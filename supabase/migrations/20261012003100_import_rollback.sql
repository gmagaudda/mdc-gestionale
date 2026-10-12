-- Restore old line snapshots after the ordinary draft/cross-brand guards. A caller
-- cannot manufacture this context: the matching private snapshot and an in-flight
-- rollback batch must both exist in the same locked transaction.
create function app.restore_import_line_snapshot() returns trigger language plpgsql security definer set search_path='' as $$
declare batch uuid;old_line public.order_lines;begin
 if app.current_role() is distinct from 'admin' then return new;end if;
 begin batch:=nullif(current_setting('app.import_rollback_batch',true),'')::uuid;exception when others then return new;end;
 if batch is null or not exists(select 1 from public.import_batches where id=batch and status='importing') then return new;end if;
 select (jsonb_populate_record(null::public.order_lines,before_row)).* into old_line from app.import_changes where batch_id=batch and relation_name='order_lines' and record_id=new.id and before_row is not null;
 if old_line.id is not null and old_line.order_id=new.order_id and old_line.variant_id=new.variant_id and old_line.brand_id=new.brand_id then
 new.vat_rate:=old_line.vat_rate;new.product_name:=old_line.product_name;new.sku:=old_line.sku;new.size:=old_line.size;new.color:=old_line.color;new.line_net_cents:=old_line.line_net_cents;new.line_vat_cents:=old_line.line_vat_cents;
 end if;return new;
