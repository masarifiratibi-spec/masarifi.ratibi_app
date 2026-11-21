-- Execute as the existing migration owner and restore the original role membership.
do $role$
begin
  if pg_has_role(current_user, 'masarifi_migration', 'SET') then
    perform set_config('masarifi.personal_grant', 'existing', true);
  else
    if exists (select from pg_auth_members where roleid='masarifi_migration'::regrole
               and member=current_user::regrole and grantor=current_user::regrole) then
      raise exception 'Review existing self-granted migration membership';
    end if;
    execute format('grant masarifi_migration to %I with set true, inherit false granted by %I', current_user, current_user);
    perform set_config('masarifi.personal_grant', 'temporary', true);
  end if;
end
$role$;
set local role masarifi_migration;


CREATE OR REPLACE FUNCTION private.claim_idempotency_key(p_actor_id text, p_scope text, p_key_hash text, p_request_hash text, p_ttl interval)
 RETURNS TABLE(outcome text, response_status integer, response_body jsonb, resource_ref text, retry_after_seconds integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  existing private.idempotency_keys;
  inserted_id uuid;
  now_at timestamptz := clock_timestamp();
begin
  perform private.assert_active_profile(p_actor_id);
  if exists(select 1 from public.admin_profiles a where a.user_id=p_actor_id) then
    raise exception using errcode='42501',message='FINANCIAL_ACCESS_DENIED';
  end if;
  if p_scope is null or p_scope !~ '^[a-z][a-z0-9_.-]{2,127}$'
    or p_key_hash is null or p_key_hash !~ '^sha256:[0-9a-f]{64}$'
    or p_request_hash is null or p_request_hash !~ '^sha256:[0-9a-f]{64}$'
    or p_ttl is null or p_ttl<interval '1 minute' or p_ttl>interval '24 hours' then
    raise exception using errcode='22023',message='IDEMPOTENCY_KEY_INVALID';
  end if;

  insert into private.idempotency_keys(
    actor_id,scope,key_hash,request_hash,locked_until,expires_at
  ) values (
    p_actor_id,p_scope,p_key_hash,p_request_hash,now_at+p_ttl,now_at+interval '30 days'
  ) on conflict(actor_id,scope,key_hash) do nothing returning id into inserted_id;
  if inserted_id is not null then
    return query select 'new'::text,null::integer,null::jsonb,null::text,null::integer;
    return;
  end if;

  select * into existing from private.idempotency_keys k
  where k.actor_id=p_actor_id and k.scope=p_scope and k.key_hash=p_key_hash
  for update;
  if existing.request_hash<>p_request_hash then
    return query select 'hash_mismatch'::text,null::integer,null::jsonb,null::text,null::integer;
    return;
  elsif existing.state='completed' then
    return query select 'replay'::text,existing.response_status,existing.response_body,
      existing.resource_ref,null::integer;
    return;
  elsif existing.state='claimed' and existing.locked_until>now_at then
    return query select 'in_progress'::text,null::integer,null::jsonb,null::text,
      greatest(1,ceil(extract(epoch from existing.locked_until-now_at)))::integer;
    return;
  end if;

  update private.idempotency_keys set state='claimed',locked_until=now_at+p_ttl,
    response_status=null,response_body=null,resource_ref=null
  where id=existing.id;
  return query select 'new'::text,null::integer,null::jsonb,null::text,null::integer;
end $function$;

CREATE OR REPLACE FUNCTION private.complete_idempotency_key(p_actor_id text, p_scope text, p_key_hash text, p_request_hash text, p_response_status integer, p_response_body jsonb, p_resource_ref text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare existing private.idempotency_keys;
begin
  perform private.assert_active_profile(p_actor_id);
  if exists(select 1 from public.admin_profiles a where a.user_id=p_actor_id) then
    raise exception using errcode='42501',message='FINANCIAL_ACCESS_DENIED';
  end if;
  if p_response_status not between 100 and 599
    or p_response_body is null or jsonb_typeof(p_response_body)<>'object'
    or pg_column_size(p_response_body)>65536 then
    raise exception using errcode='22023',message='IDEMPOTENCY_RESPONSE_INVALID';
  end if;
  select * into existing from private.idempotency_keys k
  where k.actor_id=p_actor_id and k.scope=p_scope and k.key_hash=p_key_hash
  for update;
  if existing.id is null then
    raise exception using errcode='P0001',message='IDEMPOTENCY_CLAIM_MISSING';
  elsif existing.request_hash<>p_request_hash then
    raise exception using errcode='P0001',message='IDEMPOTENCY_KEY_REUSED';
  elsif existing.state='completed' then
    if existing.response_status=p_response_status and existing.response_body=p_response_body
      and existing.resource_ref is not distinct from p_resource_ref then return; end if;
    raise exception using errcode='P0001',message='IDEMPOTENCY_RESPONSE_MISMATCH';
  elsif existing.state<>'claimed' then
    raise exception using errcode='P0001',message='IDEMPOTENCY_CLAIM_INVALID';
  end if;
  update private.idempotency_keys set state='completed',response_status=p_response_status,
    response_body=p_response_body,resource_ref=p_resource_ref
  where id=existing.id;
end $function$;

CREATE OR REPLACE FUNCTION private.create_transaction_conflict(p_user_id text, p_client_mutation_id uuid, p_transaction_id uuid, p_server_version bigint, p_client_version bigint, p_conflict_fields text[], p_server_snapshot jsonb, p_client_snapshot jsonb)
 RETURNS transaction_conflicts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare conflict public.transaction_conflicts;
begin
  if not exists(
    select 1 from public.profiles p where p.id=p_user_id and p.status='active'
  ) or exists(select 1 from public.admin_profiles a where a.user_id=p_user_id) then
    raise exception using errcode='P0001',message='SYNC_CONFLICT_TARGET_INVALID';
  end if;
  if not exists(
    select 1 from public.client_mutations m
    where m.id=p_client_mutation_id and m.user_id=p_user_id and m.domain='transactions'
  ) or not exists(
    select 1 from public.transactions t where t.id=p_transaction_id and t.user_id=p_user_id
  ) then
    raise exception using errcode='P0001',message='SYNC_CONFLICT_TARGET_INVALID';
  end if;
  insert into public.transaction_conflicts(
    user_id,client_mutation_id,transaction_id,server_version,client_version,
    conflict_fields,server_snapshot,client_snapshot
  ) values(
    p_user_id,p_client_mutation_id,p_transaction_id,p_server_version,p_client_version,
    p_conflict_fields,p_server_snapshot,p_client_snapshot
  ) on conflict(client_mutation_id) where status='open' do update
    set client_mutation_id=excluded.client_mutation_id
  returning * into conflict;
  return conflict;
end $function$;

CREATE OR REPLACE FUNCTION private.current_owner_financial_accounts_allowed()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  owner_id text := public.current_clerk_user_id();
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
begin
  if nullif(btrim(owner_id),'') is null
    or claims->>'role' is distinct from 'authenticated'
    or nullif(btrim(claims->>'sid'),'') is null then
    raise exception using errcode='28000',message='AUTH_TOKEN_INVALID';
  end if;
  perform private.assert_active_profile(owner_id);
  return not exists(select 1 from public.admin_profiles where user_id=owner_id);
end $function$;

CREATE OR REPLACE FUNCTION private.execute_voice_event_unscoped(p_batch uuid, p_token uuid, p_event uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare b private.voice_batches; s public.voice_sessions; e private.voice_events; c private.voice_event_commands; ctx private.voice_batch_context; result jsonb; reason text; count_value integer; payload jsonb; constraint_name text;
begin
  select * into b from private.voice_batches where id=p_batch;
  if b.id is null then raise exception 'VOICE_BATCH_NOT_FOUND'; end if;
  -- Owner lock precedes session, batch, item locks for both cancellation and financial execution.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(b.user_id,0));
  select * into s from public.voice_sessions where id=b.session_id for update;
  select * into b from private.voice_batches where id=p_batch for update;
  select * into e from private.voice_events where id=p_event and batch_id=b.id for update;
  if e.id is null then raise exception 'VOICE_EVENT_NOT_FOUND'; end if;
  if e.status='committed' then return jsonb_build_object('status','committed','transactionId',e.transaction_id); end if;
  if e.status<>'eligible' then return jsonb_build_object('status',e.status); end if;
  if b.lease_token is distinct from p_token or b.lease_until<=clock_timestamp() or b.status<>'finalizing' then raise exception 'VOICE_EXECUTION_FENCE_INVALID'; end if;
  if not (select enabled from private.voice_automatic_policy for share) then raise exception 'VOICE_AUTOMATIC_PAUSED'; end if;
  select * into c from private.voice_event_commands where event_id=e.id;
  if c.command_hash is distinct from encode(extensions.digest(c.command::text,'sha256'),'hex') or c.command->>'externalRef' is distinct from 'voice-event:'||e.id then raise exception 'VOICE_COMMAND_INTEGRITY_INVALID'; end if;
  select * into ctx from private.voice_batch_context where session_id=s.id;
  reason:=private.voice_command_skip_reason(c.command,'voice-event:'||e.id);
  if reason is not null then null;
  elsif s.cancelled_at is not null then reason:='cancelled';
  elsif not exists(select 1 from public.profiles where id=b.user_id and status='active') or exists(select 1 from public.admin_profiles where user_id=b.user_id) or s.deleted_at is not null or s.expires_at<=clock_timestamp() then reason:='authorization_required';
  elsif c.requires_recent_auth and (ctx.auth_expires_at is null or ctx.auth_expires_at<clock_timestamp()) then reason:='authorization_required';
  elsif not exists(select 1 from public.accounts a where a.id=(c.command->>'accountId')::uuid and a.user_id=b.user_id and a.status='active' and a.deleted_at is null) then reason:='ambiguous_account';
  elsif not exists(select 1 from public.accounts a join public.currencies currency on currency.code=a.currency_code where a.id=(c.command->>'accountId')::uuid and btrim(a.currency_code::text)=c.command->>'currency' and currency.enabled) then reason:='currency_mismatch';
  elsif (c.command->>'kind'='expense' and c.command->>'categoryId' is null) or (c.command->>'categoryId' is not null and not exists(select 1 from public.categories cat where cat.id=(c.command->>'categoryId')::uuid and cat.active and cat.deleted_at is null and (cat.user_id is null or cat.user_id=b.user_id) and cat.kind=c.command->>'kind')) then reason:='invalid_category';
  end if;
  if reason is not null then
    update private.voice_events set status=case when reason='cancelled' then 'cancelled' else 'skipped' end,reason_code=case when reason='cancelled' then null else reason end,completed_at=clock_timestamp() where id=e.id;
    delete from private.voice_event_commands where event_id=e.id;
  else
    begin
    perform private.ledger_begin(b.user_id);
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(b.user_id||':ledger.write',0));
    select count(*) into count_value from public.security_events where user_id=b.user_id and event_type='security.request_attempt' and metadata->>'category'='ledger.write' and occurred_at>clock_timestamp()-interval '60 seconds';
    if count_value>=60 then raise exception 'VOICE_EXECUTION_RATE_LIMITED'; end if;
    insert into public.security_events(user_id,event_type,severity,metadata) values(b.user_id,'security.request_attempt','info','{"category":"ledger.write"}');
    result:=private.post_transaction(b.user_id,c.command);
    perform audit.append_event(b.user_id,'user','transaction.created','transaction',result->>'transactionId',null,
      'sha256:'||encode(extensions.digest((result->>'transactionId')||':'||(result->>'version'),'sha256'),'hex'),null,'voice-event:'||e.id,
      jsonb_build_object('operation','voice.automatic','version',result->'version','ledgerVersion',result->'ledgerVersion','batchId',b.id,'policyVersion',b.policy_version,'commandHash',c.command_hash));
    payload:=jsonb_build_object('transactionId',result->'transactionId','kind',c.command->'kind','accountIds',jsonb_build_array(c.command->'accountId'),'version',result->'version','ledgerVersion',result->'ledgerVersion','occurredAt',c.command->'occurredAt','requestId','voice-event:'||e.id);
    perform private.enqueue_outbox_event('transaction.created','transaction',(result->>'transactionId')::uuid,payload);
    perform private.enqueue_outbox_event('balance.changed','transaction',(result->>'transactionId')::uuid,payload-array['kind','version','occurredAt']);
    update private.voice_events set status='committed',transaction_id=(result->>'transactionId')::uuid,ledger_version=(result->>'ledgerVersion')::bigint,completed_at=clock_timestamp() where id=e.id;
    delete from private.voice_event_commands where event_id=e.id;
    exception when check_violation then
      get stacked diagnostics constraint_name=CONSTRAINT_NAME;
      if constraint_name not in ('account_balances_confirmed_check','account_balances_pending_check','account_balances_available_check') then raise; end if;
      reason:='invalid_event';
      update private.voice_events set status='skipped',reason_code=reason,completed_at=clock_timestamp() where id=e.id;
      delete from private.voice_event_commands where event_id=e.id;
    when sqlstate 'P0001' then
      reason:=case SQLERRM when 'CATEGORY_INVALID' then 'invalid_category' when 'ACCOUNT_INVALID' then 'ambiguous_account' when 'CURRENCY_MISMATCH' then 'currency_mismatch' when 'CURRENCY_INVALID' then 'currency_mismatch' else null end;
      if reason is null then raise; end if;
      update private.voice_events set status='skipped',reason_code=reason,completed_at=clock_timestamp() where id=e.id;
      delete from private.voice_event_commands where event_id=e.id;
    end;
  end if;
  if not exists(select 1 from private.voice_events where batch_id=b.id and status='eligible') then
    if exists(select 1 from private.voice_events where batch_id=b.id and status='execution_failed') then
      update private.voice_batches set status='failed',completed_at=clock_timestamp(),lease_token=null,lease_until=null where id=b.id;
      update public.voice_sessions set status='failed',failure_code='VOICE_FINALIZATION_FAILED' where id=s.id;
    else
      update private.voice_batches set status='completed',completed_at=clock_timestamp(),lease_token=null,lease_until=null where id=b.id;
      update public.voice_sessions set status='confirmed',confirmed_at=clock_timestamp() where id=s.id;
    end if;
  end if;
  return jsonb_build_object('status',case when reason is null then 'committed' else 'skipped' end);
end $function$;

CREATE OR REPLACE FUNCTION private.ledger_begin(p_user_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.assert_active_profile(p_user_id);
  if exists(select 1 from public.admin_profiles a where a.user_id=p_user_id) then
    raise exception using errcode='42501',message='FINANCIAL_ACCESS_DENIED';
  end if;
  -- ponytail: per-owner serialization; move to per-account locks only if measured
  -- hot-owner contention misses the Phase 05 budget.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id,0));
  perform pg_catalog.set_config('masarifi.ledger_command','on',true);
