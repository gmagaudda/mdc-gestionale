begin;
select no_plan();
set local request.jwt.claims='{"aal":"aal2"}';
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000003901','metric-staff@example.test'),
 ('00000000-0000-4000-8000-000000003902','metric-brand@example.test'),
 ('00000000-0000-4000-8000-000000003903','metric-admin@example.test');
update public.profiles set role='staff' where id='00000000-0000-4000-8000-000000003901';
update public.profiles set role='admin' where id='00000000-0000-4000-8000-000000003903';
insert into public.brands(id,name,can_see_customer_names) values
 ('00000000-0000-4000-8000-000000003904','Metric brand A',false),
 ('00000000-0000-4000-8000-000000003905','Metric brand B',true);
insert into public.brand_users(brand_id,user_id) values('00000000-0000-4000-8000-000000003904','00000000-0000-4000-8000-000000003902');
insert into public.customers(id,legal_name,city,notes) values('00000000-0000-4000-8000-000000003906','Metric private customer','Roma','Metric hidden note');
insert into public.seasons(id,brand_id,code,name) values('00000000-0000-4000-8000-000000003907','00000000-0000-4000-8000-000000003904','SS26','Metric season');
insert into public.products(id,brand_id,season_id,sku_base,name,wholesale_price_cents,vat_rate) values
 ('00000000-0000-4000-8000-000000003908','00000000-0000-4000-8000-000000003904','00000000-0000-4000-8000-000000003907','METRIC-1','Metric product 1',100,0),
 ('00000000-0000-4000-8000-000000003909','00000000-0000-4000-8000-000000003904','00000000-0000-4000-8000-000000003907','METRIC-2','Metric product 2',101,0);
insert into public.product_variants(id,product_id,brand_id,size,color,sku) values('00000000-0000-4000-8000-000000003910','00000000-0000-4000-8000-000000003908','00000000-0000-4000-8000-000000003904','M','Nero','METRIC-M');
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-4000-8000-000000003901';
do $$declare day date; oid uuid; n int; today date:=(statement_timestamp() at time zone 'Europe/Rome')::date;begin
for n in 1..8 loop
 day:=case n when 1 then today when 2 then today-6 when 3 then today-7 when 4 then (today-interval '1 year')::date when 5 then today+1 when 6 then today-100 when 7 then (today-interval '2 years')::date else (today-interval '1 year')::date+1 end;
 oid:=public.save_order(null,jsonb_build_object('brand_id','00000000-0000-4000-8000-000000003904','customer_id','00000000-0000-4000-8000-000000003906','season_id','00000000-0000-4000-8000-000000003907','order_date',day,'delivery_date','','discount_pct',0,'internal_notes','Metric hidden order'),jsonb_build_array(jsonb_build_object('variant_id','00000000-0000-4000-8000-000000003910','quantity',n,'unit_price_cents',100,'discount_pct',0)));
 perform public.change_order_status(oid,'confirmed','');
end loop;end;$$;
select is(public.table_metrics('orders','Metric brand A')->'cards'->0->'periods'->'week'->>'value','2','7 days includes today and lower boundary, excludes day 8 and future orders');
select is(public.table_metrics('orders','Metric brand A')->'cards'->0->'periods'->'month'->>'value','3','30 days includes all matching rows in window');
select is(public.table_metrics('orders','Metric brand A')->'cards'->1->'periods'->'week'->>'value','300','money sums exact cents');
select is(public.table_metrics('orders','Metric brand A')->'cards'->2->'periods'->'week'->>'value','150','average computed on complete filtered cohort');
select is(public.table_metrics('orders','Metric brand A')->'cards'->1->'periods'->'week'->>'previous','400','comparison uses same calendar period last year');
select is(public.table_metrics('orders','Metric brand A')->'cards'->0->'periods'->'year'->>'value','5','year includes calendar lower boundary and older-than-month rows, excludes future');
select is(public.table_metrics('orders','Metric brand A')->'cards'->1->'periods'->'year'->>'value','2000','year sums exact cents across the complete year');
select is(public.table_metrics('orders','Metric brand A')->'cards'->1->'periods'->'year'->>'previous','400','previous year excludes its lower boundary minus one day');
select is(public.table_metrics('orders','Metric brand A')->'cards'->0->'periods'->'total'->>'value','8','total includes old and future matching orders');
select is(public.table_metrics('orders','Metric brand A')->'cards'->1->'periods'->'total'->>'value','3600','total money has no date limits');
select is(public.table_metrics('orders','Metric brand A')->'cards'->2->'periods'->'total'->>'value','450','total average uses all matching orders');
select is(public.table_metrics('orders','Metric brand A')->'cards'->0->'periods'->'total'->'previous','null'::jsonb,'total has no misleading comparison');
select is(public.table_metrics('orders','Metric brand A',p_filters=>'{"status":"draft"}')->'cards'->0->'periods'->'total'->>'value','0','total honors status filters');

