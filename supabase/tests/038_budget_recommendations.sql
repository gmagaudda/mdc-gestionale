begin;
select no_plan();
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','suggest-account@example.test'),
 ('10000000-0000-4000-8000-000000000002','suggest-staff@example.test'),
 ('10000000-0000-4000-8000-000000000003','suggest-brand@example.test'),
 ('10000000-0000-4000-8000-000000000004','suggest-admin@example.test');
update public.profiles set role='accounting' where id='10000000-0000-4000-8000-000000000001';
update public.profiles set role='staff' where id='10000000-0000-4000-8000-000000000002';
update public.profiles set role='admin' where id='10000000-0000-4000-8000-000000000004';
insert into public.brands(id,name) values('10000000-0000-4000-8000-000000000010','Suggestion brand');
insert into public.customers(id,legal_name) values('10000000-0000-4000-8000-000000000020','Suggestion customer');
insert into public.seasons(id,brand_id,code,name) values
 ('10000000-0000-4000-8000-000000000030','10000000-0000-4000-8000-000000000010','SS28','Target'),
 ('10000000-0000-4000-8000-000000000031','10000000-0000-4000-8000-000000000010','FW28','Winter target'),
 ('10000000-0000-4000-8000-000000000032','10000000-0000-4000-8000-000000000010','SS27','Prior'),
 ('10000000-0000-4000-8000-000000000033','10000000-0000-4000-8000-000000000010','SS26','Prior'),
 ('10000000-0000-4000-8000-000000000034','10000000-0000-4000-8000-000000000010','OTHER','Unsupported');
-- Fixture totals use trigger bypass only as database owner, never in runtime.
set local session_replication_role=replica;
insert into public.orders(id,number,brand_id,season_id,customer_id,status,net_total_cents,gross_total_cents) values
 ('10000000-0000-4000-8000-000000000040','SUG-27','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000032','10000000-0000-4000-8000-000000000020','confirmed',1200000,1200000),
 ('10000000-0000-4000-8000-000000000041','SUG-26','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000033','10000000-0000-4000-8000-000000000020','delivered',1000000,1000000),
 ('10000000-0000-4000-8000-000000000042','SUG-DRAFT','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000033','10000000-0000-4000-8000-000000000020','draft',9999999,9999999),
 ('10000000-0000-4000-8000-000000000043','SUG-CANCEL','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000033','10000000-0000-4000-8000-000000000020','cancelled',9999999,9999999);