end $function$;

CREATE OR REPLACE FUNCTION private.lookup_idempotency_key(p_actor_id text, p_scope text, p_key_hash text, p_request_hash text)
 RETURNS TABLE(outcome text, response_status integer, response_body jsonb, resource_ref text, retry_after_seconds integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  existing private.idempotency_keys;
  now_at timestamptz := clock_timestamp();
begin
  perform private.assert_active_profile(p_actor_id);
  if exists(select 1 from public.admin_profiles a where a.user_id=p_actor_id) then
    raise exception using errcode='42501',message='FINANCIAL_ACCESS_DENIED';
  end if;
  if p_scope is null or p_scope !~ '^[a-z][a-z0-9_.-]{2,127}$'
    or p_key_hash is null or p_key_hash !~ '^sha256:[0-9a-f]{64}$'
    or p_request_hash is null or p_request_hash !~ '^sha256:[0-9a-f]{64}$' then
    raise exception using errcode='22023',message='IDEMPOTENCY_KEY_INVALID';
  end if;
  select * into existing from private.idempotency_keys k
  where k.actor_id=p_actor_id and k.scope=p_scope and k.key_hash=p_key_hash;
  if existing.id is null or existing.state='failed'
    or (existing.state='claimed' and existing.locked_until<=now_at) then
    return query select 'new'::text,null::integer,null::jsonb,null::text,null::integer;
  elsif existing.request_hash<>p_request_hash then
    return query select 'hash_mismatch'::text,null::integer,null::jsonb,null::text,null::integer;
  elsif existing.state='completed' then
    return query select 'replay'::text,existing.response_status,existing.response_body,
      existing.resource_ref,null::integer;
  else
    return query select 'in_progress'::text,null::integer,null::jsonb,null::text,
      greatest(1,ceil(extract(epoch from existing.locked_until-now_at)))::integer;
  end if;
end $function$;

CREATE OR REPLACE FUNCTION private.voice_analysis_eligible(p_user text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(select 1 from private.voice_analysis_policy p
    join public.profiles u on u.id=p_user and u.status='active'
    where p.enabled and (p.audience='authenticated' or p.owner_id=p_user)
      and not exists(select 1 from public.admin_profiles a where a.user_id=p_user))
$function$;

alter policy transactions_api_owner_select on public.transactions using (((user_id = current_clerk_user_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = transactions.user_id) AND (p.status = 'active'::text)))) AND (NOT private.ledger_actor_is_admin(current_clerk_user_id()))));

