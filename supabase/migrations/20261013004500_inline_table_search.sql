-- Search the displayed fields under the caller's session/RLS, before pagination.
-- Unnamed composite arguments expose computed fields, not RPC row payloads.
create function app.table_money(numeric) returns text language sql immutable set search_path='' as $$
 select concat_ws(' ',($1/100)::text,replace(($1/100)::numeric(30,2)::text,'.',','),translate(to_char($1/100,'FM999,999,999,999,999,999,990.00'),',.','.,'),replace(($1/100)::numeric(30,2)::text,'.',',')||chr(160)||'€',translate(to_char($1/100,'FM999,999,999,999,999,999,990.00'),',.','.,')||chr(160)||'€');
$$;
create function app.table_date(date) returns text language sql stable set search_path='' as $$select concat_ws(' ',$1::text,to_char($1,'DD/MM/YYYY'),to_char($1,'DD/MM/YY'));$$;
create function public.table_search(public.brands) returns text language sql stable security invoker set search_path='' as $$
 select concat_ws(' ',($1).name,
  ($1).legal_name);
$$;
revoke all on function public.table_search(public.brands) from public,anon;
grant execute on function public.table_search(public.brands) to authenticated;
create function public.table_search(public.customers) returns text language sql stable security invoker set search_path='' as $$
 select concat_ws(' ',($1).legal_name,
  ($1).trade_name,
  ($1).city);
$$;
revoke all on function public.table_search(public.customers) from public,anon;
grant execute on function public.table_search(public.customers) to authenticated;
create function public.table_search(public.seasons) returns text language sql stable security invoker set search_path='' as $$
 select concat_ws(' ',($1).code,
  ($1).name,
  (select name from public.brands where id=($1).brand_id));
$$;
revoke all on function public.table_search(public.seasons) from public,anon;
grant execute on function public.table_search(public.seasons) to authenticated;
create function public.table_search(public.products) returns text language sql stable security invoker set search_path='' as $$
 select concat_ws(' ',($1).name,
  ($1).sku_base,
  (select name from public.brands where id=($1).brand_id),
  (select code from public.seasons where id=($1).season_id),
  app.table_money(($1).wholesale_price_cents));
$$;
revoke all on function public.table_search(public.products) from public,anon;
grant execute on function public.table_search(public.products) to authenticated;
create function public.table_search(public.budgets) returns text language sql stable security invoker set search_path='' as $$
 select concat_ws(' ',(select name from public.brands where id=($1).brand_id),
  coalesce((select code from public.seasons where id=($1).season_id),'Nessuno'),
  coalesce((select legal_name from public.customers where id=($1).customer_id),'Nessuno'),
  app.table_money(($1).amount_cents),
  app.table_date(($1).period_start),
  app.table_date(($1).period_end));
$$;
revoke all on function public.table_search(public.budgets) from public,anon;
grant execute on function public.table_search(public.budgets) to authenticated;
create function public.table_search(public.documents) returns text language sql stable security invoker set search_path='' as $$
 select concat_ws(' ',($1).name,
  (select name from public.brands where id=($1).brand_id),
  case ($1).kind::text when 'catalog' then 'Catalogo' when 'lookbook' then 'Lookbook' when 'price_list' then 'Listino prezzi' when 'order_confirmation' then 'Conferma ordine' when 'contract' then 'Contratto' when 'other' then 'Altro' else ($1).kind::text::text end,
  ($1).kind::text,
  case when ($1).shared_with_brand then 'Condiviso con il brand' else 'Solo personale interno' end,
  ($1).size_bytes::text,
  replace(round(($1).size_bytes::numeric/1024,1)::text,'.',',')||' KiB');
