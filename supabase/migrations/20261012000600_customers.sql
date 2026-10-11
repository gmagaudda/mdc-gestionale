create table public.customers (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null check(length(trim(legal_name)) between 1 and 200),
  trade_name text not null default '', vat_number text not null default '' check(vat_number='' or vat_number ~ '^[0-9]{11}$'),
  tax_code text not null default '', sdi_code text not null default '' check(sdi_code='' or sdi_code ~ '^[A-Z0-9]{7}$'), pec text not null default '',
  billing_address jsonb not null default '{}', shipping_address jsonb not null default '{}',
  city text not null default '', country text not null default 'IT',payment_terms text not null default '',notes text not null default '',
  external_code text,deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index customers_external_code on public.customers(external_code) where external_code is not null and deleted_at is null;
create index customers_legal_name on public.customers(legal_name) where deleted_at is null;
create table public.customer_contacts (
  id uuid primary key default gen_random_uuid(),customer_id uuid not null references public.customers(id),
  name text not null check(length(trim(name)) between 1 and 200),role_title text not null default '',email text not null default '',phone text not null default '',
  deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index customer_contacts_customer_id on public.customer_contacts(customer_id);
alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
create policy customers_read on public.customers for select to authenticated using(app.is_internal());
create policy customers_insert on public.customers for insert to authenticated with check(app.current_role() in ('admin','staff'));
create policy customers_update on public.customers for update to authenticated using(app.current_role() in ('admin','staff')) with check(app.current_role() in ('admin','staff'));
create policy customer_contacts_read on public.customer_contacts for select to authenticated using(app.is_internal());
create policy customer_contacts_insert on public.customer_contacts for insert to authenticated with check(app.current_role() in ('admin','staff') and exists(select 1 from public.customers where id=customer_id and deleted_at is null));
create policy customer_contacts_update on public.customer_contacts for update to authenticated using(app.current_role() in ('admin','staff')) with check(app.current_role() in ('admin','staff') and exists(select 1 from public.customers where id=customer_id and deleted_at is null));
create trigger customers_updated before update on public.customers for each row execute function app.set_updated_at();
create trigger customer_contacts_updated before update on public.customer_contacts for each row execute function app.set_updated_at();
create trigger customers_audit after insert or update on public.customers for each row execute function app.audit_row_change();
create trigger customer_contacts_audit after insert or update on public.customer_contacts for each row execute function app.audit_row_change();
