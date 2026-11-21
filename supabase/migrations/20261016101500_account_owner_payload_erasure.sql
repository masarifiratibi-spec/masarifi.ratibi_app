-- Explicit immediate erasure only. Ordinary writes keep their existing permissions.
grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

create table private.account_erasure_context (
  transaction_id bigint primary key,
  request_id uuid not null references private.account_deletion_requests(id) on delete restrict,
  user_id text not null references public.profiles(id) on delete restrict,
  objects_locked boolean not null default false
);
create table private.account_erasure_resources (
  request_id uuid not null references private.account_deletion_requests(id) on delete restrict,
  resource_type text not null,
  resource_id text not null,
  primary key(request_id,resource_type,resource_id)
);
-- Supabase upload capabilities remain valid for two hours after issuance. Keep
-- only scoped deletion instructions, with a one-minute in-flight HTTP margin.
create table private.account_upload_erasure_tombstones (
  id uuid primary key default extensions.gen_random_uuid(),
  request_id uuid not null references private.account_deletion_requests(id) on delete restrict,
  user_id text not null references public.profiles(id) on delete restrict,
  storage_ref text not null unique check(storage_ref ~ '^support/[0-9a-f-]{36}/[0-9a-f-]{36}$'),
  capability_expires_at timestamptz not null,
  next_attempt_at timestamptz not null default clock_timestamp(),
  lease_token uuid,
  lease_until timestamptz,
  check((lease_token is null)=(lease_until is null))
);
create index account_upload_erasure_due on private.account_upload_erasure_tombstones(user_id,next_attempt_at);
alter table private.account_erasure_context enable row level security;
alter table private.account_erasure_context force row level security;
alter table private.account_erasure_resources enable row level security;
alter table private.account_erasure_resources force row level security;
alter table private.account_upload_erasure_tombstones enable row level security;
alter table private.account_upload_erasure_tombstones force row level security;
create policy account_erasure_context_migration on private.account_erasure_context to masarifi_migration using(true) with check(true);
create policy account_erasure_resources_migration on private.account_erasure_resources to masarifi_migration using(true) with check(true);
create policy account_upload_erasure_migration on private.account_upload_erasure_tombstones to masarifi_migration using(true) with check(true);
revoke all on private.account_erasure_context,private.account_erasure_resources from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;
revoke all on private.account_upload_erasure_tombstones from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;

create function private.clear_account_erasure_context_at_commit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  delete from private.account_erasure_context where transaction_id=new.transaction_id;
  return null;
end $$;
alter function private.clear_account_erasure_context_at_commit() owner to masarifi_migration;
revoke all on function private.clear_account_erasure_context_at_commit() from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;
create constraint trigger account_erasure_context_transaction_end after insert on private.account_erasure_context
  deferrable initially deferred for each row execute function private.clear_account_erasure_context_at_commit();