$$;
revoke all on function public.table_search(public.documents) from public,anon;
grant execute on function public.table_search(public.documents) to authenticated;
create function public.table_search(public.v_invoice_balances) returns text language sql stable security invoker set search_path='' as $$
 select concat_ws(' ',($1).number,
  (select name from public.brands where id=($1).brand_id),
  (select legal_name from public.customers where id=($1).customer_id),
  case ($1).status::text when 'draft' then 'Bozza' when 'issued' then 'Emessa' when 'sent' then 'Inviata' when 'paid' then 'Pagata' when 'cancelled' then 'Annullata' when 'rejected' then 'Rifiutata' else ($1).status::text::text end,
  ($1).status::text,
  app.table_date(($1).due_date),
  app.table_money(($1).gross_cents),
  app.table_money(($1).paid_cents::numeric),
  app.table_money(($1).balance_cents::numeric),
  case when ($1).overdue then 'Scaduta Solo scadute' end);
$$;
revoke all on function public.table_search(public.v_invoice_balances) from public,anon;
grant execute on function public.table_search(public.v_invoice_balances) to authenticated;
create function public.table_search(public.orders) returns text language sql stable security invoker set search_path='' as $$
 select concat_ws(' ',($1).number,
  app.table_date(($1).order_date),
  case ($1).status::text when 'draft' then 'Bozza' when 'confirmed' then 'Confermato' when 'in_production' then 'In produzione' when 'shipped' then 'Spedito' when 'delivered' then 'Consegnato' when 'invoiced' then 'Fatturato' when 'cancelled' then 'Annullato' else ($1).status::text::text end,
  ($1).status::text,
  (select name from public.brands where id=($1).brand_id),
  (select legal_name from public.customers where id=($1).customer_id),
  (select code from public.seasons where id=($1).season_id),
  app.table_money(($1).gross_total_cents));
$$;
revoke all on function public.table_search(public.orders) from public,anon;
grant execute on function public.table_search(public.orders) to authenticated;
create function public.table_search(public.profiles) returns text language sql stable security invoker set search_path='' as $$
 select concat_ws(' ',($1).email,
  ($1).full_name,
  ($1).role::text,
  case ($1).role::text when 'admin' then 'Amministratore' when 'staff' then 'Staff' when 'accounting' then 'Amministrazione' when 'brand' then 'Brand' else ($1).role::text::text end,
  case when ($1).is_active then 'Attivo' else 'Disattivato' end);
$$;
revoke all on function public.table_search(public.profiles) from public,anon;
grant execute on function public.table_search(public.profiles) to authenticated;
create function public.table_search(public.v_audit_list) returns text language sql stable security invoker set search_path='' as $$
 select concat_ws(' ',case when ($1).actor_id is null then 'Sistema' else coalesce(nullif(($1).actor_name,''),($1).actor_id::text) end,
  ($1).table_name,
  ($1).action,
  case ($1).action::text when 'insert' then 'Creazione' when 'update' then 'Modifica' when 'delete' then 'Rimozione' when 'invite' then 'Invito' else ($1).action::text::text end,
  case ($1).table_name::text when 'profiles' then 'Utenti' when 'brands' then 'Brand' when 'brand_private' then 'Dati interni brand' when 'brand_users' then 'Utenti del brand' when 'brand_contacts' then 'Referenti brand' when 'customers' then 'Clienti' when 'customer_contacts' then 'Referenti clienti' when 'seasons' then 'Stagioni' when 'products' then 'Prodotti' when 'product_variants' then 'Varianti prodotto' when 'orders' then 'Ordini' when 'order_private' then 'Dati privati ordini' when 'order_lines' then 'Righe ordine' when 'order_status_history' then 'Storico stati ordini' when 'events' then 'Eventi' when 'ical_tokens' then 'Abbonamenti iCal' when 'event_reminders' then 'Promemoria appuntamenti' when 'documents' then 'Documenti' when 'budgets' then 'Budget' when 'budget_private' then 'Note budget' else ($1).table_name::text::text end,
  to_char(($1).created_at at time zone 'Europe/Rome','DD/MM/YYYY HH24:MI:SS'),
  to_char(($1).created_at at time zone 'Europe/Rome','DD/MM/YY HH24:MI:SS'));