set local session_replication_role=origin;
create temporary table settings(v jsonb);
insert into settings values('{"brand_id":"10000000-0000-4000-8000-000000000010","customer_id":"10000000-0000-4000-8000-000000000020","season_id":"10000000-0000-4000-8000-000000000030","weights":[50,30,20],"growth_bps":0,"seasonal_threshold":20,"profile":"auto","profile_reason":"","historical_source":null,"overrides":[]}');
grant select,update on settings to authenticated;
create temporary table snapshot(v jsonb);grant select,insert,update on snapshot to authenticated;
set local role authenticated;set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select is(public.calculate_budget_recommendation((select v from settings))->>'suggested_cents',null,'undated seasons do not imply closed');
select is(public.calculate_budget_recommendation((select v from settings))->>'detected_profile','insufficient','no paired cycles is insufficient');
select throws_ok($$select public.calculate_budget_recommendation((select v from settings)||'{"season_id":"10000000-0000-4000-8000-000000000034"}')$$,'23514','SEASON_CODE','unsupported season requires correction');
update settings set v=v||'{"overrides":[{"code":"SS27","source":"auto","state":"closed","reason":"Campagna conclusa"},{"code":"SS26","source":"auto","state":"closed","reason":"Campagna conclusa"},{"code":"SS25","source":"auto","state":"zero","reason":"Nessun ordine verificato"}]}';
insert into snapshot select public.calculate_budget_recommendation(v) from settings;
select is((select v->>'suggested_cents' from snapshot),'900000','explicit zero is included in weighted mean');
select is((select v->>'history_count' from snapshot),'3','three known same seasons used');
select is((select x->>'amount_cents' from snapshot,jsonb_array_elements(v->'rows') x where x->>'code'='SS26'),'1000000','drafts and cancelled excluded');
update settings set v=jsonb_set(v,'{overrides,2,state}','"missing"');
update snapshot set v=public.calculate_budget_recommendation((select v from settings));
select is((select v->>'suggested_cents' from snapshot),'1125000','missing season excluded and remaining weights renormalized');
select is((select v->>'history_count' from snapshot),'2','known seasons count excludes missing');
update settings set v=v||'{"growth_bps":500}';
select is(public.calculate_budget_recommendation((select v from settings))->>'suggested_cents','1181250','growth calculated exactly');
select throws_ok($$select public.calculate_budget_recommendation((select v from settings)||'{"weights":[0,30,20]}')$$,'23514','VALIDATION','zero weights rejected');
select throws_ok($$select public.calculate_budget_recommendation((select v from settings)||'{"weights":[1.5,30,20]}')$$,'23514','VALIDATION','fractional weights rejected');
select throws_ok($$select public.calculate_budget_recommendation((select v from settings)||'{"profile":null}')$$,'23514','VALIDATION','null profile rejected');
select throws_ok($$select public.calculate_budget_recommendation((select v from settings)||'{"profile":"summer"}')$$,'23514','VALIDATION','manual profile requires reason');
select throws_ok($$select public.calculate_budget_recommendation((select v from settings)||'{"unexpected":true}')$$,'23514','VALIDATION','unknown settings rejected');
select throws_ok($$select public.calculate_budget_recommendation(jsonb_set((select v from settings),'{overrides,0,state}','"zero"'))$$,'23514','ZERO_CONFLICT','positive spend cannot become zero');
select throws_ok($$select public.calculate_budget_recommendation(jsonb_set((select v from settings),'{overrides,0,reason}','""'))$$,'23514','VALIDATION','closure reason required');
select throws_ok($$select public.calculate_budget_recommendation((select v from settings)||'{"overrides":[{"code":"SS28","source":"auto","state":"closed","reason":"Test"}]}')$$,'23514','VALIDATION','target cannot be historical input');
update settings set v=v||'{"growth_bps":0,"overrides":[{"code":"SS27","source":"auto","state":"closed","reason":"Finita"},{"code":"SS26","source":"auto","state":"closed","reason":"Finita"},{"code":"FW27","source":"auto","state":"zero","reason":"Stagionale"},{"code":"FW26","source":"auto","state":"zero","reason":"Stagionale"}]}';
select is(public.calculate_budget_recommendation((select v from settings))->>'detected_profile','summer','two complete cycles classify summer');
select is(public.calculate_budget_recommendation((select v from settings))->>'paired_cycles','2','paired cycles explicit');
select is(public.calculate_budget_recommendation((select v from settings)||'{"season_id":"10000000-0000-4000-8000-000000000031"}')->>'suggested_cents','0','winter for summer customer stays zero, no SS leakage');
select is(public.calculate_budget_recommendation((select v from settings)||'{"profile":"winter","profile_reason":"Verifica commerciale"}')->>'profile','winter','operator override retained');
select is(public.calculate_budget_recommendation((select v from settings)||'{"profile":"winter","profile_reason":"Verifica commerciale"}')->>'suggested_cents','1125000','profile override does not silently alter formula');
update settings set v=jsonb_set(v,'{overrides,0,state}','"excluded"');
select is(public.calculate_budget_recommendation((select v from settings))->>'suggested_cents','1000000','exception excluded with reason');
update settings set v=jsonb_set(v,'{overrides,0,state}','"closed"');
reset role;
update public.seasons set delivery_end=current_date+10 where id='10000000-0000-4000-8000-000000000032';
set local role authenticated;
select throws_ok($$select public.calculate_budget_recommendation((select v from settings))$$,'23514','SEASON_OPEN','cannot force a dated future season closed');
reset role;
update public.seasons set delivery_end=null where id='10000000-0000-4000-8000-000000000032';
insert into public.import_batches(id,kind,file_name,file_sha256,storage_path,size_bytes,status,created_by,completed_at) values
 ('10000000-0000-4000-8000-000000000050','performance','fixture.xlsx',repeat('e',64),'10000000-0000-4000-8000-000000000050.xlsx',100,'completed','10000000-0000-4000-8000-000000000004',now());
