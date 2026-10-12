-- Extend the read model introduced in M5. Legacy/read-model rows retain null snapshots.
alter table public.invoices
 add column provider text check(provider in('mock','fic')),
 add column idempotency_key uuid not null default gen_random_uuid() unique,
 add column supplier_snapshot jsonb,
 add column customer_snapshot jsonb,
 add column lines_snapshot jsonb,
 add column currency text not null default 'EUR' check(currency='EUR'),
 add column order_discount_pct numeric(5,2) not null default 0 check(order_discount_pct between 0 and 100),
 add column payment_terms text not null default '' check(length(payment_terms)<=500),
 add constraint invoices_snapshot_shape check(
  (provider is null and supplier_snapshot is null and customer_snapshot is null and lines_snapshot is null)
  or (provider is not null and order_id is not null
   and supplier_snapshot is not null and jsonb_typeof(supplier_snapshot)='object'
   and customer_snapshot is not null and jsonb_typeof(customer_snapshot)='object'
   and lines_snapshot is not null and jsonb_typeof(lines_snapshot)='array'
   and jsonb_array_length(lines_snapshot) between 1 and 5000));
create unique index invoices_provider_external on public.invoices(provider,external_id) where external_id is not null;
create function app.guard_invoice_snapshot() returns trigger language plpgsql set search_path='' as $$
declare party jsonb;line jsonb;v_net numeric:=0;v_vat numeric:=0;
begin
 if TG_OP='DELETE' then raise exception 'invoices cannot be deleted' using errcode='42501';end if;
 if TG_OP='UPDATE' and
  (new.id,new.brand_id,new.customer_id,new.order_id,new.number,new.issue_date,new.due_date,new.net_cents,new.vat_cents,new.gross_cents,new.currency,new.order_discount_pct,new.payment_terms,new.provider,new.idempotency_key,new.supplier_snapshot,new.customer_snapshot,new.lines_snapshot)
  is distinct from
  (old.id,old.brand_id,old.customer_id,old.order_id,old.number,old.issue_date,old.due_date,old.net_cents,old.vat_cents,old.gross_cents,old.currency,old.order_discount_pct,old.payment_terms,old.provider,old.idempotency_key,old.supplier_snapshot,old.customer_snapshot,old.lines_snapshot) then
  raise exception 'invoice snapshot is immutable' using errcode='23514';
 end if;
 if TG_OP='INSERT' and new.provider is not null then
  foreach party in array array[new.supplier_snapshot,new.customer_snapshot] loop
   if party is null or jsonb_typeof(party)<>'object' or jsonb_typeof(party->'legal_name') is distinct from 'string' or length(trim(party->>'legal_name')) not between 1 and 200 or jsonb_typeof(party->'address') is distinct from 'object' then
    raise exception 'invalid fiscal snapshot' using errcode='23514';
   end if;
  end loop;
  if new.lines_snapshot is null or jsonb_typeof(new.lines_snapshot)<>'array' then raise exception 'invalid line snapshot' using errcode='23514';end if;
  for line in select * from jsonb_array_elements(new.lines_snapshot) loop
   if jsonb_typeof(line->'name') is distinct from 'string' or length(trim(line->>'name')) not between 1 and 200
    or coalesce(line->>'quantity','') !~ '^[1-9][0-9]{0,5}$' or (line->>'quantity')::integer>100000
    or coalesce(line->>'net_cents','') !~ '^[0-9]{1,13}$' or (line->>'net_cents')::numeric>1000000000000
    or coalesce(line->>'vat_cents','') !~ '^[0-9]{1,13}$' or (line->>'vat_cents')::numeric>1000000000000 then
    raise exception 'invalid line snapshot' using errcode='23514';
   end if;
   v_net:=v_net+(line->>'net_cents')::numeric;v_vat:=v_vat+(line->>'vat_cents')::numeric;
  end loop;
  if v_net<>new.net_cents or v_vat<>new.vat_cents then raise exception 'snapshot totals mismatch' using errcode='23514';end if;
 end if;
 return new;
end;$$;
create trigger invoices_snapshot_guard before insert or update or delete on public.invoices for each row execute function app.guard_invoice_snapshot();
revoke delete on public.invoices from anon,authenticated;

create table public.payments (
 id uuid primary key default gen_random_uuid(),
 invoice_id uuid not null,
 brand_id uuid not null,
 amount_cents bigint not null check(amount_cents between 1 and 2000000000000),
 paid_at timestamptz not null,
 method text not null check(method in('bank_transfer','cash','card','other')),
 note text not null default '' check(length(note)<=1000),
 idempotency_key uuid not null default gen_random_uuid(),
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 foreign key(invoice_id,brand_id) references public.invoices(id,brand_id),
 unique(invoice_id,idempotency_key)
);
create index payments_invoice on public.payments(invoice_id,paid_at,id);
alter table public.payments enable row level security;
create policy payments_read on public.payments for select to authenticated using(app.is_internal());
-- Registration is added as a bounded, transactional RPC in M7-T2. No direct writes.
revoke insert,update,delete on public.payments from anon,authenticated;
create function app.guard_payment_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' and pg_trigger_depth()>1 and old.created_by is not null and new.created_by is null
  and (to_jsonb(new)-'created_by')=(to_jsonb(old)-'created_by') then return new;end if;
 raise exception 'payment is immutable' using errcode='42501';
end;$$;
create trigger payments_immutable before update or delete on public.payments for each row execute function app.guard_payment_immutable();
create trigger payments_audit after insert on public.payments for each row execute function app.audit_row_change();
revoke all on function app.guard_invoice_snapshot(),app.guard_payment_immutable() from public;