$$;
revoke all on function public.table_search(public.v_audit_list) from public,anon;
grant execute on function public.table_search(public.v_audit_list) to authenticated;
create function public.table_search(public.portal_documents) returns text language sql stable security invoker set search_path='' as $$
 select concat_ws(' ',($1).name,
  ($1).brand_name,
  case ($1).kind::text when 'catalog' then 'Catalogo' when 'lookbook' then 'Lookbook' when 'price_list' then 'Listino prezzi' when 'order_confirmation' then 'Conferma ordine' when 'contract' then 'Contratto' when 'other' then 'Altro' else ($1).kind::text::text end,
  ($1).kind::text,
  replace(round(($1).size_bytes::numeric/1024,1)::text,'.',',')||' KiB');
$$;
revoke all on function public.table_search(public.portal_documents) from public,anon;
grant execute on function public.table_search(public.portal_documents) to authenticated;
create function public.table_search(public.v_commissions) returns text language sql stable security invoker set search_path='' as $$
 select concat_ws(' ',($1).number,
  app.table_date(($1).order_date),
  ($1).brand_name,
  app.table_money(($1).net_cents::numeric),
  app.table_money(($1).commission_cents::numeric),
  replace(trim(trailing '.' from to_char(($1).commission_pct::numeric,'FM990.99')),'.',',')||'%',
  case when ($1).has_override then 'Percentuale ordine' else 'Percentuale brand' end);
$$;
revoke all on function public.table_search(public.v_commissions) from public,anon;
grant execute on function public.table_search(public.v_commissions) to authenticated;

-- Sort every data column before pagination and keep exports in the same order.
create or replace function public.export_business_list(p_entity text, p_q text default '', p_sort text default null, p_direction text default 'asc', p_status text default 'all', p_overdue boolean default false, p_ids uuid[] default null, p_column_filters jsonb default '{}') returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare source_sql text; search_key text; sort_keys text[]; default_sort text;
  sort_sql text; extra_filter text := ''; result jsonb; text_keys text[]; money_keys text[] := '{}'; date_keys text[] := '{}'; integer_keys text[] := '{}'; f record;
