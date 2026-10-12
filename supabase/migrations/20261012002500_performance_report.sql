create function public.performance_report(p_id uuid,p_dimension text default 'brand',p_filters jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare b public.import_batches;result jsonb;begin
 if app.current_role() is distinct from 'admin' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into b from public.import_batches where id=p_id and kind='performance' and status='completed';
 if b.id is null then raise exception 'NOT_FOUND' using errcode='P0002';end if;
 if p_dimension not in('brand','area','representative','country','region','customer') or jsonb_typeof(p_filters) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_filters) k where k not in('brands','area','representative','country','region','search','page')) or octet_length(p_filters::text)>32768 then raise exception 'INVALID_FILTERS' using errcode='23514';end if;
 if p_filters ? 'brands' and (jsonb_typeof(p_filters->'brands') is distinct from 'array' or jsonb_array_length(p_filters->'brands')>500) then raise exception 'INVALID_FILTERS' using errcode='23514';end if;
 with source as (
  select mapped from public.import_rows where batch_id=p_id and status='imported'
 ),filtered as (
  select mapped,mapped->>p_dimension label from source
  where (not p_filters ? 'brands' or mapped->>'brand' in(select jsonb_array_elements_text(p_filters->'brands')))
  and (coalesce(p_filters->>'area','')='' or mapped->>'area'=p_filters->>'area')
  and (coalesce(p_filters->>'representative','')='' or mapped->>'representative'=p_filters->>'representative')
  and (coalesce(p_filters->>'country','')='' or mapped->>'country'=p_filters->>'country')
  and (coalesce(p_filters->>'region','')='' or mapped->>'region'=p_filters->>'region')
  and (coalesce(p_filters->>'search','')='' or position(lower(p_filters->>'search') in lower((mapped->>'customer')||' '||(mapped->>'brand')||' '||(mapped->>'city')))>0)
 ),groups as (
  select label,count(*) rows,
   count(distinct (mapped->>'customer',mapped->>'city',mapped->>'country')) filter(where mapped->>'customer'<>'') customers,
   sum((mapped->'values'->>'orders_ss26')::numeric)::text orders_ss26,
   sum((mapped->'values'->>'budget_fw26')::numeric)::text budget_fw26,
   sum((mapped->'values'->>'orders_fw26')::numeric)::text orders_fw26,
   sum((mapped->'values'->>'budget_ss27')::numeric)::text budget_ss27,
   sum((mapped->'values'->>'orders_ss27')::numeric)::text orders_ss27
  from filtered group by label
 ),page as (
  select * from groups order by label collate "C" limit case when p_filters->>'page'='0' then 20000 else 100 end offset greatest(0,least(199,coalesce((p_filters->>'page')::integer,1)-1))*100
 ),totals as (
  select count(*) rows,
   count(*) filter(where mapped->>'customer'='') unnamed_rows,
   sum((mapped->'values'->>'orders_ss26')::numeric)::text orders_ss26,
   sum((mapped->'values'->>'budget_fw26')::numeric)::text budget_fw26,
   sum((mapped->'values'->>'orders_fw26')::numeric)::text orders_fw26,
   sum((mapped->'values'->>'budget_ss27')::numeric)::text budget_ss27,
   sum((mapped->'values'->>'orders_ss27')::numeric)::text orders_ss27
  from filtered
 ) select jsonb_build_object(
  'batch_id',b.id,'file_name',b.file_name,'created_at',b.created_at,
  'pivotBrands',b.options->'pivotBrands','expected',b.expected_totals,
  'groups',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'),
  'group_count',(select count(*) from groups),'totals',(select to_jsonb(totals) from totals),
  'choices',jsonb_build_object(
   'brands',(select coalesce(jsonb_agg(label order by label),'[]') from(select distinct mapped->>'brand' label from source) d),
   'areas',(select coalesce(jsonb_agg(label order by label),'[]') from(select distinct mapped->>'area' label from source where mapped->>'area'<>'') d),
   'representatives',(select coalesce(jsonb_agg(label order by label),'[]') from(select distinct mapped->>'representative' label from source where mapped->>'representative'<>'') d),
   'countries',(select coalesce(jsonb_agg(label order by label),'[]') from(select distinct mapped->>'country' label from source where mapped->>'country'<>'') d),
   'regions',(select coalesce(jsonb_agg(label order by label),'[]') from(select distinct mapped->>'region' label from source where mapped->>'region'<>'') d)
  )) into result;
 return result;
end;$$;
revoke all on function public.performance_report(uuid,text,jsonb) from public;
grant execute on function public.performance_report(uuid,text,jsonb) to authenticated;
