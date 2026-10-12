alter table public.invoices
 add column processing_kind text not null default 'issue' check(processing_kind in('issue','cancel')),
 add column processing_status text not null default 'pending' check(processing_status in('pending','processing','completed','failed')),
 add column processing_lease uuid,
 add column processing_started_at timestamptz,
 add column processing_error text check(processing_error in('provider_unavailable','provider_rejected','invalid_input'));
create unique index invoices_one_per_order on public.invoices(order_id) where provider is not null;
create table public.invoice_counters (
 id uuid not null unique default gen_random_uuid(),brand_id uuid not null references public.brands(id),
 year integer not null check(year between 1900 and 9999),last_number bigint not null check(last_number>0),
 primary key(brand_id,year),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.invoice_counters enable row level security;
create policy invoice_counters_read on public.invoice_counters for select to authenticated using(app.is_internal());
revoke insert,update,delete on public.invoice_counters from anon,authenticated;
create table public.mock_invoice_records (
 id uuid primary key,brand_id uuid not null,idempotency_key uuid not null unique,
 external_id text not null unique check(external_id='mock_'||id::text),
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),status public.invoice_status not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(id,brand_id) references public.invoices(id,brand_id)
);
alter table public.mock_invoice_records enable row level security;
create policy mock_invoice_records_read on public.mock_invoice_records for select to authenticated using(app.current_role() in('admin','accounting'));
revoke insert,update,delete on public.mock_invoice_records from anon,authenticated;
create trigger mock_invoice_records_updated before update on public.mock_invoice_records for each row execute function app.set_updated_at();
create trigger mock_invoice_records_audit after insert or update on public.mock_invoice_records for each row execute function app.audit_row_change();
create table public.invoice_webhook_events (
 id uuid primary key default gen_random_uuid(),event_id text not null check(length(event_id) between 1 and 200),
 provider text not null check(provider in('mock','fic')),invoice_id uuid not null,brand_id uuid not null,
 external_status public.invoice_status not null,created_at timestamptz not null default now(),
 unique(provider,event_id),foreign key(invoice_id,brand_id) references public.invoices(id,brand_id)
);
alter table public.invoice_webhook_events enable row level security;
create policy invoice_webhook_events_read on public.invoice_webhook_events for select to authenticated using(app.current_role() in('admin','accounting'));
revoke insert,update,delete on public.invoice_webhook_events from anon,authenticated;
create trigger invoice_webhook_events_audit after insert on public.invoice_webhook_events for each row execute function app.audit_row_change();

create function app.require_billing_role() returns void language plpgsql stable set search_path='' as $$
begin if app.current_role() is null or app.current_role() not in('admin','accounting') then raise exception 'forbidden' using errcode='42501';end if;end;$$;
revoke all on function app.require_billing_role() from public;
create function app.invoice_state_allows(p_from public.invoice_status,p_to public.invoice_status) returns boolean language sql immutable set search_path='' as $$
 select p_from=p_to or case p_from when 'draft' then p_to in('issued','sent','paid','cancelled','rejected') when 'issued' then p_to in('sent','paid','cancelled','rejected') when 'sent' then p_to in('paid','cancelled','rejected') else false end
$$;
revoke all on function app.invoice_state_allows(public.invoice_status,public.invoice_status) from public;

