create extension if not exists pg_trgm with schema extensions;
create table public.import_profiles (
 id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 1 and 200),
 entity text not null check(entity in('customers','orders','budgets','performance')),
 sheet_name text not null check(length(sheet_name) between 1 and 100),header_row integer not null check(header_row between 1 and 1000),
 mapping jsonb not null check(jsonb_typeof(mapping)='object' and octet_length(mapping::text)<=16384),
 options jsonb not null default '{}' check(jsonb_typeof(options)='object' and octet_length(options::text)<=16384),
 created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.import_batches (
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in('customers','orders','budgets','mixed','performance')),
 profile_id uuid references public.import_profiles(id),season_id uuid references public.seasons(id),budget_season_id uuid references public.seasons(id),
 file_name text not null check(length(file_name) between 1 and 250 and lower(file_name) ~ '\.(xlsx|csv)$'),
 file_sha256 text not null check(file_sha256 ~ '^[a-f0-9]{64}$'),storage_path text not null unique,
 size_bytes integer not null check(size_bytes between 1 and 10485760),
 status text not null default 'uploaded' check(status in('uploaded','mapped','validated','ready','importing','completed','failed','rolled_back')),
 stats jsonb not null default '{}' check(jsonb_typeof(stats)='object' and octet_length(stats::text)<=32768),
 expected_totals jsonb not null default '{}' check(jsonb_typeof(expected_totals)='object' and octet_length(expected_totals::text)<=32768),
 options jsonb not null default '{}' check(jsonb_typeof(options)='object' and octet_length(options::text)<=32768),
 created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),completed_at timestamptz,rolled_back_at timestamptz,
 file_expires_at timestamptz not null default (now()+interval '90 days'),file_removed_at timestamptz,
 check(storage_path=id::text||case when lower(file_name) like '%.xlsx' then '.xlsx' else '.csv' end)
);
create unique index import_batches_active_hash on public.import_batches(kind,file_sha256) where status not in('failed','rolled_back');
create index import_batches_hash on public.import_batches(file_sha256,created_at desc);
create table public.import_rows (
 id uuid primary key default gen_random_uuid(),batch_id uuid not null references public.import_batches(id),
 entity text not null check(entity in('customers','orders','budgets','performance')),
 sheet text not null check(length(sheet) between 1 and 100),row_number integer not null check(row_number between 1 and 1048576),
 raw jsonb not null check(jsonb_typeof(raw)='object' and octet_length(raw::text)<=32768),
 mapped jsonb not null check(jsonb_typeof(mapped)='object' and octet_length(mapped::text)<=32768),
 status text not null check(status in('valid','warning','error','skipped','imported')),
 messages jsonb not null default '[]' check(jsonb_typeof(messages)='array' and octet_length(messages::text)<=16384),
 match jsonb not null default '{}' check(jsonb_typeof(match)='object' and octet_length(match::text)<=16384),
 target_id uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(batch_id,sheet,row_number,entity)
);
create index import_rows_batch_status on public.import_rows(batch_id,status,row_number);
-- Snapshots are private to SQL RPCs. They must not be an extra public data surface.
create table app.import_changes (
 batch_id uuid not null references public.import_batches(id),relation_name text not null,
 record_id uuid not null,before_row jsonb,after_row jsonb not null,
 primary key(batch_id,relation_name,record_id)
);
revoke all on app.import_changes from public,anon,authenticated;
create function app.can_import(p_kind text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(app.current_role()='admin' or (app.current_role()='accounting' and p_kind='budgets'),false)
$$;
revoke all on function app.can_import(text) from public;
grant execute on function app.can_import(text) to authenticated;
alter table public.import_profiles enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_rows enable row level security;
create policy import_profiles_read on public.import_profiles for select to authenticated using(app.can_import(entity));
create policy import_batches_read on public.import_batches for select to authenticated using(app.can_import(kind));
create policy import_rows_read on public.import_rows for select to authenticated using(exists(select 1 from public.import_batches b where b.id=batch_id and app.can_import(b.kind)));
revoke all on public.import_profiles,public.import_batches,public.import_rows from anon,authenticated;
grant select on public.import_profiles,public.import_batches,public.import_rows to authenticated;
create trigger import_profiles_updated before update on public.import_profiles for each row execute function app.set_updated_at();
create trigger import_batches_updated before update on public.import_batches for each row execute function app.set_updated_at();
create trigger import_rows_updated before update on public.import_rows for each row execute function app.set_updated_at();
create trigger import_profiles_audit after insert or update or delete on public.import_profiles for each row execute function app.audit_row_change();
create trigger import_batches_audit after insert or update or delete on public.import_batches for each row execute function app.audit_row_change();
-- Batch audit records the operation. Per-row payloads are not multiplied into the audit log.
alter table public.customers add column import_batch_id uuid references public.import_batches(id);
alter table public.brands add column import_batch_id uuid references public.import_batches(id);
alter table public.orders add column external_ref text check(length(external_ref)<=200),add column import_batch_id uuid references public.import_batches(id),add column import_granularity text check(import_granularity in('order_lines','order_totals'));
alter table public.order_lines add column import_batch_id uuid references public.import_batches(id);
alter table public.seasons add column import_batch_id uuid references public.import_batches(id);
alter table public.products add column import_batch_id uuid references public.import_batches(id);
alter table public.product_variants add column import_batch_id uuid references public.import_batches(id);
alter table public.budgets add column import_batch_id uuid references public.import_batches(id);
create unique index orders_external_ref on public.orders(brand_id,external_ref) where external_ref is not null and deleted_at is null;
create index customers_name_trgm on public.customers using gin(legal_name extensions.gin_trgm_ops);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('imports','imports',false,10485760,array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv']);
create policy imports_objects_read on storage.objects for select to authenticated using(bucket_id='imports' and exists(select 1 from public.import_batches b where b.storage_path=name and b.file_removed_at is null and app.can_import(b.kind)));
create policy imports_objects_upload on storage.objects for insert to authenticated with check(bucket_id='imports' and exists(select 1 from public.import_batches b where b.storage_path=name and b.status='uploaded' and b.created_by=auth.uid() and app.can_import(b.kind)));
create policy imports_objects_cancel on storage.objects for delete to authenticated using(bucket_id='imports' and exists(select 1 from public.import_batches b where b.storage_path=name and b.status in('uploaded','failed') and b.created_by=auth.uid() and app.can_import(b.kind)));
create function public.start_import_batch(p_id uuid,p_kind text,p_filename text,p_sha256 text,p_size integer) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 if not app.can_import(p_kind) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 insert into public.import_batches(id,kind,file_name,file_sha256,size_bytes,storage_path)
 values(p_id,p_kind,p_filename,p_sha256,p_size,p_id::text||case when lower(p_filename) like '%.xlsx' then '.xlsx' else '.csv' end);
 return p_id;
end;$$;
create function public.fail_import_upload(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.import_batches set status='failed' where id=p_id and status='uploaded' and created_by=auth.uid() and app.can_import(kind);
 if not found then raise exception 'FORBIDDEN' using errcode='42501';end if;
end;$$;
revoke all on function public.start_import_batch(uuid,text,text,text,integer),public.fail_import_upload(uuid) from public;
grant execute on function public.start_import_batch(uuid,text,text,text,integer),public.fail_import_upload(uuid) to authenticated;