alter policy account_balances_api_owner_select on public.account_balances using ((EXISTS ( SELECT 1
   FROM accounts a
  WHERE ((a.id = account_balances.account_id) AND (a.user_id = current_clerk_user_id()) AND (EXISTS ( SELECT 1
           FROM profiles p
          WHERE ((p.id = a.user_id) AND (p.status = 'active'::text)))) AND (NOT private.ledger_actor_is_admin(current_clerk_user_id()))))));

alter policy client_sync_state_api_owner_select on public.client_sync_state using (((user_id = current_clerk_user_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = client_sync_state.user_id) AND (p.status = 'active'::text)))) AND (NOT (EXISTS ( SELECT 1
   FROM admin_profiles a
  WHERE (a.user_id = a.user_id))))));

alter policy client_mutations_api_owner_select on public.client_mutations using (((user_id = current_clerk_user_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = client_mutations.user_id) AND (p.status = 'active'::text)))) AND (NOT (EXISTS ( SELECT 1
   FROM admin_profiles a
  WHERE (a.user_id = a.user_id))))));

alter policy transaction_conflicts_api_owner_select on public.transaction_conflicts using (((user_id = current_clerk_user_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = transaction_conflicts.user_id) AND (p.status = 'active'::text)))) AND (NOT (EXISTS ( SELECT 1
   FROM admin_profiles a
  WHERE (a.user_id = a.user_id))))));