-- Hold this read lock through every ordinary command transaction. Freezing takes
-- FOR UPDATE, drains existing readers, then makes future readers fail closed.
create or replace function private.assert_active_profile(p_user_id text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_user_id is null or char_length(btrim(p_user_id)) not between 1 and 128
    or p_user_id is distinct from public.current_clerk_user_id() then
    raise exception using errcode='28000',message='AUTH_TOKEN_INVALID';
  end if;
  perform 1 from public.profiles where id=p_user_id and status='active' for share;
  if not found then raise exception using errcode='42501',message='PROFILE_INACTIVE'; end if;
end $$;

-- Some background writers do not call assert_active_profile. The same owner
-- row lock fences their INSERT/UPDATE too, including statements already in flight.
create function private.fence_frozen_owner_payload() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.user_id is null then return new; end if;
  perform 1 from public.profiles where id=new.user_id and status='active' for share;
  if not found then raise exception using errcode='42501',message='PROFILE_INACTIVE'; end if;
  return new;
end $$;
alter function private.fence_frozen_owner_payload() owner to masarifi_migration;
revoke all on function private.fence_frozen_owner_payload() from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;
do $$ declare entry record; begin
  for entry in select n.nspname,c.relname from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid=c.oid and a.attname='user_id' and not a.attisdropped
    where c.relkind='r' and n.nspname in ('public','private')
      and c.relname not in ('admin_profiles','admin_role_assignments','account_deletion_requests','account_deletion_receipts',
        'account_erasure_context','account_upload_erasure_tombstones','staging_voice_members','owner_bootstrap_state') loop
    execute format('create trigger a_owner_payload_write_fence before insert or update on %I.%I for each row execute function private.fence_frozen_owner_payload()',entry.nspname,entry.relname);
  end loop;
end $$;

create function private.redact_frozen_owner_webhook() returns trigger
language plpgsql security definer set search_path='' as $$
declare subject text:=new.payload#>>'{data,id}'; profile_status text;
begin
  select status into profile_status from public.profiles where id=subject for share;
  if profile_status in ('deletion_pending','deleted') then
    -- Keep the verified receipt hash and subject needed to reconcile a late event.
    new.payload:=jsonb_build_object('data',jsonb_build_object('id',subject));
  end if;
  return new;
end $$;
alter function private.redact_frozen_owner_webhook() owner to masarifi_migration;
revoke all on function private.redact_frozen_owner_webhook() from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;
create trigger a_clerk_webhook_erasure_fence before insert on private.clerk_webhook_events
  for each row execute function private.redact_frozen_owner_webhook();

create function private.assert_account_erasure_request(p_request uuid,p_owner text,p_frozen boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from private.account_deletion_requests where id=p_request and user_id=p_owner and status='processing' for update;
  if not found then raise exception using errcode='42501',message='ERASURE_REQUEST_FORBIDDEN'; end if;
  if p_owner is null or p_request is null or not exists(
    select 1 from private.account_deletion_requests d join public.profiles p on p.id=d.user_id
    where d.id=p_request and d.user_id=p_owner and d.status='processing'
      and d.verified_at is not null and d.cooling_off_ends_at<=clock_timestamp()
      and (not p_frozen or p.status in ('deletion_pending','deleted'))
  ) or exists(select 1 from public.admin_profiles where user_id=p_owner) then
    raise exception using errcode='42501',message='ERASURE_REQUEST_FORBIDDEN';
  end if;
  if exists(select 1 from private.retention_holds h where h.starts_at<=clock_timestamp()
    and (h.ends_at is null or h.ends_at>clock_timestamp()) and (
      h.resource_id=p_owner or exists(select 1 from private.account_erasure_resources r
        where r.request_id=p_request and r.resource_id=h.resource_id))) then
    raise exception using errcode='55000',message='ERASURE_ACTIVE_HOLD';
  end if;
end $$;

create function private.freeze_account_deletion_owner(p_request uuid,p_owner text)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.assert_account_erasure_request(p_request,p_owner,false);
  perform 1 from public.profiles where id=p_owner for update;
  perform private.assert_account_erasure_request(p_request,p_owner,false);
  update public.profiles set status='deletion_pending' where id=p_owner and status<>'deleted';
end $$;

create function private.begin_account_erasure(p_request uuid,p_owner text)
returns void language plpgsql security definer set search_path='' as $$
declare entry record;
begin
  perform private.assert_account_erasure_request(p_request,p_owner,true);
  perform 1 from public.profiles where id=p_owner for update;
  insert into private.account_erasure_context(transaction_id,request_id,user_id)
    values(pg_catalog.txid_current(),p_request,p_owner)
    on conflict(transaction_id) do nothing;
  if not exists(select 1 from private.account_erasure_context where transaction_id=pg_catalog.txid_current()
    and request_id=p_request and user_id=p_owner) then
    raise exception using errcode='42501',message='ERASURE_CONTEXT_MISMATCH';
  end if;
  -- Only constant, reviewed owner tables are used in dynamic SQL.
  for entry in select * from (values
    ('public','accounts','account'),('public','categories','category'),
    ('public','transactions','transaction'),('public','salary_profiles','salary_profile'),
    ('public','salary_receipts','salary_receipt'),('public','budgets','budget'),
    ('public','budget_categories','budget_category'),('public','obligations','obligation'),
    ('public','obligation_schedule_items','obligation_schedule_item'),
    ('public','obligation_payments','obligation_payment'),('public','payment_matches','payment_match'),
    ('public','savings_goals','savings_goal'),('public','savings_goal_movements','savings_goal_movement'),
    ('public','voice_sessions','voice_session'),('public','voice_proposals','voice_proposal'),
    ('public','assistant_conversations','assistant_conversation'),('public','assistant_messages','assistant_message'),
    ('public','assistant_action_previews','assistant_action'),('public','financial_insights','financial_insight'),
    ('public','import_sessions','import_session'),('public','import_items','import_item'),
    ('public','review_items','review_item'),('public','duplicate_candidates','duplicate_candidate'),
    ('public','tracking_history','tracking_history'),('public','tracking_feedback','tracking_feedback'),
    ('public','user_keyword_rules','tracking_rule'),('public','user_sender_rules','tracking_rule'),
    ('public','support_tickets','support_ticket'),('public','feedback_items','feedback'),
    ('public','notification_events','notification'),('public','user_devices','device'),
    ('private','ai_usage_events','ai_usage'),
    ('public','client_mutations','client_mutation'),('public','transaction_conflicts','transaction_conflict'),
    ('public','report_schedules','report_schedule'),('private','report_output_attempts','report_attempt'),
    ('private','privacy_export_requests','privacy_export'),('private','support_access_requests','support_request')
  ) as v(schema_name,table_name,resource_type) loop
    execute format('insert into private.account_erasure_resources(request_id,resource_type,resource_id) select $1,$2,id::text from %I.%I where user_id=$3 on conflict do nothing',entry.schema_name,entry.table_name)
      using p_request,entry.resource_type,p_owner;
  end loop;
  insert into private.account_erasure_resources(request_id,resource_type,resource_id)
    select p_request,'ai_work',request_id from private.ai_usage_events where user_id=p_owner on conflict do nothing;
  insert into private.account_erasure_resources(request_id,resource_type,resource_id)
    select p_request,alias.resource_type,r.resource_id from private.account_erasure_resources r
    join (values ('voice_proposal','ai_action'),('assistant_action','ai_action'),
      ('voice_session','ai_work'),('assistant_message','ai_work'),('notification','notification_event')) alias(original_type,resource_type)
      on alias.original_type=r.resource_type where r.request_id=p_request on conflict do nothing;
  perform private.assert_account_erasure_request(p_request,p_owner,true);
end $$;

-- This function is unavailable to API/worker roles. Custom settings alone cannot
-- manufacture the migration-owned transaction row checked by immutable triggers.
create function private.account_erasure_permits_delete(p_schema text,p_table text,p_old jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare context private.account_erasure_context%rowtype;
begin
  select * into context from private.account_erasure_context where transaction_id=pg_catalog.txid_current();
  if not found then return false; end if;
  perform private.assert_account_erasure_request(context.request_id,context.user_id,true);
  if p_schema='public' and p_table in ('security_events','tracking_feedback','obligation_payment_allocations','savings_goal_movements') then
    return p_old->>'user_id'=context.user_id;
  elsif p_schema='public' and p_table='transaction_postings' then
    return exists(select 1 from public.transactions t join public.accounts a on a.id=(p_old->>'account_id')::uuid
      where t.id=(p_old->>'transaction_id')::uuid and t.user_id=context.user_id and a.user_id=context.user_id);
  elsif p_schema='audit' and p_table='transaction_revisions' then
    return exists(select 1 from public.transactions where id=(p_old->>'transaction_id')::uuid and user_id=context.user_id);
  elsif p_schema='public' and p_table='account_balances' then
    return exists(select 1 from public.accounts where id=(p_old->>'account_id')::uuid and user_id=context.user_id);
  elsif p_schema='private' and p_table='ai_failure_events' then
    return p_old->>'user_id'=context.user_id;
  elsif p_schema='audit' and p_table='audit_events' and p_old->>'resource_type'<>'deletion_request' then
    return p_old->>'actor_id'=context.user_id or p_old->>'resource_id'=context.user_id
      or p_old#>>'{metadata,userId}'=context.user_id or exists(
        select 1 from private.account_erasure_resources r where r.request_id=context.request_id
          and r.resource_id=p_old->>'resource_id' and r.resource_type=replace(p_old->>'resource_type','-','_'));
  end if;
  return false;
end $$;

create or replace function private.reject_ledger_evidence_change() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' and private.account_erasure_permits_delete(tg_table_schema,tg_table_name,to_jsonb(old)) then return old; end if;
  raise exception using errcode='42501',message='LEDGER_EVIDENCE_IMMUTABLE';
end $$;
create or replace function private.reject_planning_history_change() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' and private.account_erasure_permits_delete(tg_table_schema,tg_table_name,to_jsonb(old)) then return old; end if;
  raise exception using errcode='42501',message='PLANNING_HISTORY_IMMUTABLE';
end $$;
create or replace function private.reject_immutable_change() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' and private.account_erasure_permits_delete(tg_table_schema,tg_table_name,to_jsonb(old)) then return old; end if;
  raise exception using errcode='42501',message='SECURITY_EVIDENCE_IMMUTABLE';
end $$;
create or replace function private.guard_account_balance() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' and private.account_erasure_permits_delete(tg_table_schema,tg_table_name,to_jsonb(old)) then return old; end if;
  if current_setting('masarifi.ledger_command',true)<>'on' then raise exception using errcode='42501',message='LEDGER_COMMAND_REQUIRED'; end if;
  if tg_op='DELETE' or (tg_op='UPDATE' and new.account_id is distinct from old.account_id) then
    raise exception using errcode='42501',message='BALANCE_IDENTITY_IMMUTABLE';
  end if;
  return new;
end $$;
create or replace function private.guard_ai_failure_event_change() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' and private.account_erasure_permits_delete(tg_table_schema,tg_table_name,to_jsonb(old)) then return old; end if;
  if tg_op='UPDATE' and current_setting('masarifi.ai_privacy_delete',true)='on'
    and old.user_id is not null and new.user_id is null
    and to_jsonb(new)-'user_id' is not distinct from to_jsonb(old)-'user_id' then return new; end if;
  if tg_op='DELETE' or to_jsonb(new)-array['status','updated_at','version'] is distinct from to_jsonb(old)-array['status','updated_at','version']
    or (old.status='acknowledged' and new.status not in ('acknowledged','resolved'))
    or (old.status='resolved' and new.status<>'resolved') then
    raise exception using errcode='55000',message='IMMUTABLE_RECORD';
  end if;
  return new;
end $$;

create function private.prepare_account_owner_erasure(p_request uuid,p_owner text)
returns void language plpgsql security definer set search_path='' as $$
declare budget record;
begin
  perform private.begin_account_erasure(p_request,p_owner);
  insert into private.account_upload_erasure_tombstones(request_id,user_id,storage_ref,capability_expires_at)
    select p_request,p_owner,a.storage_ref,clock_timestamp()+interval '2 hours 1 minute'
    from private.support_attachments a join public.support_tickets t on t.id=a.ticket_id where t.user_id=p_owner
    on conflict(storage_ref) do nothing;
  -- Capture these links before the legacy AI handler deletes sessions/nulls owner IDs.
  perform 1 from public.voice_sessions where user_id=p_owner order by id for update;
  delete from private.voice_provider_attempts where session_id in(select id from public.voice_sessions where user_id=p_owner);
  delete from private.ai_failure_events where user_id=p_owner;
  -- Preserve effective shared budget totals without retaining a user, request,
  -- generation or precise-time link. Reserved costs become conservatively failed
  -- so the ordinary stale-reservation rollup cannot release anonymous evidence.
  for budget in select distinct budget_period,workload from private.ai_usage_events
    where user_id=p_owner order by budget_period,workload loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ai-budget:global:'||budget.budget_period::text,0));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ai-budget:'||budget.workload||':'||budget.budget_period::text,0));
  end loop;
  perform 1 from private.ai_usage_events where user_id=p_owner order by id for update;
  insert into private.ai_usage_events(id,user_id,budget_period,workload,model,provider,
    reservation_status,estimated_cost,request_id,provider_generation_hash,created_at)
    select extensions.gen_random_uuid(),null,budget_period,workload,model,provider,
      case when reservation_status='reserved' then 'failed' else reservation_status end,
      sum(estimated_cost),extensions.gen_random_uuid()::text,null,
      budget_period::timestamp at time zone 'UTC'
    from private.ai_usage_events where user_id=p_owner
    group by budget_period,workload,model,provider,
      case when reservation_status='reserved' then 'failed' else reservation_status end;
  delete from private.ai_usage_events where user_id=p_owner;
  -- Feedback had an unconditional immutable trigger; the protected context is the only bypass.
  delete from public.tracking_feedback where user_id=p_owner;
  delete from private.account_erasure_context where transaction_id=pg_catalog.txid_current();
