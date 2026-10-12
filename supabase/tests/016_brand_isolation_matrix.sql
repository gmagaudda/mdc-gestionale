-- Fixture-only transactions. Every probe rolls back, even if a policy regresses.
begin;
select no_plan();
create function pg_temp.fixture_id(n integer) returns uuid language sql immutable as $$select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
insert into auth.users(id,email) values(pg_temp.fixture_id(703),'isolation-staff@example.test'),(pg_temp.fixture_id(704),'isolation-a@example.test'),(pg_temp.fixture_id(705),'isolation-b@example.test');
update public.profiles set role='staff' where id=pg_temp.fixture_id(703);
insert into public.brands(id,name) values(pg_temp.fixture_id(701),'Isolation A'),(pg_temp.fixture_id(702),'Isolation B');
insert into public.brand_users(brand_id,user_id) values(pg_temp.fixture_id(701),pg_temp.fixture_id(704)),(pg_temp.fixture_id(702),pg_temp.fixture_id(705));
insert into public.customers(id,legal_name) values(pg_temp.fixture_id(706),'Isolation customer');
insert into public.customer_contacts(customer_id,name) values(pg_temp.fixture_id(706),'Private customer contact');
create temporary table isolation_scopes(scope text,brand_id uuid,season_id uuid,product_id uuid,variant_id uuid,order_id uuid,budget_id uuid,event_id uuid,document_id uuid,user_id uuid);
insert into isolation_scopes values('A',pg_temp.fixture_id(701),pg_temp.fixture_id(710),pg_temp.fixture_id(720),pg_temp.fixture_id(730),null,pg_temp.fixture_id(740),pg_temp.fixture_id(750),pg_temp.fixture_id(760),pg_temp.fixture_id(704)),('B',pg_temp.fixture_id(702),pg_temp.fixture_id(711),pg_temp.fixture_id(721),pg_temp.fixture_id(731),null,pg_temp.fixture_id(741),pg_temp.fixture_id(751),pg_temp.fixture_id(761),pg_temp.fixture_id(705));
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000703';
do $$declare s record;v_order uuid;begin
for s in select * from isolation_scopes loop
insert into public.brand_private(id,notes) values(s.brand_id,'Private brand');
insert into public.brand_contacts(brand_id,name) values(s.brand_id,'Private contact');
insert into public.seasons(id,brand_id,code,name) values(s.season_id,s.brand_id,'ISOLATION','Isolation season');
insert into public.products(id,brand_id,season_id,sku_base,name,wholesale_price_cents) values(s.product_id,s.brand_id,s.season_id,'ISOLATION-'||s.scope,'Isolation product',1000);
insert into public.product_variants(id,brand_id,product_id,size,color,sku) values(s.variant_id,s.brand_id,s.product_id,'M','Nero','ISOLATION-'||s.scope||'-M');
v_order:=public.save_order(null,jsonb_build_object('brand_id',s.brand_id,'customer_id',pg_temp.fixture_id(706),'season_id',s.season_id,'order_date','2033-01-01','discount_pct',0,'internal_notes','Isolation secret'),jsonb_build_array(jsonb_build_object('variant_id',s.variant_id,'quantity',1,'unit_price_cents',1000,'discount_pct',0)));
perform public.change_order_status(v_order,'confirmed','');
update isolation_scopes set order_id=v_order where scope=s.scope;
insert into public.budgets(id,brand_id,amount_cents,period_start,period_end) values(s.budget_id,s.brand_id,5000,'2033-01-01','2033-12-31');
insert into public.budget_private(id,brand_id,notes) values(s.budget_id,s.brand_id,'Private budget');
insert into public.invoices(number,brand_id,customer_id,order_id,status,issue_date,due_date,net_cents,vat_cents,gross_cents) values('ISOLATION-'||s.scope,s.brand_id,pg_temp.fixture_id(706),v_order,'issued','2033-01-01','2033-02-01',1000,220,1220);
insert into public.invoice_counters(brand_id,year,last_number) values(s.brand_id,2033,1);
insert into public.mock_invoice_records(id,brand_id,idempotency_key,external_id,fingerprint,status) select id,s.brand_id,idempotency_key,'mock_'||id::text,repeat('a',64),'issued' from public.invoices where number='ISOLATION-'||s.scope;
insert into public.invoice_webhook_events(event_id,provider,invoice_id,brand_id,external_status) select 'isolation-'||s.scope,'mock',id,s.brand_id,'issued' from public.invoices where number='ISOLATION-'||s.scope;
insert into public.payments(invoice_id,brand_id,amount_cents,paid_at,method) select id,s.brand_id,100,'2033-01-02T10:00Z','bank_transfer' from public.invoices where number='ISOLATION-'||s.scope;
insert into public.events(id,brand_id,title,starts_at,ends_at,visible_to_brand,assigned_to) values(s.event_id,s.brand_id,'Shared isolation','2033-01-01T09:00Z','2033-01-01T10:00Z',true,pg_temp.fixture_id(703));
insert into public.event_reminders(event_id,recipient_id,starts_at) values(s.event_id,pg_temp.fixture_id(703),'2033-01-01T09:00Z');
insert into public.documents(id,name,brand_id,storage_path,original_filename,mime_type,size_bytes,uploaded_by,shared_with_brand) values(s.document_id,'Shared isolation',s.brand_id,s.brand_id::text||'/'||s.document_id::text||'.pdf','isolation.pdf','application/pdf',10,pg_temp.fixture_id(703),true);
insert into storage.objects(bucket_id,name,metadata) values('documents',s.brand_id::text||'/'||s.document_id::text||'.pdf','{"size":10,"mimetype":"application/pdf"}');
update public.documents set ready=true where id=s.document_id;
insert into public.ical_tokens(user_id,token_hash) values(s.user_id,repeat(case when s.scope='A' then 'a' else 'b' end,64));
insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values(s.user_id,'https://fcm.googleapis.com/fcm/send/isolation-'||s.scope,'BA'||repeat('A',85),repeat('A',22));
insert into public.push_deliveries(event_id,subscription_id,starts_at) select s.event_id,id,'2033-01-01T09:00Z' from public.push_subscriptions where user_id=s.user_id;
end loop;end;$$;
insert into storage.buckets(id,name,public) values('isolation-other','isolation-other',false);
-- Manifest requires a fixture and probes for every exposed public table/view.
create temporary table isolation_matrix(relation text primary key,own_where text,foreign_where text,own_count bigint,foreign_count bigint default 0,read_column text default '*',write_column text,allow_foreign_check boolean default false);
insert into isolation_matrix(relation,own_where,foreign_where,own_count,write_column) values
('public.profiles','id=''00000000-0000-4000-8000-000000000704''','id=''00000000-0000-4000-8000-000000000705''',1,'full_name'),
('public.audit_log','actor_id=''00000000-0000-4000-8000-000000000703''','record_id=''00000000-0000-4000-8000-000000000702''',0,'action'),
('public.brands','id=''00000000-0000-4000-8000-000000000701''','id=''00000000-0000-4000-8000-000000000702''',1,'name'),
('public.brand_private','id=''00000000-0000-4000-8000-000000000701''','id=''00000000-0000-4000-8000-000000000702''',0,'notes'),
('public.brand_users','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',1,'user_id'),
('public.brand_contacts','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',0,'name'),
('public.seasons','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',1,'name'),
('public.products','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',1,'name'),
('public.product_variants','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',1,'size'),
('public.orders','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',1,'payment_terms'),
('public.order_private','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',0,'internal_notes'),
('public.order_lines','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',1,'quantity'),
('public.order_status_history','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',0,'note'),
('public.events','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',1,'title'),
('public.budgets','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',1,'amount_cents'),
('public.budget_private','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',0,'notes'),
('public.payments','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',0,'amount_cents'),
('public.invoice_counters','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',0,'last_number'),
('public.mock_invoice_records','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',0,'status'),
('public.invoice_webhook_events','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',0,'external_status'),
('public.v_invoice_balances','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',0,'status'),
('public.invoices','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',0,'number'),
('public.documents','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',1,'name'),
('public.customers','id=''00000000-0000-4000-8000-000000000706''','id=''00000000-0000-4000-8000-000000000706''',0,'legal_name'),
('public.customer_contacts','customer_id=''00000000-0000-4000-8000-000000000706''','customer_id=''00000000-0000-4000-8000-000000000706''',0,'name'),
('public.order_counters','year=2033','year=2033',0,'last_number'),
('public.ical_tokens','user_id=''00000000-0000-4000-8000-000000000704''','user_id=''00000000-0000-4000-8000-000000000705''',1,'revoked_at'),
('public.event_reminders','event_id=''00000000-0000-4000-8000-000000000750''','event_id=''00000000-0000-4000-8000-000000000751''',-1,'status'),
('public.push_subscriptions','user_id=''00000000-0000-4000-8000-000000000704''','user_id=''00000000-0000-4000-8000-000000000705''',1,'created_at'),
('public.push_deliveries','event_id=''00000000-0000-4000-8000-000000000750''','event_id=''00000000-0000-4000-8000-000000000751''',-1,'status'),
('public.portal_orders','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',1,'currency'),
('public.v_sales_by_brand_season','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',1,'brand_id'),
('public.v_sales_by_customer','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',1,'brand_id'),
('public.v_revenue_by_brand_period','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',0,'brand_id'),
('public.v_budget_vs_actual','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',1,'brand_id'),
('public.v_commissions','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',0,'brand_id'),
('public.portal_events','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',1,'title'),
('public.portal_documents','brand_id=''00000000-0000-4000-8000-000000000701''','brand_id=''00000000-0000-4000-8000-000000000702''',1,'name'),
('storage.objects','bucket_id=''documents'' and name like ''00000000-0000-4000-8000-000000000701/%''','bucket_id=''documents'' and name like ''00000000-0000-4000-8000-000000000702/%''',1,'name'),
('storage.buckets','id=''documents''','id=''isolation-other''',0,'name');
update isolation_matrix set read_column='*',allow_foreign_check=true where relation='public.budgets';
update isolation_matrix set read_column='user_id',allow_foreign_check=false where relation='public.ical_tokens';
update isolation_matrix set read_column='id',allow_foreign_check=false where relation='public.push_subscriptions';
update isolation_matrix set read_column='*',allow_foreign_check=true where relation='public.v_budget_vs_actual';
select results_eq($$select ('public.'||c.relname) collate "C" from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in('r','v','m','p') order by 1$$,$$select relation collate "C" from isolation_matrix where relation like 'public.%' order by 1$$,'every exposed public table/view has an isolation fixture');
select ok(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in('r','p') and not c.relrowsecurity),'every public business table has RLS');
select ok(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v' and not coalesce(c.reloptions @> array['security_invoker=true'],false)),'every public view uses invoker permissions');
-- Capture the real complete fixture rows as postgres. Brand probes do not depend
-- on SELECT visibility to attempt inserts. Generated columns are excluded.
create temporary table isolation_inserts(relation text,scope text,statement text);
do $$declare m record;s text;predicate text;cols text;row_data jsonb;begin
for m in select * from isolation_matrix loop
select string_agg(quote_ident(attname),',' order by attnum) into cols from pg_attribute where attrelid=m.relation::regclass and attnum>0 and not attisdropped and attgenerated='' and (m.relation<>'public.portal_orders' or attname not in ('customer_display_name','customer_city'));
foreach s in array array['A','B'] loop
predicate:=case when s='A' then m.own_where else m.foreign_where end;
execute format('select to_jsonb(t) from %s t where %s limit 1',m.relation,predicate) into row_data;
if row_data is null then raise exception 'missing fixture: %, %',m.relation,s;end if;
insert into isolation_inserts values(m.relation,s,format('insert into %s (%s) select %s from jsonb_populate_record(null::%s,%L::jsonb)',m.relation,cols,cols,m.relation,row_data));
end loop;end loop;end;$$;
grant select on isolation_matrix,isolation_inserts,isolation_scopes to authenticated;
create function pg_temp.visible_count(p_relation text,p_where text,p_column text) returns bigint language plpgsql security invoker as $$
declare n bigint;begin execute format('select count(%s) from %s where %s',p_column,p_relation,p_where) into n;return n;exception when insufficient_privilege then return -1;end;$$;
create function pg_temp.write_probe(p_sql text) returns text language plpgsql security invoker as $$
declare n bigint;begin
begin
execute p_sql;get diagnostics n=row_count;
-- Force rollback of a wrongly accepted probe, preserving its row count.
raise exception using errcode='PZ001';
exception when sqlstate 'PZ001' then return case when n=0 then 'zero' else 'WRITTEN:'||n end;
when others then return 'blocked:'||sqlstate;
end;end;$$;
create function pg_temp.run_isolation_matrix() returns setof text language plpgsql security invoker as $$
declare m record;s text;predicate text;command text;pattern text;begin
for m in select * from isolation_matrix order by relation loop
return next is(pg_temp.visible_count(m.relation,m.own_where,m.read_column),m.own_count,m.relation||': own read matches public/private access');
return next is(pg_temp.visible_count(m.relation,m.foreign_where,m.read_column),case when m.own_count=-1 then -1::bigint else 0::bigint end,m.relation||': foreign read blocked');
foreach s in array array['A','B'] loop
predicate:=case when s='A' then m.own_where else m.foreign_where end;
pattern:='^(zero|blocked:42501|blocked:55000)$';
if s='B' and m.allow_foreign_check then pattern:='^(zero|blocked:42501|blocked:55000|blocked:23514)$';end if;
select statement into command from isolation_inserts where relation=m.relation and scope=s;
return next matches(pg_temp.write_probe(command),pattern,m.relation||': insert '||s||' blocked');
return next matches(pg_temp.write_probe(format('update %s set %I=%I where %s',m.relation,m.write_column,m.write_column,predicate)),pattern,m.relation||': update '||s||' blocked');
return next matches(pg_temp.write_probe(format('delete from %s where %s',m.relation,predicate)),pattern,m.relation||': delete '||s||' blocked');
end loop;end loop;end;$$;
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000704';
select * from pg_temp.run_isolation_matrix();
-- Repeat the same real probes in the opposite direction with a different identity.
reset role;
update isolation_matrix set own_where=foreign_where,foreign_where=own_where;
update isolation_inserts set scope=case scope when 'A' then 'B' else 'A' end;
set local role authenticated;set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000705';
select * from pg_temp.run_isolation_matrix();
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000704';
-- Preferences are the explicit readonly-business exception: own token rotation.
select lives_ok($$select public.rotate_ical_token(repeat('c',64))$$,'brand can rotate its own iCal preference');
select is((select count(user_id) from public.ical_tokens),1::bigint,'rotation never exposes another user token');
select throws_ok($$select token_hash from public.ical_tokens$$,'42501',null,'credential hash column is never readable');
reset role;
delete from public.brand_users where user_id=pg_temp.fixture_id(704);
set local role authenticated;
select is((select count(*) from public.brands where id=pg_temp.fixture_id(701)),0::bigint,'revocation removes brand access');
select is((select count(*) from public.portal_orders where brand_id=pg_temp.fixture_id(701)),0::bigint,'revocation removes order access');
select is((select count(*) from storage.objects where name like '00000000-0000-4000-8000-000000000701/%'),0::bigint,'revocation removes binary access');
select throws_ok($$select public.portal_dashboard_report('00000000-0000-4000-8000-000000000701')$$,'P0002',null,'revocation removes dashboard scope');
select * from finish();rollback;
