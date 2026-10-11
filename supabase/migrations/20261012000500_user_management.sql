-- Generic audit also supports association tables with a composite primary key.
create or replace function app.audit_row_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare old_data jsonb; new_data jsonb;
begin
  if tg_op <> 'INSERT' then old_data := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then new_data := to_jsonb(new); end if;
  insert into public.audit_log(actor_id,action,table_name,record_id,before,after)
  values(auth.uid(),lower(tg_op),tg_table_name,
    coalesce(new_data->>'id',old_data->>'id',new_data->>'brand_id',old_data->>'brand_id')::uuid,old_data,new_data);
  return coalesce(new,old);
end;
$$;
create trigger brand_users_audit after insert or update or delete on public.brand_users for each row execute function app.audit_row_change();

create function public.save_user(p_id uuid,p_full_name text,p_role public.app_role,p_is_active boolean,p_brand_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if app.current_role() is distinct from 'admin' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if length(trim(p_full_name)) not between 1 and 200 or p_brand_ids is null then raise exception 'VALIDATION' using errcode='23514'; end if;
  if p_role <> 'brand' and cardinality(p_brand_ids)>0 then raise exception 'VALIDATION' using errcode='23514'; end if;
  if exists(select 1 from unnest(p_brand_ids) b(id) where not exists(select 1 from public.brands where id=b.id and deleted_at is null)) then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
  -- Serialize edits of one account, including its memberships.
  perform 1 from public.profiles where id=p_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
  update public.profiles set full_name=trim(p_full_name),role=p_role,is_active=p_is_active where id=p_id;
  delete from public.brand_users where user_id=p_id and not (brand_id=any(p_brand_ids));
  insert into public.brand_users(user_id,brand_id) select p_id,unnest(p_brand_ids) on conflict do nothing;
end;
$$;
revoke all on function public.save_user(uuid,text,public.app_role,boolean,uuid[]) from public;
grant execute on function public.save_user(uuid,text,public.app_role,boolean,uuid[]) to authenticated;
