-- Shared normalized keys, punctuation/diacritics insensitive. No account data in keys.
create function app.import_key(p text) returns text language sql immutable set search_path='' as $$
 select regexp_replace(translate(lower(coalesce(p,'')),'àáâãäåèéêëìíîïòóôõöùúûüçñ','aaaaaaeeeeiiiiooooouuuucn'),'[^[:alnum:]]','','g')
$$;
create index customers_import_name on public.customers using gin(app.import_key(legal_name) extensions.gin_trgm_ops) where deleted_at is null;
create function app.import_subject(p public.import_rows,p_kind text) returns jsonb language sql immutable set search_path='' as $$
 select case p_kind
 when 'customer' then case when p.entity='customers' then jsonb_build_array(coalesce(p.mapped->>'external_code',''),coalesce(p.mapped->>'vat_number',''),coalesce(p.mapped->>'legal_name',''),coalesce(p.mapped->>'city',''),coalesce(p.mapped->>'country','')) else jsonb_build_array(coalesce(p.mapped->>'customer',''),'','','','') end
 when 'brand' then jsonb_build_array(coalesce(p.mapped->>'brand',''))
 when 'season' then jsonb_build_array(coalesce(p.mapped->>'brand',''),coalesce(p.mapped->>'season',''))
 when 'variant' then jsonb_build_array(coalesce(p.mapped->>'brand',''),coalesce(p.mapped->>'season',''),coalesce(p.mapped->>'sku','')) end
$$;
create function app.import_candidates(p_batch uuid,p_kind text,p_subject jsonb,p_threshold numeric default 0.45) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb:='[]';v_brand uuid;v_season uuid;begin
 if p_kind='customer' then
  select coalesce(jsonb_agg(jsonb_build_object('type','existing','id',x.id,'label',x.legal_name||case when x.city<>'' then ' · '||x.city else '' end,'exact',x.exact) order by x.exact desc,x.score desc,x.legal_name),'[]') into result from (
   select c.*,case when p_subject->>2<>'' then (p_subject->>0<>'' and c.external_code=p_subject->>0) or (p_subject->>1<>'' and c.vat_number=p_subject->>1) or (app.import_key(c.legal_name)=app.import_key(p_subject->>2) and app.import_key(c.city)=app.import_key(p_subject->>3)) else c.external_code=p_subject->>0 or c.vat_number=p_subject->>0 or app.import_key(c.legal_name)=app.import_key(p_subject->>0) end as exact,
   extensions.similarity(app.import_key(c.legal_name),app.import_key(coalesce(nullif(p_subject->>2,''),p_subject->>0))) as score
   from public.customers c where c.deleted_at is null and ((p_subject->>0<>'' and (c.external_code=p_subject->>0 or c.vat_number=p_subject->>0)) or (p_subject->>1<>'' and c.vat_number=p_subject->>1) or (extensions.similarity(app.import_key(c.legal_name),app.import_key(coalesce(nullif(p_subject->>2,''),p_subject->>0)))>=p_threshold and (p_subject->>3='' or app.import_key(c.city)=app.import_key(p_subject->>3)))) order by exact desc,score desc limit 10
  ) x;
  if p_subject->>2='' then
   result:=result||coalesce((select jsonb_agg(jsonb_build_object('type','row','id',r.id,'label',r.mapped->>'legal_name','exact',true)) from public.import_rows r where r.batch_id=p_batch and r.entity='customers' and r.status in('valid','warning') and ((r.mapped->>'external_code')=p_subject->>0 or (r.mapped->>'vat_number')=p_subject->>0 or app.import_key(r.mapped->>'legal_name')=app.import_key(p_subject->>0))),'[]');
  end if;
 elsif p_kind='brand' then
  select coalesce(jsonb_agg(jsonb_build_object('type','existing','id',b.id,'label',b.name,'exact',true)),'[]') into result from public.brands b where b.deleted_at is null and (app.import_key(b.name)=app.import_key(p_subject->>0) or b.external_code=p_subject->>0);
 elsif p_kind in('season','variant') then
  select b.id into v_brand from public.brands b where b.deleted_at is null and app.import_key(b.name)=app.import_key(p_subject->>0) order by b.id limit 1;
  -- Respect an explicit brand link rather than selecting an arbitrary same-name brand.
  select coalesce((r.match->'brand'->>'id')::uuid,v_brand) into v_brand from public.import_rows r where r.batch_id=p_batch and app.import_subject(r,'brand')=jsonb_build_array(p_subject->>0) and r.match->'brand'->>'action'='link' limit 1;
  if v_brand is null then select b.id into v_brand from public.brands b where b.deleted_at is null and app.import_key(b.name)=app.import_key(p_subject->>0) order by b.id limit 1;end if;
  if p_kind='season' then
   select coalesce(jsonb_agg(jsonb_build_object('type','existing','id',s.id,'label',s.code||' · '||s.name,'exact',true)),'[]') into result from public.seasons s where s.deleted_at is null and s.brand_id=v_brand and app.import_key(s.code)=app.import_key(p_subject->>1);
  else
   select s.id into v_season from public.seasons s where s.deleted_at is null and s.brand_id=v_brand and app.import_key(s.code)=app.import_key(p_subject->>1) order by s.id limit 1;
   v_season:=coalesce((select nullif(r.match->'season'->>'id','')::uuid from public.import_rows r where r.batch_id=p_batch and app.import_subject(r,'season')=jsonb_build_array(p_subject->>0,p_subject->>1) and r.match->'season'->>'action'='link' limit 1),v_season);
   select coalesce(jsonb_agg(jsonb_build_object('type','existing','id',v.id,'label',v.sku||' · '||p.name,'exact',true)),'[]') into result from public.product_variants v join public.products p on p.id=v.product_id where v.deleted_at is null and p.deleted_at is null and v.brand_id=v_brand and p.season_id=v_season and app.import_key(v.sku)=app.import_key(p_subject->>2);
  end if;
 end if;return result;
