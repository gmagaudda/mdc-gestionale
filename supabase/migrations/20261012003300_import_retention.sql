create function public.start_import_batch(p_id uuid,p_kind text,p_filename text,p_sha256 text,p_size integer,p_retention_days integer) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not app.can_import(p_kind) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_retention_days is null or p_retention_days not between 1 and 3650 then raise exception 'INVALID_RETENTION' using errcode='23514';end if;
 insert into public.import_batches(id,kind,file_name,file_sha256,size_bytes,storage_path,file_expires_at) values(p_id,p_kind,p_filename,p_sha256,p_size,p_id::text||case when lower(p_filename) like '%.xlsx' then '.xlsx' else '.csv' end,now()+make_interval(days=>p_retention_days));return p_id;
end;$$;
create or replace function public.start_import_batch(p_id uuid,p_kind text,p_filename text,p_sha256 text,p_size integer) returns uuid language sql security definer set search_path='' as $$ select public.start_import_batch(p_id,p_kind,p_filename,p_sha256,p_size,90) $$;
create function public.finish_import_file_retention(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare b public.import_batches;begin
 if auth.role() is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into b from public.import_batches where id=p_id for update;
 if b.id is null or b.file_expires_at>now() then return false;end if;
 if b.file_removed_at is not null then return true;end if;
 if exists(select 1 from storage.objects where bucket_id='imports' and name=b.storage_path) then raise exception 'FILE_STILL_PRESENT' using errcode='23514';end if;
 -- Keep normalized historical/business data and rollback snapshots. Discard the
 -- unbounded source columns once the original expires, in the audited transaction.
 update public.import_rows set raw='{}' where batch_id=p_id;
 update public.import_batches set file_removed_at=now(),status=case when status in('uploaded','mapped','validated','ready') then 'failed' else status end where id=p_id;return true;
end;$$;
drop policy imports_objects_read on storage.objects;
create policy imports_objects_read on storage.objects for select to authenticated using(bucket_id='imports' and exists(select 1 from public.import_batches b where b.storage_path=name and b.file_removed_at is null and b.file_expires_at>now() and app.can_import(b.kind)));
revoke all on function public.start_import_batch(uuid,text,text,text,integer,integer),public.finish_import_file_retention(uuid) from public;
grant execute on function public.start_import_batch(uuid,text,text,text,integer,integer) to authenticated;
grant execute on function public.finish_import_file_retention(uuid) to service_role;
