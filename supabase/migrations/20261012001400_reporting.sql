-- Read model needed by the dashboard. Provider writes and payments follow in M7.
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null check(length(number) between 1 and 80),
  brand_id uuid not null references public.brands(id),
  customer_id uuid not null references public.customers(id),
  order_id uuid,
  status public.invoice_status not null default 'draft',
  issue_date date not null,
  due_date date not null,
  net_cents bigint not null check(net_cents between 0 and 1000000000000),
  vat_cents bigint not null check(vat_cents between 0 and 1000000000000),
  gross_cents bigint not null check(gross_cents=net_cents+vat_cents),
  external_id text,
  external_status text,
  pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,brand_id),
  foreign key(order_id,brand_id) references public.orders(id,brand_id),
  check(due_date>=issue_date)
);
create index invoices_brand_issue_date on public.invoices(brand_id,issue_date);
alter table public.invoices enable row level security;
create policy invoices_read on public.invoices for select to authenticated using(app.is_internal());
create trigger invoices_updated before update on public.invoices for each row execute function app.set_updated_at();
create trigger invoices_audit after insert or update on public.invoices for each row execute function app.audit_row_change();

create view public.v_sales_by_brand_season with(security_invoker=true) as
select brand_id,season_id,count(*) as order_count,sum(net_total_cents)::text as net_total_cents
from public.orders where deleted_at is null and status not in ('draft','cancelled') group by brand_id,season_id;
create view public.v_revenue_by_brand_period with(security_invoker=true) as
select brand_id,date_trunc('month',issue_date::timestamp)::date as month,sum(net_cents)::text as net_cents,count(*) as invoice_count
from public.invoices where status in ('issued','sent','paid') group by brand_id,month;
create view public.v_sales_by_customer with(security_invoker=true) as
select brand_id,customer_id,season_id,app.portal_customer(min(id::text)::uuid)->>'name' as customer_display_name,
app.portal_customer(min(id::text)::uuid)->>'city' as customer_city,count(*) as order_count,sum(net_total_cents)::text as net_total_cents
from public.orders where deleted_at is null and status not in ('draft','cancelled') group by brand_id,customer_id,season_id;
create view public.v_budget_vs_actual with(security_invoker=true) as
select b.id,b.brand_id,b.season_id,b.customer_id,b.amount_cents::text as budget_cents,b.period_start,b.period_end,
coalesce(s.net_cents,0)::text as sold_cents,case when app.is_internal() then coalesce(r.net_cents,0)::text else null end as revenue_cents,
(coalesce(s.net_cents,0)-b.amount_cents)::text as difference_cents,
case when b.amount_cents>0 then round((coalesce(s.net_cents,0)-b.amount_cents)*100/b.amount_cents,2)::text else null end as difference_pct
from public.budgets b
left join lateral (select sum(o.net_total_cents) as net_cents from public.orders o where o.deleted_at is null and o.status not in ('draft','cancelled') and o.brand_id=b.brand_id and (b.season_id is null or o.season_id=b.season_id) and (b.customer_id is null or o.customer_id=b.customer_id) and o.order_date between b.period_start and b.period_end) s on true
left join lateral (select sum(i.net_cents) as net_cents from public.invoices i left join public.orders o on o.id=i.order_id where i.status in ('issued','sent','paid') and i.brand_id=b.brand_id and (b.season_id is null or o.season_id=b.season_id) and (b.customer_id is null or i.customer_id=b.customer_id) and i.issue_date between b.period_start and b.period_end) r on true
where b.deleted_at is null;

create function public.dashboard_report(p_brand_id uuid default null,p_season_id uuid default null,p_start date default null,p_end date default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if not app.is_internal() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_start>p_end then raise exception 'invalid period' using errcode='23514'; end if;
  with sales as (
    select o.* from public.orders o where o.deleted_at is null and o.status not in ('draft','cancelled')
      and (p_brand_id is null or o.brand_id=p_brand_id) and (p_season_id is null or o.season_id=p_season_id)
      and (p_start is null or o.order_date>=p_start) and (p_end is null or o.order_date<=p_end)
  ), revenue as (
    select i.* from public.invoices i left join public.orders o on o.id=i.order_id
    where i.status in ('issued','sent','paid') and (p_brand_id is null or i.brand_id=p_brand_id) and (p_season_id is null or o.season_id=p_season_id)
      and (p_start is null or i.issue_date>=p_start) and (p_end is null or i.issue_date<=p_end)
  ), months as (
    select date_trunc('month',order_date::timestamp)::date as month,sum(net_total_cents) as net_cents from sales group by month
  ), top_customers as (
    select brand_id,customer_id,app.portal_customer(min(id::text)::uuid)->>'name' as name,
    app.portal_customer(min(id::text)::uuid)->>'city' as city,sum(net_total_cents)::text as net_cents,count(*) as order_count
    from sales group by brand_id,customer_id order by sum(net_total_cents) desc,customer_id limit 10
  ), comparison as (
    select v.*,b.name as brand_name,s.code as season_code,c.legal_name as customer_name from public.v_budget_vs_actual v
      left join public.brands b on b.id=v.brand_id left join public.seasons s on s.id=v.season_id left join public.customers c on c.id=v.customer_id
    where (p_brand_id is null or v.brand_id=p_brand_id) and (p_season_id is null or v.season_id=p_season_id)
      and (p_start is null or v.period_end>=p_start) and (p_end is null or v.period_start<=p_end)
  )
  select jsonb_build_object(
    'sold_cents',(select coalesce(sum(net_total_cents),0)::text from sales),
    'revenue_cents',(select coalesce(sum(net_cents),0)::text from revenue),
    'order_count',(select count(*) from sales),
    'invoice_count',(select count(*) from revenue),
    'budget_count',(select count(*) from comparison),
    'trend',coalesce((select jsonb_agg(jsonb_build_object('month',month,'net_cents',net_cents::text) order by month) from (select * from months order by month limit 120) m),'[]'::jsonb),
    'trend_month_count',(select count(*) from months),
    'customers',coalesce((select jsonb_agg(to_jsonb(t)) from top_customers t),'[]'::jsonb),
    'budgets',coalesce((select jsonb_agg(to_jsonb(c)) from (select * from comparison order by period_start desc,id limit 50) c),'[]'::jsonb)
  ) into result;
  return result;
end; $$;
revoke all on function public.dashboard_report(uuid,uuid,date,date) from public,anon;
grant execute on function public.dashboard_report(uuid,uuid,date,date) to authenticated;
