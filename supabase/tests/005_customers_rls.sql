begin;
set local request.jwt.claims='{"aal":"aal2"}';
select plan(9);
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000051','customers-brand@example.test'),
('00000000-0000-4000-8000-000000000052','customers-staff@example.test'),
('00000000-0000-4000-8000-000000000053','customers-accounting@example.test');
update public.profiles set role='staff' where id='00000000-0000-4000-8000-000000000052';
update public.profiles set role='accounting' where id='00000000-0000-4000-8000-000000000053';
insert into public.customers(id,legal_name) values('00000000-0000-4000-8000-000000000054','Store');
insert into public.customer_contacts(customer_id,name) values('00000000-0000-4000-8000-000000000054','Private buyer');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000051';
select is((select count(*) from public.customers),0::bigint,'brand cannot read customers');
select is((select count(*) from public.customer_contacts),0::bigint,'brand cannot read customer contacts');
select throws_ok($$insert into public.customers(legal_name) values('Forbidden')$$,'42501',null,'brand cannot create customers');
with changed as (update public.customers set legal_name='Forbidden' returning id) select is(count(*),0::bigint,'brand cannot update customers') from changed;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000052';
select lives_ok($$update public.customers set legal_name='Updated store' where id='00000000-0000-4000-8000-000000000054'$$,'staff edits customers');
select throws_ok($$update public.customers set vat_number='123' where id='00000000-0000-4000-8000-000000000054'$$,'23514',null,'database rejects invalid VAT');
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000053';
select is((select legal_name from public.customers where id='00000000-0000-4000-8000-000000000054'),'Updated store','accounting reads customers');
with changed as (update public.customers set legal_name='Forbidden' returning id) select is(count(*),0::bigint,'accounting cannot edit customers') from changed;
select throws_ok($$insert into public.customer_contacts(customer_id,name) values('00000000-0000-4000-8000-000000000054','Forbidden')$$,'42501',null,'accounting cannot create contacts');
select * from finish();
rollback;