insert into public.import_rows(batch_id,entity,sheet,row_number,raw,mapped,status) values
 ('10000000-0000-4000-8000-000000000050','performance','RECAP BUDGET',2,'{}','{"brand":"Suggestion brand","customer":"Suggestion customer","city":"Rome","country":"IT","values":{"orders_ss27":600000,"orders_ss26":null,"orders_fw26":0}}','imported');
set local role authenticated;
update snapshot set v=public.calculate_budget_recommendation((select v from settings));
select is((select v->>'historical_match' from snapshot),'automatic','exact unique historical identity auto matched');
select is((select x->>'state' from snapshot,jsonb_array_elements(v->'rows') x where x->>'code'='SS27'),'conflict','overlap requires explicit source');
select is((select v->>'suggested_cents' from snapshot),'1000000','conflicting season excluded rather than double counted');
select is((select x->>'historical_cents' from snapshot,jsonb_array_elements(v->'rows') x where x->>'code'='SS26'),null,'blank historical cell stays missing');
select is((select x->>'historical_cents' from snapshot,jsonb_array_elements(v->'rows') x where x->>'code'='FW26'),'0','historical zero stays zero');
update settings set v=jsonb_set(v,'{overrides,0,source}','"historical"');
update snapshot set v=public.calculate_budget_recommendation((select v from settings));
select is((select v->>'suggested_cents' from snapshot),'750000','explicit historic precedence avoids double counting');
select is(jsonb_array_length(public.budget_history_sources('Suggestion customer')),1,'accounting gets whitelisted historical choices');
select throws_ok($$select * from app.budget_recommendations$$,'42501',null,'private provenance cannot be read directly');
select throws_ok($$select public.apply_budget_recommendation('{"brand_id":"10000000-0000-4000-8000-000000000010","customer_id":"10000000-0000-4000-8000-000000000020","season_id":"10000000-0000-4000-8000-000000000030","amount_cents":750000,"period_start":"2028-01-01","period_end":"2028-06-30","notes":""}',(select v from settings),'wrong','')$$,'40001','STALE_RECOMMENDATION','stale preview cannot apply');
select throws_ok($$select public.apply_budget_recommendation('{"brand_id":"10000000-0000-4000-8000-000000000010","customer_id":"10000000-0000-4000-8000-000000000020","season_id":"10000000-0000-4000-8000-000000000030","amount_cents":800000,"period_start":"2028-01-01","period_end":"2028-06-30","notes":""}',(select v from settings),(select v->>'fingerprint' from snapshot),'')$$,'23514','REASON_REQUIRED','adjustment needs reason');
select lives_ok($$select public.apply_budget_recommendation('{"brand_id":"10000000-0000-4000-8000-000000000010","customer_id":"10000000-0000-4000-8000-000000000020","season_id":"10000000-0000-4000-8000-000000000030","amount_cents":800000,"period_start":"2028-01-01","period_end":"2028-06-30","notes":""}',(select v from settings),(select v->>'fingerprint' from snapshot),'Crescita concordata')$$,'budget applied with transactional provenance');
select is((select amount_cents from public.budgets where brand_id='10000000-0000-4000-8000-000000000010'),800000::bigint,'adjusted value saved');
select is(public.budget_recommendation_provenance((select id from public.budgets where brand_id='10000000-0000-4000-8000-000000000010'))->'snapshot'->>'suggested_cents','750000','original suggestion preserved');
select is(public.budget_recommendation_provenance((select id from public.budgets where brand_id='10000000-0000-4000-8000-000000000010'))->>'adjustment_reason','Crescita concordata','adjustment explanation preserved');
select throws_ok($$select public.apply_budget_recommendation('{"brand_id":"10000000-0000-4000-8000-000000000010","customer_id":"10000000-0000-4000-8000-000000000020","season_id":"10000000-0000-4000-8000-000000000030","amount_cents":750000,"period_start":"2028-01-01","period_end":"2028-06-30","notes":""}',(select v from settings),(select v->>'fingerprint' from snapshot),'')$$,'23P01',null,'overlap atomically rejects a duplicate application');
select is((select count(*) from public.budgets where brand_id='10000000-0000-4000-8000-000000000010'),1::bigint,'failed apply leaves no extra budget');
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select throws_ok($$select public.calculate_budget_recommendation((select v from settings))$$,'42501','FORBIDDEN','staff cannot calculate/write budget');
select lives_ok($$select public.budget_recommendation_provenance((select id from public.budgets where brand_id='10000000-0000-4000-8000-000000000010'))$$,'staff can read internal provenance');
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000003';
select throws_ok($$select public.calculate_budget_recommendation((select v from settings))$$,'42501','FORBIDDEN','brand cannot see client spend calculation');
select throws_ok($$select public.budget_history_sources('')$$,'42501','FORBIDDEN','brand cannot list historical identities');
select throws_ok($$select public.budget_recommendation_provenance('10000000-0000-4000-8000-000000000010')$$,'42501','FORBIDDEN','brand cannot read private provenance');
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000004';set local request.jwt.claims='{"aal":"aal1"}';
select throws_ok($$select public.calculate_budget_recommendation((select v from settings))$$,'42501','FORBIDDEN','admin without MFA forbidden');
reset role;
select is((select count(*) from app.budget_recommendations r join public.budgets b on b.id=r.budget_id where b.brand_id='10000000-0000-4000-8000-000000000010'),1::bigint,'one private snapshot after failed retry');
select ok(exists(select 1 from public.audit_log where action='recommendation_applied' and record_id in(select r.budget_id from app.budget_recommendations r join public.budgets b on b.id=r.budget_id where b.brand_id='10000000-0000-4000-8000-000000000010')),'application audit exists');
select ok(not has_function_privilege('anon','public.calculate_budget_recommendation(jsonb)','EXECUTE'),'anon calculator revoked');
-- Three positive homologous seasons reproduce the proposed 50/30/20 example.
insert into public.seasons(id,brand_id,code,name) values('10000000-0000-4000-8000-000000000035','10000000-0000-4000-8000-000000000010','SS25','Third year');
set local session_replication_role=replica;
insert into public.orders(id,number,brand_id,season_id,customer_id,status,net_total_cents,gross_total_cents) values
 ('10000000-0000-4000-8000-000000000044','SUG-25','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000035','10000000-0000-4000-8000-000000000020','confirmed',800000,800000);