create function public.reserve_invoice_from_order(p_order_id uuid,p_issue_date date,p_due_date date,p_provider text) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders;c public.customers;b public.brands;bp public.brand_private;v_id uuid;v_next bigint;v_supplier jsonb;v_customer jsonb;v_lines jsonb;v_count bigint;
begin
 perform app.require_billing_role();
 if p_order_id is null or p_issue_date is null or p_due_date is null or p_due_date<p_issue_date or extract(year from p_issue_date) not between 1900 and 9999 or p_provider is null or p_provider not in('mock','fic') then raise exception 'invalid input' using errcode='22023';end if;
 select * into o from public.orders where id=p_order_id and deleted_at is null for update;
 if not found or not app.has_brand_access(o.brand_id) then raise exception 'not found' using errcode='P0002';end if;
 select id into v_id from public.invoices where order_id=o.id and provider is not null;
 if v_id is not null then
  if not exists(select 1 from public.invoices where id=v_id and provider=p_provider and issue_date=p_issue_date and due_date=p_due_date) then raise exception 'invoice input conflict' using errcode='23505';end if;
  return v_id;end if;
 if o.status<>'delivered' then raise exception 'order must be delivered' using errcode='23514';end if;
 select * into c from public.customers where id=o.customer_id;
 select * into b from public.brands where id=o.brand_id;
 select * into bp from public.brand_private where id=o.brand_id;
 v_supplier:=jsonb_build_object('legal_name',coalesce(nullif(b.legal_name,''),b.name),'vat_number',coalesce(bp.vat_number,''),'tax_code',coalesce(bp.tax_code,''),'sdi_code','','pec','','address',jsonb_build_object('street',coalesce(bp.address,''),'postal_code','','city',coalesce(bp.city,''),'province','','country',coalesce(bp.country,'IT')));
 v_customer:=jsonb_build_object('legal_name',c.legal_name,'vat_number',c.vat_number,'tax_code',c.tax_code,'sdi_code',c.sdi_code,'pec',c.pec,'address',jsonb_build_object('street',coalesce(c.billing_address->>'street',''),'postal_code',coalesce(c.billing_address->>'postal_code',''),'city',coalesce(c.billing_address->>'city',c.city),'province',coalesce(c.billing_address->>'province',''),'country',coalesce(c.billing_address->>'country',c.country)));
 select count(*),jsonb_agg(jsonb_build_object('name',product_name,'sku',sku,'variant',color||' / '||size,'quantity',quantity,'unit_price_cents',unit_price_cents,'discount_pct',discount_pct,'vat_rate',vat_rate,'net_cents',line_net_cents,'vat_cents',line_vat_cents) order by product_name,sku,id) into v_count,v_lines from public.order_lines where order_id=o.id;
 if v_count not between 1 and 5000 then raise exception 'invalid line count' using errcode='23514';end if;
 insert into public.invoice_counters(brand_id,year,last_number) values(o.brand_id,extract(year from p_issue_date)::integer,1)
 on conflict(brand_id,year) do update set last_number=public.invoice_counters.last_number+1,updated_at=now() returning last_number into v_next;
 insert into public.invoices(number,brand_id,customer_id,order_id,issue_date,due_date,net_cents,vat_cents,gross_cents,provider,supplier_snapshot,customer_snapshot,lines_snapshot,payment_terms,order_discount_pct)
 values('F-'||extract(year from p_issue_date)::text||'/'||lpad(v_next::text,greatest(5,length(v_next::text)),'0'),o.brand_id,o.customer_id,o.id,p_issue_date,p_due_date,o.net_total_cents,o.vat_total_cents,o.gross_total_cents,p_provider,v_supplier,v_customer,v_lines,o.payment_terms,o.discount_pct) returning id into v_id;
 return v_id;
end;$$;

