-- Commission rates remain private. Financial calculation and rounding are SQL.
create view public.v_commissions with(security_invoker=true) as
select o.id,o.number,o.brand_id,b.name as brand_name,o.season_id,o.order_date,
o.net_total_cents::text as net_cents,
coalesce(op.commission_pct_override,bp.commission_pct,0)::text as commission_pct,
(op.commission_pct_override is not null) as has_override,
round(o.net_total_cents::numeric*coalesce(op.commission_pct_override,bp.commission_pct,0)/100)::text as commission_cents
from public.orders o join public.brands b on b.id=o.brand_id
left join public.brand_private bp on bp.id=o.brand_id
left join public.order_private op on op.id=o.id
where app.is_internal() and o.deleted_at is null and o.status not in ('draft','cancelled');
grant select on public.v_commissions to authenticated;

create function public.commissions_report(p_brand_id uuid default null,p_season_id uuid default null,p_start date default null,p_end date default null,p_offset integer default 0,p_limit integer default 25) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not app.is_internal() then raise exception 'forbidden' using errcode='42501';end if;
 if p_start>p_end or p_offset is null or p_limit is null or p_offset<0 or p_offset>2500000 or p_limit<1 or p_limit>10000 then raise exception 'invalid report parameters' using errcode='23514';end if;
 with filtered as (
 select * from public.v_commissions where (p_brand_id is null or brand_id=p_brand_id) and (p_season_id is null or season_id=p_season_id)
 and (p_start is null or order_date>=p_start) and (p_end is null or order_date<=p_end)
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
revoke all on function public.commissions_report(uuid,uuid,date,date,integer,integer) from public,anon;
grant execute on function public.commissions_report(uuid,uuid,date,date,integer,integer) to authenticated;