end;$$;
create function public.import_matching(p_id uuid,p_page integer default 1,p_threshold numeric default 0.45) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.import_batches;result jsonb;n integer;begin
 select * into b from public.import_batches where id=p_id;
 if b.id is null or b.kind='performance' or not app.can_import(b.kind) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 2000 or p_threshold is null or p_threshold not between 0.2 and 1 then raise exception 'INVALID_FILTERS' using errcode='23514';end if;
 with subjects as (select k.kind,app.import_subject(r,k.kind) as subject,min(r.id::text)::uuid as row_id from public.import_rows r cross join lateral (select 'customer' as kind where (r.entity='customers' or coalesce(r.mapped->>'customer','')<>'') union all select 'brand' where r.entity in('orders','budgets') union all select 'season' where r.entity in('orders','budgets') and coalesce(r.mapped->>'season','')<>'' union all select 'variant' where r.entity='orders' and coalesce(r.mapped->>'sku','')<>'') k where r.batch_id=p_id and r.status in('valid','warning','imported') group by k.kind,app.import_subject(r,k.kind)), numbered as (select *,count(*) over() as total from subjects order by case kind when 'customer' then 1 when 'brand' then 2 when 'season' then 3 else 4 end,subject offset (p_page-1)*50 limit 50)
 select coalesce(jsonb_agg(jsonb_build_object('kind',s.kind,'subject',s.subject,'row_id',s.row_id,'choice',r.match->s.kind,'candidates',app.import_candidates(p_id,s.kind,s.subject,p_threshold),'can_create',app.current_role()='admin' and case s.kind when 'customer' then r.entity='customers' when 'season' then exists(select 1 from jsonb_array_elements(b.options->'profiles') pr where pr->>'sheet_name'=r.sheet and pr->'options'->>'allowCreateSeasons'='true') else true end)),'[]'),(select count(*) from subjects) into result,n from numbered s join public.import_rows r on r.id=s.row_id;
 return jsonb_build_object('items',result,'total',n,'page',p_page);