end;$$;
create trigger order_line_restore_import_snapshot before insert on public.order_lines for each row execute function app.restore_import_line_snapshot();
create function public.import_rollback(p_id uuid) returns void language plpgsql security definer set search_path='' set statement_timeout='60s' as $$
declare b public.import_batches;c record;fk record;current_row jsonb;columns text;v_order public.orders;v_external boolean;v_filter text;v_referencing text;v_referenced text;begin
 if app.current_role() is distinct from 'admin' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('mdc.import.commit',0));select * into b from public.import_batches where id=p_id for update;
 if b.id is null or b.kind='performance' then raise exception 'INVALID_BATCH' using errcode='23514';end if;
 if b.status='rolled_back' then return;end if;if b.status<>'completed' then raise exception 'INVALID_STATE' using errcode='23514';end if;
 lock table public.brands,public.customers,public.seasons,public.products,public.product_variants,public.orders,public.order_lines,public.budgets,public.customer_contacts,public.brand_private,public.order_private,public.budget_private,public.invoices in share row exclusive mode;
 for c in select * from app.import_changes where batch_id=p_id loop
  execute format('select to_jsonb(t) from public.%I t where id=$1 for update',c.relation_name) into current_row using c.record_id;
  if coalesce(current_row,'null'::jsonb) is distinct from c.after_row then raise exception 'DATA_CHANGED_SINCE_IMPORT' using errcode='40001';end if;
  if c.relation_name='orders' then
   select * into v_order from public.orders where id=c.record_id;
   if v_order.status not in('draft','confirmed') or exists(select 1 from public.invoices where order_id=c.record_id) or (c.before_row is not null and v_order.status<>'draft') then raise exception 'ORDER_ROLLBACK_UNAVAILABLE' using errcode='23514';end if;
  end if;
 end loop;
 -- New records used outside this batch must not be archived underneath those uses.
 for c in select * from app.import_changes where batch_id=p_id and before_row is null and relation_name in('customers','brands','seasons','products','product_variants','orders','budgets') loop
  for fk in select con.*,ns.nspname as schema_name,rel.relname as table_name from pg_constraint con join pg_class rel on rel.oid=con.conrelid join pg_namespace ns on ns.oid=rel.relnamespace where con.contype='f' and con.confrelid=format('public.%I',c.relation_name)::regclass and ns.nspname='public' and rel.relname<>'order_status_history' loop
   select a.attname into v_referenced from unnest(fk.confkey) with ordinality ref(attnum,position) join pg_attribute a on a.attrelid=fk.confrelid and a.attnum=ref.attnum where a.attname='id';
   if v_referenced is null then continue;end if;
   select local_attr.attname into v_referencing from unnest(fk.confkey) with ordinality ref(attnum,position) join pg_attribute ref_attr on ref_attr.attrelid=fk.confrelid and ref_attr.attnum=ref.attnum join unnest(fk.conkey) with ordinality local_key(attnum,position) on local_key.position=ref.position join pg_attribute local_attr on local_attr.attrelid=fk.conrelid and local_attr.attnum=local_key.attnum where ref_attr.attname='id';
   execute format('lock table public.%I in share row exclusive mode',fk.table_name);
   v_filter:=case when exists(select 1 from pg_attribute where attrelid=fk.conrelid and attname='deleted_at' and not attisdropped) then ' and t.deleted_at is null' else '' end;
   if exists(select 1 from pg_attribute where attrelid=fk.conrelid and attname='id' and not attisdropped) then v_filter:=v_filter||format(' and not exists(select 1 from app.import_changes own where own.batch_id=$2 and own.relation_name=%L and own.record_id=t.id)',fk.table_name);end if;
   execute format('select exists(select 1 from public.%I t where t.%I=$1%s)',fk.table_name,v_referencing,v_filter) into v_external using c.record_id,p_id;
   if v_external then raise exception 'IMPORTED_RECORD_IN_USE' using errcode='23514';end if;
  end loop;
 end loop;
 update public.import_batches set status='importing' where id=p_id;perform set_config('app.import_rollback_batch',p_id::text,true);
 -- Draft order updates restore all prior lines. Created orders keep their audit and
 -- snapshots, are cancelled where necessary, then archived through normal guards.
 for c in select * from app.import_changes where batch_id=p_id and relation_name='orders' loop
  if c.before_row is null then
   update public.orders set status='cancelled' where id=c.record_id and status='confirmed';update public.orders set deleted_at=now() where id=c.record_id;
  else
   delete from public.order_lines where order_id=c.record_id;
   update public.orders o set customer_id=(c.before_row->>'customer_id')::uuid,order_date=(c.before_row->>'order_date')::date,delivery_date=(c.before_row->>'delivery_date')::date,payment_terms=c.before_row->>'payment_terms',discount_pct=(c.before_row->>'discount_pct')::numeric,external_ref=c.before_row->>'external_ref',import_batch_id=(c.before_row->>'import_batch_id')::uuid,import_granularity=c.before_row->>'import_granularity' where id=c.record_id;
   insert into public.order_lines select (jsonb_populate_record(null::public.order_lines,ch.before_row)).* from app.import_changes ch where ch.batch_id=p_id and ch.relation_name='order_lines' and ch.before_row->>'order_id'=c.record_id::text and ch.before_row is not null;
  end if;
 end loop;
 -- Restore updates before archiving new dependencies, using a closed relation list.
 for c in select * from app.import_changes where batch_id=p_id and relation_name not in('orders','order_lines') order by case relation_name when 'budgets' then 1 when 'customer_contacts' then 2 when 'customers' then 3 when 'product_variants' then 4 when 'products' then 5 when 'seasons' then 6 when 'brands' then 7 else 0 end loop
  if c.before_row is null then
   if c.relation_name in('customer_contacts','customers','product_variants','products','seasons','brands','budgets') then execute format('update public.%I set deleted_at=now() where id=$1',c.relation_name) using c.record_id;end if;
   -- Private rows stay attached to the archived parent, protected by existing RLS.
  else
   select string_agg(format('%I=old.%I',attname,attname),',') into columns from pg_attribute where attrelid=format('public.%I',c.relation_name)::regclass and attnum>0 and not attisdropped and attname not in('id','created_at','updated_at');
   execute format('update public.%I target set %s from jsonb_populate_record(null::public.%I,$1) old where target.id=$2',c.relation_name,columns,c.relation_name) using c.before_row,c.record_id;
  end if;
 end loop;
 perform set_config('app.import_rollback_batch','',true);update public.import_batches set status='rolled_back',rolled_back_at=now() where id=p_id;
end;$$;
revoke all on function app.restore_import_line_snapshot(),public.import_rollback(uuid) from public;
grant execute on function public.import_rollback(uuid) to authenticated;