begin
  if not app.is_internal() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_q is null or length(p_q)>100 or p_direction is null or p_direction not in ('asc','desc') or p_overdue is null then
    raise exception 'invalid filters' using errcode='22023';
  end if;
  case p_entity
    when 'brands' then
      text_keys := array['name','legal_name'];
      source_sql := 'select id,name,legal_name,public.table_search(brands) as search_text from public.brands where deleted_at is null';
      search_key := 'search_text'; sort_keys := array['name','legal_name']; default_sort := 'name';
    when 'customers' then
      text_keys := array['legal_name','trade_name','city'];
      source_sql := 'select id,legal_name,trade_name,city,public.table_search(customers) as search_text from public.customers where deleted_at is null';
      search_key := 'search_text'; sort_keys := array['legal_name','trade_name','city']; default_sort := 'legal_name';
    when 'seasons' then
      text_keys := array['code','name'];
      source_sql := 'select s.id,s.code,s.name,b.name as brand,public.table_search(s) as search_text from public.seasons s left join public.brands b on b.id=s.brand_id where s.deleted_at is null';
      search_key := 'search_text'; sort_keys := array['code','name','brand']; default_sort := 'code';
    when 'products' then
      text_keys := array['name','sku_base']; money_keys := array['wholesale_price_cents'];
      source_sql := 'select p.id,p.name,p.sku_base,p.wholesale_price_cents::text,b.name as brand,s.code as season,public.table_search(p) as search_text from public.products p left join public.brands b on b.id=p.brand_id left join public.seasons s on s.id=p.season_id where p.deleted_at is null';
      search_key := 'search_text'; sort_keys := array['name','sku_base','wholesale_price_cents','brand','season']; default_sort := 'name';
    when 'budgets' then
      text_keys := '{}'; money_keys := array['amount_cents']; date_keys := array['period_start','period_end'];
      source_sql := 'select x.id,b.name as brand,s.code as season,c.legal_name as customer,x.amount_cents::text,x.period_start,x.period_end,x.created_at,public.table_search(x) as search_text from public.budgets x join public.brands b on b.id=x.brand_id left join public.seasons s on s.id=x.season_id left join public.customers c on c.id=x.customer_id where x.deleted_at is null';
      search_key := 'search_text'; sort_keys := array['period_start','amount_cents','created_at','brand','season','customer','period_end']; default_sort := 'period_start';
    when 'documents' then
      text_keys := array['name']; integer_keys := array['size_bytes'];
      source_sql := 'select d.id,d.name,d.kind,d.shared_with_brand,d.size_bytes,d.created_at,b.name as brand,public.table_search(d) as search_text from public.documents d left join public.brands b on b.id=d.brand_id where d.ready=true and d.deleted_at is null';
      search_key := 'search_text'; sort_keys := array['name','created_at','brand','kind','shared_with_brand','size_bytes']; default_sort := 'created_at';
    when 'invoices' then
      text_keys := array['number']; money_keys := array['gross_cents']; date_keys := array['issue_date','due_date'];
      source_sql := 'select i.id,i.number,b.name as brand,c.legal_name as customer,i.status,i.issue_date,i.due_date,i.net_cents::text,i.vat_cents::text,i.gross_cents::text,i.paid_cents,i.balance_cents,i.overdue,public.table_search(i) as search_text from public.v_invoice_balances i left join public.brands b on b.id=i.brand_id left join public.customers c on c.id=i.customer_id';
      search_key := 'search_text'; sort_keys := array['due_date','issue_date','number','brand','customer','status','gross_cents','paid_cents','balance_cents']; default_sort := 'due_date';
      if p_status is null or p_status not in ('all','draft','issued','sent','paid','cancelled','rejected') then raise exception 'invalid status' using errcode='22023'; end if;
      extra_filter := 'and ($2=''all'' or status::text=$2) and (not $3 or overdue)';
    else raise exception 'invalid entity' using errcode='22023';
  end case;
  if p_ids is not null and (cardinality(p_ids)>500 or array_position(p_ids,null) is not null) then raise exception 'invalid selection' using errcode='22023'; end if;
  if jsonb_typeof(p_column_filters) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_column_filters))>4 then raise exception 'invalid column filters' using errcode='22023'; end if;
  for f in select key,value from jsonb_each(p_column_filters) loop
    if jsonb_typeof(f.value)<>'string' or length(f.value#>>'{}')>100 then raise exception 'invalid column filter' using errcode='22023'; end if;
    if f.key=any(text_keys) then
      extra_filter := extra_filter||format(' and strpos(lower(coalesce(%I,'''')::text),lower($5->>%L))>0',f.key,f.key);
    elsif f.key=any(money_keys) or f.key=any(integer_keys) then
      if (f.value#>>'{}') !~ '^[0-9]{1,13}$' or (f.value#>>'{}')::numeric>(case when f.key=any(integer_keys) then 10485760 else 1000000000000 end) then raise exception 'invalid amount filter' using errcode='22023'; end if;
      extra_filter := extra_filter||format(' and (%I)::numeric=($5->>%L)::numeric',f.key,f.key);
    elsif f.key=any(date_keys) then
      if (f.value#>>'{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'invalid date filter' using errcode='22023'; end if;
      extra_filter := extra_filter||format(' and (%I)::date=($5->>%L)::date',f.key,f.key);
    else raise exception 'invalid column' using errcode='22023';
    end if;
  end loop;
  p_sort := coalesce(p_sort,default_sort);
  if not p_sort=any(sort_keys) then raise exception 'invalid sort' using errcode='22023'; end if;
  sort_sql := case when p_sort in ('amount_cents','wholesale_price_cents','gross_cents','paid_cents','balance_cents') then format('(%I)::numeric',p_sort) else format('%I',p_sort) end;
  execute format('with source as (%s), filtered as (select * from source where strpos(lower(coalesce(%I,'''')),lower($1))>0 and ($4 is null or id=any($4)) %s), picked as (select * from filtered order by %s %s,id limit 10001) select jsonb_build_object(''rows'',coalesce(jsonb_agg(to_jsonb(picked)-''search_text''),''[]''::jsonb)) from picked',source_sql,search_key,extra_filter,sort_sql,p_direction)
    into result using btrim(p_q),p_status,p_overdue,p_ids,p_column_filters;
  return result;
end;$$;
revoke all on function public.export_business_list(text,text,text,text,text,boolean,uuid[],jsonb) from public,anon;
grant execute on function public.export_business_list(text,text,text,text,text,boolean,uuid[],jsonb) to authenticated;

drop function public.portal_orders_report(uuid,uuid,date,date,public.order_status,integer,integer,text,text);
create function public.portal_orders_report(p_brand_id uuid default null,p_season_id uuid default null,p_start date default null,p_end date default null,p_status public.order_status default null,p_offset integer default 0,p_limit integer default 25,p_sort text default 'order_date',p_direction text default 'desc',p_q text default '') returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; sort_sql text;
begin
 if app.current_role() is distinct from 'brand'::public.app_role then raise exception 'forbidden' using errcode='42501';end if;
 if p_brand_id is not null and not app.has_brand_access(p_brand_id) then raise exception 'brand unavailable' using errcode='P0002';end if;
 if p_start>p_end or p_offset is null or p_limit is null or p_offset<0 or p_offset>2500000 or p_limit<1 or p_limit>10000 then raise exception 'invalid filters' using errcode='23514';end if;

 if p_q is null or length(p_q)>100 then raise exception 'invalid search' using errcode='22023';end if;
 if p_sort is null or p_sort not in ('order_date','number','brand_name','season_code','customer_display_name','customer_city','status','net_total_cents') or p_direction is null or p_direction not in ('asc','desc') then raise exception 'invalid sort' using errcode='22023';end if;
 sort_sql := case when p_sort='net_cents' then 'net_cents::numeric' else format('%I',p_sort) end;
 execute format($query$with filtered as (
 select o.id,o.number,o.brand_id,o.season_id,o.status,o.order_date,o.delivery_date,o.currency,o.net_total_cents,o.vat_total_cents,o.gross_total_cents,o.customer_display_name,o.customer_city,b.name as brand_name,s.code as season_code from public.portal_orders o join public.brands b on b.id=o.brand_id join public.seasons s on s.id=o.season_id
 where ($1 is null or o.brand_id=$1) and ($2 is null or o.season_id=$2) and ($5 is null or o.status=$5)
 and ($3 is null or o.order_date>=$3) and ($4 is null or o.order_date<=$4)
 and strpos(lower(concat_ws(' ',o.number,app.table_date(o.order_date),b.name,s.code,o.customer_display_name,o.customer_city,o.status::text,case o.status::text when 'draft' then 'Bozza' when 'confirmed' then 'Confermato' when 'in_production' then 'In produzione' when 'shipped' then 'Spedito' when 'delivered' then 'Consegnato' when 'invoiced' then 'Fatturato' when 'cancelled' then 'Annullato' else o.status::text::text end,app.table_money(o.net_total_cents))),lower($8))>0
 ), page as (select * from filtered order by %s %s,number desc,id offset $6 limit $7)
 select jsonb_build_object('count',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(p) order by %s %s,number desc,id) from page p),'[]'::jsonb));$query$,sort_sql,p_direction,sort_sql,p_direction) into result using p_brand_id,p_season_id,p_start,p_end,p_status,p_offset,p_limit,btrim(p_q);
 return result;
