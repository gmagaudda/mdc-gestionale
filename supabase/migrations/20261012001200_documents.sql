create table public.documents (
 id uuid primary key default gen_random_uuid(), kind public.document_kind not null default 'other',
 name text not null check(length(trim(name)) between 1 and 200),
 storage_path text not null unique, original_filename text not null check(length(original_filename) between 1 and 250),
 mime_type text not null check(mime_type in('application/pdf','image/png','image/jpeg')),
 size_bytes integer not null check(size_bytes between 1 and 10485760),
 brand_id uuid not null references public.brands(id), customer_id uuid references public.customers(id),order_id uuid references public.orders(id),
 shared_with_brand boolean not null default false, uploaded_by uuid not null default auth.uid() references public.profiles(id),
 ready boolean not null default false,deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(storage_path=brand_id::text||'/'||id::text||case mime_type when 'application/pdf' then '.pdf' when 'image/png' then '.png' else '.jpg' end)
);
create index documents_brand_created on public.documents(brand_id,created_at desc) where deleted_at is null and ready;
alter table public.documents enable row level security;
create policy documents_read on public.documents for select to authenticated using(app.is_internal() or (ready and deleted_at is null and shared_with_brand and app.has_brand_access(brand_id)));
create policy documents_insert on public.documents for insert to authenticated with check(app.current_role() in('admin','staff') and app.has_brand_access(brand_id) and uploaded_by=auth.uid() and not ready and deleted_at is null);
create policy documents_update on public.documents for update to authenticated using(app.current_role() in('admin','staff')) with check(app.current_role() in('admin','staff'));
create policy documents_cancel_pending on public.documents for delete to authenticated using(app.current_role() in('admin','staff') and not ready and uploaded_by=auth.uid() and not exists(select 1 from storage.objects o where o.bucket_id='documents' and o.name=storage_path));
create function app.validate_document() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.id,new.brand_id,new.storage_path,new.original_filename,new.mime_type,new.size_bytes,new.uploaded_by) is distinct from (old.id,old.brand_id,old.storage_path,old.original_filename,old.mime_type,old.size_bytes,old.uploaded_by) then raise exception 'immutable file' using errcode='23514'; end if;
 if (tg_op='INSERT' or new.customer_id is distinct from old.customer_id) and new.customer_id is not null and not exists(select 1 from public.customers c where c.id=new.customer_id and c.deleted_at is null) then raise exception 'invalid customer' using errcode='23514'; end if;
 if (tg_op='INSERT' or (new.order_id,new.customer_id) is distinct from (old.order_id,old.customer_id)) and new.order_id is not null and not exists(select 1 from public.orders o where o.id=new.order_id and o.brand_id=new.brand_id and o.deleted_at is null and (new.customer_id is null or o.customer_id=new.customer_id)) then raise exception 'invalid order' using errcode='23514'; end if;
 if tg_op='UPDATE' and new.ready is distinct from old.ready then
   if not new.ready or not exists(select 1 from storage.objects o where o.bucket_id='documents' and o.name=new.storage_path and (o.metadata->>'size')::bigint=new.size_bytes and o.metadata->>'mimetype'=new.mime_type) then raise exception 'missing or invalid file' using errcode='23514'; end if;
 end if;
 return new;
end;$$;
revoke all on function app.validate_document() from public;
create trigger documents_validate before insert or update on public.documents for each row execute function app.validate_document();
create trigger documents_updated before update on public.documents for each row execute function app.set_updated_at();
create trigger documents_audit after insert or update or delete on public.documents for each row execute function app.audit_row_change();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('documents','documents',false,10485760,array['application/pdf','image/png','image/jpeg']);
-- Metadata RLS also controls object access. No anonymous read, overwrite or unlinked uploads.
create policy document_objects_read on storage.objects for select to authenticated using(bucket_id='documents' and exists(select 1 from public.documents d where d.storage_path=storage.objects.name and d.deleted_at is null and (d.ready or (d.uploaded_by=auth.uid() and app.current_role() in('admin','staff')))));
create policy document_objects_upload on storage.objects for insert to authenticated with check(bucket_id='documents' and app.current_role() in('admin','staff') and exists(select 1 from public.documents d where d.storage_path=storage.objects.name and not d.ready and d.deleted_at is null and d.uploaded_by=auth.uid()));
create policy document_objects_cancel on storage.objects for delete to authenticated using(bucket_id='documents' and app.current_role() in('admin','staff') and exists(select 1 from public.documents d where d.storage_path=storage.objects.name and not d.ready and d.uploaded_by=auth.uid()));