select is(public.table_metrics('orders','Metric brand A',p_filters=>'{"status":"draft"}')->'cards'->0->'periods'->'year'->>'value','0','status filters apply before aggregation');
select is(public.table_metrics('orders','Metric hidden order')->'cards'->0->'periods'->'year'->>'value','0','hidden notes do not affect metrics search');
select is(public.table_metrics('products','Metric product')->'cards'->1->'periods'->'month'->>'value','101','average rounds half cent in SQL');
select is(public.table_metrics('products','Metric product',p_columns=>'{"wholesale_price_cents":"100"}')->'cards'->0->'periods'->'month'->>'value','1','money column equality matches table filters');
select is(public.table_metrics('customers','Metric hidden note')->'cards'->0->'periods'->'month'->>'value','0','private customer data never influences search');
select is(public.table_metrics('customers','Metric private',p_columns=>'{"city":"ROMA"}')->'cards'->0->'periods'->'month'->>'value','1','text column filters case insensitive');
select is(public.table_metrics('customers','No-match-metric')->'cards'->0->'periods'->'month'->>'value','0','empty filter returns three zero metrics');
select throws_ok($$select public.table_metrics('orders',p_filters=>'{"brand_id":"invalid"}')$$,'22P02',null,'invalid UUID refused');
select throws_ok($$select public.table_metrics('customers',p_columns=>'{"notes":"hidden"}')$$,'22023',null,'private column refused');
select throws_ok($$select public.table_metrics('products',p_columns=>'{"wholesale_price_cents":"0.1"}')$$,'22023',null,'fractional cents refused');
select throws_ok($$select public.table_metrics('products',p_columns=>'{"name;drop table orders":"x"}')$$,'22023',null,'identifier injection refused');
select throws_ok($$select public.table_metrics('orders',repeat('a',101))$$,'22023',null,'oversized search refused');
select throws_ok($$select public.table_metrics('orders',p_filters=>'[]')$$,'22023',null,'non-object filters refused');
select throws_ok($$select public.table_metrics('orders',p_filters=>'{"from":"2026-01-01"}')$$,'22023',null,'removed date filters cannot affect aggregates');
select throws_ok($$select public.table_metrics('settings/users')$$,'42501',null,'staff cannot read administrative metrics');
select throws_ok($$select public.table_metrics('settings/audit')$$,'42501',null,'staff cannot read audit metrics');
select throws_ok($$select public.table_metrics('imports')$$,'42501',null,'staff cannot read import metrics');
select throws_ok($$select public.table_metrics('portal/orders')$$,'42501',null,'staff cannot impersonate portal metrics');
select lives_ok($$select public.table_metrics('brands')$$,'brand metrics');
select lives_ok($$select public.table_metrics('seasons')$$,'season metrics');
select lives_ok($$select public.table_metrics('budgets')$$,'budget metrics');
select lives_ok($$select public.table_metrics('documents')$$,'ready documents metrics');
select lives_ok($$select public.table_metrics('invoices',p_filters=>'{"status":"issued","overdue":"yes"}')$$,'invoice balance and overdue metrics');
select lives_ok($$select public.table_metrics('commissions')$$,'commission metrics');
reset role;
insert into public.customers(legal_name) select 'Metric capacity '||n from generate_series(1,10002) n;
set local role authenticated;
select is(public.table_metrics('customers','Metric capacity')->'cards'->0->'periods'->'month'->>'value','10002','metrics have no page or export cap');
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000003902';
select throws_ok($$select public.table_metrics('orders')$$,'42501',null,'brand cannot read internal metrics');
select is(public.table_metrics('portal/orders','Metric brand A')->'cards'->0->'periods'->'month'->>'value','3','brand sees own orders');
select is(public.table_metrics('portal/orders','Metric brand B')->'cards'->0->'periods'->'month'->>'value','0','brand sees no unlinked brand');
select is(public.table_metrics('portal/orders','Metric brand A')->'cards'->0->'periods'->'total'->>'value','8','portal total includes all linked brand dates');
select is(public.table_metrics('portal/orders','Metric brand B')->'cards'->0->'periods'->'total'->>'value','0','total still excludes unlinked brands');
select is(public.table_metrics('portal/orders','Metric private customer')->'cards'->0->'periods'->'total'->>'value','0','total search preserves customer masking');
select is(public.table_metrics('portal/orders','Metric private customer')->'cards'->0->'periods'->'month'->>'value','0','portal order search honors customer masking');
select is(public.table_metrics('portal/sales','Metric brand A')->'cards'->1->'periods'->'month'->>'value','600','portal sales aggregates underlying matching groups in selected window');
select is(public.table_metrics('portal/sales','Metric private customer')->'cards'->0->'periods'->'month'->>'value','0','portal grouped search honors customer masking');
select lives_ok($$select public.table_metrics('portal/documents')$$,'portal documents retain RLS');
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000003903';
select lives_ok($$select public.table_metrics('settings/users')$$,'verified admin user metrics');
select lives_ok($$select public.table_metrics('settings/audit')$$,'verified admin audit metrics');
select lives_ok($$select public.table_metrics('imports')$$,'verified admin import metrics');
set local request.jwt.claims='{"aal":"aal1"}';
select throws_ok($$select public.table_metrics('customers')$$,'42501',null,'password-only admin cannot aggregate');
reset role;
select ok(not has_function_privilege('anon','public.table_metrics(text,text,jsonb,jsonb)','execute'),'anonymous metric access denied');
select ok(not (select prosecdef from pg_proc where oid='public.table_metrics(text,text,jsonb,jsonb)'::regprocedure),'metrics never bypass session RLS');
select * from finish();rollback;
