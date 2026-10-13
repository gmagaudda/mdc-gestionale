begin;
set local request.jwt.claims='{"aal":"aal2"}';
select plan(6);
insert into auth.users(id, email) values
('00000000-0000-4000-8000-000000000011','audit-admin@example.test'),
('00000000-0000-4000-8000-000000000012','audit-brand@example.test');
update public.profiles set role='admin' where id='00000000-0000-4000-8000-000000000011';
-- Isolate the last-admin invariant inside this rolled-back test transaction.
update public.profiles set role='brand' where role='admin' and id<>'00000000-0000-4000-8000-000000000011';
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000012';
select is((select count(*) from public.audit_log), 0::bigint, 'brand cannot read audit');
select throws_ok($$select public.write_audit('test','profiles','00000000-0000-4000-8000-000000000012')$$, '42501', 'FORBIDDEN', 'brand cannot append audit');
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000011';
select ok((select count(*) from public.audit_log)>0, 'admin sees changes');
select throws_ok($$update public.profiles set is_active=false where id='00000000-0000-4000-8000-000000000011'$$, '23514', 'LAST_ADMIN', 'cannot deactivate last admin');
select lives_ok($$update public.profiles set full_name='Updated' where id='00000000-0000-4000-8000-000000000012'$$, 'admin changes profile');
select is((select actor_id::text from public.audit_log where record_id='00000000-0000-4000-8000-000000000012' and after->>'full_name'='Updated'), '00000000-0000-4000-8000-000000000011', 'audit derives actor from session');
select * from finish();
rollback;