set local session_replication_role=origin;
set local role authenticated;set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select is(public.calculate_budget_recommendation(jsonb_set((select v from settings),'{overrides,0,source}','"operational"')||jsonb_build_object('overrides',
 jsonb_set((select v->'overrides' from settings),'{0,source}','"operational"')||'[{"code":"SS25","source":"auto","state":"closed","reason":"Finita"}]'::jsonb))->>'suggested_cents','1060000','three positive seasons yield 10600 euros exactly');
select is(public.calculate_budget_recommendation((select v from settings)||'{"growth_bps":-10000}')->>'suggested_cents','0','minus one hundred percent gives zero');
select is(public.calculate_budget_recommendation((select v from settings)||'{"growth_bps":10000}')->>'suggested_cents','1500000','plus one hundred percent doubles');
select throws_ok($$select public.calculate_budget_recommendation((select v from settings)||'{"overrides":[{"code":"SS22","source":"auto","state":"closed","reason":"Finita"},{"code":"SS22","source":"auto","state":"closed","reason":"Finita"}]}')$$,'23514','VALIDATION','duplicate overrides rejected in SQL');
select throws_ok($$select public.calculate_budget_recommendation((select v from settings)||'{"overrides":[{"code":"SS27","source":null,"state":"default","reason":""}]}')$$,'23514','VALIDATION','null override source rejected');
reset role;
insert into public.customers(id,legal_name,city) values('10000000-0000-4000-8000-000000000021','Suggestion customer','Milano');
set local role authenticated;
select is(public.calculate_budget_recommendation((select v from settings))->>'historical_match','ambiguous','duplicate customer names do not auto merge');
select is(public.calculate_budget_recommendation((select v from settings)||jsonb_build_object('historical_source',(select v->'historical_source' from snapshot)))->>'historical_match','explicit','operator can select a historical identity explicitly');
select is(public.calculate_budget_recommendation((select v from settings)||jsonb_build_object('historical_source',(select v->'historical_source' from snapshot)))->>'suggested_cents','750000','explicit identity restores the chosen source');
reset role;
delete from public.customers where id='10000000-0000-4000-8000-000000000021';
insert into public.import_batches(id,kind,file_name,file_sha256,storage_path,size_bytes,status,created_by,completed_at) values
 ('10000000-0000-4000-8000-000000000051','performance','fixture-new.xlsx',repeat('f',64),'10000000-0000-4000-8000-000000000051.xlsx',100,'completed','10000000-0000-4000-8000-000000000004',now()+interval '1 second');
