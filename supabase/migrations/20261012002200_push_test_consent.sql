-- A test notification requires a live own subscription and a per-device cooldown.
alter table public.push_subscriptions add column last_test_at timestamptz;
create function public.claim_push_test(p_endpoint text,p_p256dh text,p_auth text) returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 if auth.uid() is null or app.current_role() not in('admin','staff','accounting') or app.current_role() is null then raise exception 'forbidden' using errcode='42501';end if;
 update public.push_subscriptions set last_test_at=now() where endpoint=p_endpoint and user_id=auth.uid() and p256dh=p_p256dh and auth=p_auth and (last_test_at is null or last_test_at<now()-interval '1 minute');
 get diagnostics changed=row_count;return changed=1;
end;$$;
revoke all on function public.claim_push_test(text,text,text) from public,anon;
grant execute on function public.claim_push_test(text,text,text) to authenticated;
