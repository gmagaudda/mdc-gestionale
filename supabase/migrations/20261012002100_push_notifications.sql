-- Personal preferences are an explicit exception to brand business-readonly.
-- Endpoint and encryption material are never exposed by table grants or audit.
create table public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 endpoint text not null unique check(length(endpoint)<=2048 and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|wns2-[a-z0-9]+\.notify\.windows\.com)/[^#]+$'),
 p256dh text not null check(p256dh ~ '^B[A-Za-z0-9_-]{86}$' and get_byte(decode(translate(p256dh,'-_','+/')||'=','base64'),0)=4),
 auth text not null check(auth ~ '^[A-Za-z0-9_-]{22}$'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon,authenticated;
grant select(id,user_id,created_at,updated_at) on public.push_subscriptions to authenticated;
create policy push_own_read on public.push_subscriptions for select to authenticated using(user_id=auth.uid() and app.current_role() is not null);
create trigger push_subscriptions_updated before update on public.push_subscriptions for each row execute function app.set_updated_at();
create function app.audit_push_subscription() returns trigger language plpgsql security definer set search_path='' as $$
declare b jsonb; a jsonb;
begin
 if tg_op<>'INSERT' then b:=jsonb_build_object('user_id',old.user_id,'created_at',old.created_at);end if;
 if tg_op<>'DELETE' then a:=jsonb_build_object('user_id',new.user_id,'created_at',new.created_at);end if;
 insert into public.audit_log(actor_id,action,table_name,record_id,before,after) values(auth.uid(),lower(tg_op),tg_table_name,coalesce(new.id,old.id),b,a);
 return coalesce(new,old);
end;$$;
create trigger push_subscriptions_audit after insert or update or delete on public.push_subscriptions for each row execute function app.audit_push_subscription();
create function public.subscribe_push(p_endpoint text,p_p256dh text,p_auth text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or app.current_role() is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_endpoint is null or p_p256dh is null or p_auth is null then raise exception 'invalid subscription' using errcode='22023';end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if (select count(*) from public.push_subscriptions where user_id=auth.uid())>=10 and not exists(select 1 from public.push_subscriptions where endpoint=p_endpoint and user_id=auth.uid()) then raise exception 'device limit' using errcode='22023';end if;
 insert into public.push_subscriptions as s(user_id,endpoint,p256dh,auth) values(auth.uid(),p_endpoint,p_p256dh,p_auth)
 on conflict(endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth where s.user_id=auth.uid();
 if not found then raise exception 'subscription unavailable' using errcode='42501';end if;
end;$$;
create function public.has_push_subscription(p_endpoint text) returns boolean language sql stable security definer set search_path='' as $$
 select app.current_role() is not null and exists(select 1 from public.push_subscriptions where endpoint=p_endpoint and user_id=auth.uid())
$$;
create function public.revoke_push_subscription(p_endpoint text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'forbidden' using errcode='42501';end if;
 delete from public.push_subscriptions where user_id=auth.uid() and (p_endpoint is null or endpoint=p_endpoint);
end;$$;
revoke all on function public.subscribe_push(text,text,text),public.has_push_subscription(text),public.revoke_push_subscription(text) from public,anon;
grant execute on function public.subscribe_push(text,text,text),public.has_push_subscription(text),public.revoke_push_subscription(text) to authenticated;

create table public.push_deliveries (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
 starts_at timestamptz not null, lease_id uuid not null default gen_random_uuid(),
 status text not null default 'processing' check(status in('processing','sent','failed','discarded')),
 attempts integer not null default 1 check(attempts between 1 and 3),
 attempted_at timestamptz not null default now(), completed_at timestamptz,
 unique(event_id,subscription_id,starts_at)
);
alter table public.push_deliveries enable row level security;
revoke all on public.push_deliveries from anon,authenticated;
create trigger push_deliveries_audit after insert or update on public.push_deliveries for each row execute function app.audit_row_change();
create function public.claim_push_reminders(p_start timestamptz,p_end timestamptz) returns table(delivery_id uuid,lease_id uuid,subscription_id uuid,endpoint text,p256dh text,auth text)
language plpgsql security definer set search_path='' as $$
begin
 if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>interval '26 hours' then raise exception 'invalid period' using errcode='22023';end if;
 return query with candidates as (
 select e.id event_id,e.starts_at,s.id subscription_id,s.endpoint,s.p256dh,s.auth from public.events e
 join public.profiles p on p.id=e.assigned_to join public.push_subscriptions s on s.user_id=p.id
 where e.deleted_at is null and e.type='appointment' and e.starts_at>=p_start and e.starts_at<p_end and p.is_active and p.role in('admin','staff','accounting')
 and not exists(select 1 from public.push_deliveries d where d.event_id=e.id and d.subscription_id=s.id and d.starts_at=e.starts_at and (d.status in('sent','discarded') or d.attempts>=3 or d.attempted_at>=now()-interval '15 minutes'))
 order by e.starts_at,e.id,s.id limit 100
 ), claims as (
 insert into public.push_deliveries as d(event_id,subscription_id,starts_at) select c.event_id,c.subscription_id,c.starts_at from candidates c
 on conflict on constraint push_deliveries_event_id_subscription_id_starts_at_key do update set lease_id=gen_random_uuid(),status='processing',attempts=d.attempts+1,attempted_at=now(),completed_at=null
 where d.status in('failed','processing') and d.attempts<3 and d.attempted_at<now()-interval '15 minutes'
 returning d.id,d.lease_id,d.event_id,d.subscription_id
 ) select cl.id,cl.lease_id,c.subscription_id,c.endpoint,c.p256dh,c.auth from claims cl join candidates c on c.event_id=cl.event_id and c.subscription_id=cl.subscription_id;
end;$$;
create function public.finish_push_reminder(p_id uuid,p_lease uuid,p_status text,p_expired boolean default false) returns boolean language plpgsql security definer set search_path='' as $$
declare affected integer; device uuid;
begin
 if p_status is null or p_status not in('sent','failed','discarded') then raise exception 'invalid status' using errcode='22023';end if;
 update public.push_deliveries set status=p_status,completed_at=case when p_status='failed' then null else now() end where id=p_id and lease_id=p_lease and status='processing' returning subscription_id into device;
 get diagnostics affected=row_count;
 if affected=1 and p_expired then delete from public.push_subscriptions where id=device;end if;
 return affected=1;
end;$$;
revoke all on function public.claim_push_reminders(timestamptz,timestamptz),public.finish_push_reminder(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.claim_push_reminders(timestamptz,timestamptz),public.finish_push_reminder(uuid,uuid,text,boolean) to service_role;
