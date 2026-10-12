-- Called inside the same transaction as the commercial commit. Comparisons are
-- snapshots of confirmed sales at that moment, preserved even after rollback.
create function app.import_budget_report(p_id uuid) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(t) order by t.brand,t.season,t.customer,t.period_start),'[]') from (
 select bu.id,br.name as brand,s.code as season,coalesce(c.legal_name,'') as customer,bu.period_start,bu.period_end,
 bu.amount_cents::text as budget_cents,v.previous_season,v.sold_cents,v.difference_cents,v.difference_pct,
 coalesce((select sum(o.net_total_cents) from public.orders o where o.id in(select distinct target_id from public.import_rows where batch_id=p_id and entity='orders' and status='imported') and o.brand_id=bu.brand_id and o.season_id is not distinct from bu.season_id and (bu.customer_id is null or o.customer_id=bu.customer_id) and o.order_date between bu.period_start and bu.period_end),0)::text as imported_cents
 from public.budgets bu join public.brands br on br.id=bu.brand_id left join public.seasons s on s.id=bu.season_id left join public.customers c on c.id=bu.customer_id left join public.v_budget_vs_previous_season v on v.budget_id=bu.id
 where bu.id in(select distinct target_id from public.import_rows where batch_id=p_id and entity='budgets' and status in('imported','skipped')) and bu.deleted_at is null
 ) t
$$;
create function public.import_batch_report(p_id uuid,p_page integer default 1,p_export boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare b public.import_batches;rows jsonb;result jsonb;begin
 select * into b from public.import_batches where id=p_id;
 if b.id is null or b.kind='performance' or not app.can_import(b.kind) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 200 or p_export is null then raise exception 'INVALID_FILTERS' using errcode='23514';end if;
 rows:=case when jsonb_typeof(b.stats->'budget_comparison')='array' then b.stats->'budget_comparison' else app.import_budget_report(p_id) end;
 select coalesce(jsonb_agg(value),'[]') into result from (select value from jsonb_array_elements(rows) with ordinality order by ordinality offset case when p_export then 0 else (p_page-1)*100 end limit case when p_export then 5001 else 100 end) q;
 return jsonb_build_object('status',b.status,'totals',public.import_totals(p_id),'budgets',result,'budget_count',jsonb_array_length(rows),'page',p_page,'snapshot',b.status in('completed','rolled_back'));
end;$$;
revoke all on function app.import_budget_report(uuid),public.import_batch_report(uuid,integer,boolean) from public;
grant execute on function public.import_batch_report(uuid,integer,boolean) to authenticated;