alter policy planning_salary_profiles_api_owner_select on public.salary_profiles using (((user_id = current_clerk_user_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = salary_profiles.user_id) AND (p.status = 'active'::text)))) AND (NOT private.ledger_actor_is_admin(current_clerk_user_id()))));

alter policy planning_salary_receipts_api_owner_select on public.salary_receipts using (((user_id = current_clerk_user_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = salary_receipts.user_id) AND (p.status = 'active'::text)))) AND (NOT private.ledger_actor_is_admin(current_clerk_user_id()))));

alter policy planning_budgets_api_owner_select on public.budgets using (((user_id = current_clerk_user_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = budgets.user_id) AND (p.status = 'active'::text)))) AND (NOT private.ledger_actor_is_admin(current_clerk_user_id()))));

alter policy planning_budget_categories_api_owner_select on public.budget_categories using (((user_id = current_clerk_user_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = budget_categories.user_id) AND (p.status = 'active'::text)))) AND (NOT private.ledger_actor_is_admin(current_clerk_user_id()))));

alter policy planning_obligations_api_owner_select on public.obligations using (((user_id = current_clerk_user_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = obligations.user_id) AND (p.status = 'active'::text)))) AND (NOT private.ledger_actor_is_admin(current_clerk_user_id()))));

alter policy planning_obligation_schedule_items_api_owner_select on public.obligation_schedule_items using (((user_id = current_clerk_user_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = obligation_schedule_items.user_id) AND (p.status = 'active'::text)))) AND (NOT private.ledger_actor_is_admin(current_clerk_user_id()))));