end $$;

create function private.lock_account_erasure_objects(p_request uuid,p_owner text)
returns table(kind text,storage_ref text) language plpgsql security definer set search_path='' as $$
declare attempt record;
begin
  perform private.begin_account_erasure(p_request,p_owner);
  if exists(select 1 from private.privacy_export_requests where user_id=p_owner and status='processing'
    and updated_at>clock_timestamp()-interval '15 minutes') then
    raise exception using errcode='55000',message='ERASURE_EXPORT_BUSY';
  end if;
  for attempt in select a.id from private.report_output_attempts a where a.user_id=p_owner order by a.id loop
    if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(attempt.id::text,0)) then
      raise exception using errcode='55000',message='ERASURE_WORK_BUSY';
    end if;
  end loop;
  update private.account_erasure_context set objects_locked=true where transaction_id=pg_catalog.txid_current();
  return query select 'report'::text,coalesce(a.storage_ref,'reports/'||encode(extensions.digest(p_owner,'sha256'),'hex')||'/'||a.id||'.'||(a.snapshot->>'format'))
    from private.report_output_attempts a where a.user_id=p_owner;
  return query select 'export'::text,coalesce(e.storage_ref,'exports/'||e.id||'/privacy.zip')
    from private.privacy_export_requests e where e.user_id=p_owner;
  return query select 'support'::text,t.storage_ref from private.account_upload_erasure_tombstones t where t.user_id=p_owner;
