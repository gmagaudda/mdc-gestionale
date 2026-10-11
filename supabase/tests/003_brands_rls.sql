begin;
select plan(12);
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000021','brand-admin@example.test'),
('00000000-0000-4000-8000-000000000022','brand-a@example.test'),
('00000000-0000-4000-8000-000000000023','brand-staff@example.test');
update public.profiles set role='admin' where id='00000000-0000-4000-8000-000000000021';
update public.profiles set role='staff' where id='00000000-0000-4000-8000-000000000023';
insert into public.brands(id,name) values ('00000000-0000-4000-8000-000000000031','Brand A'),('00000000-0000-4000-8000-000000000032','Brand B');
insert into public.brand_private(id,notes) values ('00000000-0000-4000-8000-000000000031','Private');
insert into public.brand_contacts(brand_id,name) values ('00000000-0000-4000-8000-000000000031','Private contact');
insert into public.brand_users(brand_id,user_id) values ('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000022');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000022';
select is((select count(*) from public.brands),1::bigint,'brand reads only assigned brands');
select is((select name from public.brands),'Brand A','assigned brand is correct');
select is((select count(*) from public.brand_private),0::bigint,'private fields are hidden');
select is((select count(*) from public.brand_contacts),0::bigint,'contacts are hidden');
select is(public.has_brand_access('00000000-0000-4000-8000-000000000032'),false,'foreign brand denied');
select throws_ok($$insert into public.brands(name) values ('Forbidden')$$,'42501',null,'brand cannot create');
with changed as (update public.brands set name='Forbidden' returning id) select is(count(*),0::bigint,'brand cannot update') from changed;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000023';
select is((select count(*) from public.brands),2::bigint,'staff reads all brands');
select is((select count(*) from public.brand_private),1::bigint,'staff reads private fields');
with changed as (update public.brands set name='Forbidden' returning id) select is(count(*),0::bigint,'staff cannot update') from changed;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000021';
select lives_ok($$update public.brands set name='Updated' where id='00000000-0000-4000-8000-000000000031'$$,'admin can update');
select ok((select count(*) from public.audit_log where table_name='brands' and after->>'name'='Updated')=1,'brand write produces transactional audit');
select * from finish();
rollback;
