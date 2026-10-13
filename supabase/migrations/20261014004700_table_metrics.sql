-- Read-only aggregates use the caller's session and existing RLS/masking views.
-- No pagination or export limit: all matching table rows contribute.
create function public.table_metrics(p_entity text, p_q text default '', p_filters jsonb default '{}', p_columns jsonb default '{}') returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare source_sql text; predicate text := ''; aggregates text[]; labels text[]; formats text[]; basis text;
 text_keys text[] := '{}'; numeric_keys text[] := '{}'; filter_keys text[] := '{}'; f record; result jsonb;
 today date := (statement_timestamp() at time zone 'Europe/Rome')::date;
begin
 if p_entity like 'portal/%' then
   if app.current_role() is distinct from 'brand'::public.app_role then raise exception 'forbidden' using errcode='42501'; end if;
 elsif not app.is_internal() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_entity in ('settings/users','settings/audit') and app.current_role() is distinct from 'admin'::public.app_role then raise exception 'forbidden' using errcode='42501'; end if;
 if p_entity='imports' and app.current_role() not in ('admin','accounting') then raise exception 'forbidden' using errcode='42501'; end if;
 if p_q is null or length(p_q)>100 then raise exception 'invalid search' using errcode='22023'; end if;
 if jsonb_typeof(p_filters) is distinct from 'object' or jsonb_typeof(p_columns) is distinct from 'object' then raise exception 'invalid filters' using errcode='22023'; end if;
 case p_entity
 when 'orders' then
  source_sql := 'select t.*, t.order_date as recorded_on, public.table_search(t) as search_text from public.orders t where t.deleted_at is null';
  labels := array['orders','gross','averageOrder']::text[]; formats := array['number','money','money']::text[]; aggregates := array['count(*)','coalesce(sum(gross_total_cents::numeric),0)','coalesce(round(avg(gross_total_cents::numeric)),0)']::text[]; basis := 'orderDate';
  text_keys := array[]::text[]; numeric_keys := array[]::text[];
  filter_keys := array['brand_id','season_id','status','customer_id']::text[];
 when 'customers' then
  source_sql := 'select t.*, (t.created_at at time zone ''Europe/Rome'')::date as recorded_on, public.table_search(t) as search_text from public.customers t where t.deleted_at is null';
  labels := array['customers','cities','tradeNames']::text[]; formats := array['number','number','number']::text[]; aggregates := array['count(*)','count(distinct nullif(btrim(city),''''))','count(*) filter(where btrim(trade_name)<>'''')']::text[]; basis := 'createdAt';
  text_keys := array['legal_name','trade_name','city']::text[]; numeric_keys := array[]::text[];
  filter_keys := array[]::text[];
 when 'brands' then
  source_sql := 'select t.*, (t.created_at at time zone ''Europe/Rome'')::date as recorded_on, public.table_search(t) as search_text from public.brands t where t.deleted_at is null';
  labels := array['brands','legalNames','externalCodes']::text[]; formats := array['number','number','number']::text[]; aggregates := array['count(*)','count(*) filter(where btrim(legal_name)<>'''')','count(*) filter(where external_code is not null)']::text[]; basis := 'createdAt';
  text_keys := array['name','legal_name']::text[]; numeric_keys := array[]::text[];
  filter_keys := array[]::text[];
 when 'seasons' then
  source_sql := 'select t.*, (t.created_at at time zone ''Europe/Rome'')::date as recorded_on, public.table_search(t) as search_text from public.seasons t where t.deleted_at is null';
  labels := array['seasons','brandsCovered','campaigns']::text[]; formats := array['number','number','number']::text[]; aggregates := array['count(*)','count(distinct brand_id)','count(*) filter(where campaign_start is not null)']::text[]; basis := 'createdAt';
  text_keys := array['code','name']::text[]; numeric_keys := array[]::text[];
  filter_keys := array[]::text[];
 when 'products' then
  source_sql := 'select t.*, (t.created_at at time zone ''Europe/Rome'')::date as recorded_on, public.table_search(t) as search_text from public.products t where t.deleted_at is null';
  labels := array['products','averagePrice','brandsCovered']::text[]; formats := array['number','money','number']::text[]; aggregates := array['count(*)','coalesce(round(avg(wholesale_price_cents::numeric)),0)','count(distinct brand_id)']::text[]; basis := 'createdAt';
  text_keys := array['name','sku_base']::text[]; numeric_keys := array['wholesale_price_cents']::text[];
  filter_keys := array[]::text[];
 when 'budgets' then
  source_sql := 'select t.*, (t.created_at at time zone ''Europe/Rome'')::date as recorded_on, public.table_search(t) as search_text from public.budgets t where t.deleted_at is null';
  labels := array['budgets','budgetTotal','averageBudget']::text[]; formats := array['number','money','money']::text[]; aggregates := array['count(*)','coalesce(sum(amount_cents::numeric),0)','coalesce(round(avg(amount_cents::numeric)),0)']::text[]; basis := 'createdAt';
  text_keys := array[]::text[]; numeric_keys := array['amount_cents']::text[];
  filter_keys := array[]::text[];
 when 'documents' then
  source_sql := 'select t.*, (t.created_at at time zone ''Europe/Rome'')::date as recorded_on, public.table_search(t) as search_text from public.documents t where t.deleted_at is null and t.ready';
  labels := array['documents','fileBytes','sharedDocuments']::text[]; formats := array['number','number','number']::text[]; aggregates := array['count(*)','coalesce(sum(size_bytes::numeric),0)','count(*) filter(where shared_with_brand)']::text[]; basis := 'createdAt';
  text_keys := array['name']::text[]; numeric_keys := array['size_bytes']::text[];
  filter_keys := array[]::text[];
 when 'invoices' then
  source_sql := 'select t.*, t.issue_date as recorded_on, public.table_search(t) as search_text from public.v_invoice_balances t';
  labels := array['invoices','invoiced','outstanding']::text[]; formats := array['number','money','money']::text[]; aggregates := array['count(*)','coalesce(sum(gross_cents::numeric),0)','coalesce(sum(balance_cents::numeric),0)']::text[]; basis := 'issueDate';
  text_keys := array['number']::text[]; numeric_keys := array['gross_cents']::text[];
  filter_keys := array['status','overdue']::text[];
 when 'commissions' then
  source_sql := 'select t.*, t.order_date as recorded_on, public.table_search(t) as search_text from public.v_commissions t';
  labels := array['orders','net','commissions']::text[]; formats := array['number','money','money']::text[]; aggregates := array['count(*)','coalesce(sum(net_cents::numeric),0)','coalesce(sum(commission_cents::numeric),0)']::text[]; basis := 'orderDate';
  text_keys := array[]::text[]; numeric_keys := array[]::text[];
  filter_keys := array['brand_id','season_id']::text[];
 when 'settings/users' then
  source_sql := 'select t.*, (t.created_at at time zone ''Europe/Rome'')::date as recorded_on, public.table_search(t) as search_text from public.profiles t';
  labels := array['users','activeUsers','roles']::text[]; formats := array['number','number','number']::text[]; aggregates := array['count(*)','count(*) filter(where is_active)','count(distinct role)']::text[]; basis := 'createdAt';
  text_keys := array[]::text[]; numeric_keys := array[]::text[];
  filter_keys := array[]::text[];
 when 'settings/audit' then
  source_sql := 'select t.*, (t.created_at at time zone ''Europe/Rome'')::date as recorded_on, public.table_search(t) as search_text from public.v_audit_list t';
  labels := array['events','actors','resources']::text[]; formats := array['number','number','number']::text[]; aggregates := array['count(*)','count(distinct actor_id)','count(distinct table_name)']::text[]; basis := 'createdAt';
  text_keys := array[]::text[]; numeric_keys := array[]::text[];
  filter_keys := array[]::text[];
 when 'imports' then
  source_sql := 'select t.*, (t.created_at at time zone ''Europe/Rome'')::date as recorded_on, concat_ws('' '',t.file_name,t.kind::text,t.status::text) as search_text from public.import_batches t';
  labels := array['imports','completedImports','failedImports']::text[]; formats := array['number','number','number']::text[]; aggregates := array['count(*)','count(*) filter(where status=''completed'')','count(*) filter(where status=''failed'')']::text[]; basis := 'createdAt';
  text_keys := array[]::text[]; numeric_keys := array[]::text[];
  filter_keys := array[]::text[];
 when 'portal/documents' then
  source_sql := 'select t.*, (t.created_at at time zone ''Europe/Rome'')::date as recorded_on, public.table_search(t) as search_text from public.portal_documents t';
  labels := array['documents','fileBytes','documentKinds']::text[]; formats := array['number','number','number']::text[]; aggregates := array['count(*)','coalesce(sum(size_bytes::numeric),0)','count(distinct kind)']::text[]; basis := 'createdAt';
  text_keys := array[]::text[]; numeric_keys := array[]::text[];
  filter_keys := array[]::text[];
 when 'portal/orders' then
  source_sql := 'select t.*, t.order_date as recorded_on, concat_ws('' '',t.number,app.table_date(t.order_date),b.name,s.code,t.customer_display_name,t.customer_city,t.status::text,case t.status::text when ''draft'' then ''Bozza'' when ''confirmed'' then ''Confermato'' when ''in_production'' then ''In produzione'' when ''shipped'' then ''Spedito'' when ''delivered'' then ''Consegnato'' when ''invoiced'' then ''Fatturato'' when ''cancelled'' then ''Annullato'' end,app.table_money(t.net_total_cents)) as search_text from public.portal_orders t join public.brands b on b.id=t.brand_id join public.seasons s on s.id=t.season_id';
  labels := array['orders','net','averageNetOrder']::text[]; formats := array['number','money','money']::text[]; aggregates := array['count(*)','coalesce(sum(net_total_cents::numeric),0)','coalesce(round(avg(net_total_cents::numeric)),0)']::text[]; basis := 'orderDate';
  text_keys := array[]::text[]; numeric_keys := array[]::text[];
  filter_keys := array['brand_id','season_id','status']::text[];
 when 'portal/sales' then
  labels := array['orders','net','averageNetOrder']; formats := array['number','money','money'];
  aggregates := array['count(*)','coalesce(sum(net_total_cents::numeric),0)','coalesce(round(avg(net_total_cents::numeric)),0)']; basis := 'orderDate';
  filter_keys := array['brand_id','season_id'];
  source_sql := $source$with sales as (
    select o.* from public.orders o where o.deleted_at is null and o.status not in ('draft','cancelled')
    and (nullif($2->>'brand_id','') is null or o.brand_id=(nullif($2->>'brand_id',''))::uuid)
    and (nullif($2->>'season_id','') is null or o.season_id=(nullif($2->>'season_id',''))::uuid)
  ), grouped as (
    select o.brand_id,o.customer_id,o.season_id,
    concat_ws(' ',b.name,s.code,app.portal_customer(min(o.id::text)::uuid)->>'name',
    app.portal_customer(min(o.id::text)::uuid)->>'city',app.table_money(sum(o.net_total_cents)),count(*)::text) as search_text
    from sales o join public.brands b on b.id=o.brand_id join public.seasons s on s.id=o.season_id
    group by o.brand_id,o.customer_id,o.season_id,b.name,s.code
  ) select t.*, t.order_date as recorded_on, g.search_text from sales t join grouped g using(brand_id,customer_id,season_id)$source$;
 else raise exception 'invalid entity' using errcode='22023';
 end case;
 for f in select key,value from jsonb_each(p_filters) loop
   if not f.key=any(filter_keys) or jsonb_typeof(f.value)<>'string' or length(f.value#>>'{}')>100 then raise exception 'invalid filter' using errcode='22023'; end if;
   if f.value#>>'{}' in ('','all') then continue; end if;
   if f.key in ('brand_id','customer_id','season_id') then
     perform (f.value#>>'{}')::uuid;
     predicate := predicate || format(' and %I=($2->>%L)::uuid',f.key,f.key);
   elsif f.key='status' then
     if p_entity='invoices' then perform (f.value#>>'{}')::public.invoice_status;
     else perform (f.value#>>'{}')::public.order_status; end if;
     predicate := predicate || ' and status::text=$2->>''status''';
   elsif f.key='overdue' then
     if f.value#>>'{}'<>'yes' then raise exception 'invalid overdue filter' using errcode='22023'; end if;
     predicate := predicate || ' and overdue';
   end if;
 end loop;
 for f in select key,value from jsonb_each(p_columns) loop
   if jsonb_typeof(f.value)<>'string' or length(f.value#>>'{}')>100 then raise exception 'invalid column filter' using errcode='22023'; end if;
   if f.key=any(text_keys) then
     predicate := predicate || format(' and strpos(lower(coalesce(%I,'''')),lower($3->>%L))>0',f.key,f.key);
   elsif f.key=any(numeric_keys) then
     if (f.value#>>'{}') !~ '^[0-9]{1,13}$' or (f.value#>>'{}')::numeric > (case when f.key='size_bytes' then 10485760 else 1000000000000 end) then raise exception 'invalid amount' using errcode='22023'; end if;
     predicate := predicate || format(' and %I::numeric=($3->>%L)::numeric',f.key,f.key);
   else raise exception 'invalid column' using errcode='22023'; end if;
 end loop;
 -- Six windows are evaluated against one filtered snapshot. Calendar bounds,
 -- including leap days, are shifted by one year, not by a fixed 365 days.
 execute format($query$
   with source as (%s), filtered as materialized (
     select * from source where strpos(lower(coalesce(search_text,'')),lower($1))>0 %s
   ), windows as (
     select days, previous,
       case when previous then ($4-(days-1)-interval '1 year')::date else $4-(days-1) end as starts,
       case when previous then ($4-interval '1 year')::date else $4 end as ends
     from unnest(array[7,30,90]) days cross join unnest(array[false,true]) previous
   ), totals as (
     select days,previous,array[(%s)::text,(%s)::text,(%s)::text] as values
     from windows w cross join lateral (select * from filtered where recorded_on between w.starts and w.ends) f
     group by days,previous
   ), complete as (
     select w.days,w.previous,coalesce(t.values,array['0','0','0']) as values
     from windows w left join totals t using(days,previous)
   ) select jsonb_build_object('as_of',$4,'basis',$5,'cards',(
     select jsonb_agg(jsonb_build_object('label',$6[i],'format',$7[i],'periods',(
       select jsonb_object_agg(c.days::text,jsonb_build_object('value',c.values[i],'previous',p.values[i]))
       from complete c join complete p on p.days=c.days and p.previous where not c.previous
     )) order by i) from generate_series(1,3) i
   ))
 $query$,source_sql,predicate,aggregates[1],aggregates[2],aggregates[3]) into result
 using btrim(p_q),p_filters,p_columns,today,basis,labels,formats;
 return result;
end;$$;
revoke all on function public.table_metrics(text,text,jsonb,jsonb) from public,anon;
grant execute on function public.table_metrics(text,text,jsonb,jsonb) to authenticated;
