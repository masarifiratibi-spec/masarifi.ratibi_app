-- Indexed owner lookup avoids scanning unrelated outbox payload during erasure.
-- Existing deployments may prebuild these exact indexes CONCURRENTLY before
-- applying this atomic migration. Fresh databases create them here normally.
grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

create index if not exists outbox_events_erasure_user_idx
  on private.outbox_events ((payload->>'userId')) where payload?'userId';
create index if not exists outbox_events_erasure_profile_idx
  on private.outbox_events ((payload->>'profileId')) where payload?'profileId';
create index if not exists outbox_events_erasure_resource_idx
  on private.outbox_events ((replace(aggregate_type,'-','_')),(aggregate_id::text))
  where aggregate_id is not null;

-- IF NOT EXISTS must never accept an invalid concurrent build or a different
-- expression, predicate, access method, owner, or table under the reviewed name.
do $$
declare expected record;
begin
  for expected in select * from (values
    ('outbox_events_erasure_user_idx',
      'CREATE INDEX outbox_events_erasure_user_idx ON private.outbox_events USING btree (((payload ->> ''userId''::text))) WHERE (payload ? ''userId''::text)'),
    ('outbox_events_erasure_profile_idx',
      'CREATE INDEX outbox_events_erasure_profile_idx ON private.outbox_events USING btree (((payload ->> ''profileId''::text))) WHERE (payload ? ''profileId''::text)'),
    ('outbox_events_erasure_resource_idx',
      'CREATE INDEX outbox_events_erasure_resource_idx ON private.outbox_events USING btree (replace(aggregate_type, ''-''::text, ''_''::text), ((aggregate_id)::text)) WHERE (aggregate_id IS NOT NULL)')
  ) v(index_name,definition) loop
    if not exists (
      select 1 from pg_catalog.pg_index i
      join pg_catalog.pg_class c on c.oid=i.indexrelid
      join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='private' and c.relname=expected.index_name
        and i.indrelid='private.outbox_events'::regclass
        and i.indisvalid and i.indisready and i.indislive
        and c.relowner='masarifi_migration'::regrole
        and pg_catalog.pg_get_indexdef(i.indexrelid)=expected.definition
    ) then
      raise exception using errcode='55000',message='ERASURE_OUTBOX_INDEX_DEFINITION_REQUIRED';
    end if;
  end loop;
end $$;

