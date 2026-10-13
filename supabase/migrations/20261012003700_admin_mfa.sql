create function app.mfa_satisfied() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select is_active and (role<>'admin' or auth.jwt()->>'aal'='aal2') from public.profiles where id=auth.uid()),false)
$$;
create or replace function app.current_role() returns public.app_role language sql stable security definer set search_path='' as $$
 select role from public.profiles where id=auth.uid() and is_active and (role<>'admin' or auth.jwt()->>'aal'='aal2')
$$;
revoke all on function app.mfa_satisfied() from public;
grant execute on function app.mfa_satisfied() to authenticated;
-- Own profile SELECT is intentionally available at aal1 for enrollment. All
-- business tables also get a restrictive policy, covering membership or personal
-- policies that do not otherwise consult current_role(). Existing role policies
-- still decide what an authenticated, MFA-compliant account can do.
do $$declare relation record;begin
 for relation in select tablename from pg_tables where schemaname='public' and tablename<>'profiles' loop
 execute format('create policy admin_mfa_required on public.%I as restrictive for all to authenticated using((select app.mfa_satisfied())) with check((select app.mfa_satisfied()))',relation.tablename);
 end loop;
end;$$;
create policy admin_mfa_required on storage.objects as restrictive for all to authenticated using((select app.mfa_satisfied())) with check((select app.mfa_satisfied()));
create policy admin_mfa_required on storage.buckets as restrictive for all to authenticated using((select app.mfa_satisfied())) with check((select app.mfa_satisfied()));

-- Avoid documents DELETE -> Storage SELECT -> documents policy recursion. This
-- narrow ownership check exposes no object data and only admits unready uploads.
create function app.can_cancel_pending_document(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(app.current_role() in('admin','staff'),false) and exists(select 1 from public.documents d where d.id=p_id and d.uploaded_by=auth.uid() and not d.ready and not exists(select 1 from storage.objects o where o.bucket_id='documents' and o.name=d.storage_path))
$$;
revoke all on function app.can_cancel_pending_document(uuid) from public;
grant execute on function app.can_cancel_pending_document(uuid) to authenticated;
drop policy documents_cancel_pending on public.documents;
create policy documents_cancel_pending on public.documents for delete to authenticated using(app.can_cancel_pending_document(id));
