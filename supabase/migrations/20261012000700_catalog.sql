create table public.seasons (
  id uuid primary key default gen_random_uuid(), brand_id uuid not null references public.brands(id),
  code text not null check(length(trim(code)) between 1 and 30),name text not null check(length(trim(name)) between 1 and 200),
  campaign_start date,campaign_end date,delivery_start date,delivery_end date,
  deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(id,brand_id),check(campaign_end>=campaign_start),check(delivery_end>=delivery_start)
);
create unique index seasons_brand_code on public.seasons(brand_id,code) where deleted_at is null;
create table public.products (
  id uuid primary key default gen_random_uuid(),brand_id uuid not null references public.brands(id),season_id uuid not null,
  sku_base text not null check(length(trim(sku_base)) between 1 and 80),name text not null check(length(trim(name)) between 1 and 200),description text not null default '',
  wholesale_price_cents bigint not null check(wholesale_price_cents between 0 and 1000000000000),retail_price_cents bigint not null default 0 check(retail_price_cents between 0 and 1000000000000),vat_rate numeric(5,2) not null default 22 check(vat_rate between 0 and 100),
  deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(id,brand_id),foreign key(season_id,brand_id) references public.seasons(id,brand_id)
);
create unique index products_sku_base on public.products(sku_base) where deleted_at is null;
create index products_brand_season on public.products(brand_id,season_id);
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),product_id uuid not null,brand_id uuid not null references public.brands(id),
  size text not null check(length(trim(size)) between 1 and 40),color text not null check(length(trim(color)) between 1 and 80),sku text not null unique,
  deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(product_id,size,color),unique(id,brand_id),foreign key(product_id,brand_id) references public.products(id,brand_id)
);
alter table public.seasons enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
create policy seasons_read on public.seasons for select to authenticated using(app.is_internal() or (deleted_at is null and app.has_brand_access(brand_id)));
create policy seasons_insert on public.seasons for insert to authenticated with check(app.current_role() in ('admin','staff') and app.has_brand_access(brand_id));
create policy seasons_update on public.seasons for update to authenticated using(app.current_role() in ('admin','staff')) with check(app.current_role() in ('admin','staff') and app.has_brand_access(brand_id));
create policy products_read on public.products for select to authenticated using(app.is_internal() or (deleted_at is null and app.has_brand_access(brand_id)));
create policy products_insert on public.products for insert to authenticated with check(app.current_role() in ('admin','staff') and app.has_brand_access(brand_id));
create policy products_update on public.products for update to authenticated using(app.current_role() in ('admin','staff')) with check(app.current_role() in ('admin','staff') and app.has_brand_access(brand_id));
create policy variants_read on public.product_variants for select to authenticated using(app.is_internal() or (deleted_at is null and app.has_brand_access(brand_id) and exists(select 1 from public.products p where p.id=product_id and p.deleted_at is null)));
create policy variants_insert on public.product_variants for insert to authenticated with check(app.current_role() in ('admin','staff') and app.has_brand_access(brand_id));
create policy variants_update on public.product_variants for update to authenticated using(app.current_role() in ('admin','staff')) with check(app.current_role() in ('admin','staff') and app.has_brand_access(brand_id));
create trigger seasons_updated before update on public.seasons for each row execute function app.set_updated_at();
create trigger products_updated before update on public.products for each row execute function app.set_updated_at();
create trigger variants_updated before update on public.product_variants for each row execute function app.set_updated_at();
create trigger seasons_audit after insert or update on public.seasons for each row execute function app.audit_row_change();
create trigger products_audit after insert or update on public.products for each row execute function app.audit_row_change();
create trigger variants_audit after insert or update on public.product_variants for each row execute function app.audit_row_change();

create function public.save_product(p_id uuid,p_data jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_id uuid;v_brand uuid:=(p_data->>'brand_id')::uuid;v_size text;v_color text;v_sizes text[];v_colors text[];
begin
  if app.current_role() not in ('admin','staff') or app.current_role() is null then raise exception 'forbidden' using errcode='42501'; end if;
  select array_agg(trim(value)) into v_sizes from jsonb_array_elements_text(p_data->'sizes');
  select array_agg(trim(value)) into v_colors from jsonb_array_elements_text(p_data->'colors');
  if coalesce(cardinality(v_sizes),0) not between 1 and 30 or coalesce(cardinality(v_colors),0) not between 1 and 30
    or cardinality(v_sizes)<>(select count(distinct x) from unnest(v_sizes) x)
    or cardinality(v_colors)<>(select count(distinct x) from unnest(v_colors) x) then raise exception 'invalid variants' using errcode='23514'; end if;
  if not exists(select 1 from public.seasons where id=(p_data->>'season_id')::uuid and brand_id=v_brand and deleted_at is null) then raise exception 'invalid season' using errcode='23514'; end if;
  if p_id is null then
    insert into public.products(brand_id,season_id,sku_base,name,description,wholesale_price_cents,retail_price_cents,vat_rate)
    values(v_brand,(p_data->>'season_id')::uuid,p_data->>'sku_base',p_data->>'name',coalesce(p_data->>'description',''),(p_data->>'wholesale_price_cents')::bigint,(p_data->>'retail_price_cents')::bigint,(p_data->>'vat_rate')::numeric) returning id into v_id;
  else
    update public.products set season_id=(p_data->>'season_id')::uuid,sku_base=p_data->>'sku_base',name=p_data->>'name',description=coalesce(p_data->>'description',''),wholesale_price_cents=(p_data->>'wholesale_price_cents')::bigint,retail_price_cents=(p_data->>'retail_price_cents')::bigint,vat_rate=(p_data->>'vat_rate')::numeric
    where id=p_id and brand_id=v_brand and deleted_at is null returning id into v_id;
    if v_id is null then raise exception 'product unavailable' using errcode='P0002'; end if;
  end if;
  update public.product_variants set deleted_at=now() where product_id=v_id and deleted_at is null and (not(size=any(v_sizes)) or not(color=any(v_colors)));
  foreach v_size in array v_sizes loop
    foreach v_color in array v_colors loop
      insert into public.product_variants(product_id,brand_id,size,color,sku)
      values(v_id,v_brand,v_size,v_color,(p_data->>'sku_base')||':'||encode(convert_to(v_size,'UTF8'),'hex')||':'||encode(convert_to(v_color,'UTF8'),'hex'))
      on conflict(product_id,size,color) do update set sku=excluded.sku,deleted_at=null;
    end loop;
  end loop;
  return v_id;
end; $$;
revoke all on function public.save_product(uuid,jsonb) from public,anon;
grant execute on function public.save_product(uuid,jsonb) to authenticated;