create function public.claim_invoice_issue(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invoices;v_lease uuid:=gen_random_uuid();begin
 perform app.require_billing_role();
 select * into i from public.invoices where id=p_id and provider is not null for update;
 if not found then raise exception 'not found' using errcode='P0002';end if;
 if i.processing_kind='cancel' then raise exception 'cancellation pending' using errcode='55P03';end if;
 if i.status<>'draft' or i.processing_status='completed' then return null;end if;
 if i.processing_status='processing' and i.processing_started_at>now()-interval '10 minutes' then raise exception 'processing' using errcode='55P03';end if;
 update public.invoices set processing_kind='issue',processing_status='processing',processing_started_at=now(),processing_lease=v_lease,processing_error=null where id=i.id;
 return v_lease;
end;$$;
create function public.fail_invoice_issue(p_id uuid,p_lease uuid,p_error text) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;begin
 perform app.require_billing_role();
 if p_error is null or p_error not in('provider_unavailable','provider_rejected','invalid_input') then raise exception 'invalid error' using errcode='22023';end if;
 update public.invoices set processing_status='failed',processing_error=p_error where id=p_id and processing_lease=p_lease and processing_status='processing';
 get diagnostics n=row_count;return n=1;
end;$$;
create function public.mock_invoice_put(p_id uuid,p_key uuid,p_fingerprint text,p_status public.invoice_status) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.invoices;r public.mock_invoice_records;begin
 perform app.require_billing_role();
 select * into i from public.invoices where id=p_id and provider='mock' for update;
 if not found then raise exception 'not found' using errcode='P0002';end if;
 if p_key is distinct from i.idempotency_key or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' or p_status is null then raise exception 'invalid input' using errcode='22023';end if;
 select * into r from public.mock_invoice_records where id=i.id;
 if found then
  if r.fingerprint<>p_fingerprint then raise exception 'idempotency conflict' using errcode='23505';end if;
 else
  insert into public.mock_invoice_records(id,brand_id,idempotency_key,external_id,fingerprint,status) values(i.id,i.brand_id,i.idempotency_key,'mock_'||i.id::text,p_fingerprint,p_status) returning * into r;
 end if;
 return jsonb_build_object('externalId',r.external_id,'idempotencyKey',r.idempotency_key,'fingerprint',r.fingerprint,'status',r.status);
end;$$;
create function public.mock_invoice_transition(p_external_id text,p_status public.invoice_status) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.mock_invoice_records;begin
 perform app.require_billing_role();
 select * into r from public.mock_invoice_records where external_id=p_external_id for update;
 if not found then raise exception 'not found' using errcode='P0002';end if;
 if p_status is null or not app.invoice_state_allows(r.status,p_status) then raise exception 'invalid transition' using errcode='23514';end if;
 update public.mock_invoice_records set status=p_status where id=r.id returning * into r;
 return jsonb_build_object('externalId',r.external_id,'idempotencyKey',r.idempotency_key,'fingerprint',r.fingerprint,'status',r.status);
end;$$;
-- Shared reconciliation called only through narrowly authorized wrappers.
create function app.apply_invoice_status(p_id uuid,p_external_id text,p_status public.invoice_status) returns void language plpgsql security definer set search_path='' as $$
declare i public.invoices;v_status public.invoice_status;v_paid numeric;begin
 select * into i from public.invoices where id=p_id for update;
 if not found or i.provider is null then raise exception 'not found' using errcode='P0002';end if;
 if p_external_id is null or length(p_external_id) not between 1 and 200 or p_status is null or (i.external_id is not null and i.external_id<>p_external_id) then raise exception 'invalid provider reference' using errcode='22023';end if;
 select coalesce(sum(amount_cents),0) into v_paid from public.payments where invoice_id=i.id;
 if p_status in('cancelled','rejected') and v_paid>0 then raise exception 'invoice has payments' using errcode='23514';end if;
 -- Terminal or newer business states cannot regress on delayed provider callbacks.
 if i.external_status is not null and not app.invoice_state_allows(i.external_status::public.invoice_status,p_status) then return;end if;
 v_status:=case when p_status in('issued','sent','paid') and v_paid=i.gross_cents then 'paid'::public.invoice_status when p_status='paid' and v_paid<i.gross_cents then case when i.status in('draft','issued') then 'issued'::public.invoice_status else i.status end else p_status end;
 if not app.invoice_state_allows(i.status,v_status) then return;end if;
 update public.invoices set status=v_status,external_id=p_external_id,external_status=p_status::text,
 processing_status=case when processing_kind='cancel' and p_status in('paid','cancelled','rejected') then 'completed' else processing_status end,
 processing_kind=case when processing_kind='cancel' and p_status='paid' then 'issue' else processing_kind end where id=i.id;
 if v_status in('issued','sent','paid') then
  update public.orders set status='invoiced' where id=i.order_id and status='delivered';
 end if;
end;$$;
revoke all on function app.apply_invoice_status(uuid,text,public.invoice_status) from public;
create function public.finish_invoice_issue(p_id uuid,p_lease uuid,p_external_id text,p_status public.invoice_status) returns boolean language plpgsql security definer set search_path='' as $$
declare i public.invoices;begin
 perform app.require_billing_role();select * into i from public.invoices where id=p_id for update;
 if not found or i.processing_lease is distinct from p_lease or p_lease is null or i.processing_status<>'processing' or i.processing_kind<>'issue' then return false;end if;
 if i.provider='mock' and not exists(select 1 from public.mock_invoice_records r where r.id=i.id and r.external_id=p_external_id and r.status=p_status) then raise exception 'unknown mock reference' using errcode='23514';end if;
 perform app.apply_invoice_status(i.id,p_external_id,p_status);
 update public.invoices set processing_status='completed',processing_error=case when p_status='rejected' then 'provider_rejected' else null end where id=i.id;
 return true;
end;$$;
create function public.reconcile_invoice_status(p_id uuid,p_external_id text,p_status public.invoice_status) returns void language plpgsql security definer set search_path='' as $$
begin perform app.require_billing_role();perform app.apply_invoice_status(p_id,p_external_id,p_status);end;$$;

create function public.register_invoice_payment(p_id uuid,p_key uuid,p_amount bigint,p_paid_at timestamptz,p_method text,p_note text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invoices;p public.payments;v_total numeric;v_id uuid;begin
 perform app.require_billing_role();
 if p_key is null or p_amount is null or p_amount<=0 or p_amount>2000000000000 or p_paid_at is null or p_method is null or p_method not in('bank_transfer','cash','card','other') or p_note is null or length(p_note)>1000 then raise exception 'invalid payment' using errcode='22023';end if;
 select * into i from public.invoices where id=p_id for update;
 if not found then raise exception 'not found' using errcode='P0002';end if;
 select * into p from public.payments where invoice_id=i.id and idempotency_key=p_key;
 if found then
  if (p.amount_cents,p.paid_at,p.method,p.note) is distinct from (p_amount,p_paid_at,p_method,p_note) then raise exception 'idempotency conflict' using errcode='23505';end if;
  return p.id;
 end if;
 if i.processing_kind='cancel' and i.processing_status in('processing','failed') then raise exception 'cancellation pending' using errcode='55P03';end if;
 if i.status not in('issued','sent') then raise exception 'invoice is not payable' using errcode='23514';end if;
 select coalesce(sum(amount_cents),0) into v_total from public.payments where invoice_id=i.id;
 if v_total+p_amount>i.gross_cents then raise exception 'payment exceeds balance' using errcode='23514';end if;
 insert into public.payments(invoice_id,brand_id,amount_cents,paid_at,method,note,idempotency_key,created_by) values(i.id,i.brand_id,p_amount,p_paid_at,p_method,p_note,p_key,auth.uid()) returning id into v_id;
 if v_total+p_amount=i.gross_cents then
  update public.invoices set status='paid',external_status=case when provider='mock' then 'paid' else external_status end where id=i.id;
  update public.mock_invoice_records set status='paid' where id=i.id and status in('issued','sent');
 end if;
 return v_id;
end;$$;
create function public.apply_invoice_webhook(p_provider text,p_event_id text,p_external_id text,p_status public.invoice_status) returns boolean language plpgsql security definer set search_path='' as $$
declare i public.invoices;existing public.invoice_webhook_events;begin
 if p_provider is null or p_provider not in('mock','fic') or p_event_id is null or length(p_event_id) not between 1 and 200 or p_status is null then raise exception 'invalid event' using errcode='22023';end if;
 select * into i from public.invoices where provider=p_provider and external_id=p_external_id for update;
 if not found then raise exception 'not found' using errcode='P0002';end if;
 select * into existing from public.invoice_webhook_events where provider=p_provider and event_id=p_event_id;
 if found then
  if existing.invoice_id<>i.id or existing.external_status<>p_status then raise exception 'event conflict' using errcode='23505';end if;
  return false;
 end if;
 perform app.apply_invoice_status(i.id,p_external_id,p_status);
 insert into public.invoice_webhook_events(event_id,provider,invoice_id,brand_id,external_status) values(p_event_id,p_provider,i.id,i.brand_id,p_status);
 -- Keep the simulation durable across isolates and status polling.
 update public.mock_invoice_records set status=p_status where id=i.id and app.invoice_state_allows(status,p_status);
 return true;
end;$$;
revoke all on function public.apply_invoice_webhook(text,text,text,public.invoice_status) from public,anon,authenticated;
grant execute on function public.apply_invoice_webhook(text,text,text,public.invoice_status) to service_role;
revoke all on function public.reserve_invoice_from_order(uuid,date,date,text),public.claim_invoice_issue(uuid),public.fail_invoice_issue(uuid,uuid,text),public.mock_invoice_put(uuid,uuid,text,public.invoice_status),public.mock_invoice_transition(text,public.invoice_status),public.finish_invoice_issue(uuid,uuid,text,public.invoice_status),public.reconcile_invoice_status(uuid,text,public.invoice_status),public.register_invoice_payment(uuid,uuid,bigint,timestamptz,text,text) from public,anon;
grant execute on function public.reserve_invoice_from_order(uuid,date,date,text),public.claim_invoice_issue(uuid),public.fail_invoice_issue(uuid,uuid,text),public.mock_invoice_put(uuid,uuid,text,public.invoice_status),public.mock_invoice_transition(text,public.invoice_status),public.finish_invoice_issue(uuid,uuid,text,public.invoice_status),public.reconcile_invoice_status(uuid,text,public.invoice_status),public.register_invoice_payment(uuid,uuid,bigint,timestamptz,text,text) to authenticated;

-- Enforce an actual issued invoice before the order can be marked invoiced.
create or replace function app.guard_order() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_next bigint;v_net bigint;v_vat bigint;v_allowed boolean;
begin
  -- Auth deletion clears the attribution through a FK trigger. It must not
  -- change a commercial field, nor make an archived order editable.
  if tg_op='UPDATE' and pg_trigger_depth()>1 and old.created_by is not null and new.created_by is null
    and (to_jsonb(new)-'created_by'-'updated_at')=(to_jsonb(old)-'created_by'-'updated_at') then return new; end if;
  if tg_op='INSERT' then
    if app.current_role() not in ('admin','staff') or app.current_role() is null then raise exception 'forbidden' using errcode='42501'; end if;
    if new.status<>'draft' then raise exception 'new order must be draft' using errcode='23514'; end if;
    if not exists(select 1 from public.seasons s join public.brands b on b.id=s.brand_id where s.id=new.season_id and s.brand_id=new.brand_id and s.deleted_at is null and b.deleted_at is null)
       or not exists(select 1 from public.customers where id=new.customer_id and deleted_at is null) then raise exception 'inactive order reference' using errcode='23514'; end if;
    insert into public.order_counters(year,last_number) values(extract(year from new.order_date)::integer,1)
      on conflict(year) do update set last_number=public.order_counters.last_number+1,updated_at=now() returning last_number into v_next;
    new.number:=extract(year from new.order_date)::text||'/'||lpad(v_next::text,greatest(5,length(v_next::text)), '0');
    new.created_by:=auth.uid();new.net_total_cents:=0;new.vat_total_cents:=0;new.gross_total_cents:=0;
  else
    if old.deleted_at is not null then raise exception 'archived order is immutable' using errcode='23514'; end if;
    select coalesce(sum(line_net_cents),0),coalesce(sum(line_vat_cents),0) into v_net,v_vat from public.order_lines where order_id=old.id;
    new.net_total_cents:=v_net;new.vat_total_cents:=v_vat;new.gross_total_cents:=v_net+v_vat;
    if new.id<>old.id or new.number<>old.number or new.brand_id<>old.brand_id or new.season_id<>old.season_id or new.created_at<>old.created_at or new.created_by is distinct from old.created_by or extract(year from new.order_date)<>extract(year from old.order_date) then raise exception 'immutable order identity' using errcode='23514'; end if;
    if app.current_role()='accounting' or (auth.role()='service_role' and exists(select 1 from public.invoices where order_id=old.id and provider is not null and status in('issued','sent','paid'))) then
      if old.status<>'delivered' or new.status<>'invoiced' or (to_jsonb(new)-'status'-'updated_at')<>(to_jsonb(old)-'status'-'updated_at') then raise exception 'accounting only invoices delivered orders' using errcode='42501'; end if;
    elsif app.current_role() not in ('admin','staff') or app.current_role() is null then raise exception 'forbidden' using errcode='42501'; end if;
    if old.status<>'draft' and (new.customer_id<>old.customer_id or new.discount_pct<>old.discount_pct or new.order_date<>old.order_date or new.currency<>old.currency) then raise exception 'confirmed financial data is immutable' using errcode='23514'; end if;
    if new.customer_id<>old.customer_id and not exists(select 1 from public.customers where id=new.customer_id and deleted_at is null) then raise exception 'inactive customer' using errcode='23514'; end if;
    if new.status<>old.status then
      v_allowed:=case old.status
        when 'draft' then new.status in ('confirmed','cancelled')
        when 'confirmed' then new.status in ('in_production','cancelled')
        when 'in_production' then new.status in ('shipped','cancelled')
        when 'shipped' then new.status='delivered'
        when 'delivered' then new.status='invoiced'
        else false end;
      if new.status='invoiced' and not exists(select 1 from public.invoices where order_id=old.id and status in('issued','sent','paid')) then raise exception 'invoice required' using errcode='23514';end if;
      if not v_allowed then raise exception 'invalid status transition' using errcode='23514'; end if;
      if new.status='confirmed' and not exists(select 1 from public.order_lines where order_id=old.id) then raise exception 'cannot confirm an empty order' using errcode='23514'; end if;
    end if;
    if new.deleted_at is distinct from old.deleted_at and (old.status not in ('draft','cancelled') or old.deleted_at is not null) then raise exception 'cannot archive this order' using errcode='23514'; end if;
  end if;
  new.updated_at:=now();return new;
end; $$;

create view public.v_invoice_balances with(security_invoker=true) as
 select i.id,i.number,i.brand_id,i.customer_id,i.order_id,i.status,i.provider,i.issue_date,i.due_date,i.net_cents,i.vat_cents,i.gross_cents,i.processing_status,
 coalesce(p.paid_cents,0)::text as paid_cents,(i.gross_cents-coalesce(p.paid_cents,0))::text as balance_cents,
 (i.status in('issued','sent') and i.due_date<(now() at time zone 'Europe/Rome')::date and i.gross_cents>coalesce(p.paid_cents,0)) as overdue
 from public.invoices i left join lateral(select sum(amount_cents) as paid_cents from public.payments where invoice_id=i.id)p on true;
grant select on public.v_invoice_balances to authenticated;

create function public.claim_invoice_cancellation(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invoices;v_lease uuid:=gen_random_uuid();begin
 perform app.require_billing_role();select * into i from public.invoices where id=p_id and provider is not null for update;
 if not found then raise exception 'not found' using errcode='P0002';end if;
 if i.status='cancelled' then return null;end if;
 if i.status not in('draft','issued','sent') or i.external_status in('paid','cancelled','rejected') or i.external_id is null or exists(select 1 from public.payments where invoice_id=i.id) then raise exception 'not cancellable' using errcode='23514';end if;
 if i.processing_status='processing' and i.processing_started_at>now()-interval '10 minutes' then raise exception 'processing' using errcode='55P03';end if;
 update public.invoices set processing_kind='cancel',processing_status='processing',processing_started_at=now(),processing_lease=v_lease,processing_error=null where id=i.id;
 return v_lease;
end;$$;
create function public.finish_invoice_cancellation(p_id uuid,p_lease uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare i public.invoices;begin
 perform app.require_billing_role();select * into i from public.invoices where id=p_id for update;
 if not found or p_lease is null or i.processing_lease is distinct from p_lease or i.processing_kind<>'cancel' or i.processing_status<>'processing' then return false;end if;
 if i.provider='mock' and not exists(select 1 from public.mock_invoice_records where id=i.id and status='cancelled') then raise exception 'unknown cancellation' using errcode='23514';end if;
 perform app.apply_invoice_status(i.id,i.external_id,'cancelled');
 update public.invoices set processing_status='completed',processing_error=null where id=i.id;return true;
end;$$;
revoke all on function public.claim_invoice_cancellation(uuid),public.finish_invoice_cancellation(uuid,uuid) from public,anon;
grant execute on function public.claim_invoice_cancellation(uuid),public.finish_invoice_cancellation(uuid,uuid) to authenticated;
