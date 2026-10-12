alter table public.customers add column representative text not null default '' check(length(representative)<=200),add column area text not null default '' check(length(area)<=200),add column category text not null default '' check(length(category)<=200);
create function app.import_valid_vat(p text) returns boolean language plpgsql immutable set search_path='' as $$
declare n integer;s integer:=0;i integer;begin
 if p is null or p!~'^[0-9]{11}$' then return false;end if;
 for i in 1..10 loop n:=substring(p,i,1)::integer;if i%2=0 then n:=n*2;if n>9 then n:=n-9;end if;end if;s:=s+n;end loop;
 return (10-s%10)%10=substring(p,11,1)::integer;
end;$$;
create function app.import_valid_cf(p text) returns boolean language plpgsql immutable set search_path='' as $$
declare alphabet text:='ABCDEFGHIJKLMNOPQRSTUVWXYZ';odd integer[]:=array[1,0,5,7,9,13,15,17,19,21,2,4,18,20,11,3,6,8,12,14,16,10,22,25,24,23];s integer:=0;i integer;n integer;c text;day integer;month integer;year integer;begin
 if p~'^[0-9]{11}$' then return app.import_valid_vat(p);end if;
 if p is null or p!~'^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$' then return false;end if;
 for i in 1..15 loop c:=substring(p,i,1);n:=case when c~'[0-9]' then c::integer else strpos(alphabet,c)-1 end;s:=s+case when i%2=1 then odd[n+1] else n end;end loop;
 day:=translate(substring(p,10,2),'LMNPQRSTUV','0123456789')::integer;if day>40 then day:=day-40;end if;
 month:=strpos('ABCDEHLMPRST',substring(p,9,1));year:=2000+translate(substring(p,7,2),'LMNPQRSTUV','0123456789')::integer;perform make_date(year,month,day);
 return substring(alphabet,s%26+1,1)=substring(p,16,1);
 exception when others then return false;
end;$$;
create function app.valid_operational_row(p_entity text,p jsonb,p_profile jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare fields text[];required text[];k text;v jsonb;t text;n numeric;limit_length integer;begin
 fields:=case p_entity when 'customers' then array['external_code','legal_name','trade_name','vat_number','tax_code','address','postal_code','city','province','country','email','phone','representative','area','category','payment_terms','sdi_code','pec','notes'] when 'orders' then array['external_ref','order_date','customer','brand','season','delivery_date','status','discount_pct','total_cents','notes','sku','product_name','color','size','quantity','unit_price_cents','line_discount_pct','line_net_cents','vat_rate'] when 'budgets' then array['brand','season','customer','amount_cents','period_start','period_end','notes'] end;
 required:=case p_entity when 'customers' then array['legal_name'] when 'orders' then array['order_date','customer','brand','season']||case when p_profile->'options'->>'granularity'='order_totals' then array['total_cents','vat_rate','product_name'] else array['sku','quantity','unit_price_cents'] end when 'budgets' then array['brand','amount_cents','period_start','period_end'] end;
 if fields is null or jsonb_typeof(p) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p) x where not x=any(fields)) then return false;end if;
 foreach k in array required loop if p->k is null or p->>k is null or p->>k='' then return false;end if;end loop;
 for k,v in select * from jsonb_each(p) loop
 t:=p->>k;
 if jsonb_typeof(v) not in('string','number') then return false;end if;
 if t='' then continue;end if;
 if k in('amount_cents','total_cents','unit_price_cents','line_net_cents','quantity','discount_pct','line_discount_pct','vat_rate') then
  if jsonb_typeof(v)<>'number' then return false;end if;n:=t::numeric;
  if k in('discount_pct','line_discount_pct','vat_rate') then if n not between 0 and 100 or round(n,2)<>n then return false;end if;
  elsif k='quantity' then if n not between 1 and 100000 or trunc(n)<>n then return false;end if;
  else if n not between 0 and 1000000000000 or trunc(n)<>n then return false;end if;end if;
 elsif k in('order_date','delivery_date','period_start','period_end') then
  if jsonb_typeof(v)<>'string' or t!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or t::date<'1900-01-01'::date or to_char(t::date,'YYYY-MM-DD')<>t then return false;end if;
 else
  limit_length:=case k when 'notes' then 5000 when 'season' then 30 when 'sku' then 80 when 'color' then 80 when 'size' then 40 when 'postal_code' then 20 when 'province' then 10 when 'phone' then 40 else 200 end;
  if jsonb_typeof(v)<>'string' or length(t)>limit_length then return false;end if;
  if k='vat_number' and not app.import_valid_vat(t) then return false;end if;
  if k='tax_code' and not app.import_valid_cf(t) then return false;end if;
  if k='sdi_code' and t!~'^[A-Z0-9]{7}$' then return false;end if;
  if k='country' and t!~'^[A-Z]{2}$' then return false;end if;
  if k in('email','pec') and t!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return false;end if;
 end if;
 end loop;
 if p_entity='orders' and (coalesce(p->>'status','') not in('','draft','confirmed') or nullif(p->>'delivery_date','')::date<nullif(p->>'order_date','')::date) then return false;end if;
 if p_entity='orders' and p_profile->'options'->>'granularity'='order_totals' and (coalesce(nullif(p->>'discount_pct','')::numeric,0)<>0 or coalesce(nullif(p->>'line_discount_pct','')::numeric,0)<>0) then return false;end if;
 if p_entity='budgets' and (p->>'period_end')::date<(p->>'period_start')::date then return false;end if;
 return true;
