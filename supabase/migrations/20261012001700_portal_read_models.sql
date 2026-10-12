create view public.portal_events with(security_invoker=true) as
select id,brand_id,title,type,description,location,starts_at,ends_at,all_day
from public.events where deleted_at is null and visible_to_brand;
create view public.portal_documents with(security_invoker=true) as
select d.id,d.brand_id,d.name,d.kind,d.size_bytes,d.created_at,b.name as brand_name
from public.documents d join public.brands b on b.id=d.brand_id where d.ready and d.shared_with_brand and d.deleted_at is null;
grant select on public.portal_events,public.portal_documents to authenticated;

create function public.portal_orders_report(p_brand_id uuid default null,p_season_id uuid default null,p_start date default null,p_end date default null,p_status public.order_status default null,p_offset integer default 0,p_limit integer default 25) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if app.current_role() is distinct from 'brand'::public.app_role then raise exception 'forbidden' using errcode='42501';end if;
 if p_brand_id is not null and not app.has_brand_access(p_brand_id) then raise exception 'brand unavailable' using errcode='P0002';end if;
 if p_start>p_end or p_offset is null or p_limit is null or p_offset<0 or p_offset>2500000 or p_limit<1 or p_limit>10000 then raise exception 'invalid filters' using errcode='23514';end if;
 with filtered as (
 select o.id,o.number,o.brand_id,o.season_id,o.status,o.order_date,o.delivery_date,o.currency,o.net_total_cents,o.vat_total_cents,o.gross_total_cents,o.customer_display_name,o.customer_city,b.name as brand_name,s.code as season_code from public.portal_orders o join public.brands b on b.id=o.brand_id join public.seasons s on s.id=o.season_id
 where (p_brand_id is null or o.brand_id=p_brand_id) and (p_season_id is null or o.season_id=p_season_id) and (p_status is null or o.status=p_status)
 and (p_start is null or o.order_date>=p_start) and (p_end is null or o.order_date<=p_end)
 ), page as (select * from filtered order by order_date desc,number desc,id offset p_offset limit p_limit)
 select jsonb_build_object('count',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(p) order by order_date desc,number desc,id) from page p),'[]'::jsonb)) into result;
 return result;
end;$$;

create function public.portal_sales_report(p_brand_id uuid default null,p_season_id uuid default null,p_start date default null,p_end date default null,p_offset integer default 0,p_limit integer default 25) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if app.current_role() is distinct from 'brand'::public.app_role then raise exception 'forbidden' using errcode='42501';end if;
 if p_brand_id is not null and not app.has_brand_access(p_brand_id) then raise exception 'brand unavailable' using errcode='P0002';end if;
 if p_start>p_end or p_offset is null or p_limit is null or p_offset<0 or p_offset>2500000 or p_limit<1 or p_limit>10000 then raise exception 'invalid filters' using errcode='23514';end if;
 with sales as (
 select o.id,o.brand_id,o.customer_id,o.season_id,o.net_total_cents from public.orders o where o.deleted_at is null and o.status not in('draft','cancelled')
 and (p_brand_id is null or o.brand_id=p_brand_id) and (p_season_id is null or o.season_id=p_season_id)
 and (p_start is null or o.order_date>=p_start) and (p_end is null or o.order_date<=p_end)
 ), groups as (
 select o.brand_id,o.customer_id,o.season_id,b.name as brand_name,s.code as season_code,
 app.portal_customer(min(o.id::text)::uuid)->>'name' as customer_display_name,
 app.portal_customer(min(o.id::text)::uuid)->>'city' as customer_city,
 sum(o.net_total_cents)::text as net_cents,count(*) as order_count
 from sales o join public.brands b on b.id=o.brand_id join public.seasons s on s.id=o.season_id group by o.brand_id,o.customer_id,o.season_id,b.name,s.code
 ), page as (select * from groups order by net_cents::numeric desc,brand_id,season_id,customer_id offset p_offset limit p_limit)
 select jsonb_build_object('count',(select count(*) from groups),'sold_cents',(select coalesce(sum(net_total_cents),0)::text from sales),'rows',coalesce((select jsonb_agg(to_jsonb(p)) from page p),'[]'::jsonb)) into result;
 return result;
end;$$;
revoke all on function public.portal_orders_report(uuid,uuid,date,date,public.order_status,integer,integer) from public,anon;
revoke all on function public.portal_sales_report(uuid,uuid,date,date,integer,integer) from public,anon;
grant execute on function public.portal_orders_report(uuid,uuid,date,date,public.order_status,integer,integer) to authenticated;
grant execute on function public.portal_sales_report(uuid,uuid,date,date,integer,integer) to authenticated;
