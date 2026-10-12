create table public.order_counters (
  year integer primary key check(year between 1900 and 9999),last_number bigint not null check(last_number>0),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.orders (
  id uuid primary key default gen_random_uuid(),number text not null unique,
  brand_id uuid not null references public.brands(id),customer_id uuid not null references public.customers(id),season_id uuid not null,
  status public.order_status not null default 'draft',order_date date not null default ((now() at time zone 'Europe/Rome')::date),delivery_date date,payment_terms text not null default '',
  discount_pct numeric(5,2) not null default 0 check(discount_pct between 0 and 100),currency text not null default 'EUR' check(currency='EUR'),
  net_total_cents bigint not null default 0 check(net_total_cents between 0 and 1000000000000),vat_total_cents bigint not null default 0 check(vat_total_cents>=0),gross_total_cents bigint not null default 0 check(gross_total_cents between 0 and 1000000000000),
  created_by uuid references public.profiles(id) on delete set null,deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(id,brand_id),foreign key(season_id,brand_id) references public.seasons(id,brand_id),check(delivery_date>=order_date)
);
create index orders_brand_season_status on public.orders(brand_id,season_id,status) where deleted_at is null;
create index orders_customer on public.orders(customer_id);
create table public.order_private (
  id uuid primary key,brand_id uuid not null,internal_notes text not null default '' check(length(internal_notes)<=10000),commission_pct_override numeric(5,2) check(commission_pct_override between 0 and 100),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),foreign key(id,brand_id) references public.orders(id,brand_id)
);
create table public.order_lines (
  id uuid primary key default gen_random_uuid(),order_id uuid not null,brand_id uuid not null,variant_id uuid not null,
  quantity integer not null check(quantity between 1 and 100000),unit_price_cents bigint not null check(unit_price_cents between 0 and 1000000000000),discount_pct numeric(5,2) not null default 0 check(discount_pct between 0 and 100),
  vat_rate numeric(5,2) not null,product_name text not null,sku text not null,size text not null,color text not null,
  line_net_cents bigint not null,line_vat_cents bigint not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(order_id,variant_id),foreign key(order_id,brand_id) references public.orders(id,brand_id),foreign key(variant_id,brand_id) references public.product_variants(id,brand_id)
);
create index order_lines_order on public.order_lines(order_id);
create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),order_id uuid not null,brand_id uuid not null,from_status public.order_status,to_status public.order_status not null,
  changed_by uuid references public.profiles(id) on delete set null,changed_at timestamptz not null default now(),note text not null default '' check(length(note)<=1000),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),foreign key(order_id,brand_id) references public.orders(id,brand_id)
);
alter table public.orders enable row level security;
alter table public.order_private enable row level security;
alter table public.order_lines enable row level security;
alter table public.order_status_history enable row level security;
alter table public.order_counters enable row level security;
create policy orders_read on public.orders for select to authenticated using(app.is_internal() or (deleted_at is null and app.has_brand_access(brand_id)));
create policy orders_insert on public.orders for insert to authenticated with check(app.current_role() in ('admin','staff') and app.has_brand_access(brand_id));
create policy orders_update on public.orders for update to authenticated using(app.is_internal()) with check(app.is_internal());
create policy order_private_read on public.order_private for select to authenticated using(app.is_internal());
create policy order_private_insert on public.order_private for insert to authenticated with check(app.current_role() in ('admin','staff') and exists(select 1 from public.orders where orders.id=order_private.id and status='draft' and deleted_at is null));
create policy order_private_update on public.order_private for update to authenticated using(app.current_role() in ('admin','staff')) with check(app.current_role() in ('admin','staff') and exists(select 1 from public.orders where orders.id=order_private.id and status='draft' and deleted_at is null));
create policy order_lines_read on public.order_lines for select to authenticated using(app.is_internal() or (app.has_brand_access(brand_id) and exists(select 1 from public.orders where orders.id=order_lines.order_id and deleted_at is null)));
create policy order_lines_insert on public.order_lines for insert to authenticated with check(app.current_role() in ('admin','staff'));
create policy order_lines_update on public.order_lines for update to authenticated using(app.current_role() in ('admin','staff')) with check(app.current_role() in ('admin','staff'));
create policy order_lines_delete on public.order_lines for delete to authenticated using(app.current_role() in ('admin','staff'));
create policy order_history_read on public.order_status_history for select to authenticated using(app.is_internal());
create policy order_counters_read on public.order_counters for select to authenticated using(app.is_internal());
revoke insert,update,delete on public.order_status_history,public.order_counters from authenticated;