end;$$;

revoke all on function public.portal_orders_report(uuid,uuid,date,date,public.order_status,integer,integer,text,text,text) from public,anon;
grant execute on function public.portal_orders_report(uuid,uuid,date,date,public.order_status,integer,integer,text,text,text) to authenticated;

drop function public.portal_sales_report(uuid,uuid,date,date,integer,integer,text,text);
create function public.portal_sales_report(p_brand_id uuid default null,p_season_id uuid default null,p_start date default null,p_end date default null,p_offset integer default 0,p_limit integer default 25,p_sort text default 'net_cents',p_direction text default 'desc',p_q text default '') returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; sort_sql text;
begin
 if app.current_role() is distinct from 'brand'::public.app_role then raise exception 'forbidden' using errcode='42501';end if;
 if p_brand_id is not null and not app.has_brand_access(p_brand_id) then raise exception 'brand unavailable' using errcode='P0002';end if;
 if p_start>p_end or p_offset is null or p_limit is null or p_offset<0 or p_offset>2500000 or p_limit<1 or p_limit>10000 then raise exception 'invalid filters' using errcode='23514';end if;

 if p_q is null or length(p_q)>100 then raise exception 'invalid search' using errcode='22023';end if;
 if p_sort is null or p_sort not in ('net_cents','brand_name','season_code','customer_display_name','customer_city','order_count') or p_direction is null or p_direction not in ('asc','desc') then raise exception 'invalid sort' using errcode='22023';end if;
 sort_sql := case when p_sort='net_cents' then 'net_cents::numeric' else format('%I',p_sort) end;
 execute format($query$with sales as (
 select o.id,o.brand_id,o.customer_id,o.season_id,o.net_total_cents from public.orders o where o.deleted_at is null and o.status not in('draft','cancelled')
 and ($1 is null or o.brand_id=$1) and ($2 is null or o.season_id=$2)
 and ($3 is null or o.order_date>=$3) and ($4 is null or o.order_date<=$4)
 ), grouped as (
 select o.brand_id,o.customer_id,o.season_id,b.name as brand_name,s.code as season_code,
 app.portal_customer(min(o.id::text)::uuid)->>'name' as customer_display_name,
 app.portal_customer(min(o.id::text)::uuid)->>'city' as customer_city,
 sum(o.net_total_cents)::text as net_cents,count(*) as order_count
 from sales o join public.brands b on b.id=o.brand_id join public.seasons s on s.id=o.season_id group by o.brand_id,o.customer_id,o.season_id,b.name,s.code
 ), groups as (select * from grouped where strpos(lower(concat_ws(' ',brand_name,season_code,customer_display_name,customer_city,app.table_money(net_cents::numeric),order_count::text)),lower($7))>0), page as (select * from groups order by %s %s,brand_id,season_id,customer_id offset $5 limit $6)
 select jsonb_build_object('count',(select count(*) from groups),'sold_cents',(select coalesce(sum(net_cents::numeric),0)::text from groups),'rows',coalesce((select jsonb_agg(to_jsonb(p) order by %s %s,brand_id,season_id,customer_id) from page p),'[]'::jsonb));$query$,sort_sql,p_direction,sort_sql,p_direction) into result using p_brand_id,p_season_id,p_start,p_end,p_offset,p_limit,btrim(p_q);
 return result;
