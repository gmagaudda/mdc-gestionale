create or replace function public.stage_import_rows(p_id uuid,p_rows jsonb,p_revision uuid) returns integer language plpgsql security definer set search_path='' as $$
declare b public.import_batches;v jsonb;n integer;begin
 select * into b from public.import_batches where id=p_id for update;
 if b.id is null or not app.can_import(b.kind) or b.created_by<>auth.uid() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if b.kind<>'performance' and (p_revision is null or b.options->>'revision' is distinct from p_revision::text) then raise exception 'CONFIG_CONFLICT' using errcode='40001';end if;
 if b.kind='performance' and p_revision is not null then raise exception 'INVALID_REVISION' using errcode='23514';end if;
 if b.status not in('mapped','validated','ready') then raise exception 'INVALID_STATE' using errcode='23514';end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 then raise exception 'INVALID_CHUNK' using errcode='23514';end if;
 for v in select value from jsonb_array_elements(p_rows) loop
 if jsonb_typeof(v)<>'object' or exists(select 1 from jsonb_object_keys(v) k where k not in('entity','sheet','row_number','raw','mapped','status','messages')) or (b.kind<>'mixed' and v->>'entity' is distinct from b.kind) or v->>'status' not in('valid','warning','error','skipped') then raise exception 'INVALID_ROW' using errcode='23514';end if;
 if b.kind<>'performance' and not exists(select 1 from jsonb_array_elements(b.options->'profiles') p where p->>'sheet_name'=v->>'sheet' and p->>'entity'=v->>'entity' and (v->>'row_number')::integer>(p->>'header_row')::integer) then raise exception 'INVALID_PROFILE_ROW' using errcode='23514';end if;
 insert into public.import_rows(batch_id,entity,sheet,row_number,raw,mapped,status,messages)
 values(p_id,v->>'entity',v->>'sheet',(v->>'row_number')::integer,v->'raw',v->'mapped',v->>'status',coalesce(v->'messages','[]'))
 on conflict(batch_id,sheet,row_number,entity) do update set raw=excluded.raw,mapped=excluded.mapped,status=excluded.status,messages=excluded.messages,match='{}',target_id=null;
 end loop;
 select count(*) into n from public.import_rows where batch_id=p_id;
 if n>20000 then raise exception 'ROW_LIMIT' using errcode='23514';end if;
 update public.import_batches set options=case when kind='performance' then options else options-'staging_complete' end,status='validated',stats=jsonb_build_object('rows',n,'errors',(select count(*) from public.import_rows where batch_id=p_id and status='error'),'warnings',(select count(*) from public.import_rows where batch_id=p_id and status='warning')) where id=p_id;
 return n;
end;$$;
-- Completion is separate from chunk upload. Partial staging can never be committed.
create function public.finish_import_staging(p_id uuid,p_revision uuid,p_counts jsonb) returns void language plpgsql security definer set search_path='' as $$
declare b public.import_batches;p jsonb;begin
 select * into b from public.import_batches where id=p_id for update;
 if b.id is null or not app.can_import(b.kind) or b.created_by<>auth.uid() or b.kind='performance' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if b.status<>'validated' then raise exception 'INVALID_STATE' using errcode='23514';end if;
 if p_revision is null or b.options->>'revision' is distinct from p_revision::text then raise exception 'CONFIG_CONFLICT' using errcode='40001';end if;
 if jsonb_typeof(p_counts) is distinct from 'object' then raise exception 'INVALID_COUNTS' using errcode='23514';end if;
 for p in select value from jsonb_array_elements(b.options->'profiles') loop
  if jsonb_typeof(p_counts->(p->>'sheet_name')) is distinct from 'number' or (p_counts->>(p->>'sheet_name'))::numeric<>(select count(*) from public.import_rows where batch_id=p_id and sheet=p->>'sheet_name' and entity=p->>'entity') then raise exception 'INCOMPLETE_STAGING' using errcode='23514';end if;
 end loop;
 if exists(select 1 from jsonb_object_keys(p_counts) x where not exists(select 1 from jsonb_array_elements(b.options->'profiles') as profiles(profile_value) where profiles.profile_value->>'sheet_name'=x)) then raise exception 'INVALID_COUNTS' using errcode='23514';end if;
 -- A repeated key across chunk or sheet boundaries is not silently overwritten.
 with duplicates as (select entity,case entity when 'customers' then case when nullif(mapped->>'external_code','') is not null then 'code:'||(mapped->>'external_code') when nullif(mapped->>'vat_number','') is not null then 'vat:'||(mapped->>'vat_number') else jsonb_build_array(app.import_key(mapped->>'legal_name'),app.import_key(mapped->>'city'),app.import_key(mapped->>'country'))::text end when 'budgets' then jsonb_build_array(app.import_key(mapped->>'brand'),app.import_key(mapped->>'season'),app.import_key(mapped->>'customer'),mapped->>'period_start',mapped->>'period_end')::text end as key from public.import_rows where batch_id=p_id and status in('valid','warning') and entity in('customers','budgets') group by entity,key having count(*)>1)
 update public.import_rows r set status='error',messages=r.messages||'[{"field":"","code":"duplicate","severity":"error"}]'::jsonb from duplicates d where r.batch_id=p_id and r.entity=d.entity and r.status in('valid','warning') and d.key=case r.entity when 'customers' then case when nullif(r.mapped->>'external_code','') is not null then 'code:'||(r.mapped->>'external_code') when nullif(r.mapped->>'vat_number','') is not null then 'vat:'||(r.mapped->>'vat_number') else jsonb_build_array(app.import_key(r.mapped->>'legal_name'),app.import_key(r.mapped->>'city'),app.import_key(r.mapped->>'country'))::text end when 'budgets' then jsonb_build_array(app.import_key(r.mapped->>'brand'),app.import_key(r.mapped->>'season'),app.import_key(r.mapped->>'customer'),r.mapped->>'period_start',r.mapped->>'period_end')::text end;
 update public.import_batches set options=jsonb_set(options,'{staging_complete}','true'),stats=jsonb_build_object('rows',(select count(*) from public.import_rows where batch_id=p_id),'errors',(select count(*) from public.import_rows where batch_id=p_id and status='error'),'warnings',(select count(*) from public.import_rows where batch_id=p_id and status='warning')) where id=p_id;
end;$$;
revoke all on function public.finish_import_staging(uuid,uuid,jsonb) from public;
grant execute on function public.finish_import_staging(uuid,uuid,jsonb) to authenticated;