create function app.guard_order() returns trigger
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
    if app.current_role()='accounting' then
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
      if not v_allowed then raise exception 'invalid status transition' using errcode='23514'; end if;
      if new.status='confirmed' and not exists(select 1 from public.order_lines where order_id=old.id) then raise exception 'cannot confirm an empty order' using errcode='23514'; end if;
    end if;
    if new.deleted_at is distinct from old.deleted_at and (old.status not in ('draft','cancelled') or old.deleted_at is not null) then raise exception 'cannot archive this order' using errcode='23514'; end if;
  end if;
  new.updated_at:=now();return new;
end; $$;
create trigger orders_guard before insert or update on public.orders for each row execute function app.guard_order();

create function app.calculate_order_line() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_order public.orders;v_variant record;
begin
  -- Direct database operators may remove synthetic fixtures/restore data.
  -- Authenticated and service-role API requests still enforce draft-only edits.
  if tg_op='DELETE' and current_user='postgres' then return old; end if;
  if app.current_role() not in ('admin','staff') or app.current_role() is null then raise exception 'forbidden' using errcode='42501'; end if;
  select * into v_order from public.orders where id=case when tg_op='DELETE' then old.order_id else new.order_id end for update;
  if v_order.id is null or v_order.status<>'draft' or v_order.deleted_at is not null then raise exception 'order lines require an active draft' using errcode='23514'; end if;
  if tg_op='DELETE' then return old; end if;
  if tg_op='UPDATE' and (new.id<>old.id or new.order_id<>old.order_id or new.brand_id<>old.brand_id or new.variant_id<>old.variant_id) then raise exception 'immutable line identity' using errcode='23514'; end if;
  if tg_op='INSERT' then
    select v.*,p.vat_rate,p.name,p.season_id into v_variant from public.product_variants v join public.products p on p.id=v.product_id
      where v.id=new.variant_id and v.brand_id=new.brand_id and p.season_id=v_order.season_id and v.deleted_at is null and p.deleted_at is null;
    if not found then raise exception 'invalid variant' using errcode='23514'; end if;
    new.vat_rate:=v_variant.vat_rate;new.product_name:=v_variant.name;new.sku:=v_variant.sku;new.size:=v_variant.size;new.color:=v_variant.color;
  else
    new.vat_rate:=old.vat_rate;new.product_name:=old.product_name;new.sku:=old.sku;new.size:=old.size;new.color:=old.color;
  end if;
  new.line_net_cents:=round(new.quantity::numeric*new.unit_price_cents*(100-new.discount_pct)*(100-v_order.discount_pct)/10000)::bigint;
  new.line_vat_cents:=round(new.line_net_cents::numeric*new.vat_rate/100)::bigint;
  new.updated_at:=now();return new;
