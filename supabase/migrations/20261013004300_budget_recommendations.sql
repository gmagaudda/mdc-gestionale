-- Private provenance, exposed only through guarded session RPCs.
create table app.budget_recommendations (
 budget_id uuid primary key references public.budgets(id) on delete cascade,
 settings jsonb not null,snapshot jsonb not null,applied_cents bigint not null,
 adjustment_reason text not null,created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table app.budget_recommendations enable row level security;
revoke all on app.budget_recommendations from public,anon,authenticated,service_role;

create function public.budget_history_sources(p_q text default '') returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if coalesce(app.current_role() in ('admin','accounting'),false) is not true then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_q is null or length(p_q)>100 then raise exception 'VALIDATION' using errcode='23514';end if;
 return (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
  select distinct b.id batch_id,b.file_name,b.completed_at,r.mapped->>'brand' brand,r.mapped->>'customer' customer,
   coalesce(r.mapped->>'city','') city,coalesce(r.mapped->>'country','') country
  from public.import_batches b join public.import_rows r on r.batch_id=b.id
  where b.kind='performance' and b.status='completed' and r.entity='performance' and r.status='imported'
   and coalesce(r.mapped->>'customer','')<>''
   and strpos(lower(concat_ws(' ',r.mapped->>'brand',r.mapped->>'customer',r.mapped->>'city',b.file_name)),lower(p_q))>0
  order by b.completed_at desc,b.id,brand,customer,city,country limit 50
 ) x);
end;$$;

