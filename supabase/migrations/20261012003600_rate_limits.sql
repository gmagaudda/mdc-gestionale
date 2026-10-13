create table app.rate_limits (
 scope text not null,key_hash text not null check(key_hash~'^[a-f0-9]{64}$'),
 hits integer not null check(hits>0),reset_at timestamptz not null,
 primary key(scope,key_hash)
);
alter table app.rate_limits enable row level security;
create index rate_limits_expiry on app.rate_limits(reset_at);
revoke all on app.rate_limits from public,anon,authenticated,service_role;
create function public.consume_rate_limit(p_scope text,p_key_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare maximum integer;seconds integer;entry app.rate_limits;begin
 if auth.role() is distinct from 'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_key_hash is null or p_key_hash!~'^[a-f0-9]{64}$' then raise exception 'INVALID_KEY' using errcode='23514';end if;
 case p_scope when 'login_email' then maximum:=10;seconds:=900;
 when 'login_ip' then maximum:=500;seconds:=900;
 when 'reset_email' then maximum:=3;seconds:=3600;
 when 'reset_ip' then maximum:=100;seconds:=3600;
 when 'mfa_user' then maximum:=10;seconds:=60;
 when 'feed_ip' then maximum:=100;seconds:=60;
 when 'feed_token' then maximum:=60;seconds:=60;
 when 'webhook_ip' then maximum:=300;seconds:=60;
 else raise exception 'INVALID_SCOPE' using errcode='23514';end case;
 delete from app.rate_limits where (scope,key_hash) in(select scope,key_hash from app.rate_limits where reset_at<clock_timestamp()-interval '1 day' order by reset_at limit 1000);
 insert into app.rate_limits(scope,key_hash,hits,reset_at) values(p_scope,p_key_hash,1,clock_timestamp()+make_interval(secs=>seconds))
 on conflict(scope,key_hash) do update set hits=case when app.rate_limits.reset_at<=clock_timestamp() then 1 else least(app.rate_limits.hits+1,maximum+1) end,reset_at=case when app.rate_limits.reset_at<=clock_timestamp() then clock_timestamp()+make_interval(secs=>seconds) else app.rate_limits.reset_at end returning * into entry;
 return jsonb_build_object('allowed',entry.hits<=maximum,'retry_after',case when entry.hits<=maximum then 0 else greatest(1,ceil(extract(epoch from entry.reset_at-clock_timestamp()))::integer) end);
end;$$;
revoke all on function public.consume_rate_limit(text,text) from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,text) to service_role;
