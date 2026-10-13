begin;
set local request.jwt.claims='{"aal":"aal2"}';
set local statement_timeout='60s';
select no_plan();
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000960','import-capacity@example.test');
update public.profiles set role='admin' where id='00000000-0000-4000-8000-000000000960';
create temp table import_benchmark(started timestamptz,finished timestamptz);grant all on import_benchmark to authenticated;
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000960';
select public.start_import_batch('00000000-0000-4000-8000-000000000961','performance','capacity.xlsx',repeat('f',64),100);
insert into storage.objects(bucket_id,name,metadata) values('imports','00000000-0000-4000-8000-000000000961.xlsx','{"size":100}');
select public.configure_import_batch('00000000-0000-4000-8000-000000000961','{"pivotBrands":[]}','{"orders_ss26":20000}');
insert into import_benchmark(started) values(clock_timestamp());
with mapped as (
 select i,jsonb_build_object('row_number',i,'brand','Synthetic capacity','customer','','representative','','area','','country','','region','','city','','customer_status','','values',jsonb_build_object('orders_ss26',1,'budget_fw26',null,'orders_fw26',null,'budget_ss27',null,'orders_ss27',null)) data from generate_series(1,20000) i
),chunks as (
 select (i-1)/500 chunk,jsonb_agg(jsonb_build_object('entity','performance','sheet','Capacity','row_number',i,'raw',data,'mapped',data,'status','warning','messages',jsonb_build_array(jsonb_build_object('code','missingCustomer')))) payload from mapped group by (i-1)/500
) select public.stage_import_rows('00000000-0000-4000-8000-000000000961',payload) from chunks order by chunk;
update import_benchmark set finished=clock_timestamp();
select ok((select extract(epoch from finished-started)<60 from import_benchmark),'20000 rows staged in chunks under 60 seconds');
select is((select count(*) from public.import_rows where batch_id='00000000-0000-4000-8000-000000000961'),20000::bigint,'all source rows staged');
select throws_ok($$select public.stage_import_rows('00000000-0000-4000-8000-000000000961',jsonb_build_array(jsonb_build_object('entity','performance','sheet','Capacity','row_number',20001,'raw','{}'::jsonb,'mapped','{}'::jsonb,'status','valid')))$$,'23514','ROW_LIMIT','20001st row rejected');
select is((select count(*) from public.import_rows where batch_id='00000000-0000-4000-8000-000000000961'),20000::bigint,'limit rejection atomic');
select lives_ok($$select public.complete_performance_import('00000000-0000-4000-8000-000000000961')$$,'SQL revalidates every staged row and commits');
select is(public.performance_report('00000000-0000-4000-8000-000000000961')->'totals'->>'orders_ss26','20000','complete totals match independent integer sum');
select * from finish();rollback;
