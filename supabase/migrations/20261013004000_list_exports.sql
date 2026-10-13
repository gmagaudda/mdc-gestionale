-- Bounded exports from one statement snapshot, without private fields or URLs.
create function public.export_business_list(p_entity text, p_q text default '', p_sort text default null, p_direction text default 'asc', p_status text default 'all', p_overdue boolean default false) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare source_sql text; search_key text; sort_keys text[]; default_sort text;
  sort_sql text; extra_filter text := ''; result jsonb;
begin
  if not app.is_internal() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_q is null or length(p_q)>100 or p_direction is null or p_direction not in ('asc','desc') or p_overdue is null then
    raise exception 'invalid filters' using errcode='22023';
  end if;
  case p_entity
    when 'brands' then
      source_sql := 'select id,name,legal_name from public.brands where deleted_at is null';
      search_key := 'name'; sort_keys := array['name','legal_name']; default_sort := 'name';
    when 'customers' then
      source_sql := 'select id,legal_name,trade_name,city from public.customers where deleted_at is null';
      search_key := 'legal_name'; sort_keys := array['legal_name','trade_name','city']; default_sort := 'legal_name';
    when 'seasons' then
      source_sql := 'select s.id,s.code,s.name,b.name as brand from public.seasons s left join public.brands b on b.id=s.brand_id where s.deleted_at is null';
      search_key := 'name'; sort_keys := array['code','name']; default_sort := 'code';
    when 'products' then
      source_sql := 'select p.id,p.name,p.sku_base,p.wholesale_price_cents::text,b.name as brand,s.code as season from public.products p left join public.brands b on b.id=p.brand_id left join public.seasons s on s.id=p.season_id where p.deleted_at is null';
      search_key := 'name'; sort_keys := array['name','sku_base','wholesale_price_cents']; default_sort := 'name';
    when 'budgets' then
      source_sql := 'select x.id,b.name as brand,s.code as season,c.legal_name as customer,x.amount_cents::text,x.period_start,x.period_end,x.created_at from public.budgets x join public.brands b on b.id=x.brand_id left join public.seasons s on s.id=x.season_id left join public.customers c on c.id=x.customer_id where x.deleted_at is null';
      search_key := 'brand'; sort_keys := array['period_start','amount_cents','created_at']; default_sort := 'period_start';
    when 'documents' then
      source_sql := 'select d.id,d.name,d.kind,d.shared_with_brand,d.size_bytes,d.created_at,b.name as brand from public.documents d left join public.brands b on b.id=d.brand_id where d.ready=true and d.deleted_at is null';
      search_key := 'name'; sort_keys := array['name','created_at']; default_sort := 'created_at';
    when 'invoices' then
      source_sql := 'select i.id,i.number,b.name as brand,c.legal_name as customer,i.status,i.issue_date,i.due_date,i.net_cents::text,i.vat_cents::text,i.gross_cents::text,i.paid_cents,i.balance_cents,i.overdue from public.v_invoice_balances i left join public.brands b on b.id=i.brand_id left join public.customers c on c.id=i.customer_id';
      search_key := 'number'; sort_keys := array['due_date','issue_date','number']; default_sort := 'due_date';
      if p_status is null or p_status not in ('all','draft','issued','sent','paid','cancelled','rejected') then raise exception 'invalid status' using errcode='22023'; end if;
      extra_filter := 'and ($2=''all'' or status::text=$2) and (not $3 or overdue)';
    else raise exception 'invalid entity' using errcode='22023';
  end case;
  p_sort := coalesce(p_sort,default_sort);
  if not p_sort=any(sort_keys) then raise exception 'invalid sort' using errcode='22023'; end if;
  sort_sql := case when p_sort in ('amount_cents','wholesale_price_cents') then format('(%I)::numeric',p_sort) else format('%I',p_sort) end;
  execute format('with source as (%s), filtered as (select * from source where strpos(lower(coalesce(%I,'''')),lower($1))>0 %s), picked as (select * from filtered order by %s %s,id limit 10001) select jsonb_build_object(''rows'',coalesce(jsonb_agg(to_jsonb(picked)),''[]''::jsonb)) from picked',source_sql,search_key,extra_filter,sort_sql,p_direction)
    into result using btrim(p_q),p_status,p_overdue;
  return result;
end;$$;
revoke all on function public.export_business_list(text,text,text,text,text,boolean) from public,anon;
grant execute on function public.export_business_list(text,text,text,text,text,boolean) to authenticated;
