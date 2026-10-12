create function public.save_import_profile(p_id uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;begin
 if not app.can_import(p_data->>'entity') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if jsonb_typeof(p_data)<>'object' or exists(select 1 from jsonb_object_keys(p_data) k where k not in('name','entity','sheet_name','header_row','mapping','options')) then raise exception 'INVALID_PROFILE' using errcode='23514';end if;
 if p_id is null then
 insert into public.import_profiles(name,entity,sheet_name,header_row,mapping,options) values(p_data->>'name',p_data->>'entity',p_data->>'sheet_name',(p_data->>'header_row')::integer,p_data->'mapping',coalesce(p_data->'options','{}')) returning id into result;
 else
 update public.import_profiles set name=p_data->>'name',sheet_name=p_data->>'sheet_name',header_row=(p_data->>'header_row')::integer,mapping=p_data->'mapping',options=coalesce(p_data->'options','{}') where id=p_id and entity=p_data->>'entity' and app.can_import(entity) returning id into result;
 if result is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
 end if;return result;
end;$$;
create function public.configure_import_batch(p_id uuid,p_options jsonb,p_expected jsonb) returns void language plpgsql security definer set search_path='' as $$
declare b public.import_batches;begin
 select * into b from public.import_batches where id=p_id for update;
 if b.id is null or not app.can_import(b.kind) or b.created_by<>auth.uid() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if b.status not in('uploaded','mapped','validated','ready') then raise exception 'INVALID_STATE' using errcode='23514';end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='imports' and o.name=b.storage_path and (o.metadata->>'size')::bigint=b.size_bytes) then raise exception 'FILE_MISSING' using errcode='23514';end if;
 update public.import_batches set options=p_options,expected_totals=p_expected,status='mapped' where id=p_id;
end;$$;
create function public.stage_import_rows(p_id uuid,p_rows jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare b public.import_batches;v jsonb;n integer;begin
 select * into b from public.import_batches where id=p_id for update;
 if b.id is null or not app.can_import(b.kind) or b.created_by<>auth.uid() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if b.status not in('mapped','validated','ready') then raise exception 'INVALID_STATE' using errcode='23514';end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 then raise exception 'INVALID_CHUNK' using errcode='23514';end if;
 for v in select value from jsonb_array_elements(p_rows) loop
 if jsonb_typeof(v)<>'object' or exists(select 1 from jsonb_object_keys(v) k where k not in('entity','sheet','row_number','raw','mapped','status','messages')) or (b.kind<>'mixed' and v->>'entity' is distinct from b.kind) or v->>'status' not in('valid','warning','error','skipped') then raise exception 'INVALID_ROW' using errcode='23514';end if;
 insert into public.import_rows(batch_id,entity,sheet,row_number,raw,mapped,status,messages)
 values(p_id,v->>'entity',v->>'sheet',(v->>'row_number')::integer,v->'raw',v->'mapped',v->>'status',coalesce(v->'messages','[]'))
 on conflict(batch_id,sheet,row_number,entity) do update set raw=excluded.raw,mapped=excluded.mapped,status=excluded.status,messages=excluded.messages,match='{}',target_id=null;
 end loop;
 select count(*) into n from public.import_rows where batch_id=p_id;
 if n>20000 then raise exception 'ROW_LIMIT' using errcode='23514';end if;
 update public.import_batches set status='validated',stats=jsonb_build_object('rows',n,'errors',(select count(*) from public.import_rows where batch_id=p_id and status='error'),'warnings',(select count(*) from public.import_rows where batch_id=p_id and status='warning')) where id=p_id;
 return n;
end;$$;
create function app.valid_performance_row(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;v jsonb;begin
 if jsonb_typeof(p) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p) as keys(key_name) where keys.key_name not in('row_number','brand','customer','representative','area','country','region','city','customer_status','values')) or jsonb_typeof(p->'row_number') is distinct from 'number' or (p->>'row_number')::numeric not between 1 and 1048576 or mod((p->>'row_number')::numeric,1)<>0 then return false;end if;
 foreach k in array array['brand','customer','representative','area','country','region','city','customer_status'] loop
 if jsonb_typeof(p->k) is distinct from 'string' or length(p->>k)>200 then return false;end if;
 end loop;
 if length(trim(p->>'brand'))=0 or jsonb_typeof(p->'values') is distinct from 'object' or exists(select 1 from jsonb_object_keys(p->'values') as keys(key_name) where keys.key_name not in('orders_ss26','budget_fw26','orders_fw26','budget_ss27','orders_ss27')) then return false;end if;
 foreach k in array array['orders_ss26','budget_fw26','orders_fw26','budget_ss27','orders_ss27'] loop
 v:=p->'values'->k;
 if v is null or (v<>'null'::jsonb and (jsonb_typeof(v)<>'number' or (v::text)::numeric not between 0 and 1000000000000 or mod((v::text)::numeric,1)<>0)) then return false;end if;
 end loop;return true;