alter policy planning_obligation_payments_api_owner_select on public.obligation_payments using (((user_id = current_clerk_user_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = obligation_payments.user_id) AND (p.status = 'active'::text)))) AND (NOT private.ledger_actor_is_admin(current_clerk_user_id()))));

alter policy planning_obligation_payment_allocations_api_owner_select on public.obligation_payment_allocations using (((user_id = current_clerk_user_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = obligation_payment_allocations.user_id) AND (p.status = 'active'::text)))) AND (NOT private.ledger_actor_is_admin(current_clerk_user_id()))));

alter policy planning_payment_matches_api_owner_select on public.payment_matches using (((user_id = current_clerk_user_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = payment_matches.user_id) AND (p.status = 'active'::text)))) AND (NOT private.ledger_actor_is_admin(current_clerk_user_id()))));

alter policy planning_savings_goals_api_owner_select on public.savings_goals using (((user_id = current_clerk_user_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = savings_goals.user_id) AND (p.status = 'active'::text)))) AND (NOT private.ledger_actor_is_admin(current_clerk_user_id()))));

alter policy planning_savings_goal_movements_api_owner_select on public.savings_goal_movements using (((user_id = current_clerk_user_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = savings_goal_movements.user_id) AND (p.status = 'active'::text)))) AND (NOT private.ledger_actor_is_admin(current_clerk_user_id()))));

reset role;
do $role$
begin
  if current_setting('masarifi.personal_grant') = 'temporary' then
    execute format('revoke masarifi_migration from %I granted by %I', current_user, current_user);
  end if;
end
$role$;