end $$;

create function private.claim_account_upload_erasure(p_owner text,p_limit integer)
returns table(id uuid,storage_ref text,lease_token uuid) language plpgsql security definer set search_path='' as $$
begin
  if p_owner is null or char_length(p_owner) not between 1 and 128 or p_limit not between 1 and 16 then
    raise exception using errcode='42501',message='ERASURE_PURGE_FORBIDDEN';
  end if;
  return query with due as (
    select t.id from private.account_upload_erasure_tombstones t
    join private.account_deletion_requests d on d.id=t.request_id and d.user_id=t.user_id
    join public.profiles p on p.id=t.user_id
    where t.user_id=p_owner and d.status in ('processing','completed','failed')
      and p.status in ('deletion_pending','deleted') and t.next_attempt_at<=clock_timestamp()
      and (t.lease_until is null or t.lease_until<=clock_timestamp())
    order by t.next_attempt_at,t.id for update of t skip locked limit p_limit
  ) update private.account_upload_erasure_tombstones t
    set lease_token=extensions.gen_random_uuid(),lease_until=clock_timestamp()+interval '5 minutes'
    from due where t.id=due.id returning t.id,t.storage_ref,t.lease_token;
end $$;

create function private.complete_account_upload_erasure(p_owner text,p_id uuid,p_lease uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare tombstone private.account_upload_erasure_tombstones%rowtype;
begin
  select * into tombstone from private.account_upload_erasure_tombstones
    where id=p_id and user_id=p_owner and lease_token=p_lease and lease_until>clock_timestamp() for update;
  if not found then raise exception using errcode='42501',message='ERASURE_PURGE_LEASE_INVALID'; end if;
  if tombstone.capability_expires_at<=clock_timestamp() then
    delete from private.account_upload_erasure_tombstones where id=p_id;
    return true;
  end if;
  update private.account_upload_erasure_tombstones set lease_token=null,lease_until=null,
    next_attempt_at=least(capability_expires_at,clock_timestamp()+interval '30 seconds') where id=p_id;
  return false;
end $$;

create function private.erase_account_owner_payload(p_request uuid,p_owner text)
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
  delete from private.outbox_events o where o.event_type not like 'privacy.deletion_%' and (
    o.payload->>'userId'=p_owner or o.payload->>'profileId'=p_owner or o.payload#>>'{sync,userId}'=p_owner
    or exists(select 1 from private.account_erasure_resources r where r.request_id=p_request
      and r.resource_id=o.aggregate_id::text and r.resource_type=replace(o.aggregate_type,'-','_')));
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

do $$ declare signature text; begin
  foreach signature in array array[
    'private.assert_account_erasure_request(uuid,text,boolean)',
    'private.freeze_account_deletion_owner(uuid,text)','private.begin_account_erasure(uuid,text)',
    'private.account_erasure_permits_delete(text,text,jsonb)',
    'private.prepare_account_owner_erasure(uuid,text)','private.lock_account_erasure_objects(uuid,text)',
    'private.erase_account_owner_payload(uuid,text)','private.claim_account_upload_erasure(text,integer)',
    'private.complete_account_upload_erasure(text,uuid,uuid)'
  ] loop
    execute 'alter function '||signature||' owner to masarifi_migration';
    execute 'revoke all on function '||signature||' from public,anon,authenticated,service_role,masarifi_api,masarifi_worker';
  end loop;
end $$;
grant execute on function private.freeze_account_deletion_owner(uuid,text),
  private.prepare_account_owner_erasure(uuid,text),private.lock_account_erasure_objects(uuid,text),
  private.erase_account_owner_payload(uuid,text),private.claim_account_upload_erasure(text,integer),
  private.complete_account_upload_erasure(text,uuid,uuid) to masarifi_worker;

reset role;
revoke masarifi_migration from current_user granted by current_user;
