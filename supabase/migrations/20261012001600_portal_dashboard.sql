-- Dedicated payload: no invoice, commission, note, fiscal or contact data.
create function public.portal_dashboard_report(p_brand_id uuid default null,p_season_id uuid default null,p_start date default null,p_end date default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if app.current_role() is distinct from 'brand'::public.app_role then raise exception 'forbidden' using errcode='42501';end if;
 if p_brand_id is not null and not app.has_brand_access(p_brand_id) then raise exception 'brand unavailable' using errcode='P0002';end if;
 if p_start>p_end then raise exception 'invalid period' using errcode='23514';end if;
 with sales as (
 select o.net_total_cents from public.orders o where o.deleted_at is null and o.status not in ('draft','cancelled')
 and (p_brand_id is null or o.brand_id=p_brand_id) and (p_season_id is null or o.season_id=p_season_id)
 and (p_start is null or o.order_date>=p_start) and (p_end is null or o.order_date<=p_end)
 ), comparison as (
 select v.id,v.brand_id,v.season_id,v.customer_id,v.budget_cents,v.sold_cents,v.period_start,v.period_end,v.difference_cents,v.difference_pct,
 b.name as brand_name,s.code as season_code,
 case when v.customer_id is null then null else coalesce(app.portal_customer((select min(o.id::text)::uuid from public.orders o where o.brand_id=v.brand_id and o.customer_id=v.customer_id and o.deleted_at is null))->>'name','Cliente riservato') end as customer_name
 from public.v_budget_vs_actual v join public.brands b on b.id=v.brand_id left join public.seasons s on s.id=v.season_id
 where (p_brand_id is null or v.brand_id=p_brand_id) and (p_season_id is null or v.season_id=p_season_id)
 and (p_start is null or v.period_end>=p_start) and (p_end is null or v.period_start<=p_end)
 )
 select jsonb_build_object(
 'sold_cents',(select coalesce(sum(net_total_cents),0)::text from sales),
 'order_count',(select count(*) from sales),
 'budget_count',(select count(*) from comparison),
 'budgets',coalesce((select jsonb_agg(to_jsonb(c)) from (select * from comparison order by period_start desc,id limit 50) c),'[]'::jsonb)
 ) into result;
 return result;
end;$$;
revoke all on function public.portal_dashboard_report(uuid,uuid,date,date) from public,anon;
grant execute on function public.portal_dashboard_report(uuid,uuid,date,date) to authenticated;