end;$$;

revoke all on function public.portal_sales_report(uuid,uuid,date,date,integer,integer,text,text,text) from public,anon;
grant execute on function public.portal_sales_report(uuid,uuid,date,date,integer,integer,text,text,text) to authenticated;

drop function public.commissions_report(uuid,uuid,date,date,integer,integer);
create function public.commissions_report(p_brand_id uuid default null,p_season_id uuid default null,p_start date default null,p_end date default null,p_offset integer default 0,p_limit integer default 25,p_q text default '') returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not app.is_internal() then raise exception 'forbidden' using errcode='42501';end if;
 if p_q is null or length(p_q)>100 then raise exception 'invalid search' using errcode='22023';end if;
 if p_start>p_end or p_offset is null or p_limit is null or p_offset<0 or p_offset>2500000 or p_limit<1 or p_limit>10000 then raise exception 'invalid report parameters' using errcode='23514';end if;
 with filtered as (
 select * from public.v_commissions where (p_brand_id is null or brand_id=p_brand_id) and (p_season_id is null or season_id=p_season_id)
 and (p_start is null or order_date>=p_start) and (p_end is null or order_date<=p_end) and strpos(lower(public.table_search(v_commissions)),lower(btrim(p_q)))>0
 ), brands as (
 select brand_id,brand_name,count(*) as order_count,sum(net_cents::numeric)::text as net_cents,sum(commission_cents::numeric)::text as commission_cents
 from filtered group by brand_id,brand_name
 ), page as (select * from filtered order by order_date desc,number desc,id offset p_offset limit p_limit)
 select jsonb_build_object(
 'net_cents',(select coalesce(sum(net_cents::numeric),0)::text from filtered),
 'commission_cents',(select coalesce(sum(commission_cents::numeric),0)::text from filtered),
 'order_count',(select count(*) from filtered),
 'brand_count',(select count(*) from brands),
 'brands',coalesce((select jsonb_agg(to_jsonb(b) order by brand_name,brand_id) from (select * from brands order by brand_name,brand_id limit 500) b),'[]'::jsonb),
 'orders',coalesce((select jsonb_agg(to_jsonb(p) order by order_date desc,number desc,id) from page p),'[]'::jsonb)
 ) into result;
 return result;
