-- Metadata only. OAuth secrets stay in the server environment.
alter table public.invoices
 add column fic_company_id bigint check(fic_company_id between 1 and 9007199254740991),
 add column fic_request_fingerprint text check(fic_request_fingerprint ~ '^[a-f0-9]{64}$'),
 add column fic_request_state text check(fic_request_state in('prepared','uncertain','linked')),
 add column fic_document_id bigint check(fic_document_id between 1 and 9007199254740991),
 add column fic_document_number text check(length(fic_document_number) between 1 and 120),
 add constraint fic_journal_shape check(
  (fic_company_id is null and fic_request_fingerprint is null and fic_request_state is null and fic_document_id is null and fic_document_number is null)
  or (provider='fic' and fic_company_id is not null and fic_request_fingerprint is not null and fic_request_state is not null and
   ((fic_request_state='linked' and fic_document_id is not null and fic_document_number is not null) or (fic_request_state in('prepared','uncertain') and fic_document_id is null and fic_document_number is null))));
create unique index invoices_fic_document_unique on public.invoices(fic_company_id,fic_document_id) where fic_document_id is not null;
create function app.fic_record(i public.invoices) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('invoice_id',i.id,'company_id',i.fic_company_id,'fingerprint',i.fic_request_fingerprint,'state',i.fic_request_state,'document_id',i.fic_document_id,'document_number',i.fic_document_number);
$$;
revoke all on function app.fic_record(public.invoices) from public;
create function public.fic_prepare_invoice(p_id uuid,p_company_id bigint,p_fingerprint text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.invoices;begin
 perform app.require_billing_role();select * into i from public.invoices where id=p_id for update;
 if not found or i.provider is distinct from 'fic' then raise exception 'not found' using errcode='P0002';end if;
 if p_company_id is null or p_company_id not between 1 and 9007199254740991 or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'invalid request' using errcode='22023';end if;
 if i.fic_request_state is not null then
  if i.fic_company_id<>p_company_id or i.fic_request_fingerprint<>p_fingerprint then raise exception 'request conflict' using errcode='23505';end if;
 else
  if i.status<>'draft' or i.processing_status<>'processing' or i.processing_kind<>'issue' then raise exception 'no active issue claim' using errcode='55P03';end if;
  update public.invoices set fic_company_id=p_company_id,fic_request_fingerprint=p_fingerprint,fic_request_state='prepared' where id=i.id returning * into i;
 end if;
 return app.fic_record(i);
end;$$;
create function public.fic_mark_attempt(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare i public.invoices;begin
 perform app.require_billing_role();select * into i from public.invoices where id=p_id for update;
 if not found or i.provider is distinct from 'fic' then raise exception 'not found' using errcode='P0002';end if;
 if i.processing_status<>'processing' or i.processing_kind<>'issue' or i.status<>'draft' then raise exception 'no active issue claim' using errcode='55P03';end if;
 if i.fic_request_state is distinct from 'prepared' then return false;end if;
 update public.invoices set fic_request_state='uncertain' where id=i.id;return true;
end;$$;
create function public.fic_definite_failure(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform app.require_billing_role();
 update public.invoices set fic_request_state='prepared' where id=p_id and provider='fic' and fic_request_state='uncertain' and processing_status='processing' and processing_kind='issue' and status='draft';
end;$$;
create function public.fic_link_invoice(p_id uuid,p_document_id bigint,p_number text) returns void language plpgsql security definer set search_path='' as $$
declare i public.invoices;begin
 perform app.require_billing_role();select * into i from public.invoices where id=p_id for update;
 if not found or i.provider is distinct from 'fic' then raise exception 'not found' using errcode='P0002';end if;
 if p_document_id is null or p_document_id not between 1 and 9007199254740991 or p_number is null or length(p_number) not between 1 and 120 then raise exception 'invalid document' using errcode='22023';end if;
 if i.fic_request_state='linked' then
  if i.fic_document_id<>p_document_id or i.fic_document_number<>p_number then raise exception 'document conflict' using errcode='23505';end if;
  return;
 end if;
 if i.fic_request_state is distinct from 'uncertain' or i.processing_kind<>'issue' or i.processing_status<>'processing' then raise exception 'no active attempt' using errcode='55P03';end if;
 update public.invoices set fic_document_id=p_document_id,fic_document_number=p_number,fic_request_state='linked' where id=i.id;
end;$$;
create or replace function public.finish_invoice_issue(p_id uuid,p_lease uuid,p_external_id text,p_status public.invoice_status) returns boolean language plpgsql security definer set search_path='' as $$
declare i public.invoices;begin
 perform app.require_billing_role();select * into i from public.invoices where id=p_id for update;
 if not found or i.processing_lease is distinct from p_lease or p_lease is null or i.processing_status<>'processing' or i.processing_kind<>'issue' then return false;end if;
 if i.provider='mock' and not exists(select 1 from public.mock_invoice_records r where r.id=i.id and r.external_id=p_external_id and r.status=p_status) then raise exception 'unknown mock reference' using errcode='23514';end if;
 if i.provider='fic' and (i.fic_request_state is distinct from 'linked' or p_external_id is distinct from ('fic_'||i.fic_company_id||'_'||i.fic_document_id)) then raise exception 'unknown fic reference' using errcode='23514';end if;
 perform app.apply_invoice_status(i.id,p_external_id,p_status);
 update public.invoices set processing_status='completed',processing_error=case when p_status='rejected' then 'provider_rejected' else null end where id=i.id;return true;
end;$$;
create or replace function public.reconcile_invoice_status(p_id uuid,p_external_id text,p_status public.invoice_status) returns void language plpgsql security definer set search_path='' as $$
declare i public.invoices;begin
 perform app.require_billing_role();select * into i from public.invoices where id=p_id for update;
 if not found or i.external_id is null or i.external_id is distinct from p_external_id then raise exception 'unknown reference' using errcode='P0002';end if;
 if i.provider='mock' and not exists(select 1 from public.mock_invoice_records r where r.id=i.id and r.status=p_status) then raise exception 'unknown mock state' using errcode='23514';end if;
 perform app.apply_invoice_status(i.id,p_external_id,p_status);
end;$$;
revoke all on function public.fic_prepare_invoice(uuid,bigint,text),public.fic_mark_attempt(uuid),public.fic_definite_failure(uuid),public.fic_link_invoice(uuid,bigint,text) from public,anon;
grant execute on function public.fic_prepare_invoice(uuid,bigint,text),public.fic_mark_attempt(uuid),public.fic_definite_failure(uuid),public.fic_link_invoice(uuid,bigint,text) to authenticated;

-- Persist authenticated notifications before acknowledging them. No raw JWT/body or secrets.
alter table public.invoice_webhook_events
 add column fic_digest text check(fic_digest ~ '^[a-f0-9]{64}$'),
 add column reconcile_pending boolean not null default false,
 add column reconcile_lease uuid,
 add column reconcile_started_at timestamptz,
 add column reconcile_error boolean not null default false;
create trigger invoice_webhook_events_reconcile_audit after update on public.invoice_webhook_events for each row execute function app.audit_row_change();
create function public.enqueue_fic_webhook(p_event_id text,p_company_id bigint,p_document_ids bigint[],p_digest text) returns integer language plpgsql security definer set search_path='' as $$
declare i public.invoices;e public.invoice_webhook_events;v_doc bigint;v_count integer:=0;v_key text;begin
 if p_event_id is null or length(p_event_id) not between 1 and 140 or p_company_id is null or p_company_id not between 1 and 9007199254740991 or p_document_ids is null or cardinality(p_document_ids) not between 1 and 1000 or p_digest is null or p_digest !~ '^[a-f0-9]{64}$' then raise exception 'invalid event' using errcode='22023';end if;
 foreach v_doc in array p_document_ids loop
  select * into i from public.invoices where provider='fic' and fic_company_id=p_company_id and fic_document_id=v_doc and external_id=('fic_'||p_company_id||'_'||v_doc);
  if not found then continue;end if;
  v_key:=p_event_id||':'||v_doc;
  insert into public.invoice_webhook_events(event_id,provider,invoice_id,brand_id,external_status,fic_digest,reconcile_pending)
   values(v_key,'fic',i.id,i.brand_id,coalesce(i.external_status::public.invoice_status,'issued'),p_digest,true) on conflict(provider,event_id) do nothing;
  select * into e from public.invoice_webhook_events where provider='fic' and event_id=v_key;
  if e.invoice_id<>i.id or e.fic_digest is distinct from p_digest then raise exception 'event conflict' using errcode='23505';end if;
  v_count:=v_count+1;
 end loop;return v_count;
end;$$;
create function public.claim_fic_webhooks() returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.invoice_webhook_events;i public.invoices;v_lease uuid;v_result jsonb:='[]'::jsonb;begin
 for e in select * from public.invoice_webhook_events where provider='fic' and reconcile_pending and (reconcile_lease is null or reconcile_started_at<now()-interval '10 minutes') order by created_at,id limit 10 for update skip locked loop
  select * into strict i from public.invoices where id=e.invoice_id;
  v_lease:=gen_random_uuid();update public.invoice_webhook_events set reconcile_lease=v_lease,reconcile_started_at=now(),reconcile_error=false where id=e.id;
  v_result:=v_result||jsonb_build_array(jsonb_build_object('id',e.id,'lease',v_lease,'external_id',i.external_id));
 end loop;return v_result;
end;$$;
create function public.finish_fic_webhook(p_id uuid,p_lease uuid,p_status public.invoice_status) returns boolean language plpgsql security definer set search_path='' as $$
declare e public.invoice_webhook_events;i public.invoices;begin
 select * into e from public.invoice_webhook_events where id=p_id for update;
 if not found or e.provider<>'fic' or not e.reconcile_pending or p_lease is null or e.reconcile_lease is distinct from p_lease then return false;end if;
 select * into strict i from public.invoices where id=e.invoice_id;
 perform app.apply_invoice_status(i.id,i.external_id,p_status);
 update public.invoice_webhook_events set external_status=p_status,reconcile_pending=false,reconcile_lease=null,reconcile_error=false where id=e.id;return true;
end;$$;
create function public.fail_fic_webhook(p_id uuid,p_lease uuid) returns void language sql security definer set search_path='' as $$
 update public.invoice_webhook_events set reconcile_lease=null,reconcile_error=true where id=p_id and provider='fic' and reconcile_pending and reconcile_lease=p_lease;
$$;
revoke all on function public.enqueue_fic_webhook(text,bigint,bigint[],text),public.claim_fic_webhooks(),public.finish_fic_webhook(uuid,uuid,public.invoice_status),public.fail_fic_webhook(uuid,uuid) from public,anon,authenticated;
grant execute on function public.enqueue_fic_webhook(text,bigint,bigint[],text),public.claim_fic_webhooks(),public.finish_fic_webhook(uuid,uuid,public.invoice_status),public.fail_fic_webhook(uuid,uuid) to service_role;

-- The provider refused cancellation before any write (e.g. electronic/locked document).
create function public.release_invoice_cancellation(p_id uuid,p_lease uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform app.require_billing_role();
 update public.invoices set processing_kind='issue',processing_status='completed',processing_error=null
 where id=p_id and processing_kind='cancel' and processing_status='processing' and processing_lease=p_lease and p_lease is not null;
 return found;
end;$$;
revoke all on function public.release_invoice_cancellation(uuid,uuid) from public,anon;
grant execute on function public.release_invoice_cancellation(uuid,uuid) to authenticated;