exception when others then return false;
end;$$;
create function app.import_order_key(p public.import_rows) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_array(coalesce(p.match->'brand'->>'id',app.import_key(p.mapped->>'brand')),case when nullif(p.mapped->>'external_ref','') is not null then jsonb_build_array(p.mapped->>'external_ref') else jsonb_build_array(coalesce(p.match->'customer'->>'id',p.mapped->>'customer'),coalesce(p.match->'season'->>'id',p.mapped->>'season'),p.mapped->>'order_date') end)
$$;
create function app.import_profile(p_batch public.import_batches,p_row public.import_rows) returns jsonb language sql immutable set search_path='' as $$
 select p from jsonb_array_elements(p_batch.options->'profiles') p where p->>'sheet_name'=p_row.sheet and p->>'entity'=p_row.entity
$$;
create function app.import_track(p_batch uuid,p_relation text,p_id uuid,p_before jsonb) returns void language plpgsql security definer set search_path='' as $$
declare v_after jsonb;begin
 if p_relation not in('customers','customer_contacts','brands','brand_private','seasons','products','product_variants','orders','order_private','order_lines','budgets','budget_private') then raise exception 'INVALID_RELATION';end if;
 execute format('select to_jsonb(t) from public.%I t where id=$1',p_relation) into v_after using p_id;
 if v_after is null then raise exception 'SNAPSHOT_MISSING';end if;
 insert into app.import_changes(batch_id,relation_name,record_id,before_row,after_row) values(p_batch,p_relation,p_id,p_before,v_after) on conflict(batch_id,relation_name,record_id) do update set after_row=excluded.after_row;
end;$$;
create function app.import_resolved(p_row public.import_rows,p_kind text) returns uuid language plpgsql stable security definer set search_path='' as $$
declare choice jsonb:=p_row.match->p_kind;result uuid;begin
 if choice->>'action'='link' then
  if choice->>'type'='row' then select target_id into result from public.import_rows where id=(choice->>'id')::uuid and batch_id=p_row.batch_id and entity='customers';else result:=(choice->>'id')::uuid;end if;
 elsif choice->>'action'='create' then
  select (r.match->p_kind->>'created_id')::uuid into result from public.import_rows r where r.batch_id=p_row.batch_id and app.import_subject(r,p_kind)=app.import_subject(p_row,p_kind) and r.match->p_kind->>'created_id' is not null limit 1;
 end if;
 return result;
end;$$;
revoke all on function app.import_valid_vat(text),app.import_valid_cf(text),app.valid_operational_row(text,jsonb,jsonb),app.import_order_key(public.import_rows),app.import_profile(public.import_batches,public.import_rows),app.import_track(uuid,text,uuid,jsonb),app.import_resolved(public.import_rows,text) from public;
