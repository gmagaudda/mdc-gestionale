create or replace function public.configure_import_batch(p_id uuid,p_options jsonb,p_expected jsonb) returns void language plpgsql security definer set search_path='' as $$
declare b public.import_batches;begin
 select * into b from public.import_batches where id=p_id for update;
 if b.id is null or not app.can_import(b.kind) or b.created_by<>auth.uid() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if b.kind<>'performance' then raise exception 'REVISION_REQUIRED' using errcode='23514';end if;
 if b.status not in('uploaded','mapped','validated','ready') then raise exception 'INVALID_STATE' using errcode='23514';end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='imports' and o.name=b.storage_path and (o.metadata->>'size')::bigint=b.size_bytes) then raise exception 'FILE_MISSING' using errcode='23514';end if;
 if b.options is distinct from p_options then delete from public.import_rows where batch_id=p_id;end if;
 update public.import_batches set options=p_options,expected_totals=p_expected,status='mapped' where id=p_id;
end;$$;
create function public.configure_import_batch(p_id uuid,p_options jsonb,p_expected jsonb,p_previous_revision uuid) returns void language plpgsql security definer set search_path='' as $$
declare b public.import_batches;p jsonb;begin
 select * into b from public.import_batches where id=p_id for update;
 if b.id is null or b.kind='performance' or not app.can_import(b.kind) or b.created_by<>auth.uid() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if b.status not in('uploaded','mapped','validated','ready') then raise exception 'INVALID_STATE' using errcode='23514';end if;
 if b.options->>'revision' is distinct from p_previous_revision::text then raise exception 'CONFIG_CONFLICT' using errcode='40001';end if;
 if jsonb_typeof(p_options) is distinct from 'object' or jsonb_typeof(p_options->'profiles') is distinct from 'array' or jsonb_array_length(p_options->'profiles') not between 1 and 20 or (p_options->>'revision') is null then raise exception 'INVALID_PROFILE' using errcode='23514';end if;
 perform (p_options->>'revision')::uuid;
 if exists(select 1 from jsonb_array_elements(p_options->'profiles') pr group by pr->>'sheet_name' having count(*)>1) then raise exception 'INVALID_PROFILE' using errcode='23514';end if;
 for p in select value from jsonb_array_elements(p_options->'profiles') loop
 if p->>'entity' not in('customers','orders','budgets') or (b.kind<>'mixed' and p->>'entity' is distinct from b.kind) or not app.can_import(p->>'entity') or length(p->>'sheet_name') not between 1 and 100 or (p->>'header_row')::integer not between 1 and 1000 or jsonb_typeof(p->'mapping') is distinct from 'object' or jsonb_typeof(p->'options') is distinct from 'object' then raise exception 'INVALID_PROFILE' using errcode='23514';end if;
 end loop;
 if not exists(select 1 from storage.objects o where o.bucket_id='imports' and o.name=b.storage_path and (o.metadata->>'size')::bigint=b.size_bytes) then raise exception 'FILE_MISSING' using errcode='23514';end if;
 if b.options is distinct from p_options then delete from public.import_rows where batch_id=p_id;end if;
 update public.import_batches set options=p_options,expected_totals=p_expected,status='mapped',stats='{}' where id=p_id;
end;$$;
create function public.stage_import_rows(p_id uuid,p_rows jsonb,p_revision uuid) returns integer language plpgsql security definer set search_path='' as $$
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
 update public.import_batches set status='validated',stats=jsonb_build_object('rows',n,'errors',(select count(*) from public.import_rows where batch_id=p_id and status='error'),'warnings',(select count(*) from public.import_rows where batch_id=p_id and status='warning')) where id=p_id;
 return n;
end;$$;
create or replace function public.stage_import_rows(p_id uuid,p_rows jsonb) returns integer language sql security definer set search_path='' as $$ select public.stage_import_rows(p_id,p_rows,null::uuid) $$;
revoke all on function public.configure_import_batch(uuid,jsonb,jsonb,uuid),public.stage_import_rows(uuid,jsonb,uuid) from public;
grant execute on function public.configure_import_batch(uuid,jsonb,jsonb,uuid),public.stage_import_rows(uuid,jsonb,uuid) to authenticated;
