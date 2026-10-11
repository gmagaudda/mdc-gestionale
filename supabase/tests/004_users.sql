begin;
select plan(6);
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000041','users-admin@example.test'),
('00000000-0000-4000-8000-000000000042','users-brand@example.test');
update public.profiles set role='admin' where id='00000000-0000-4000-8000-000000000041';
insert into public.brands(id,name) values('00000000-0000-4000-8000-000000000043','Users brand');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000042';
select throws_ok($$select public.save_user('00000000-0000-4000-8000-000000000042','Name','staff',true,'{}')$$,'42501','FORBIDDEN','user cannot promote self');
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000041';
select lives_ok($$select public.save_user('00000000-0000-4000-8000-000000000042','Name','brand',true,'{00000000-0000-4000-8000-000000000043}')$$,'admin associates brand');
select is((select count(*) from public.brand_users where user_id='00000000-0000-4000-8000-000000000042'),1::bigint,'membership saved');
select is((select count(*) from public.audit_log where table_name='brand_users' and actor_id='00000000-0000-4000-8000-000000000041'),1::bigint,'membership audited');
select lives_ok($$select public.save_user('00000000-0000-4000-8000-000000000042','Name','staff',false,'{}')$$,'admin changes role and deactivates');
select is((select count(*) from public.brand_users where user_id='00000000-0000-4000-8000-000000000042'),0::bigint,'internal role removes old memberships');
select * from finish();
rollback;
