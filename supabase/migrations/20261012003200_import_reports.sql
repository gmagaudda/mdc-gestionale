create function app.import_preview_net(p jsonb,p_profile jsonb) returns numeric language plpgsql immutable set search_path='' as $$
begin
 if not app.valid_operational_row('orders',p,p_profile) then return null;end if;
 if p_profile->'options'->>'granularity'='order_totals' then return (p->>'total_cents')::numeric;end if;
 return round((p->>'quantity')::numeric*(p->>'unit_price_cents')::numeric*(100-coalesce(nullif(p->>'discount_pct','')::numeric,0))*(100-coalesce(nullif(p->>'line_discount_pct','')::numeric,0))/10000);
end;$$;
create function public.import_totals(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare b public.import_batches;result jsonb;begin
 select * into b from public.import_batches where id=p_id;
 if b.id is null or b.kind='performance' or not app.can_import(b.kind) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if b.status in('completed','rolled_back') and jsonb_typeof(b.stats->'totals')='array' then return b.stats->'totals';end if;
 if b.status in('completed','rolled_back') then
  select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from (select br.name as brand,s.code as season,count(*) as orders,count(distinct o.customer_id) as customers,sum(coalesce(lines.pieces,0)) as pieces,sum(o.net_total_cents)::text as net_cents,sum(o.gross_total_cents)::text as gross_cents from public.orders o join public.brands br on br.id=o.brand_id join public.seasons s on s.id=o.season_id left join lateral (select sum(quantity) as pieces from public.order_lines where order_id=o.id) lines on true where o.id in(select distinct target_id from public.import_rows where batch_id=p_id and entity='orders' and status='imported') group by br.name,s.code order by br.name,s.code) t;
 else
  with source as (select r.*,r as import_row,app.import_preview_net(r.mapped,app.import_profile(b,r)) as net,coalesce(br.name,r.mapped->>'brand') as brand_label,coalesce(s.code,r.mapped->>'season') as season_label,coalesce(p.vat_rate,nullif(r.mapped->>'vat_rate','')::numeric) as vat from public.import_rows r left join public.brands br on br.id=nullif(r.match->'brand'->>'id','')::uuid left join public.seasons s on s.id=nullif(r.match->'season'->>'id','')::uuid left join public.product_variants v on v.id=nullif(r.match->'variant'->>'id','')::uuid left join public.products p on p.id=v.product_id where r.batch_id=p_id and r.entity='orders' and r.status in('valid','warning') and not (app.import_profile(b,r)->'options'->>'mode'='insert_only' and exists(select 1 from public.orders existing where existing.deleted_at is null and existing.brand_id=app.import_resolved(r,'brand') and case when nullif(r.mapped->>'external_ref','') is not null then existing.external_ref=r.mapped->>'external_ref' else existing.external_ref is null and existing.customer_id=app.import_resolved(r,'customer') and existing.season_id=app.import_resolved(r,'season') and existing.order_date=nullif(r.mapped->>'order_date','')::date end)))
  select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from (select brand_label as brand,season_label as season,count(distinct app.import_order_key(source.import_row)) as orders,count(distinct coalesce(match->'customer'->>'id',mapped->>'customer')) as customers,sum(case when app.import_profile(b,source.import_row)->'options'->>'granularity'='order_totals' then 1 else (mapped->>'quantity')::numeric end) as pieces,sum(net)::text as net_cents,case when bool_and(vat is not null) then sum(net+round(net*vat/100))::text end as gross_cents from source where net is not null group by brand_label,season_label order by brand_label,season_label) t;
 end if;return result;
end;$$;
create function public.import_preview(p_id uuid,p_page integer default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare b public.import_batches;r public.import_rows;pr jsonb;v_before jsonb;v_after jsonb;v_target uuid;v_brand uuid;v_customer uuid;v_season uuid;v_existing public.orders;v_changes jsonb;v_operations jsonb:='[]';v_total integer:=0;v_problems jsonb:='[]';v_problem_count integer:=0;v_code text;v_action text;result jsonb;begin
 select * into b from public.import_batches where id=p_id;
 if b.id is null or b.kind='performance' or not app.can_import(b.kind) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 1000 then raise exception 'INVALID_FILTERS' using errcode='23514';end if;
 for r in select * from public.import_rows where batch_id=p_id and status in('valid','warning') order by entity,sheet,row_number loop
  pr:=app.import_profile(b,r);v_code:=null;v_action:='create';v_before:=null;v_target:=null;v_changes:='[]';
  if not app.valid_operational_row(r.entity,r.mapped,pr) then v_code:='invalidRow';
  elsif r.entity='customers' and coalesce(r.match->'customer'->>'action','') not in('link','create') then v_code:='missingMatch';
  elsif r.entity in('orders','budgets') and (coalesce(r.match->'brand'->>'action','') not in('link','create') or (nullif(r.mapped->>'customer','') is not null and coalesce(r.match->'customer'->>'action','') not in('link','create')) or (nullif(r.mapped->>'season','') is not null and coalesce(r.match->'season'->>'action','') not in('link','create'))) then v_code:='missingMatch';
  elsif r.entity='orders' and pr->'options'->>'granularity'<>'order_totals' and coalesce(r.match->'variant'->>'action','') not in('link','create') then v_code:='missingMatch';
  elsif r.entity='orders' and r.match->'variant'->>'action'='create' and (nullif(r.mapped->>'product_name','') is null or nullif(r.mapped->>'size','') is null or nullif(r.mapped->>'color','') is null or nullif(r.mapped->>'vat_rate','') is null) then v_code:='newArticleData';end if;
  if v_code is not null then v_problem_count:=v_problem_count+1;if jsonb_array_length(v_problems)<100 then v_problems:=v_problems||jsonb_build_array(jsonb_build_object('sheet',r.sheet,'row',r.row_number,'code',v_code));end if;end if;
  if r.entity='customers' and r.match->'customer'->>'action'='link' then
   v_target:=app.import_resolved(r,'customer');select to_jsonb(c)||jsonb_build_object('address',coalesce(c.billing_address->>'street',''),'postal_code',coalesce(c.billing_address->>'postal_code',''),'province',coalesce(c.billing_address->>'province',''),'email',coalesce(contact.email,''),'phone',coalesce(contact.phone,'')) into v_before from public.customers c left join lateral (select email,phone from public.customer_contacts where customer_id=c.id and deleted_at is null and role_title='Recapito aziendale' order by id limit 1) contact on true where c.id=v_target and c.deleted_at is null;
  elsif r.entity='orders' then
   v_brand:=app.import_resolved(r,'brand');v_customer:=app.import_resolved(r,'customer');v_season:=app.import_resolved(r,'season');v_existing:=null;
   if nullif(r.mapped->>'external_ref','') is not null then select * into v_existing from public.orders where brand_id=v_brand and external_ref=r.mapped->>'external_ref' and deleted_at is null;
   else select * into v_existing from public.orders where brand_id=v_brand and customer_id=v_customer and season_id=v_season and order_date=nullif(r.mapped->>'order_date','')::date and external_ref is null and deleted_at is null order by id limit 1;end if;
   if v_existing.id is not null then
    v_before:=to_jsonb(v_existing)||jsonb_build_object('total_cents',v_existing.net_total_cents,'unit_price_cents',line.unit_price_cents,'quantity',line.quantity,'line_discount_pct',line.discount_pct,'line_net_cents',line.line_net_cents) from public.order_lines line where line.order_id=v_existing.id and line.variant_id=app.import_resolved(r,'variant') limit 1;
    if v_before is null then v_before:=to_jsonb(v_existing)||jsonb_build_object('total_cents',v_existing.net_total_cents);end if;
    v_target:=v_existing.id;if pr->'options'->>'mode'='upsert' and (v_existing.status<>'draft' or coalesce(r.mapped->>'status',pr->'options'->>'initialStatus','draft')<>'draft') then v_problem_count:=v_problem_count+1;if jsonb_array_length(v_problems)<100 then v_problems:=v_problems||jsonb_build_array(jsonb_build_object('sheet',r.sheet,'row',r.row_number,'code','existingOrderLocked'));end if;end if;
   end if;
  elsif r.entity='budgets' then
   select bu.id,to_jsonb(bu)||jsonb_build_object('notes',coalesce(bp.notes,'')) into v_target,v_before from public.budgets bu left join public.budget_private bp on bp.id=bu.id where bu.brand_id=app.import_resolved(r,'brand') and bu.season_id is not distinct from app.import_resolved(r,'season') and bu.customer_id is not distinct from app.import_resolved(r,'customer') and bu.period_start=nullif(r.mapped->>'period_start','')::date and bu.period_end=nullif(r.mapped->>'period_end','')::date and bu.deleted_at is null;
  end if;
  if v_target is not null then
   v_action:=case when pr->'options'->>'mode'='insert_only' then 'skip' else 'update' end;
   if v_action='update' then
    select coalesce(jsonb_agg(jsonb_build_object('field',key,'before',coalesce(v_before->key,'""'::jsonb),'after',value)),'[]') into v_changes from jsonb_each(r.mapped) where key not in('customer','brand','season','sku','product_name','color','size','vat_rate') and coalesce(v_before->key,'""'::jsonb) is distinct from value;
   end if;
  end if;
  v_total:=v_total+1;
  if v_total>(p_page-1)*100 and v_total<=p_page*100 then v_operations:=v_operations||jsonb_build_array(jsonb_build_object('row_id',r.id,'sheet',r.sheet,'row',r.row_number,'entity',r.entity,'action',v_action,'target_id',v_target,'changes',v_changes));end if;
 end loop;
 result:=jsonb_build_object('operations',v_operations,'total',v_total,'page',p_page,'problems',v_problems,'problem_count',v_problem_count,'errors',(select count(*) from public.import_rows where batch_id=p_id and status='error'),'totals',public.import_totals(p_id),'expected',b.expected_totals,'complete',b.options->>'staging_complete'='true');return result;
end;$$;
create function public.set_import_expected(p_id uuid,p_expected jsonb,p_revision uuid) returns void language plpgsql security definer set search_path='' as $$
declare b public.import_batches;k text;v jsonb;begin
 select * into b from public.import_batches where id=p_id for update;
 if b.id is null or b.kind='performance' or not app.can_import(b.kind) or b.created_by<>auth.uid() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if b.status not in('validated','ready') then raise exception 'INVALID_STATE' using errcode='23514';end if;
 if p_revision is null or b.options->>'revision' is distinct from p_revision::text then raise exception 'CONFIG_CONFLICT' using errcode='40001';end if;
 if jsonb_typeof(p_expected) is distinct from 'object' or octet_length(p_expected::text)>32768 then raise exception 'INVALID_EXPECTED_TOTAL' using errcode='23514';end if;
 for k,v in select * from jsonb_each(p_expected) loop if length(k) not between 1 and 200 or jsonb_typeof(v) is distinct from 'string' or v#>>'{}'!~'^[0-9]{1,17}$' then raise exception 'INVALID_EXPECTED_TOTAL' using errcode='23514';end if;end loop;
 update public.import_batches set expected_totals=p_expected where id=p_id;
end;$$;
revoke all on function app.import_preview_net(jsonb,jsonb),public.import_totals(uuid),public.import_preview(uuid,integer),public.set_import_expected(uuid,jsonb,uuid) from public;
grant execute on function public.import_totals(uuid),public.import_preview(uuid,integer),public.set_import_expected(uuid,jsonb,uuid) to authenticated;