end;$$;
revoke all on function public.commissions_report(uuid,uuid,date,date,integer,integer,text) from public,anon;
grant execute on function public.commissions_report(uuid,uuid,date,date,integer,integer,text) to authenticated;


create function public.table_filter_options(p_entity text,p_column text,p_q text default '') returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare source_table text; allowed text[]; guard text; search_sql text; result jsonb;
begin
 if not app.is_internal() then raise exception 'forbidden' using errcode='42501';end if;
 if p_q is null or length(p_q)>100 then raise exception 'invalid search' using errcode='22023';end if;
 case p_entity
 when 'brands' then source_table:='brands';allowed:=array['name','legal_name'];
 when 'customers' then source_table:='customers';allowed:=array['legal_name','trade_name','city'];
 when 'seasons' then source_table:='seasons';allowed:=array['code','name'];
 when 'products' then source_table:='products';allowed:=array['name','sku_base','wholesale_price_cents'];
 when 'budgets' then source_table:='budgets';allowed:=array['amount_cents'];
 when 'documents' then source_table:='documents';allowed:=array['name','size_bytes'];
 when 'invoices' then source_table:='v_invoice_balances';allowed:=array['number','gross_cents'];
 else raise exception 'invalid entity' using errcode='22023';end case;
 if p_column is null or not p_column=any(allowed) then raise exception 'invalid column' using errcode='22023';end if;
 guard:=case when p_entity='invoices' then 'true' when p_entity='documents' then 'deleted_at is null and ready' else 'deleted_at is null' end;
 search_sql:=case when p_column in ('amount_cents','wholesale_price_cents','gross_cents') then format('app.table_money(%I::numeric)',p_column) else format('%I::text',p_column) end;
 execute format('select coalesce(jsonb_agg(value),''[]''::jsonb) from (select distinct %I::text as value from public.%I where %s and %I is not null and %I::text<>'''' and strpos(lower(%s),lower($1))>0 order by value limit 50) choices',p_column,source_table,guard,p_column,p_column,search_sql) into result using btrim(p_q);
 return result;
end;$$;
revoke all on function public.table_filter_options(text,text,text) from public,anon;
grant execute on function public.table_filter_options(text,text,text) to authenticated;
notify pgrst,'reload schema';
