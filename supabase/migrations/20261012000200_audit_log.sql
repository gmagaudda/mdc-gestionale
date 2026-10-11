create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (length(action) between 1 and 100),
  table_name text not null,
  record_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_at on public.audit_log (created_at desc);
alter table public.audit_log enable row level security;
revoke insert, update, delete on public.audit_log from anon, authenticated;
create policy audit_admin_read on public.audit_log for select to authenticated
using ((select app.current_role()) = 'admin');

create function app.audit_row_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log(actor_id, action, table_name, record_id, before, after)
  values (auth.uid(), lower(tg_op), tg_table_name, coalesce(new.id, old.id),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return coalesce(new, old);
end;
$$;
revoke all on function app.audit_row_change() from public;
create trigger profiles_audit after insert or update on public.profiles
for each row execute function app.audit_row_change();

create function public.write_audit(p_action text, p_table_name text, p_record_id uuid, p_before jsonb default null, p_after jsonb default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if not app.is_internal() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  insert into public.audit_log(actor_id, action, table_name, record_id, before, after)
  values (auth.uid(), p_action, p_table_name, p_record_id, p_before, p_after) returning id into result;
  return result;
end;
$$;
revoke all on function public.write_audit(text,text,uuid,jsonb,jsonb) from public;
grant execute on function public.write_audit(text,text,uuid,jsonb,jsonb) to authenticated;

-- Serialize administrator changes so concurrent edits cannot deactivate the last admin.
create function app.guard_last_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'admin' and old.is_active and (new.role <> 'admin' or not new.is_active) then
    perform pg_advisory_xact_lock(872401);
    if (select count(*) from public.profiles where role = 'admin' and is_active) <= 1 then
      raise exception 'LAST_ADMIN' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function app.guard_last_admin() from public;
create trigger profiles_guard_last_admin before update on public.profiles
for each row execute function app.guard_last_admin();
