-- Fields readable by a linked brand. Internal financial/contact data is in a
-- separate RLS table, so direct REST requests cannot leak it through SELECT *.
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  legal_name text not null default '',
  can_see_customer_names boolean not null default true,
  external_code text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index brands_external_code on public.brands(external_code) where external_code is not null and deleted_at is null;
create table public.brand_private (
  id uuid primary key references public.brands(id),
  vat_number text not null default '', tax_code text not null default '',
  address text not null default '', city text not null default '', country text not null default 'IT',
  commission_pct numeric(5,2) not null default 0 check (commission_pct between 0 and 100),
  notes text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.brand_users (
  brand_id uuid not null references public.brands(id),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(brand_id,user_id)
);
create index brand_users_user_id on public.brand_users(user_id,brand_id);
create table public.brand_contacts (
  id uuid primary key default gen_random_uuid(), brand_id uuid not null references public.brands(id),
  name text not null, role_title text not null default '', email text not null default '', phone text not null default '',
  deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index brand_contacts_brand_id on public.brand_contacts(brand_id);
create function app.has_brand_access(p_brand_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.brands b where b.id=p_brand_id and b.deleted_at is null and
    (app.is_internal() or (app.current_role()='brand' and exists(select 1 from public.brand_users bu where bu.brand_id=b.id and bu.user_id=auth.uid()))))
$$;
revoke all on function app.has_brand_access(uuid) from public;
grant execute on function app.has_brand_access(uuid) to authenticated;
create function public.has_brand_access(p_brand_id uuid) returns boolean language sql stable security invoker set search_path = '' as $$ select app.has_brand_access(p_brand_id) $$;
revoke all on function public.has_brand_access(uuid) from public;
grant execute on function public.has_brand_access(uuid) to authenticated;
alter table public.brands enable row level security;
alter table public.brand_private enable row level security;
alter table public.brand_users enable row level security;
alter table public.brand_contacts enable row level security;
create policy brands_read on public.brands for select to authenticated using (app.has_brand_access(id));
create policy brands_admin_insert on public.brands for insert to authenticated with check (app.current_role()='admin');
create policy brands_admin_update on public.brands for update to authenticated using (app.current_role()='admin') with check (app.current_role()='admin');
create policy brand_private_read on public.brand_private for select to authenticated using (app.is_internal());
create policy brand_private_insert on public.brand_private for insert to authenticated with check (app.current_role()='admin');
create policy brand_private_update on public.brand_private for update to authenticated using (app.current_role()='admin') with check (app.current_role()='admin');
create policy brand_users_read on public.brand_users for select to authenticated using (app.current_role()='admin' or (user_id=auth.uid() and app.current_role()='brand'));
create policy brand_users_write on public.brand_users for all to authenticated using (app.current_role()='admin') with check (app.current_role()='admin');
create policy brand_contacts_read on public.brand_contacts for select to authenticated using (app.is_internal());
create policy brand_contacts_insert on public.brand_contacts for insert to authenticated with check (app.current_role()='admin');
create policy brand_contacts_update on public.brand_contacts for update to authenticated using (app.current_role()='admin') with check (app.current_role()='admin');
create trigger brands_updated before update on public.brands for each row execute function app.set_updated_at();
create trigger brand_private_updated before update on public.brand_private for each row execute function app.set_updated_at();
create trigger brand_users_updated before update on public.brand_users for each row execute function app.set_updated_at();
create trigger brand_contacts_updated before update on public.brand_contacts for each row execute function app.set_updated_at();
create trigger brands_audit after insert or update on public.brands for each row execute function app.audit_row_change();
create trigger brand_private_audit after insert or update on public.brand_private for each row execute function app.audit_row_change();
create trigger brand_contacts_audit after insert or update on public.brand_contacts for each row execute function app.audit_row_change();

-- One transaction for public and private fields; checks plus table RLS both apply.
create function public.save_brand(p_id uuid, p_data jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare result uuid;
begin
  if app.current_role() is distinct from 'admin' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_id is null then
    insert into public.brands(name,legal_name,can_see_customer_names) values(p_data->>'name',p_data->>'legal_name',coalesce((p_data->>'can_see_customer_names')::boolean,true)) returning id into result;
  else
    update public.brands set name=p_data->>'name',legal_name=p_data->>'legal_name',can_see_customer_names=(p_data->>'can_see_customer_names')::boolean where id=p_id and deleted_at is null returning id into result;
    if result is null then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
  end if;
  insert into public.brand_private(id,vat_number,tax_code,address,city,country,commission_pct,notes)
  values(result,p_data->>'vat_number',p_data->>'tax_code',p_data->>'address',p_data->>'city',p_data->>'country',(p_data->>'commission_pct')::numeric,p_data->>'notes')
  on conflict(id) do update set vat_number=excluded.vat_number,tax_code=excluded.tax_code,address=excluded.address,city=excluded.city,country=excluded.country,commission_pct=excluded.commission_pct,notes=excluded.notes;
  return result;
end;
$$;
revoke all on function public.save_brand(uuid,jsonb) from public;
grant execute on function public.save_brand(uuid,jsonb) to authenticated;
