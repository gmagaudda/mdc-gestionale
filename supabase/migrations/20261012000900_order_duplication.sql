-- Copies are new drafts and revalidate the current customer/catalog in one transaction.
create function public.duplicate_order(p_id uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare source public.orders; private_data public.order_private; lines jsonb; today date := (now() at time zone 'Europe/Rome')::date;
begin
  if app.current_role() is null or app.current_role() not in ('admin','staff') then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into source from public.orders where id=p_id and deleted_at is null for update;
  if not found then raise exception 'Order unavailable' using errcode='P0002'; end if;
  select * into private_data from public.order_private where id=p_id;
  select coalesce(jsonb_agg(jsonb_build_object('variant_id',variant_id,'quantity',quantity,'unit_price_cents',unit_price_cents,'discount_pct',discount_pct) order by id),'[]'::jsonb) into lines from public.order_lines where order_id=p_id;
  return public.save_order(null,jsonb_build_object('brand_id',source.brand_id,'customer_id',source.customer_id,'season_id',source.season_id,'order_date',today,'delivery_date',null,'payment_terms',source.payment_terms,'discount_pct',source.discount_pct,'commission_pct_override',private_data.commission_pct_override,'internal_notes',coalesce(private_data.internal_notes,'')),lines);
end $$;
revoke all on function public.duplicate_order(uuid) from public, anon;
grant execute on function public.duplicate_order(uuid) to authenticated;

-- Explicit database maintenance may remove historical rows. Business API deletion
-- remains limited to drafts by RLS and calculate_order_line.
create or replace function app.refresh_order_totals() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' and current_user='postgres' then return old; end if;
  perform public.recalculate_order_totals(coalesce(new.order_id,old.order_id));
  return coalesce(new,old);
end $$;