end;$$;
create function public.resolve_import_match(p_id uuid,p_kind text,p_subject jsonb,p_choice jsonb,p_revision uuid) returns integer language plpgsql security definer set search_path='' as $$
declare b public.import_batches;c jsonb;n integer;v_type text;v_id uuid;begin
 select * into b from public.import_batches where id=p_id for update;
 if b.id is null or not app.can_import(b.kind) or b.created_by<>auth.uid() or b.kind='performance' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if b.status not in('validated','ready') then raise exception 'INVALID_STATE' using errcode='23514';end if;
 if p_revision is null or b.options->>'revision' is distinct from p_revision::text then raise exception 'CONFIG_CONFLICT' using errcode='40001';end if;
 if p_kind is null or p_kind not in('customer','brand','season','variant') or jsonb_typeof(p_subject) is distinct from 'array' or jsonb_typeof(p_choice) is distinct from 'object' or p_choice->>'action' is null or p_choice->>'action' not in('link','create','ignore') or exists(select 1 from jsonb_object_keys(p_choice) x where x not in('action','type','id')) then raise exception 'INVALID_CHOICE' using errcode='23514';end if;
 if p_choice->>'action'='create' then
  if app.current_role()<>'admin' or (p_kind='customer' and exists(select 1 from public.import_rows r where r.batch_id=p_id and app.import_subject(r,p_kind)=p_subject and r.entity<>'customers')) or (p_kind='season' and exists(select 1 from public.import_rows r where r.batch_id=p_id and app.import_subject(r,p_kind)=p_subject and not exists(select 1 from jsonb_array_elements(b.options->'profiles') pr where pr->>'sheet_name'=r.sheet and pr->'options'->>'allowCreateSeasons'='true'))) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 elsif p_choice->>'action'='link' then
  v_id:=(p_choice->>'id')::uuid;v_type:=p_choice->>'type';
  if v_id is null or v_type is null or v_type not in('existing','row') then raise exception 'INVALID_CHOICE' using errcode='23514';end if;
  if v_type='row' then
   if p_kind<>'customer' or not exists(select 1 from public.import_rows r where r.id=v_id and r.batch_id=p_id and r.entity='customers' and r.status in('valid','warning')) then raise exception 'INVALID_TARGET' using errcode='23514';end if;
  else
   if not (case p_kind when 'customer' then exists(select 1 from public.customers where id=v_id and deleted_at is null) when 'brand' then exists(select 1 from public.brands where id=v_id and deleted_at is null) when 'season' then exists(select 1 from public.seasons where id=v_id and deleted_at is null) when 'variant' then exists(select 1 from public.product_variants v join public.products p on p.id=v.product_id where v.id=v_id and v.deleted_at is null and p.deleted_at is null) else false end) then raise exception 'INVALID_TARGET' using errcode='23514';end if;
  end if;
 end if;
 update public.import_rows r set match=jsonb_set(r.match,array[p_kind],p_choice),status=case when p_choice->>'action'='ignore' then 'skipped' else r.status end where r.batch_id=p_id and app.import_subject(r,p_kind)=p_subject and r.status in('valid','warning');get diagnostics n=row_count;
 if n=0 then raise exception 'INVALID_SUBJECT' using errcode='23514';end if;
 -- Changing a brand/season invalidates all choices tied to its previous scope.
 if p_kind='brand' then update public.import_rows r set match=r.match-'season'-'variant' where r.batch_id=p_id and app.import_subject(r,'brand')=p_subject;end if;
 if p_kind='season' then update public.import_rows r set match=r.match-'variant' where r.batch_id=p_id and app.import_subject(r,'season')=p_subject;end if;
 update public.import_batches set status='validated' where id=p_id;
 return n;
end;$$;
create function public.exclude_import_errors(p_id uuid,p_rows uuid[],p_revision uuid) returns integer language plpgsql security definer set search_path='' as $$
declare b public.import_batches;n integer;begin
 select * into b from public.import_batches where id=p_id for update;
 if b.id is null or not app.can_import(b.kind) or b.created_by<>auth.uid() or b.kind='performance' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if b.status not in('validated','ready') then raise exception 'INVALID_STATE' using errcode='23514';end if;
 if p_revision is null or b.options->>'revision' is distinct from p_revision::text then raise exception 'CONFIG_CONFLICT' using errcode='40001';end if;
 if coalesce(cardinality(p_rows),0) not between 1 and 500 then raise exception 'INVALID_ROWS' using errcode='23514';end if;
 update public.import_rows set status='skipped',match=jsonb_build_object('excluded_error',true) where batch_id=p_id and id=any(p_rows) and status='error';get diagnostics n=row_count;
 update public.import_batches set status='validated' where id=p_id;return n;
end;$$;
revoke all on function app.import_key(text),app.import_subject(public.import_rows,text),app.import_candidates(uuid,text,jsonb,numeric) from public;
revoke all on function public.import_matching(uuid,integer,numeric),public.resolve_import_match(uuid,text,jsonb,jsonb,uuid),public.exclude_import_errors(uuid,uuid[],uuid) from public;
grant execute on function public.import_matching(uuid,integer,numeric),public.resolve_import_match(uuid,text,jsonb,jsonb,uuid),public.exclude_import_errors(uuid,uuid[],uuid) to authenticated;
grant execute on function app.import_key(text) to authenticated;
