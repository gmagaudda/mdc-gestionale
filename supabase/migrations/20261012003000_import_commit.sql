create function public.import_commit(p_id uuid,p_confirm_updates boolean default false,p_confirm_differences boolean default false) returns jsonb language plpgsql security definer set search_path='' set statement_timeout='60s' as $$
declare b public.import_batches;r public.import_rows;q public.import_rows;pr jsonb;m jsonb;v_id uuid;v_brand uuid;v_season uuid;v_customer uuid;v_variant uuid;v_product uuid;v_contact uuid;v_before jsonb;v_key jsonb;v_order public.orders;v_budget public.budgets;v_count integer;v_status text;v_sku text;v_total numeric;v_actual numeric;v_expected jsonb;v_change record;v_fields jsonb;v_stats jsonb;begin
 if app.current_role() is distinct from 'admin' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('mdc.import.commit',0));
 select * into b from public.import_batches where id=p_id for update;
 if b.id is null or b.kind='performance' then raise exception 'INVALID_BATCH' using errcode='23514';end if;
 if b.status='completed' then return b.stats;end if;
 if b.status not in('validated','ready') or b.options->>'staging_complete' is distinct from 'true' then raise exception 'INCOMPLETE_STAGING' using errcode='23514';end if;
 if not exists(select 1 from public.import_rows where batch_id=p_id and status in('valid','warning')) or exists(select 1 from public.import_rows where batch_id=p_id and status='error') then raise exception 'INVALID_ROWS' using errcode='23514';end if;
 -- Serialize against ordinary edits too, so the reviewed references and snapshots
 -- cannot change while one atomic commercial write is in progress.
 lock table public.brands,public.customers,public.seasons,public.products,public.product_variants,public.orders,public.order_lines,public.budgets,public.customer_contacts,public.brand_private,public.order_private,public.budget_private in share row exclusive mode;
 for r in select * from public.import_rows where batch_id=p_id and status in('valid','warning') loop
  pr:=app.import_profile(b,r);
  if pr is null or not app.valid_operational_row(r.entity,r.mapped,pr) then raise exception 'INVALID_ROW:%:%',r.sheet,r.row_number using errcode='23514';end if;
  if r.entity='customers' and r.match->'customer'->>'action' not in('link','create') or r.entity in('orders','budgets') and r.match->'brand'->>'action' not in('link','create') then raise exception 'MISSING_MATCH' using errcode='23514';end if;
  if r.entity='customers' and r.match->'customer' is null or r.entity in('orders','budgets') and r.match->'brand' is null then raise exception 'MISSING_MATCH' using errcode='23514';end if;
  if r.entity in('orders','budgets') and nullif(r.mapped->>'customer','') is not null and coalesce(r.match->'customer'->>'action','') not in('link','create') then raise exception 'MISSING_MATCH' using errcode='23514';end if;
  if r.entity in('orders','budgets') and nullif(r.mapped->>'season','') is not null and coalesce(r.match->'season'->>'action','') not in('link','create') then raise exception 'MISSING_MATCH' using errcode='23514';end if;
  if r.entity='orders' and pr->'options'->>'granularity'<>'order_totals' and coalesce(r.match->'variant'->>'action','') not in('link','create') then raise exception 'MISSING_MATCH' using errcode='23514';end if;
  if pr->'options'->>'mode'='upsert' and p_confirm_updates is not true and (r.entity in('orders','budgets') or r.match->'customer'->>'action'='link') then raise exception 'UPDATES_REQUIRE_CONFIRMATION' using errcode='23514';end if;
 end loop;
 -- Header consistency and duplicate article/total rows are checked over the whole
 -- batch, including sheet and chunk boundaries, before any business insert.
 if exists(select 1 from public.import_rows src where src.batch_id=p_id and src.entity='orders' and src.status in('valid','warning') group by app.import_order_key(src) having count(distinct jsonb_build_array(src.match->'customer',src.match->'season',src.mapped->>'order_date',src.mapped->>'delivery_date',src.mapped->>'discount_pct',src.mapped->>'status',app.import_profile(b,src)->'options'->>'granularity',app.import_profile(b,src)->'options'->>'initialStatus'))>1) then raise exception 'INCONSISTENT_ORDER' using errcode='23514';end if;
 if exists(select 1 from public.import_rows src where src.batch_id=p_id and src.entity='orders' and src.status in('valid','warning') group by app.import_order_key(src),case when app.import_profile(b,src)->'options'->>'granularity'='order_totals' then '' else coalesce(src.match->'variant'->>'id',app.import_key(src.mapped->>'sku')) end having count(*)>1) then raise exception 'DUPLICATE_ORDER_LINE' using errcode='23514';end if;
 if exists(select 1 from public.import_rows src where batch_id=p_id and entity='customers' and status in('valid','warning') and match->'customer'->>'action'='link' group by app.import_resolved(src,'customer') having count(*)>1) then raise exception 'DUPLICATE_CUSTOMER_TARGET' using errcode='23514';end if;
 if exists(select 1 from public.import_rows src where batch_id=p_id and entity='orders' and status in('valid','warning') and match->'variant'->>'action'='create' group by app.import_subject(src,'variant') having count(distinct jsonb_build_array(mapped->>'product_name',mapped->>'size',mapped->>'color',mapped->>'vat_rate'))>1) then raise exception 'INCONSISTENT_ARTICLE' using errcode='23514';end if;
 update public.import_batches set status='importing' where id=p_id;
 -- Explicit creations only. Recheck active names to catch changes since preview.
 for r in select distinct on(app.import_subject(src,'brand')) src.* from public.import_rows src where batch_id=p_id and status in('valid','warning') and src.entity in('orders','budgets') and src.match->'brand'->>'action'='create' order by app.import_subject(src,'brand'),src.id loop
  if exists(select 1 from public.brands where deleted_at is null and app.import_key(name)=app.import_key(r.mapped->>'brand')) then raise exception 'BRAND_EXISTS' using errcode='23514';end if;
  insert into public.brands(name,import_batch_id) values(r.mapped->>'brand',p_id) returning id into v_id;perform app.import_track(p_id,'brands',v_id,null);
  insert into public.brand_private(id) values(v_id);perform app.import_track(p_id,'brand_private',v_id,null);
  update public.import_rows x set match=jsonb_set(x.match,'{brand,created_id}',to_jsonb(v_id)) where x.batch_id=p_id and app.import_subject(x,'brand')=app.import_subject(r,'brand') and x.status in('valid','warning');
 end loop;
 for r in select distinct on(app.import_subject(src,'season')) src.* from public.import_rows src where batch_id=p_id and status in('valid','warning') and src.entity in('orders','budgets') and src.match->'season'->>'action'='create' order by app.import_subject(src,'season'),src.id loop
  pr:=app.import_profile(b,r);if pr->'options'->>'allowCreateSeasons' is distinct from 'true' then raise exception 'SEASON_CREATION_NOT_CONFIRMED' using errcode='23514';end if;
  v_brand:=app.import_resolved(r,'brand');if v_brand is null then raise exception 'MISSING_MATCH' using errcode='23514';end if;
  if exists(select 1 from public.seasons where brand_id=v_brand and deleted_at is null and app.import_key(code)=app.import_key(r.mapped->>'season')) then raise exception 'SEASON_EXISTS' using errcode='23514';end if;
  insert into public.seasons(brand_id,code,name,import_batch_id) values(v_brand,r.mapped->>'season',r.mapped->>'season',p_id) returning id into v_id;perform app.import_track(p_id,'seasons',v_id,null);
  update public.import_rows x set match=jsonb_set(x.match,'{season,created_id}',to_jsonb(v_id)) where x.batch_id=p_id and app.import_subject(x,'season')=app.import_subject(r,'season') and x.status in('valid','warning');
 end loop;
 -- Stores precede references from orders and budgets.
 for r in select * from public.import_rows where batch_id=p_id and status in('valid','warning') and entity='customers' order by sheet,row_number loop
  pr:=app.import_profile(b,r);m:=r.mapped;v_id:=app.import_resolved(r,'customer');v_before:=null;
  if r.match->'customer'->>'action'='create' then
   if exists(select 1 from public.customers c where c.deleted_at is null and ((nullif(m->>'external_code','') is not null and c.external_code=m->>'external_code') or (nullif(m->>'vat_number','') is not null and c.vat_number=m->>'vat_number') or (app.import_key(c.legal_name)=app.import_key(m->>'legal_name') and app.import_key(c.city)=app.import_key(m->>'city') and app.import_key(c.country)=app.import_key(coalesce(nullif(m->>'country',''),'IT'))))) then raise exception 'CUSTOMER_EXISTS' using errcode='23514';end if;
   insert into public.customers(legal_name,import_batch_id) values(m->>'legal_name',p_id) returning id into v_id;
  else
   select to_jsonb(c) into v_before from public.customers c where c.id=v_id and c.deleted_at is null;
   if v_before is null then raise exception 'INVALID_TARGET' using errcode='23514';end if;
   if pr->'options'->>'mode'='insert_only' then update public.import_rows set target_id=v_id,status='skipped',messages=messages||'[{"field":"","code":"alreadyExists","severity":"warning"}]'::jsonb where id=r.id;continue;end if;
  end if;
  update public.customers c set legal_name=m->>'legal_name',trade_name=coalesce(m->>'trade_name',c.trade_name),vat_number=coalesce(m->>'vat_number',c.vat_number),tax_code=coalesce(m->>'tax_code',c.tax_code),sdi_code=coalesce(m->>'sdi_code',c.sdi_code),pec=coalesce(m->>'pec',c.pec),city=coalesce(m->>'city',c.city),country=coalesce(m->>'country',c.country),payment_terms=coalesce(m->>'payment_terms',c.payment_terms),notes=coalesce(m->>'notes',c.notes),external_code=case when m?'external_code' then nullif(m->>'external_code','') else c.external_code end,representative=coalesce(m->>'representative',c.representative),area=coalesce(m->>'area',c.area),category=coalesce(m->>'category',c.category),billing_address=c.billing_address||coalesce((select jsonb_object_agg(case key when 'address' then 'street' else key end,value) from jsonb_each(m) where key in('address','postal_code','city','province','country')),'{}') where id=v_id;
  perform app.import_track(p_id,'customers',v_id,v_before);
  if m?'email' or m?'phone' then
   v_contact:=null;v_fields:=null;select id,to_jsonb(c) into v_contact,v_fields from public.customer_contacts c where customer_id=v_id and deleted_at is null and role_title='Recapito aziendale' order by id limit 1;
   if v_contact is null then insert into public.customer_contacts(customer_id,name,role_title,email,phone) values(v_id,m->>'legal_name','Recapito aziendale',coalesce(m->>'email',''),coalesce(m->>'phone','')) returning id into v_contact;
   else update public.customer_contacts set name=m->>'legal_name',email=coalesce(m->>'email',email),phone=coalesce(m->>'phone',phone) where id=v_contact;end if;
   perform app.import_track(p_id,'customer_contacts',v_contact,v_fields);
  end if;
  update public.import_rows set target_id=v_id,status='imported',match=case when r.match->'customer'->>'action'='create' then jsonb_set(match,'{customer,created_id}',to_jsonb(v_id)) else match end where id=r.id;
 end loop;
 -- Validate linked season/customer scope after all explicit creations.
 for r in select * from public.import_rows where batch_id=p_id and status in('valid','warning') and entity in('orders','budgets') loop
  v_brand:=app.import_resolved(r,'brand');v_season:=app.import_resolved(r,'season');v_customer:=app.import_resolved(r,'customer');
  if not exists(select 1 from public.brands where id=v_brand and deleted_at is null) or (nullif(r.mapped->>'season','') is not null and not exists(select 1 from public.seasons where id=v_season and brand_id=v_brand and deleted_at is null)) or (nullif(r.mapped->>'customer','') is not null and not exists(select 1 from public.customers where id=v_customer and deleted_at is null)) then raise exception 'INVALID_SCOPE' using errcode='23514';end if;
 end loop;
 if exists(select 1 from public.import_rows src where batch_id=p_id and entity='budgets' and status in('valid','warning') group by app.import_resolved(src,'brand'),app.import_resolved(src,'season'),app.import_resolved(src,'customer'),mapped->>'period_start',mapped->>'period_end' having count(*)>1) then raise exception 'DUPLICATE_BUDGET_TARGET' using errcode='23514';end if;
 -- Create each new article exactly once, only from explicit descriptive/tax data.
 for r in select distinct on(app.import_subject(src,'variant')) src.* from public.import_rows src where batch_id=p_id and status in('valid','warning') and entity='orders' and src.match->'variant'->>'action'='create' order by app.import_subject(src,'variant'),src.id loop
  m:=r.mapped;v_brand:=app.import_resolved(r,'brand');v_season:=app.import_resolved(r,'season');
  if nullif(m->>'product_name','') is null or nullif(m->>'size','') is null or nullif(m->>'color','') is null or nullif(m->>'vat_rate','') is null then raise exception 'NEW_ARTICLE_DATA_REQUIRED' using errcode='23514';end if;
  if exists(select 1 from public.product_variants where app.import_key(sku)=app.import_key(m->>'sku')) then raise exception 'SKU_EXISTS' using errcode='23514';end if;
  insert into public.products(brand_id,season_id,sku_base,name,wholesale_price_cents,vat_rate,import_batch_id) values(v_brand,v_season,m->>'sku',m->>'product_name',(m->>'unit_price_cents')::bigint,(m->>'vat_rate')::numeric,p_id) returning id into v_product;perform app.import_track(p_id,'products',v_product,null);
  insert into public.product_variants(product_id,brand_id,size,color,sku,import_batch_id) values(v_product,v_brand,m->>'size',m->>'color',m->>'sku',p_id) returning id into v_id;perform app.import_track(p_id,'product_variants',v_id,null);
  update public.import_rows x set match=jsonb_set(x.match,'{variant,created_id}',to_jsonb(v_id)) where x.batch_id=p_id and app.import_subject(x,'variant')=app.import_subject(r,'variant') and x.status in('valid','warning');
 end loop;
 -- One order per external reference, or per resolved customer/brand/season/date.
 for v_key in select distinct app.import_order_key(x) from public.import_rows x where batch_id=p_id and entity='orders' and status in('valid','warning') loop
  select * into r from public.import_rows x where batch_id=p_id and entity='orders' and status in('valid','warning') and app.import_order_key(x)=v_key order by sheet,row_number limit 1;
  pr:=app.import_profile(b,r);m:=r.mapped;v_brand:=app.import_resolved(r,'brand');v_customer:=app.import_resolved(r,'customer');v_season:=app.import_resolved(r,'season');v_order:=null;
  if nullif(m->>'external_ref','') is not null then select * into v_order from public.orders where brand_id=v_brand and external_ref=m->>'external_ref' and deleted_at is null;
  else select * into v_order from public.orders where brand_id=v_brand and customer_id=v_customer and season_id=v_season and order_date=(m->>'order_date')::date and external_ref is null and deleted_at is null order by id limit 1;end if;
  v_status:=coalesce(nullif(m->>'status',''),pr->'options'->>'initialStatus','draft');v_before:=null;
  if v_order.id is not null then
   if pr->'options'->>'mode'='insert_only' then update public.import_rows x set status='skipped',target_id=v_order.id,messages=messages||'[{"field":"","code":"alreadyExists","severity":"warning"}]'::jsonb where batch_id=p_id and entity='orders' and app.import_order_key(x)=v_key;continue;end if;
   if v_order.status<>'draft' or v_status<>'draft' or v_order.season_id<>v_season or extract(year from v_order.order_date)<>extract(year from (m->>'order_date')::date) then raise exception 'EXISTING_ORDER_NOT_EDITABLE' using errcode='23514';end if;
   v_id:=v_order.id;v_before:=to_jsonb(v_order);
   for v_change in select * from public.order_lines where order_id=v_id loop perform app.import_track(p_id,'order_lines',v_change.id,to_jsonb(v_change));end loop;
   delete from public.order_lines where order_id=v_id;
   update public.orders set customer_id=v_customer,order_date=(m->>'order_date')::date,delivery_date=nullif(m->>'delivery_date','')::date,discount_pct=coalesce(nullif(m->>'discount_pct','')::numeric,0),import_granularity=pr->'options'->>'granularity' where id=v_id;
  else
   insert into public.orders(brand_id,customer_id,season_id,order_date,delivery_date,discount_pct,external_ref,import_batch_id,import_granularity) values(v_brand,v_customer,v_season,(m->>'order_date')::date,nullif(m->>'delivery_date','')::date,coalesce(nullif(m->>'discount_pct','')::numeric,0),nullif(m->>'external_ref',''),p_id,pr->'options'->>'granularity') returning id into v_id;
  end if;
  select to_jsonb(x) into v_fields from public.order_private x where id=v_id;
  insert into public.order_private(id,brand_id,internal_notes) values(v_id,v_brand,coalesce(m->>'notes','')) on conflict(id) do update set internal_notes=coalesce(m->>'notes',public.order_private.internal_notes);perform app.import_track(p_id,'order_private',v_id,v_fields);
  for q in select * from public.import_rows x where batch_id=p_id and entity='orders' and status in('valid','warning') and app.import_order_key(x)=v_key order by sheet,row_number loop
   if pr->'options'->>'granularity'='order_totals' then
    v_sku:='MDC-SUM-'||md5(p_id::text||v_id::text);
    insert into public.products(brand_id,season_id,sku_base,name,wholesale_price_cents,vat_rate,import_batch_id) values(v_brand,v_season,v_sku,q.mapped->>'product_name',(q.mapped->>'total_cents')::bigint,(q.mapped->>'vat_rate')::numeric,p_id) returning id into v_product;perform app.import_track(p_id,'products',v_product,null);
    insert into public.product_variants(product_id,brand_id,size,color,sku,import_batch_id) values(v_product,v_brand,'Unica','Riepilogo',v_sku,p_id) returning id into v_variant;perform app.import_track(p_id,'product_variants',v_variant,null);
   else v_variant:=app.import_resolved(q,'variant');end if;
   if not exists(select 1 from public.product_variants v join public.products p on p.id=v.product_id where v.id=v_variant and v.brand_id=v_brand and p.season_id=v_season and v.deleted_at is null and p.deleted_at is null) then raise exception 'INVALID_ARTICLE_SCOPE' using errcode='23514';end if;
   insert into public.order_lines(order_id,brand_id,variant_id,quantity,unit_price_cents,discount_pct,vat_rate,product_name,sku,size,color,line_net_cents,line_vat_cents,import_batch_id) values(v_id,v_brand,v_variant,case when pr->'options'->>'granularity'='order_totals' then 1 else (q.mapped->>'quantity')::integer end,case when pr->'options'->>'granularity'='order_totals' then (q.mapped->>'total_cents')::bigint else (q.mapped->>'unit_price_cents')::bigint end,coalesce(nullif(q.mapped->>'line_discount_pct','')::numeric,0),0,'','','','',0,0,p_id) returning id into v_contact;perform app.import_track(p_id,'order_lines',v_contact,null);
   update public.import_rows set status='imported',target_id=v_id where id=q.id;
  end loop;
  if nullif(m->>'total_cents','') is not null and abs((select net_total_cents from public.orders where id=v_id)-(m->>'total_cents')::bigint)>1 and p_confirm_differences is not true then raise exception 'TOTAL_DIFFERENCES' using errcode='23514';end if;
  if v_status='confirmed' then update public.orders set status='confirmed' where id=v_id;end if;
  perform app.import_track(p_id,'orders',v_id,v_before);
 end loop;
 for r in select * from public.import_rows where batch_id=p_id and entity='budgets' and status in('valid','warning') order by sheet,row_number loop
  pr:=app.import_profile(b,r);m:=r.mapped;v_brand:=app.import_resolved(r,'brand');v_season:=app.import_resolved(r,'season');v_customer:=app.import_resolved(r,'customer');v_budget:=null;v_before:=null;
  select * into v_budget from public.budgets where brand_id=v_brand and season_id is not distinct from v_season and customer_id is not distinct from v_customer and period_start=(m->>'period_start')::date and period_end=(m->>'period_end')::date and deleted_at is null;
  if v_budget.id is not null then
   if pr->'options'->>'mode'='insert_only' then update public.import_rows set status='skipped',target_id=v_budget.id,messages=messages||'[{"field":"","code":"alreadyExists","severity":"warning"}]'::jsonb where id=r.id;continue;end if;
   v_id:=v_budget.id;v_before:=to_jsonb(v_budget);update public.budgets set amount_cents=(m->>'amount_cents')::bigint where id=v_id;
  else insert into public.budgets(brand_id,season_id,customer_id,amount_cents,period_start,period_end,import_batch_id) values(v_brand,v_season,v_customer,(m->>'amount_cents')::bigint,(m->>'period_start')::date,(m->>'period_end')::date,p_id) returning id into v_id;end if;
  perform app.import_track(p_id,'budgets',v_id,v_before);select to_jsonb(x) into v_fields from public.budget_private x where id=v_id;
  insert into public.budget_private(id,brand_id,notes) values(v_id,v_brand,coalesce(m->>'notes','')) on conflict(id) do update set notes=coalesce(m->>'notes',public.budget_private.notes);perform app.import_track(p_id,'budget_private',v_id,v_fields);
  update public.import_rows set status='imported',target_id=v_id where id=r.id;
 end loop;
 -- Independent server totals from persisted order lines, not uploaded net amounts.
 for v_expected in select jsonb_build_object('brand',key,'amount',value) from jsonb_each(b.expected_totals) loop
  if jsonb_typeof(v_expected->'amount') not in('string','number') or v_expected->>'amount'!~'^[0-9]{1,17}$' then raise exception 'INVALID_EXPECTED_TOTAL' using errcode='23514';end if;
  select coalesce(sum(o.net_total_cents),0) into v_actual from public.orders o join public.brands br on br.id=o.brand_id where o.id in(select distinct target_id from public.import_rows where batch_id=p_id and entity='orders' and status='imported') and app.import_key(br.name)=app.import_key(v_expected->>'brand');
  if v_actual<>(v_expected->>'amount')::numeric and p_confirm_differences is not true then raise exception 'TOTAL_DIFFERENCES' using errcode='23514';end if;
 end loop;
 -- Refresh after snapshots because totals triggers may have touched parent rows.
 for v_change in select * from app.import_changes where batch_id=p_id loop
  execute format('select to_jsonb(t) from public.%I t where id=$1',v_change.relation_name) into v_fields using v_change.record_id;
  update app.import_changes set after_row=coalesce(v_fields,'null'::jsonb) where batch_id=p_id and relation_name=v_change.relation_name and record_id=v_change.record_id;
 end loop;
 select jsonb_build_object('rows',(select count(*) from public.import_rows where batch_id=p_id),'imported',(select count(*) from public.import_rows where batch_id=p_id and status='imported'),'skipped',(select count(*) from public.import_rows where batch_id=p_id and status='skipped'),'created',(select count(*) from app.import_changes where batch_id=p_id and before_row is null),'updated',(select count(*) from app.import_changes where batch_id=p_id and before_row is not null),'orders',(select count(distinct target_id) from public.import_rows where batch_id=p_id and entity='orders' and status='imported'),'net_cents',(select coalesce(sum(net_total_cents),0)::text from public.orders where id in(select distinct target_id from public.import_rows where batch_id=p_id and entity='orders' and status='imported'))) into v_stats;
  select coalesce(jsonb_agg(to_jsonb(t)),'[]') into v_fields from (select br.name as brand,s.code as season,count(*) as orders,count(distinct o.customer_id) as customers,sum(coalesce(lines.pieces,0)) as pieces,sum(o.net_total_cents)::text as net_cents,sum(o.gross_total_cents)::text as gross_cents from public.orders o join public.brands br on br.id=o.brand_id join public.seasons s on s.id=o.season_id left join lateral (select sum(quantity) as pieces from public.order_lines where order_id=o.id) lines on true where o.id in(select distinct target_id from public.import_rows where batch_id=p_id and entity='orders' and status='imported') group by br.name,s.code order by br.name,s.code) t;
 v_stats:=v_stats||jsonb_build_object('totals',v_fields,'budget_comparison',app.import_budget_report(p_id));
 update public.import_batches set status='completed',completed_at=now(),stats=v_stats where id=p_id;return v_stats;
end;$$;
revoke all on function public.import_commit(uuid,boolean,boolean) from public;
grant execute on function public.import_commit(uuid,boolean,boolean) to authenticated;
