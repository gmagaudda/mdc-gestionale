create extension if not exists btree_gist with schema extensions;
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id),
  season_id uuid,
  customer_id uuid references public.customers(id),
  amount_cents bigint not null check(amount_cents between 0 and 1000000000000),
  period_start date not null,
  period_end date not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,brand_id),
  foreign key(season_id,brand_id) references public.seasons(id,brand_id),
  check(period_end >= period_start),
  constraint budgets_no_overlap exclude using gist (
    brand_id with =,
    (coalesce(season_id,'00000000-0000-0000-0000-000000000000'::uuid)) with =,
    (season_id is null) with =,
    (coalesce(customer_id,'00000000-0000-0000-0000-000000000000'::uuid)) with =,
    (customer_id is null) with =,
    daterange(period_start,period_end,'[]') with &&
  ) where (deleted_at is null)
);
create table public.budget_private (
  id uuid primary key,
  brand_id uuid not null,
  notes text not null default '' check(length(notes)<=5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(id,brand_id) references public.budgets(id,brand_id)
);
alter table public.budgets enable row level security;
alter table public.budget_private enable row level security;
create policy budgets_read on public.budgets for select to authenticated using(app.is_internal() or (deleted_at is null and app.has_brand_access(brand_id)));
create policy budgets_insert on public.budgets for insert to authenticated with check(app.current_role() in ('admin','accounting') and app.has_brand_access(brand_id));
create policy budgets_update on public.budgets for update to authenticated using(app.current_role() in ('admin','accounting')) with check(app.current_role() in ('admin','accounting') and app.has_brand_access(brand_id));
create policy budget_private_read on public.budget_private for select to authenticated using(app.is_internal());
create policy budget_private_insert on public.budget_private for insert to authenticated with check(app.current_role() in ('admin','accounting') and exists(select 1 from public.budgets b where b.id=budget_private.id and b.brand_id=budget_private.brand_id and b.deleted_at is null));
create policy budget_private_update on public.budget_private for update to authenticated using(app.current_role() in ('admin','accounting')) with check(app.current_role() in ('admin','accounting') and exists(select 1 from public.budgets b where b.id=budget_private.id and b.brand_id=budget_private.brand_id and b.deleted_at is null));

create function app.validate_budget() returns trigger language plpgsql set search_path='' as $$
begin
  if TG_OP='UPDATE' and (new.id<>old.id or new.brand_id<>old.brand_id) then
    raise exception 'immutable budget identity' using errcode='23514';
  end if;
  if TG_OP='INSERT' and not exists(select 1 from public.brands where id=new.brand_id and deleted_at is null) then
    raise exception 'invalid brand' using errcode='23514';
  end if;
  if new.season_id is not null and (TG_OP='INSERT' or new.season_id is distinct from old.season_id) and not exists(select 1 from public.seasons where id=new.season_id and brand_id=new.brand_id and deleted_at is null) then
    raise exception 'invalid season' using errcode='23514';
  end if;
  if new.customer_id is not null and (TG_OP='INSERT' or new.customer_id is distinct from old.customer_id) and not exists(select 1 from public.customers where id=new.customer_id and deleted_at is null) then
    raise exception 'invalid customer' using errcode='23514';
  end if;
  return new;
end; $$;
create trigger budgets_validate before insert or update on public.budgets for each row execute function app.validate_budget();
create trigger budgets_updated before update on public.budgets for each row execute function app.set_updated_at();
create trigger budget_private_updated before update on public.budget_private for each row execute function app.set_updated_at();
create trigger budgets_audit after insert or update on public.budgets for each row execute function app.audit_row_change();
create trigger budget_private_audit after insert or update on public.budget_private for each row execute function app.audit_row_change();

create function public.save_budget(p_id uuid,p_data jsonb,p_updated_at timestamptz default null) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_id uuid;v_brand uuid:=(p_data->>'brand_id')::uuid;
begin
  if app.current_role() is null or app.current_role() not in ('admin','accounting') then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_id is null then
    insert into public.budgets(brand_id,season_id,customer_id,amount_cents,period_start,period_end)
    values(v_brand,nullif(p_data->>'season_id','')::uuid,nullif(p_data->>'customer_id','')::uuid,(p_data->>'amount_cents')::bigint,(p_data->>'period_start')::date,(p_data->>'period_end')::date) returning id into v_id;
  else
    update public.budgets set season_id=nullif(p_data->>'season_id','')::uuid,customer_id=nullif(p_data->>'customer_id','')::uuid,amount_cents=(p_data->>'amount_cents')::bigint,period_start=(p_data->>'period_start')::date,period_end=(p_data->>'period_end')::date
    where id=p_id and brand_id=v_brand and deleted_at is null and updated_at=p_updated_at returning id into v_id;
    if v_id is null then raise exception 'budget unavailable or changed' using errcode='P0002'; end if;
  end if;
  insert into public.budget_private(id,brand_id,notes) values(v_id,v_brand,coalesce(p_data->>'notes',''))
    on conflict(id) do update set notes=excluded.notes;
  return v_id;
end; $$;
revoke all on function public.save_budget(uuid,jsonb,timestamptz) from public,anon;
grant execute on function public.save_budget(uuid,jsonb,timestamptz) to authenticated;