create or replace function private.erase_account_owner_payload(p_request uuid,p_owner text)
returns integer language plpgsql security definer set search_path='' as $$
declare entry record; removed integer:=0; affected integer; residual boolean;
begin
  perform private.assert_account_erasure_request(p_request,p_owner,true);
  if not exists(select 1 from private.account_erasure_context where transaction_id=pg_catalog.txid_current()
    and request_id=p_request and user_id=p_owner and objects_locked) then
    raise exception using errcode='42501',message='ERASURE_OBJECTS_NOT_LOCKED';
  end if;
  -- The domain handlers must have removed their objects and roots first.
  if exists(select 1 from public.voice_sessions where user_id=p_owner)
    or exists(select 1 from public.assistant_conversations where user_id=p_owner)
    or exists(select 1 from public.import_sessions where user_id=p_owner)
    or exists(select 1 from public.support_tickets where user_id=p_owner) then
    raise exception using errcode='55000',message='ERASURE_DOMAINS_REMAIN';
  end if;
  delete from private.report_output_attempts where user_id=p_owner; get diagnostics affected=row_count; removed:=removed+affected;
  delete from private.privacy_export_requests where user_id=p_owner; get diagnostics affected=row_count; removed:=removed+affected;
  delete from private.support_access_grants where request_id in(select id from private.support_access_requests where user_id=p_owner);
  delete from private.support_access_requests where user_id=p_owner;
  delete from private.planning_job_claims where resource_id::text in(
    select resource_id from private.account_erasure_resources where request_id=p_request
      and resource_type in ('salary_profile','salary_receipt','budget','obligation','obligation_schedule_item','savings_goal','transaction'));
  delete from private.planning_reminder_intents where user_id=p_owner;
  delete from private.voice_provider_attempts where session_id::text in(
    select resource_id from private.account_erasure_resources where request_id=p_request and resource_type='voice_session');
  -- Persisted sync/outbox snapshots contain financial payload, not only technical cursors.
  delete from private.outbox_events o where o.event_type not like 'privacy.deletion_%' and o.id in (
    select owned.id from private.outbox_events owned
      where owned.payload?'userId' and owned.payload->>'userId'=p_owner
    union
    select owned.id from private.outbox_events owned
      where owned.payload?'profileId' and owned.payload->>'profileId'=p_owner
    union
    select owned.id from private.outbox_events owned
      where owned.payload?'sync' and owned.payload#>>'{sync,userId}'=p_owner
    union
    select owned.id from private.account_erasure_resources r
      join private.outbox_events owned on replace(owned.aggregate_type,'-','_')=r.resource_type
        and owned.aggregate_id::text=r.resource_id
      where r.request_id=p_request and owned.aggregate_id is not null);
  delete from audit.audit_events a where a.resource_type<>'deletion_request' and (
    a.actor_id=p_owner or a.resource_id=p_owner or a.metadata->>'userId'=p_owner
    or exists(select 1 from private.account_erasure_resources r where r.request_id=p_request
      and r.resource_id=a.resource_id and r.resource_type=replace(a.resource_type,'-','_')));
  delete from public.security_events where user_id=p_owner;
  delete from private.idempotency_keys where actor_id=p_owner;
  delete from public.transaction_conflicts where user_id=p_owner;
  delete from public.client_sync_state where user_id=p_owner;
  delete from public.client_mutations where user_id=p_owner;
  delete from private.sync_cursor_positions where user_id=p_owner;
  delete from public.obligation_payment_allocations where user_id=p_owner;
  delete from public.payment_matches where user_id=p_owner;
  delete from public.savings_goal_movements where user_id=p_owner;
  delete from public.obligation_payments where user_id=p_owner;
  delete from public.obligation_schedule_items where user_id=p_owner;
  delete from public.salary_receipts where user_id=p_owner;
  -- Only reviewed owner-column tables are interpolated; globals (user_id NULL) remain.
  for entry in select * from (values
    ('public','salary_profiles'),('public','budget_categories'),('public','budgets'),
    ('public','obligations'),('public','savings_goals'),('public','report_schedules'),
    ('public','financial_insights'),('public','merchant_rules'),('public','category_rules'),
    ('public','unsupported_formats'),
    ('public','tracking_account_bindings'),('private','tracking_capture_reservations'),
    ('private','tracking_automatic_cohorts'),('private','ai_user_quota_overrides'),
    ('private','user_job_quota_events'),('public','voice_category_preferences'),
    ('public','assistant_consents'),('public','tracking_preferences'),('public','user_keyword_rules'),
    ('public','user_sender_rules'),('public','notification_preferences'),('public','notification_events'),
    ('private','notification_deliveries'),('public','user_preferences'),('public','onboarding_progress'),
    ('public','push_tokens'),('public','user_devices')
  ) v(schema_name,table_name) loop
    execute format('delete from %I.%I where user_id=$1',entry.schema_name,entry.table_name) using p_owner;
    get diagnostics affected=row_count; removed:=removed+affected;
  end loop;
  delete from audit.transaction_revisions where transaction_id in(select id from public.transactions where user_id=p_owner); get diagnostics affected=row_count; removed:=removed+affected;
  delete from public.transaction_postings where transaction_id in(select id from public.transactions where user_id=p_owner); get diagnostics affected=row_count; removed:=removed+affected;
  delete from public.account_balances where account_id in(select id from public.accounts where user_id=p_owner); get diagnostics affected=row_count; removed:=removed+affected;
  delete from public.transactions where user_id=p_owner; get diagnostics affected=row_count; removed:=removed+affected;
  delete from public.accounts where user_id=p_owner; get diagnostics affected=row_count; removed:=removed+affected;
  delete from public.categories where user_id=p_owner; get diagnostics affected=row_count; removed:=removed+affected;
  delete from private.clerk_webhook_events where payload#>>'{data,id}'=p_owner;
  -- Membership is still required while an upload capability can recreate audio.
  update private.staging_voice_members m set command_evidence=null where m.user_id=p_owner;
  delete from private.staging_voice_members m where m.user_id=p_owner
    and not exists(select 1 from private.voice_media_tombstones t where t.id=m.session_id);
  update public.profiles set locale='ar',timezone='Asia/Riyadh',last_seen_at=null where id=p_owner;
  for entry in select n.nspname schema_name,c.relname table_name from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid=c.oid and a.attname='user_id' and not a.attisdropped
    where c.relkind='r' and n.nspname in ('public','private')
      and c.relname not in ('admin_profiles','admin_role_assignments','account_deletion_requests','account_deletion_receipts',
        'account_erasure_context','account_upload_erasure_tombstones','staging_voice_members','owner_bootstrap_state') loop
    execute format('select exists(select 1 from %I.%I where user_id=$1)',entry.schema_name,entry.table_name) into residual using p_owner;
    if residual then raise exception using errcode='55000',message='ERASURE_PAYLOAD_REMAINS',detail=entry.schema_name||'.'||entry.table_name; end if;
  end loop;
  delete from private.account_erasure_resources where request_id=p_request;
  delete from private.account_erasure_context where transaction_id=pg_catalog.txid_current();
  return removed;
end $$;

alter function private.erase_account_owner_payload(uuid,text) owner to masarifi_migration;
revoke all on function private.erase_account_owner_payload(uuid,text) from public,anon,authenticated,service_role,masarifi_api;
grant execute on function private.erase_account_owner_payload(uuid,text) to masarifi_worker;
reset role;
revoke masarifi_migration from current_user granted by current_user;
