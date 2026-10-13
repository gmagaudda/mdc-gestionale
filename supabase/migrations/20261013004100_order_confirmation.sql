-- Private delivery ledger. Session RPCs authorize every claim and completion;
-- neither recipients nor commercial snapshots enter the public audit log.
create table app.order_confirmations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  contact_id uuid not null references public.customer_contacts(id),
  fingerprint text not null,
  recipient text not null,
  payload jsonb not null,
  state text not null default 'pending' check(state in ('pending','sent','logged','failed')),
  claimed_by uuid references public.profiles(id) on delete set null,
  lease uuid, lease_until timestamptz,
  attempts integer not null default 0 check(attempts between 0 and 3),
  created_at timestamptz not null default now(), completed_at timestamptz,
  unique(order_id,contact_id,fingerprint)
);
alter table app.order_confirmations enable row level security;
revoke all on app.order_confirmations from public,anon,authenticated,service_role;

create function public.prepare_order_confirmation(p_order_id uuid,p_contact_id uuid,p_mode text default 'log') returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.orders; c public.customer_contacts; j app.order_confirmations; v_payload jsonb; v_fingerprint text;
begin
  if coalesce(app.current_role() in ('admin','staff'),false) is not true then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_mode is null or p_mode not in ('log','resend') then raise exception 'VALIDATION' using errcode='23514'; end if;
  select * into o from public.orders where id=p_order_id and deleted_at is null for update;
  if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
  if o.status in ('draft','cancelled') then raise exception 'ORDER_UNAVAILABLE' using errcode='23514'; end if;
  select * into c from public.customer_contacts where id=p_contact_id and customer_id=o.customer_id and deleted_at is null;
  if not found or length(c.email)>254 or c.email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'RECIPIENT_UNAVAILABLE' using errcode='23514'; end if;
  select jsonb_build_object('number',o.number,'brand',b.name,'customer',cu.legal_name,'season',s.code||': '||s.name,
    'order_date',o.order_date,'delivery_date',o.delivery_date,'payment_terms',o.payment_terms,'discount_pct',o.discount_pct,
    'net_cents',o.net_total_cents::text,'vat_cents',o.vat_total_cents::text,'gross_cents',o.gross_total_cents::text,
    'lines',(select coalesce(jsonb_agg(jsonb_build_object('product',l.product_name,'sku',l.sku,'color',l.color,'size',l.size,
      'quantity',l.quantity,'unit_cents',l.unit_price_cents::text,'discount_pct',l.discount_pct,'vat_rate',l.vat_rate,
      'net_cents',l.line_net_cents::text) order by l.product_name,l.sku,l.id),'[]'::jsonb) from public.order_lines l where l.order_id=o.id))
    into v_payload from public.brands b join public.seasons s on s.id=o.season_id join public.customers cu on cu.id=o.customer_id
    where b.id=o.brand_id and b.deleted_at is null and cu.deleted_at is null and s.deleted_at is null;
  if v_payload is null then raise exception 'ORDER_UNAVAILABLE' using errcode='23514'; end if;
  if jsonb_array_length(v_payload->'lines')>500 then raise exception 'ORDER_TOO_LARGE' using errcode='54000'; end if;
  -- Commercial data and recipient identify the message; status-only transitions
  -- do not create another confirmation for unchanged commercial terms.
  -- A local simulation must not prevent a later explicit real delivery.
  v_fingerprint:=md5(v_payload::text||c.email||'|'||p_mode);
  insert into app.order_confirmations(order_id,contact_id,fingerprint,recipient,payload)
    values(o.id,c.id,v_fingerprint,c.email,v_payload) on conflict do nothing;
  select * into j from app.order_confirmations where order_id=o.id and contact_id=c.id and fingerprint=v_fingerprint for update;
  if j.state in ('sent','logged') then return jsonb_build_object('state',j.state,'duplicate',true); end if;
  if j.lease_until>now() then raise exception 'BUSY' using errcode='55P03'; end if;
  if j.attempts>=3 then raise exception 'RETRY_LIMIT' using errcode='54000'; end if;
  update app.order_confirmations set state='pending',claimed_by=auth.uid(),lease=gen_random_uuid(),lease_until=now()+interval '10 minutes',attempts=attempts+1 where id=j.id returning * into j;
  insert into public.audit_log(actor_id,action,table_name,record_id,after) values(auth.uid(),'confirmation_requested','orders',o.id,jsonb_build_object('job_id',j.id,'contact_id',c.id,'attempt',j.attempts));
  return jsonb_build_object('state','pending','id',j.id,'lease',j.lease,'recipient',j.recipient,'payload',j.payload);
end;$$;

create function public.finish_order_confirmation(p_id uuid,p_lease uuid,p_state text) returns void
language plpgsql security definer set search_path='' as $$
declare j app.order_confirmations;
begin
  if coalesce(app.current_role() in ('admin','staff'),false) is not true then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_state is null or p_state not in ('sent','logged','failed') then raise exception 'VALIDATION' using errcode='23514'; end if;
  select * into j from app.order_confirmations where id=p_id and lease=p_lease and claimed_by=auth.uid() and state='pending' for update;
  if not found then raise exception 'CONFLICT' using errcode='40001'; end if;
  update app.order_confirmations set state=p_state,lease=null,lease_until=null,completed_at=case when p_state='failed' then null else now() end where id=j.id;
  insert into public.audit_log(actor_id,action,table_name,record_id,after) values(auth.uid(),'confirmation_'||p_state,'orders',j.order_id,jsonb_build_object('job_id',j.id,'contact_id',j.contact_id,'attempt',j.attempts));
end;$$;

create function public.order_confirmation_history(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if coalesce(app.current_role() in ('admin','staff'),false) is not true then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'contact',r.name,'state',r.state,'created_at',r.created_at,'completed_at',r.completed_at) order by r.created_at desc),'[]'::jsonb)
    from (select j.id,c.name,j.state,j.created_at,j.completed_at from app.order_confirmations j join public.customer_contacts c on c.id=j.contact_id
      join public.orders o on o.id=j.order_id where o.id=p_order_id and o.deleted_at is null order by j.created_at desc limit 20) r);
end;$$;
revoke all on function public.prepare_order_confirmation(uuid,uuid,text),public.finish_order_confirmation(uuid,uuid,text),public.order_confirmation_history(uuid) from public,anon;
grant execute on function public.prepare_order_confirmation(uuid,uuid,text),public.finish_order_confirmation(uuid,uuid,text),public.order_confirmation_history(uuid) to authenticated;