insert into public.import_rows(batch_id,entity,sheet,row_number,raw,mapped,status) values
 ('10000000-0000-4000-8000-000000000051','performance','RECAP BUDGET',2,'{}','{"brand":"Suggestion brand","customer":"Suggestion customer","city":"Rome","country":"IT","values":{"orders_ss27":650000,"orders_ss26":null,"orders_fw26":0}}','imported');
set local role authenticated;
select is(public.calculate_budget_recommendation((select v from settings))->'historical_source'->>'batch_id','10000000-0000-4000-8000-000000000051','one latest workbook selected');
select is(public.calculate_budget_recommendation((select v from settings))->>'suggested_cents','781250','repeat workbooks not added together');
select throws_ok($$select public.apply_budget_recommendation('{"brand_id":"10000000-0000-4000-8000-000000000010","customer_id":"10000000-0000-4000-8000-000000000020","season_id":"10000000-0000-4000-8000-000000000030","amount_cents":750000,"period_start":"2028-07-01","period_end":"2028-12-31","notes":""}',(select v from settings),(select v->>'fingerprint' from snapshot),'')$$,'40001','STALE_RECOMMENDATION','real source change invalidates the preview');
reset role;
insert into public.import_rows(batch_id,entity,sheet,row_number,raw,mapped,status) values
 ('10000000-0000-4000-8000-000000000050','performance','RECAP BUDGET',3,'{}','{"brand":"Suggestion brand","customer":"Suggestion customer","city":"Rome","country":"IT","values":{"orders_ss27":null,"orders_ss26":null,"orders_fw26":0}}','imported');
set local role authenticated;
select is(public.calculate_budget_recommendation((select v from settings)||jsonb_build_object('historical_source',(select v->'historical_source' from snapshot)))->>'suggested_cents','1000000','partially missing historical aggregates are incomplete');
reset role;
select is((select count(*) from app.budget_recommendations r join public.budgets b on b.id=r.budget_id where b.brand_id='10000000-0000-4000-8000-000000000010'),1::bigint,'stale application creates no snapshot');
select * from finish();rollback;
