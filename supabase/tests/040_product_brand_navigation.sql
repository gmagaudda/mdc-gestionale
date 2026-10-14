begin;
select no_plan();
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000004001','brand-navigation-staff@example.test'),
 ('00000000-0000-4000-8000-000000004002','brand-navigation-portal@example.test');
update public.profiles set role='staff' where id='00000000-0000-4000-8000-000000004001';
insert into public.brands(id,name,deleted_at) values
 ('00000000-0000-4000-8000-000000004003','Brand navigation A',null),
 ('00000000-0000-4000-8000-000000004004','Brand navigation B',null),
 ('00000000-0000-4000-8000-000000004005','Brand navigation archived',now());
insert into public.seasons(id,brand_id,code,name) values
 ('00000000-0000-4000-8000-000000004006','00000000-0000-4000-8000-000000004003','SS26','Brand navigation A'),
 ('00000000-0000-4000-8000-000000004007','00000000-0000-4000-8000-000000004004','SS26','Brand navigation B'),
 ('00000000-0000-4000-8000-000000004008','00000000-0000-4000-8000-000000004005','SS26','Brand navigation archived');
insert into public.products(id,brand_id,season_id,sku_base,name,wholesale_price_cents) values
 ('00000000-0000-4000-8000-000000004009','00000000-0000-4000-8000-000000004003','00000000-0000-4000-8000-000000004006','BN-A','Brand navigation product A',100),
 ('00000000-0000-4000-8000-000000004010','00000000-0000-4000-8000-000000004004','00000000-0000-4000-8000-000000004007','BN-B','Brand navigation product B',300),
 ('00000000-0000-4000-8000-000000004011','00000000-0000-4000-8000-000000004005','00000000-0000-4000-8000-000000004008','BN-X','Brand navigation product archived',9999);
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000004001';
select is(public.table_metrics('products','Brand navigation')->'cards'->0->'periods'->'total'->>'value','2','all metrics exclude products of archived brands');
select is(public.table_metrics('products',p_filters=>'{"brand_id":"00000000-0000-4000-8000-000000004003"}')->'cards'->0->'periods'->'total'->>'value','1','brand scopes product count');
select is(public.table_metrics('products',p_filters=>'{"brand_id":"00000000-0000-4000-8000-000000004004"}')->'cards'->1->'periods'->'total'->>'value','300','brand scopes exact average cents');
select is(public.table_metrics('products','absent',p_filters=>'{"brand_id":"00000000-0000-4000-8000-000000004003"}')->'cards'->0->'periods'->'total'->>'value','0','brand intersects general search');
select is(public.table_metrics('products',p_filters=>'{"brand_id":"00000000-0000-4000-8000-000000004003"}',p_columns=>'{"wholesale_price_cents":"300"}')->'cards'->0->'periods'->'total'->>'value','0','brand intersects column filters');
select is(public.table_metrics('products',p_filters=>'{"brand_id":"00000000-0000-4000-8000-000000004005"}')->'cards'->0->'periods'->'total'->>'value','0','archived brand metrics empty');
select throws_ok($$select public.table_metrics('products',p_filters=>'{"brand_id":"invalid"}')$$,'22P02',null,'invalid product brand UUID refused');
select is(jsonb_array_length(public.export_business_list('products','Brand navigation')->'rows'),2,'all export excludes archived brand');
select is(public.export_business_list('products',p_brand_id=>'00000000-0000-4000-8000-000000004003')->'rows'->0->>'sku_base','BN-A','brand scopes CSV');
select is(jsonb_array_length(public.export_business_list('products','absent',p_brand_id=>'00000000-0000-4000-8000-000000004003')->'rows'),0,'CSV intersects brand and search');
select is(jsonb_array_length(public.export_business_list('products',p_brand_id=>'00000000-0000-4000-8000-000000004003',p_ids=>array['00000000-0000-4000-8000-000000004010']::uuid[])->'rows'),0,'selected IDs cannot escape brand scope');
select is(jsonb_array_length(public.export_business_list('products',p_brand_id=>'00000000-0000-4000-8000-000000004005')->'rows'),0,'archived brand export empty');
select throws_ok($$select public.export_business_list('customers',p_brand_id=>'00000000-0000-4000-8000-000000004003')$$,'22023',null,'product-only brand argument rejected on other entities');
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000004002';
select throws_ok($$select public.table_metrics('products',p_filters=>'{"brand_id":"00000000-0000-4000-8000-000000004003"}')$$,'42501',null,'portal cannot access internal product metrics');
select throws_ok($$select public.export_business_list('products',p_brand_id=>'00000000-0000-4000-8000-000000004003')$$,'42501',null,'portal cannot access internal CSV');
reset role;
select is((select count(*) from public.products where id='00000000-0000-4000-8000-000000004011'),1::bigint,'archived catalog product is preserved');
select * from finish();
rollback;
