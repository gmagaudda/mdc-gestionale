begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'staff-test@example.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'brand-test@example.invalid');

select is((select count(*) from public.profiles where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222')), 2::bigint, 'auth trigger creates both profiles');
update public.profiles set role = 'admin' where id = '11111111-1111-4111-8111-111111111111';

set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select is((select app.current_role()), 'brand'::public.app_role, 'new user has least privileged role');
select is((select count(*) from public.profiles), 1::bigint, 'brand sees only own profile');
update public.profiles set full_name = 'Not allowed' where id = '22222222-2222-4222-8222-222222222222';
select is((select full_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'), '', 'brand cannot edit profile');

set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select is((select count(*) from public.profiles where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222')), 2::bigint, 'admin sees all profiles');
select * from finish();
rollback;
