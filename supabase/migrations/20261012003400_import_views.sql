create view public.v_import_batch_totals with(security_invoker=true) as
select b.id as batch_id,t.brand,t.season,t.orders,t.customers,t.pieces,t.net_cents,t.gross_cents from public.import_batches b cross join lateral jsonb_to_recordset(public.import_totals(b.id)) as t(brand text,season text,orders bigint,customers bigint,pieces bigint,net_cents text,gross_cents text) where b.kind<>'performance';
create function app.previous_import_season(p_code text) returns text language sql immutable set search_path='' as $$
 select case when upper(trim(p_code))~'^FW[0-9]{2}$' then 'SS'||right(trim(p_code),2) when upper(trim(p_code))~'^SS[0-9]{2}$' then 'FW'||lpad(((right(trim(p_code),2)::integer+99)%100)::text,2,'0') else null end
$$;
create view public.v_budget_vs_previous_season with(security_invoker=true) as
select b.id as budget_id,b.brand_id,b.customer_id,b.season_id as budget_season_id,s.code as budget_season,previous.id as previous_season_id,previous.code as previous_season,b.amount_cents::text as budget_cents,
case when previous.id is not null then coalesce(sold.net,0)::text end as sold_cents,
case when previous.id is not null then (coalesce(sold.net,0)-b.amount_cents)::text end as difference_cents,
case when previous.id is not null and b.amount_cents>0 then round((coalesce(sold.net,0)-b.amount_cents)*100/b.amount_cents,2)::text end as difference_pct
from public.budgets b join public.seasons s on s.id=b.season_id and s.brand_id=b.brand_id
left join public.seasons previous on previous.brand_id=b.brand_id and upper(previous.code)=app.previous_import_season(s.code) and previous.deleted_at is null
left join lateral (select sum(o.net_total_cents) as net from public.orders o where o.brand_id=b.brand_id and o.season_id=previous.id and (b.customer_id is null or o.customer_id=b.customer_id) and o.deleted_at is null and o.status not in('draft','cancelled')) sold on true
where b.deleted_at is null and s.deleted_at is null;
revoke all on function app.previous_import_season(text) from public;
grant execute on function app.previous_import_season(text) to authenticated;
revoke all on public.v_import_batch_totals,public.v_budget_vs_previous_season from anon,authenticated;
grant select on public.v_import_batch_totals,public.v_budget_vs_previous_season to authenticated;
