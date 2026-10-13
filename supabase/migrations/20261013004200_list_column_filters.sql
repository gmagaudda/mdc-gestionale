-- Column filters and explicit selected IDs keep exports aligned with list reads.
drop function public.export_business_list(text,text,text,text,text,boolean);
create function public.export_business_list(p_entity text, p_q text default '', p_sort text default null, p_direction text default 'asc', p_status text default 'all', p_overdue boolean default false, p_ids uuid[] default null, p_column_filters jsonb default '{}') returns jsonb
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
      source_sql := 'select id,name,legal_name from public.brands where deleted_at is null';
      search_key := 'name'; sort_keys := array['name','legal_name']; default_sort := 'name';
    when 'customers' then
      text_keys := array['legal_name','trade_name','city'];
      source_sql := 'select id,legal_name,trade_name,city from public.customers where deleted_at is null';
      search_key := 'legal_name'; sort_keys := array['legal_name','trade_name','city']; default_sort := 'legal_name';
    when 'seasons' then
      text_keys := array['code','name'];
      source_sql := 'select s.id,s.code,s.name,b.name as brand from public.seasons s left join public.brands b on b.id=s.brand_id where s.deleted_at is null';
      search_key := 'name'; sort_keys := array['code','name']; default_sort := 'code';
    when 'products' then
      text_keys := array['name','sku_base']; money_keys := array['wholesale_price_cents'];
      source_sql := 'select p.id,p.name,p.sku_base,p.wholesale_price_cents::text,b.name as brand,s.code as season from public.products p left join public.brands b on b.id=p.brand_id left join public.seasons s on s.id=p.season_id where p.deleted_at is null';
      search_key := 'name'; sort_keys := array['name','sku_base','wholesale_price_cents']; default_sort := 'name';
    when 'budgets' then
      text_keys := '{}'; money_keys := array['amount_cents']; date_keys := array['period_start','period_end'];
      source_sql := 'select x.id,b.name as brand,s.code as season,c.legal_name as customer,x.amount_cents::text,x.period_start,x.period_end,x.created_at from public.budgets x join public.brands b on b.id=x.brand_id left join public.seasons s on s.id=x.season_id left join public.customers c on c.id=x.customer_id where x.deleted_at is null';
      search_key := 'brand'; sort_keys := array['period_start','amount_cents','created_at']; default_sort := 'period_start';
    when 'documents' then
      text_keys := array['name']; integer_keys := array['size_bytes'];
      source_sql := 'select d.id,d.name,d.kind,d.shared_with_brand,d.size_bytes,d.created_at,b.name as brand from public.documents d left join public.brands b on b.id=d.brand_id where d.ready=true and d.deleted_at is null';
      search_key := 'name'; sort_keys := array['name','created_at']; default_sort := 'created_at';
    when 'invoices' then
      text_keys := array['number']; money_keys := array['gross_cents']; date_keys := array['issue_date','due_date'];
      source_sql := 'select i.id,i.number,b.name as brand,c.legal_name as customer,i.status,i.issue_date,i.due_date,i.net_cents::text,i.vat_cents::text,i.gross_cents::text,i.paid_cents,i.balance_cents,i.overdue from public.v_invoice_balances i left join public.brands b on b.id=i.brand_id left join public.customers c on c.id=i.customer_id';
      search_key := 'number'; sort_keys := array['due_date','issue_date','number']; default_sort := 'due_date';
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
  sort_sql := case when p_sort in ('amount_cents','wholesale_price_cents') then format('(%I)::numeric',p_sort) else format('%I',p_sort) end;
  execute format('with source as (%s), filtered as (select * from source where strpos(lower(coalesce(%I,'''')),lower($1))>0 and ($4 is null or id=any($4)) %s), picked as (select * from filtered order by %s %s,id limit 10001) select jsonb_build_object(''rows'',coalesce(jsonb_agg(to_jsonb(picked)),''[]''::jsonb)) from picked',source_sql,search_key,extra_filter,sort_sql,p_direction)
    into result using btrim(p_q),p_status,p_overdue,p_ids,p_column_filters;
  return result;
end;$$;
revoke all on function public.export_business_list(text,text,text,text,text,boolean,uuid[],jsonb) from public,anon;
grant execute on function public.export_business_list(text,text,text,text,text,boolean,uuid[],jsonb) to authenticated;