create function public.calculate_budget_recommendation(p_settings jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 b public.brands;c public.customers;s public.seasons;hist jsonb:=p_settings->'historical_source';
 matched text:='none';target text;kind text;yr integer;v_code text;other_kind text;historical numeric;operational numeric;amount numeric;
 ended date;is_closed boolean;source text;state text;ov jsonb;rows jsonb:='[]';result jsonb;r jsonb;
 weights integer[];growth integer;threshold integer;row_year integer;used_count integer:=0;weighted numeric:=0;weight_sum integer:=0;weight integer;
 base numeric;suggested numeric;cycles integer:=0;ss numeric;fw numeric;summer_count integer:=0;winter_count integer:=0;continuous_count integer:=0;
 detected text:='insufficient';profile text;identity_count integer;batch uuid;
 today date:=(now() at time zone 'Europe/Rome')::date;
begin
 if coalesce(app.current_role() in ('admin','accounting'),false) is not true then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_settings is null or jsonb_typeof(p_settings)<>'object' or octet_length(p_settings::text)>16384
  or exists(select 1 from jsonb_object_keys(p_settings) k where k not in('brand_id','customer_id','season_id','weights','growth_bps','seasonal_threshold','profile','profile_reason','historical_source','overrides'))
  or not (p_settings ?& array['brand_id','customer_id','season_id','weights','growth_bps','seasonal_threshold','profile','profile_reason','historical_source','overrides'])
 then raise exception 'VALIDATION' using errcode='23514';end if;
 if exists(select 1 from jsonb_each(p_settings) x where x.key in('brand_id','customer_id','season_id','profile') and (jsonb_typeof(x.value)<>'string' or (x.value#>>'{}')='')) then raise exception 'VALIDATION' using errcode='23514';end if;
 if jsonb_typeof(p_settings->'weights') is distinct from 'array' or jsonb_array_length(p_settings->'weights')<>3
  or exists(select 1 from jsonb_array_elements(p_settings->'weights') v where jsonb_typeof(v)<>'number' or v::text !~ '^[0-9]{1,4}$' or v::text::integer not between 1 and 1000)
  or jsonb_typeof(p_settings->'growth_bps') is distinct from 'number' or p_settings->>'growth_bps' !~ '^-?[0-9]{1,5}$'
  or jsonb_typeof(p_settings->'seasonal_threshold') is distinct from 'number' or p_settings->>'seasonal_threshold' !~ '^[0-9]{1,2}$'
  or p_settings->>'profile' not in('auto','continuous','summer','winter','irregular')
  or jsonb_typeof(p_settings->'profile_reason') is distinct from 'string' or length(p_settings->>'profile_reason')>500
 then raise exception 'VALIDATION' using errcode='23514';end if;
 select array_agg(v::text::integer order by n) into weights from jsonb_array_elements(p_settings->'weights') with ordinality x(v,n);
 growth:=(p_settings->>'growth_bps')::integer;threshold:=(p_settings->>'seasonal_threshold')::integer;
 if growth not between -10000 and 10000 or threshold not between 1 and 50
  or (p_settings->>'profile'<>'auto' and length(trim(p_settings->>'profile_reason'))=0)
  or jsonb_typeof(p_settings->'overrides') is distinct from 'array' or jsonb_array_length(p_settings->'overrides')>12
 then raise exception 'VALIDATION' using errcode='23514';end if;
 select * into b from public.brands where id=(p_settings->>'brand_id')::uuid and deleted_at is null;
 select * into c from public.customers where id=(p_settings->>'customer_id')::uuid and deleted_at is null;
 select * into s from public.seasons where id=(p_settings->>'season_id')::uuid and brand_id=b.id and deleted_at is null;
 if b.id is null or c.id is null or s.id is null then raise exception 'NOT_FOUND' using errcode='P0002';end if;
 target:=upper(trim(s.code));
 if target !~ '^(SS|FW)([0-9]{2}|20[0-9]{2})$' then raise exception 'SEASON_CODE' using errcode='23514';end if;
 kind:=left(target,2);yr:=case when length(target)=4 then 2000+right(target,2)::integer else right(target,4)::integer end;
 if exists(select 1 from jsonb_array_elements(p_settings->'overrides') o
   where jsonb_typeof(o)<>'object' or exists(select 1 from jsonb_each(o) x where jsonb_typeof(x.value)<>'string') or not(o ?& array['code','source','state','reason'])
    or exists(select 1 from jsonb_object_keys(o) k where k not in('code','source','state','reason'))
    or o->>'code' !~ '^(SS|FW)[0-9]{2}$' or o->>'source' not in('auto','operational','historical')
    or o->>'state' not in('default','closed','zero','missing','excluded')
    or jsonb_typeof(o->'reason') is distinct from 'string' or length(o->>'reason')>500
    or (o->>'state' in('closed','zero','excluded') and length(trim(o->>'reason'))=0)
    or (2000+right(o->>'code',2)::integer) not between yr-6 and yr
    or (2000+right(o->>'code',2)::integer)=yr and (kind='SS' or left(o->>'code',2)='FW'))
  or (select count(*)<>count(distinct o->>'code') from jsonb_array_elements(p_settings->'overrides') o)
 then raise exception 'VALIDATION' using errcode='23514';end if;
 -- An explicit identity is selected by the operator. Automatic matching is exact,
 -- unique and uses one latest snapshot, never the sum of repeated workbooks.
 if hist is not null and hist<>'null'::jsonb then
  if jsonb_typeof(hist)<>'object' or not(hist ?& array['batch_id','brand','customer','city','country'])
   or exists(select 1 from jsonb_object_keys(hist) k where k not in('batch_id','brand','customer','city','country'))
   or exists(select 1 from jsonb_each(hist) x where jsonb_typeof(x.value)<>'string' or length(x.value#>>'{}')>200)
   or trim(hist->>'brand')='' or trim(hist->>'customer')=''
  then raise exception 'VALIDATION' using errcode='23514';end if;
  batch:=(hist->>'batch_id')::uuid;matched:='explicit';
  if not exists(select 1 from public.import_batches ib join public.import_rows ir on ir.batch_id=ib.id
    where ib.id=batch and ib.kind='performance' and ib.status='completed' and ir.entity='performance' and ir.status='imported'
    and ir.mapped->>'brand'=hist->>'brand' and ir.mapped->>'customer'=hist->>'customer'
    and coalesce(ir.mapped->>'city','')=hist->>'city' and coalesce(ir.mapped->>'country','')=hist->>'country')
  then raise exception 'NOT_FOUND' using errcode='P0002';end if;
 else
  hist:=null;
  select ib.id into batch from public.import_batches ib join public.import_rows ir on ir.batch_id=ib.id
   where ib.kind='performance' and ib.status='completed' and ir.entity='performance' and ir.status='imported'
    and lower(trim(ir.mapped->>'brand'))=lower(trim(b.name))
    and lower(trim(ir.mapped->>'customer')) in(lower(trim(c.legal_name)),nullif(lower(trim(c.trade_name)),''))
   order by ib.completed_at desc nulls last,ib.created_at desc,ib.id limit 1;
  if batch is not null then
   select count(*) into identity_count from (
    select distinct ir.mapped->>'brand',ir.mapped->>'customer',coalesce(ir.mapped->>'city',''),coalesce(ir.mapped->>'country','')
    from public.import_rows ir where ir.batch_id=batch and ir.status='imported' and ir.entity='performance'
      and lower(trim(ir.mapped->>'brand'))=lower(trim(b.name))
      and lower(trim(ir.mapped->>'customer')) in(lower(trim(c.legal_name)),nullif(lower(trim(c.trade_name)),''))
   ) x;
   if identity_count<>1 or (select count(*) from public.brands where deleted_at is null and lower(trim(name))=lower(trim(b.name)))<>1
     or (select count(*) from public.customers where deleted_at is null and (
       lower(trim(legal_name)) in(lower(trim(c.legal_name)),nullif(lower(trim(c.trade_name)),''))
       or nullif(lower(trim(trade_name)),'') in(lower(trim(c.legal_name)),nullif(lower(trim(c.trade_name)),''))))<>1
   then matched:='ambiguous';batch:=null;
   else
    select jsonb_build_object('batch_id',batch,'brand',ir.mapped->>'brand','customer',ir.mapped->>'customer',
      'city',coalesce(ir.mapped->>'city',''),'country',coalesce(ir.mapped->>'country','')) into hist
     from public.import_rows ir where ir.batch_id=batch and ir.status='imported' and ir.entity='performance'
      and lower(trim(ir.mapped->>'brand'))=lower(trim(b.name))
      and lower(trim(ir.mapped->>'customer')) in(lower(trim(c.legal_name)),nullif(lower(trim(c.trade_name)),'')) limit 1;
    matched:='automatic';
   end if;
  end if;
 end if;
 -- Twelve chronological slots preceding the target, including the other season
 -- of the current year for FW. Season names do not imply completion or coverage.
 for i in 1..12 loop
  if kind='FW' then
   other_kind:=case when i%2=1 then 'SS' else 'FW' end;row_year:=yr-(i/2);
  else
   other_kind:=case when i%2=1 then 'FW' else 'SS' end;row_year:=yr-((i+1)/2);
  end if;
  if row_year<2000 then continue;end if;
  v_code:=other_kind||lpad((row_year%100)::text,2,'0');
  select o into ov from jsonb_array_elements(p_settings->'overrides') o where o->>'code'=v_code;
  select sum(o.net_total_cents::numeric) into operational from public.orders o join public.seasons se on se.id=o.season_id
   where o.brand_id=b.id and o.customer_id=c.id and o.deleted_at is null and o.status not in('draft','cancelled')
    and se.deleted_at is null and upper(trim(se.code)) in(v_code,left(v_code,2)||'20'||right(v_code,2));
  historical:=null;
  if hist is not null then
   select case when count(*)=count(ir.mapped->'values'->>('orders_'||lower(v_code))) then
     sum((ir.mapped->'values'->>('orders_'||lower(v_code)))::numeric) else null end into historical
    from public.import_rows ir where ir.batch_id=batch and ir.status='imported' and ir.entity='performance'
      and ir.mapped->>'brand'=hist->>'brand' and ir.mapped->>'customer'=hist->>'customer'
      and coalesce(ir.mapped->>'city','')=hist->>'city' and coalesce(ir.mapped->>'country','')=hist->>'country';
  end if;
  select max(greatest(se.campaign_end,se.delivery_end)) into ended from public.seasons se
   where se.brand_id=b.id and se.deleted_at is null and upper(trim(se.code)) in(v_code,left(v_code,2)||'20'||right(v_code,2));
  is_closed:=coalesce(ended<today,false);source:='none';amount:=null;state:='missing';
  if ov->>'source'='operational' then amount:=operational;source:='operational';
  elsif ov->>'source'='historical' then amount:=historical;source:='historical';
  elsif operational is not null and historical is not null then state:='conflict';
  elsif operational is not null then amount:=operational;source:='operational';
  elsif historical is not null then amount:=historical;source:='historical';end if;
  if ov->>'state' in('closed','zero') then
   if ended>=today then raise exception 'SEASON_OPEN' using errcode='23514';end if;
   is_closed:=true;
  end if;
  if ov->>'state'='zero' then
   if coalesce(operational,0)>0 or coalesce(historical,0)>0 then raise exception 'ZERO_CONFLICT' using errcode='23514';end if;
   amount:=0;source:='declared';state:='known';
  elsif ov->>'state'='missing' then amount:=null;state:='missing';
  elsif ov->>'state'='excluded' then state:='excluded';
  elsif amount is not null then state:=case when is_closed then 'known' else 'open' end;end if;
  rows:=rows||jsonb_build_array(jsonb_build_object('code',v_code,'kind',other_kind,'year',row_year,
   'state',state,'source',source,'amount_cents',amount::text,'operational_cents',operational::text,'historical_cents',historical::text,
   'closed',is_closed,'used',false,'weight',0,'reason',coalesce(ov->>'reason','')));
 end loop;
 if exists(select 1 from jsonb_array_elements(p_settings->'overrides') o where not exists(select 1 from jsonb_array_elements(rows) x where x->>'code'=o->>'code')) then raise exception 'VALIDATION' using errcode='23514';end if;
 -- Two or more complete paired cycles are required. The low season must meet
 -- the configured ratio in every observed pair, not only in a pooled total.
 for y in yr-6..yr-1 loop
  select (x->>'amount_cents')::numeric into ss from jsonb_array_elements(rows) x where x->>'kind'='SS' and (x->>'year')::integer=y and x->>'state'='known';
  select (x->>'amount_cents')::numeric into fw from jsonb_array_elements(rows) x where x->>'kind'='FW' and (x->>'year')::integer=y and x->>'state'='known';
  if ss is not null and fw is not null then
   cycles:=cycles+1;
   if ss>0 and fw*100<=ss*threshold then summer_count:=summer_count+1;
   elsif fw>0 and ss*100<=fw*threshold then winter_count:=winter_count+1;
   elsif ss>0 and fw>0 then continuous_count:=continuous_count+1;end if;
  end if;
 end loop;
 if cycles>=2 then detected:=case when summer_count=cycles then 'summer' when winter_count=cycles then 'winter' when continuous_count=cycles then 'continuous' else 'irregular' end;end if;
 profile:=case when p_settings->>'profile'='auto' then detected else p_settings->>'profile' end;
 result:='[]';
 for r in select value from jsonb_array_elements(rows) loop
  if r->>'kind'=kind and r->>'state'='known' and used_count<3 then
   used_count:=used_count+1;weight:=weights[used_count];weighted:=weighted+(r->>'amount_cents')::numeric*weight;weight_sum:=weight_sum+weight;
   r:=r||jsonb_build_object('used',true,'weight',weight);
  end if;
  result:=result||jsonb_build_array(r);
 end loop;
 if weight_sum>0 then
  base:=round(weighted/weight_sum);suggested:=round(weighted*(10000+growth)/(weight_sum::numeric*10000));
  if suggested>1000000000000 then raise exception 'AMOUNT_LIMIT' using errcode='22003';end if;
 end if;
 result:=jsonb_build_object('target',target,'suggested_cents',suggested,'base_cents',base::text,'detected_profile',detected,
  'profile',profile,'paired_cycles',cycles,'history_count',used_count,'historical_match',matched,'historical_source',hist,'rows',result);
 return result||jsonb_build_object('fingerprint',md5(result::text||p_settings::text));
end;$$;

create function public.apply_budget_recommendation(p_data jsonb,p_settings jsonb,p_expected text,p_adjustment_reason text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare snapshot jsonb;v_id uuid;v_amount bigint;
begin
 if coalesce(app.current_role() in ('admin','accounting'),false) is not true then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_data is null or p_data->>'brand_id' is distinct from p_settings->>'brand_id'
  or p_data->>'customer_id' is distinct from p_settings->>'customer_id' or p_data->>'season_id' is distinct from p_settings->>'season_id'
  or p_adjustment_reason is null or length(p_adjustment_reason)>500 then raise exception 'VALIDATION' using errcode='23514';end if;
 snapshot:=public.calculate_budget_recommendation(p_settings);
 if p_expected is distinct from snapshot->>'fingerprint' then raise exception 'STALE_RECOMMENDATION' using errcode='40001';end if;
 if snapshot->>'suggested_cents' is null then raise exception 'NO_HISTORY' using errcode='23514';end if;
 v_amount:=(p_data->>'amount_cents')::bigint;
 if v_amount is null or (v_amount<>(snapshot->>'suggested_cents')::bigint and length(trim(p_adjustment_reason))=0)
 then raise exception 'REASON_REQUIRED' using errcode='23514';end if;
 v_id:=public.save_budget(null,p_data);
 insert into app.budget_recommendations(budget_id,settings,snapshot,applied_cents,adjustment_reason,created_by)
  values(v_id,p_settings,snapshot,v_amount,trim(p_adjustment_reason),auth.uid());
 insert into public.audit_log(actor_id,action,table_name,record_id,after)
  values(auth.uid(),'recommendation_applied','budgets',v_id,jsonb_build_object('suggested_cents',(snapshot->>'suggested_cents')::bigint,'applied_cents',v_amount,'fingerprint',p_expected));
 return v_id;
end;$$;

create function public.budget_recommendation_provenance(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not app.is_internal() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return (select jsonb_build_object('settings',r.settings,'snapshot',r.snapshot,'applied_cents',r.applied_cents,
  'adjustment_reason',r.adjustment_reason,'created_at',r.created_at)
  from app.budget_recommendations r join public.budgets b on b.id=r.budget_id where b.id=p_id and b.deleted_at is null);
end;$$;
revoke all on function public.budget_history_sources(text),public.calculate_budget_recommendation(jsonb),public.apply_budget_recommendation(jsonb,jsonb,text,text),public.budget_recommendation_provenance(uuid) from public,anon;
grant execute on function public.budget_history_sources(text),public.calculate_budget_recommendation(jsonb),public.apply_budget_recommendation(jsonb,jsonb,text,text),public.budget_recommendation_provenance(uuid) to authenticated;
