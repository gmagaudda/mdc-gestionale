create table public.events (
 id uuid primary key default gen_random_uuid(),
 type public.event_type not null default 'appointment',
 title text not null check(length(trim(title)) between 1 and 200),
 description text not null default '' check(length(description)<=5000),
 starts_at timestamptz not null, ends_at timestamptz not null,
 all_day boolean not null default false,
 brand_id uuid references public.brands(id), customer_id uuid references public.customers(id),
 assigned_to uuid references public.profiles(id),
 visible_to_brand boolean not null default false,
 location text not null default '' check(length(location)<=500),
 deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(ends_at>starts_at), check(ends_at-starts_at<=interval '366 days'),
 check(not visible_to_brand or brand_id is not null),
 check(not all_day or ((starts_at at time zone 'Europe/Rome')::time='00:00' and (ends_at at time zone 'Europe/Rome')::time='00:00'))
);
create index events_period on public.events(starts_at,ends_at) where deleted_at is null;
create index events_brand_period on public.events(brand_id,starts_at) where deleted_at is null;
create index events_assignee_period on public.events(assigned_to,starts_at) where deleted_at is null;
alter table public.events enable row level security;
create policy events_read on public.events for select to authenticated using(app.is_internal() or (deleted_at is null and visible_to_brand and app.has_brand_access(brand_id)));
create policy events_insert on public.events for insert to authenticated with check(app.current_role() in('admin','staff') and (brand_id is null or app.has_brand_access(brand_id)));
-- Internal readers retain archived history; application queries filter it.
-- Brand readers can never read archived events.
create policy events_update on public.events for update to authenticated using(app.current_role() in('admin','staff')) with check(app.current_role() in('admin','staff') and (brand_id is null or app.has_brand_access(brand_id)));
create function app.validate_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (tg_op='INSERT' or new.assigned_to is distinct from old.assigned_to) and new.assigned_to is not null and not exists(select 1 from public.profiles where id=new.assigned_to and is_active and role in('admin','staff','accounting')) then raise exception 'invalid assignee' using errcode='23514'; end if;
 if (tg_op='INSERT' or new.customer_id is distinct from old.customer_id) and new.customer_id is not null and not exists(select 1 from public.customers where id=new.customer_id and deleted_at is null) then raise exception 'invalid customer' using errcode='23514'; end if;
 return new;
end;$$;
revoke all on function app.validate_event() from public;
create trigger events_validate before insert or update on public.events for each row execute function app.validate_event();
create trigger events_updated before update on public.events for each row execute function app.set_updated_at();
create trigger events_audit after insert or update or delete on public.events for each row execute function app.audit_row_change();
-- Narrow directory for scheduling, never grants direct profile-table access.
create function public.calendar_assignees() returns table(id uuid,full_name text,email text) language sql stable security definer set search_path='' as $$
 select p.id,p.full_name,p.email from public.profiles p where app.is_internal() and p.is_active and p.role in('admin','staff','accounting') order by p.full_name,p.email
$$;
revoke all on function public.calendar_assignees() from public,anon;
grant execute on function public.calendar_assignees() to authenticated;