end; $$;
create trigger order_line_calculate before insert or update or delete on public.order_lines for each row execute function app.calculate_order_line();
create function public.recalculate_order_totals(p_order_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if app.current_role() not in ('admin','staff') or app.current_role() is null then raise exception 'forbidden' using errcode='42501'; end if;
  -- guard_order derives all three totals from the current lines, ignoring supplied totals.
  update public.orders set updated_at=now() where id=p_order_id;
end; $$;
revoke all on function public.recalculate_order_totals(uuid) from public,anon;
grant execute on function public.recalculate_order_totals(uuid) to authenticated;
create function app.refresh_order_totals() returns trigger language plpgsql set search_path='' as $$
begin perform public.recalculate_order_totals(case when tg_op='DELETE' then old.order_id else new.order_id end);return null;end; $$;
create trigger order_lines_totals after insert or update or delete on public.order_lines for each row execute function app.refresh_order_totals();
create function app.refresh_discounted_lines() returns trigger language plpgsql set search_path='' as $$
begin update public.order_lines set updated_at=now() where order_id=new.id;return null;end; $$;
create trigger orders_discount after update of discount_pct on public.orders for each row when(old.discount_pct is distinct from new.discount_pct) execute function app.refresh_discounted_lines();
create function app.record_order_status() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then insert into public.order_status_history(order_id,brand_id,to_status,changed_by) values(new.id,new.brand_id,new.status,auth.uid());
  elsif old.status<>new.status then insert into public.order_status_history(order_id,brand_id,from_status,to_status,changed_by,note) values(new.id,new.brand_id,old.status,new.status,auth.uid(),coalesce(current_setting('app.status_note',true),'')); end if;
  return null;
end; $$;
create trigger orders_status after insert or update on public.orders for each row execute function app.record_order_status();
create trigger orders_audit after insert or update on public.orders for each row execute function app.audit_row_change();
create trigger order_lines_audit after insert or update or delete on public.order_lines for each row execute function app.audit_row_change();
create trigger order_private_updated before update on public.order_private for each row execute function app.set_updated_at();
create trigger order_private_audit after insert or update on public.order_private for each row execute function app.audit_row_change();
create trigger order_history_audit after insert on public.order_status_history for each row execute function app.audit_row_change();

create function public.save_order(p_id uuid,p_data jsonb,p_lines jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_id uuid;v_order public.orders;v_line jsonb;v_variants uuid[];
begin
  if app.current_role() not in ('admin','staff') or app.current_role() is null then raise exception 'forbidden' using errcode='42501'; end if;
  if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)>500 then raise exception 'invalid lines' using errcode='23514'; end if;
  select coalesce(array_agg((x->>'variant_id')::uuid),'{}') into v_variants from jsonb_array_elements(p_lines) x;
  if cardinality(v_variants)<>(select count(distinct x) from unnest(v_variants) x) then raise exception 'duplicate variants' using errcode='23514'; end if;
  if p_id is null then
    insert into public.orders(number,brand_id,customer_id,season_id,order_date,delivery_date,payment_terms,discount_pct)
    values('',(p_data->>'brand_id')::uuid,(p_data->>'customer_id')::uuid,(p_data->>'season_id')::uuid,(p_data->>'order_date')::date,nullif(p_data->>'delivery_date','')::date,coalesce(p_data->>'payment_terms',''),(p_data->>'discount_pct')::numeric) returning id into v_id;
  else
    select * into v_order from public.orders where id=p_id and deleted_at is null for update;
    if not found or v_order.status<>'draft' then raise exception 'draft unavailable' using errcode='P0002'; end if;
    if v_order.brand_id<>(p_data->>'brand_id')::uuid or v_order.season_id<>(p_data->>'season_id')::uuid then raise exception 'immutable brand or season' using errcode='23514'; end if;
    update public.orders set customer_id=(p_data->>'customer_id')::uuid,order_date=(p_data->>'order_date')::date,delivery_date=nullif(p_data->>'delivery_date','')::date,payment_terms=coalesce(p_data->>'payment_terms',''),discount_pct=(p_data->>'discount_pct')::numeric where id=p_id returning id into v_id;
  end if;
  insert into public.order_private(id,brand_id,internal_notes,commission_pct_override) values(v_id,(p_data->>'brand_id')::uuid,coalesce(p_data->>'internal_notes',''),nullif(p_data->>'commission_pct_override','')::numeric)
    on conflict(id) do update set internal_notes=excluded.internal_notes,commission_pct_override=excluded.commission_pct_override;
  delete from public.order_lines where order_id=v_id and not(variant_id=any(v_variants));
  for v_line in select value from jsonb_array_elements(p_lines) loop
    update public.order_lines set quantity=(v_line->>'quantity')::integer,unit_price_cents=(v_line->>'unit_price_cents')::bigint,discount_pct=(v_line->>'discount_pct')::numeric where order_id=v_id and variant_id=(v_line->>'variant_id')::uuid;
    if not found then
      insert into public.order_lines(order_id,brand_id,variant_id,quantity,unit_price_cents,discount_pct)
      values(v_id,(p_data->>'brand_id')::uuid,(v_line->>'variant_id')::uuid,(v_line->>'quantity')::integer,(v_line->>'unit_price_cents')::bigint,(v_line->>'discount_pct')::numeric);
    end if;
  end loop;
  perform public.recalculate_order_totals(v_id);return v_id;
end; $$;
revoke all on function public.save_order(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_order(uuid,jsonb,jsonb) to authenticated;
create function public.change_order_status(p_id uuid,p_status public.order_status,p_note text default '') returns void language plpgsql security invoker set search_path='' as $$
begin
  if not app.is_internal() then raise exception 'forbidden' using errcode='42501'; end if;
  if length(p_note)>1000 then raise exception 'invalid note' using errcode='23514'; end if;
  perform set_config('app.status_note',p_note,true);
  update public.orders set status=p_status where id=p_id and deleted_at is null;
  if not found then raise exception 'order unavailable' using errcode='P0002'; end if;
  perform set_config('app.status_note','',true);
end; $$;
revoke all on function public.change_order_status(uuid,public.order_status,text) from public,anon;
grant execute on function public.change_order_status(uuid,public.order_status,text) to authenticated;

-- The only customer data available to brands is derived from an authorized order.
create function app.portal_customer(p_order_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('name',case when b.can_see_customer_names then c.legal_name else 'Cliente riservato' end,'city',case when b.can_see_customer_names then c.city else '' end)
  from public.orders o join public.brands b on b.id=o.brand_id join public.customers c on c.id=o.customer_id
  where o.id=p_order_id and o.deleted_at is null and app.has_brand_access(o.brand_id)
$$;
revoke all on function app.portal_customer(uuid) from public,anon;
grant execute on function app.portal_customer(uuid) to authenticated;
create view public.portal_orders with(security_invoker=true) as
select o.id,o.number,o.brand_id,o.season_id,o.status,o.order_date,o.delivery_date,o.currency,o.net_total_cents,o.vat_total_cents,o.gross_total_cents,
  app.portal_customer(o.id)->>'name' as customer_display_name,app.portal_customer(o.id)->>'city' as customer_city
from public.orders o where o.deleted_at is null;
