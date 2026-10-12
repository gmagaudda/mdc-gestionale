create table public.ical_tokens (
 id uuid not null unique default gen_random_uuid(),
 user_id uuid primary key references public.profiles(id) on delete cascade,
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(), revoked_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.ical_tokens enable row level security;
revoke all on public.ical_tokens from anon,authenticated;
grant select(user_id,created_at,revoked_at) on public.ical_tokens to authenticated;
create policy ical_own_read on public.ical_tokens for select to authenticated using(user_id=auth.uid() and app.current_role() is not null);
create trigger ical_tokens_updated before update on public.ical_tokens for each row execute function app.set_updated_at();
create trigger ical_tokens_audit after insert or update or delete on public.ical_tokens for each row execute function app.audit_row_change();
create function public.rotate_ical_token(p_hash text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or app.current_role() is null then raise exception 'forbidden' using errcode='42501'; end if;
 if p_hash !~ '^[a-f0-9]{64}$' or p_hash is null then raise exception 'invalid hash' using errcode='22023'; end if;
 insert into public.ical_tokens(user_id,token_hash) values(auth.uid(),p_hash)
 on conflict(user_id) do update set token_hash=excluded.token_hash,created_at=now(),revoked_at=null;
end;$$;
create function public.revoke_ical_token() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or app.current_role() is null then raise exception 'forbidden' using errcode='42501'; end if;
 update public.ical_tokens set revoked_at=now() where user_id=auth.uid() and revoked_at is null;
end;$$;
revoke all on function public.rotate_ical_token(text),public.revoke_ical_token() from public,anon;
grant execute on function public.rotate_ical_token(text),public.revoke_ical_token() to authenticated;
-- Only the public feed route can use this RPC. Check live profile and membership on every request.
-- Return only publishable calendar fields, never customer or assignee identifiers.
create function public.read_ical_feed(p_hash text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare owner_id uuid; owner_role public.app_role;
begin
 select p.id,p.role into owner_id,owner_role from public.ical_tokens t join public.profiles p on p.id=t.user_id where t.token_hash=p_hash and t.revoked_at is null and p.is_active;
 if owner_id is null then return null; end if;
 return coalesce((select jsonb_agg(to_jsonb(x)) from (
 select e.id,e.title,e.description,e.starts_at,e.ends_at,e.all_day,e.location,e.updated_at
 from public.events e where e.deleted_at is null and (
 owner_role in('admin','staff','accounting') or
 (owner_role='brand' and e.visible_to_brand and exists(select 1 from public.brand_users bu join public.brands b on b.id=bu.brand_id where bu.user_id=owner_id and bu.brand_id=e.brand_id and b.deleted_at is null)))
 order by e.starts_at,e.id limit 5001
 )x),'[]'::jsonb);
end;$$;
revoke all on function public.read_ical_feed(text) from public,anon,authenticated;
grant execute on function public.read_ical_feed(text) to service_role;

create table public.event_reminders (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 starts_at timestamptz not null, lease_id uuid not null default gen_random_uuid(),
 status text not null default 'processing' check(status in('processing','sent','logged','failed')),
 attempted_at timestamptz not null default now(), completed_at timestamptz,
 unique(event_id,recipient_id,starts_at)
);
alter table public.event_reminders enable row level security;
revoke all on public.event_reminders from anon,authenticated;
create trigger event_reminders_audit after insert or update on public.event_reminders for each row execute function app.audit_row_change();
-- One atomic claim prevents concurrent schedulers from sending the same reminder.
-- A failed claim or a crashed worker can retry. Completed reminders stay completed.
create function public.claim_event_reminders(p_start timestamptz,p_end timestamptz) returns table(
 reminder_id uuid,lease_id uuid,event_id uuid,email text,title text,description text,location text,starts_at timestamptz,ends_at timestamptz,all_day boolean
) language plpgsql security definer set search_path='' as $$
begin
 if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>interval '26 hours' then raise exception 'invalid period' using errcode='22023'; end if;
 return query with candidates as (
 select e.* ,p.email as recipient_email from public.events e join public.profiles p on p.id=e.assigned_to
 where e.deleted_at is null and e.type='appointment' and e.starts_at>=p_start and e.starts_at<p_end
 and p.is_active and p.role in('admin','staff','accounting')
 and not exists(select 1 from public.event_reminders r where r.event_id=e.id and r.recipient_id=e.assigned_to and r.starts_at=e.starts_at and (r.status in('sent','logged') or (r.status='processing' and r.attempted_at>=now()-interval '10 minutes')))
 order by e.starts_at,e.id limit 500
 ), claims as (
 insert into public.event_reminders as r(event_id,recipient_id,starts_at)
 select c.id,c.assigned_to,c.starts_at from candidates c
 on conflict on constraint event_reminders_event_id_recipient_id_starts_at_key do update set lease_id=gen_random_uuid(),status='processing',attempted_at=now(),completed_at=null
 where r.status='failed' or (r.status='processing' and r.attempted_at<now()-interval '10 minutes')
 returning r.id,r.lease_id,r.event_id
 ) select cl.id,cl.lease_id,c.id,c.recipient_email,c.title,c.description,c.location,c.starts_at,c.ends_at,c.all_day from claims cl join candidates c on c.id=cl.event_id;
end;$$;
create function public.finish_event_reminder(p_id uuid,p_lease uuid,p_status text) returns boolean language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 if p_status not in('sent','logged','failed') or p_status is null then raise exception 'invalid status' using errcode='22023'; end if;
 update public.event_reminders set status=p_status,completed_at=case when p_status='failed' then null else now() end where id=p_id and lease_id=p_lease and status='processing';
 get diagnostics affected=row_count; return affected=1;
end;$$;
revoke all on function public.claim_event_reminders(timestamptz,timestamptz),public.finish_event_reminder(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_event_reminders(timestamptz,timestamptz),public.finish_event_reminder(uuid,uuid,text) to service_role;
