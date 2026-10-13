-- One snapshot for printable summaries. Session permissions and RLS also apply
-- when this function is called directly, without the Next route handler.
create function public.brand_sales_summary(p_brand_id uuid, p_season_id uuid default null, p_start date default null, p_end date default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if not app.is_internal() and app.current_role() is distinct from 'brand'::public.app_role then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_brand_id is null or not app.has_brand_access(p_brand_id) then
    raise exception 'brand unavailable' using errcode='P0002';
  end if;
  if p_start > p_end then raise exception 'invalid period' using errcode='23514'; end if;
  if p_season_id is not null and not exists(select 1 from public.seasons where id=p_season_id and brand_id=p_brand_id and deleted_at is null) then
    raise exception 'season unavailable' using errcode='P0002';
  end if;
  with sales as (
    select o.* from public.orders o
    where o.brand_id=p_brand_id and o.deleted_at is null and o.status not in ('draft','cancelled')
      and (p_season_id is null or o.season_id=p_season_id)
      and (p_start is null or o.order_date>=p_start) and (p_end is null or o.order_date<=p_end)
  ), groups as (
    select o.season_id,o.customer_id,s.code as season_code,
      case when app.is_internal() then c.legal_name else app.portal_customer(min(o.id::text)::uuid)->>'name' end as customer,
      case when app.is_internal() then c.city else app.portal_customer(min(o.id::text)::uuid)->>'city' end as city,
      count(*) as order_count,sum(o.net_total_cents)::text as net_cents,
      sum(o.vat_total_cents)::text as vat_cents,sum(o.gross_total_cents)::text as gross_cents
    from sales o join public.seasons s on s.id=o.season_id left join public.customers c on c.id=o.customer_id
    group by o.season_id,o.customer_id,s.code,c.legal_name,c.city
  ), page as (
    select season_code,customer,city,order_count,net_cents,vat_cents,gross_cents
    from groups order by season_code,net_cents::numeric desc,season_id,customer_id limit 1000
  )
  select jsonb_build_object(
    'count',(select count(*) from groups), 'order_count',(select count(*) from sales),
    'net_cents',(select coalesce(sum(net_total_cents),0)::text from sales),
    'vat_cents',(select coalesce(sum(vat_total_cents),0)::text from sales),
    'gross_cents',(select coalesce(sum(gross_total_cents),0)::text from sales),
    'rows',coalesce((select jsonb_agg(to_jsonb(p)) from page p),'[]'::jsonb)
  ) into result;
  return result;
end;$$;
revoke all on function public.brand_sales_summary(uuid,uuid,date,date) from public,anon;
grant execute on function public.brand_sales_summary(uuid,uuid,date,date) to authenticated;