exception when others then return false;end;$$;
revoke all on function app.valid_performance_row(jsonb) from public;
create function public.complete_performance_import(p_id uuid,p_confirm_differences boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.import_batches;k text;actual numeric;expected numeric;totals jsonb:='{}';differences jsonb:='{}';n integer;begin
 select * into b from public.import_batches where id=p_id for update;
 if b.id is null or b.kind<>'performance' or app.current_role() is distinct from 'admin' or b.created_by<>auth.uid() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if b.status='completed' then return b.stats;end if;
 if b.status<>'validated' then raise exception 'INVALID_STATE' using errcode='23514';end if;
 if exists(select 1 from public.import_rows where batch_id=p_id and (status='error' or (status<>'skipped' and (entity<>'performance' or not app.valid_performance_row(mapped))))) then raise exception 'ROW_ERRORS' using errcode='23514';end if;
 if jsonb_typeof(b.options->'pivotBrands') is distinct from 'array' or jsonb_array_length(b.options->'pivotBrands')>500 or exists(select 1 from jsonb_array_elements(b.options->'pivotBrands') v where jsonb_typeof(v)<>'string' or length(v::text)>202) then raise exception 'INVALID_OPTIONS' using errcode='23514';end if;
 select count(*) into n from public.import_rows where batch_id=p_id and status<>'skipped';
 if n=0 then raise exception 'NO_ROWS' using errcode='23514';end if;
 foreach k in array array['orders_ss26','budget_fw26','orders_fw26','budget_ss27','orders_ss27'] loop
 select sum((mapped->'values'->>k)::numeric) into actual from public.import_rows where batch_id=p_id and status<>'skipped';
 totals:=totals||jsonb_build_object(k,actual::text);
 if b.expected_totals ? k and b.expected_totals->k<>'null'::jsonb then
 expected:=(b.expected_totals->>k)::numeric;
 if expected<0 or mod(expected,1)<>0 then raise exception 'INVALID_EXPECTED' using errcode='23514';end if;
 select sum((mapped->'values'->>k)::numeric) into actual from public.import_rows where batch_id=p_id and status<>'skipped' and (jsonb_array_length(b.options->'pivotBrands')=0 or mapped->>'brand' in(select jsonb_array_elements_text(b.options->'pivotBrands')));
 if actual is null or actual<>expected then differences:=differences||jsonb_build_object(k,(actual-expected)::text);end if;
 end if;end loop;
 if differences<>'{}'::jsonb and p_confirm_differences is not true then raise exception 'TOTAL_DIFFERENCES' using errcode='23514';end if;
 update public.import_rows set status='imported' where batch_id=p_id and status<>'skipped';
 update public.import_batches set status='completed',completed_at=now(),stats=stats||jsonb_build_object('rows',n,'totals',totals,'differences',differences,'differences_confirmed',p_confirm_differences) where id=p_id returning stats into totals;
 return totals;
end;$$;
create function public.rollback_performance_import(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare b public.import_batches;begin
 select * into b from public.import_batches where id=p_id for update;
 if b.id is null or b.kind<>'performance' or app.current_role() is distinct from 'admin' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if b.status='rolled_back' then return;end if;
 if b.status<>'completed' then raise exception 'INVALID_STATE' using errcode='23514';end if;
 update public.import_batches set status='rolled_back',rolled_back_at=now() where id=p_id;
end;$$;
revoke all on function public.save_import_profile(uuid,jsonb),public.configure_import_batch(uuid,jsonb,jsonb),public.stage_import_rows(uuid,jsonb),public.complete_performance_import(uuid,boolean),public.rollback_performance_import(uuid) from public;
grant execute on function public.save_import_profile(uuid,jsonb),public.configure_import_batch(uuid,jsonb,jsonb),public.stage_import_rows(uuid,jsonb),public.complete_performance_import(uuid,boolean),public.rollback_performance_import(uuid) to authenticated;
