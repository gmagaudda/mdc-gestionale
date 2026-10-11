-- Base role model. Business tables are added by later migrations.
create type public.app_role as enum ('admin', 'staff', 'accounting', 'brand');
create type public.order_status as enum ('draft', 'confirmed', 'in_production', 'shipped', 'delivered', 'invoiced', 'cancelled');
create type public.event_type as enum ('appointment', 'campaign', 'delivery', 'payment_due', 'other');
create type public.invoice_status as enum ('draft', 'issued', 'sent', 'paid', 'cancelled', 'rejected');
create type public.document_kind as enum ('catalog', 'lookbook', 'price_list', 'order_confirmation', 'contract', 'other');

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated;

create function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'brand',
  full_name text not null default '',
  email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function app.set_updated_at();

create function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

create function app.current_role()
returns public.app_role
language sql stable security definer
set search_path = ''
as $$
  select role from public.profiles
  where id = auth.uid() and is_active = true
$$;

create function app.is_internal()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(app.current_role() in ('admin', 'staff', 'accounting'), false)
$$;

revoke all on function app.current_role() from public;
revoke all on function app.is_internal() from public;
grant execute on function app.current_role() to authenticated;
grant execute on function app.is_internal() to authenticated;

alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
for select to authenticated
using (id = (select auth.uid()) or (select app.current_role()) = 'admin');

create policy profiles_admin_update on public.profiles
for update to authenticated
using ((select app.current_role()) = 'admin')
with check ((select app.current_role()) = 'admin');

-- No insert or delete policy: creation is handled by the auth trigger.
