-- Serialized owner reset. The receipt contains no erased financial payload.
do $role$
begin
  if pg_has_role(current_user, 'masarifi_migration', 'SET') then
    perform set_config('masarifi.financial_reset_grant', 'existing', true);
  else
    if exists (select from pg_auth_members where roleid='masarifi_migration'::regrole
               and member=current_user::regrole and grantor=current_user::regrole) then
      raise exception 'Review existing self-granted migration membership';
    end if;
    execute format('grant masarifi_migration to %I with set true, inherit false granted by %I', current_user, current_user);
    perform set_config('masarifi.financial_reset_grant', 'temporary', true);
  end if;
end
$role$;
set local role masarifi_migration;

-- A real tuple update at reset makes REPEATABLE READ writers that obtained an
-- older snapshot fail serialization even when their first financial write is later.
create table private.financial_reset_epochs (
  owner_id text primary key references public.profiles(id) on delete cascade,
  generation bigint not null default 0
);
create function private.initialize_financial_reset_epoch() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into private.financial_reset_epochs(owner_id) values(new.id) on conflict do nothing;
  return new;
end $$;
revoke all on function private.initialize_financial_reset_epoch() from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;
create trigger initialize_financial_reset_epoch after insert on public.profiles for each row execute function private.initialize_financial_reset_epoch();
insert into private.financial_reset_epochs(owner_id) select id from public.profiles on conflict do nothing;
create table private.financial_reset_receipts (
  owner_id text not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  generation bigint not null check (generation>0),
  reset_at timestamptz not null,
  primary key(owner_id,request_id), unique(owner_id,generation)
);
create table private.financial_reset_objects (
  owner_id text not null, request_id uuid not null,
  kind text not null check(kind in ('report','export','tracking','voice')), storage_ref text not null,
  protect_until timestamptz, next_attempt_at timestamptz not null default clock_timestamp(),
  primary key(owner_id,request_id,kind,storage_ref),
  foreign key(owner_id,request_id) references private.financial_reset_receipts(owner_id,request_id) on delete restrict
);
create index financial_reset_objects_due on private.financial_reset_objects(next_attempt_at);
-- Exists exclusively during reset_financial_data, and rolls back with that transaction.
create table private.financial_reset_context (
  xid bigint primary key, owner_id text not null, request_id uuid not null,
  foreign key(owner_id,request_id) references private.financial_reset_receipts(owner_id,request_id)
);
create table private.financial_reset_resources (
  xid bigint references private.financial_reset_context(xid) on delete cascade,
  resource_id uuid not null, resource_type text not null, primary key(xid,resource_id,resource_type)
);
do $$ declare t text; begin
  foreach t in array array['financial_reset_epochs','financial_reset_receipts','financial_reset_objects','financial_reset_context','financial_reset_resources'] loop
    execute format('alter table private.%I enable row level security',t);
    execute format('alter table private.%I force row level security',t);
    execute format('create policy migration_only on private.%I to masarifi_migration using(true) with check(true)',t);
    execute format('revoke all on private.%I from public,anon,authenticated,service_role,masarifi_api,masarifi_worker',t);
  end loop;
end $$;

create function private.financial_reset_active(p_owner text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.financial_reset_context
    where xid=txid_current() and owner_id=p_owner)
$$;

create function private.financial_reset_ledger_delete(p_transaction uuid,p_account uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.financial_reset_context c join public.transactions t
    on c.owner_id=t.user_id and t.id=p_transaction where c.xid=txid_current()
    and (p_account is null or exists(select 1 from public.accounts a where a.user_id=c.owner_id and a.id=p_account)))
$$;
-- Only DELETE gains a reset exception. All normal UPDATE checks and all account
-- erasure behavior run the original guard. Postings require BOTH owner links.
do $$ declare r record; subject text; begin
  for r in select * from (values
    ('public.transaction_postings','transaction_postings_immutable','reject_ledger_evidence_change','posting'),
    ('audit.transaction_revisions','transaction_revisions_immutable','reject_ledger_evidence_change','revision'),
    ('public.client_mutations','client_mutations_guard','guard_client_mutation','user_id'),
    ('private.idempotency_keys','idempotency_keys_guard','guard_idempotency_key','actor_id'),
    ('public.obligation_payment_allocations','planning_obligation_payment_allocations_immutable','reject_planning_history_change','user_id'),
    ('public.savings_goal_movements','planning_savings_goal_movements_immutable','reject_planning_history_change','user_id'),
    ('public.tracking_history','tracking_history_immutable','guard_tracking_history_change','user_id'),
    ('public.tracking_feedback','tracking_feedback_immutable','reject_immutable_change','user_id'),
    ('public.voice_transcripts','voice_transcripts_immutable','reject_ai_immutable_change','user_id'),
    ('public.voice_proposal_fields','voice_fields_immutable','reject_ai_immutable_change','user_id'),
    ('public.assistant_response_snapshots','assistant_snapshots_immutable','reject_ai_immutable_change','user_id')
  ) v(tbl,trg,fn,col) loop
    if r.col='posting' then subject:='private.financial_reset_ledger_delete(old.transaction_id,old.account_id)';
    elsif r.col='revision' then subject:='private.financial_reset_ledger_delete(old.transaction_id,null)';
    else subject:=format('private.financial_reset_active(old.%I)',r.col); end if;
    execute format('drop trigger %I on %s',r.trg,r.tbl);
    execute format('create trigger %I before update on %s for each row execute function private.%I()',r.trg,r.tbl,r.fn);
    execute format('create trigger %I before delete on %s for each row when (not %s) execute function private.%I()',r.trg||'_delete',r.tbl,subject,r.fn);
  end loop;
end $$;

create function private.financial_reset_receipt(p_owner text,p_request uuid)
returns table(generation bigint,reset_at timestamptz,request_id uuid,cleanup_pending boolean)
language plpgsql security definer set search_path='' as $$
begin
  perform private.assert_active_profile(p_owner);
  return query select r.generation,r.reset_at,r.request_id,exists(select 1 from private.financial_reset_objects o
    where o.owner_id=r.owner_id and o.request_id=r.request_id)
    from private.financial_reset_receipts r where r.owner_id=p_owner and r.request_id=p_request;
end $$;
create function private.financial_reset_state(p_owner text)
returns table(generation bigint,reset_at timestamptz,request_id uuid,cleanup_pending boolean)
language plpgsql security definer set search_path='' as $$
begin
  perform private.assert_active_profile(p_owner);
  return query select coalesce(r.generation,0),r.reset_at,r.request_id,exists(select 1 from private.financial_reset_objects o
    where o.owner_id=p_owner and o.request_id=r.request_id)
    from (values (1)) s(n) left join lateral (select * from private.financial_reset_receipts f
      where f.owner_id=p_owner order by f.generation desc limit 1) r on true;
end $$;
create function private.list_pending_financial_reset_objects(p_limit integer,p_owner text default null)
returns table(owner_id text,request_id uuid,kind text,storage_ref text)
language plpgsql security definer set search_path='' as $$
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'INVALID_RESET_CLEANUP_LIMIT'; end if;
  return query with due as (select o.* from private.financial_reset_objects o
    where (p_owner is null or o.owner_id=p_owner) and o.next_attempt_at<=clock_timestamp()
    order by o.next_attempt_at,o.owner_id,o.storage_ref limit p_limit for update skip locked)
    update private.financial_reset_objects o set next_attempt_at=clock_timestamp()+interval '30 seconds'
    from due where (o.owner_id,o.request_id,o.kind,o.storage_ref)=(due.owner_id,due.request_id,due.kind,due.storage_ref)
    returning o.owner_id,o.request_id,o.kind,o.storage_ref;
end $$;
create function private.complete_financial_reset_object(p_owner text,p_request uuid,p_kind text,p_ref text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_owner is null or p_owner is distinct from public.current_clerk_user_id() then
    raise exception using errcode='28000',message='AUTH_TOKEN_INVALID';
  end if;
  perform 1 from public.profiles where id=p_owner for share;
  delete from private.financial_reset_objects where owner_id=p_owner and request_id=p_request
    and kind=p_kind and storage_ref=p_ref and coalesce(protect_until,'-infinity')<=clock_timestamp();
  if not found then
    update private.financial_reset_objects set next_attempt_at=least(protect_until,clock_timestamp()+interval '30 seconds')
      where owner_id=p_owner and request_id=p_request and kind=p_kind and storage_ref=p_ref;
  end if;
  if exists(select 1 from public.profiles where id=p_owner and status='deleted') then
    delete from private.financial_reset_receipts r where r.owner_id=p_owner and r.request_id=p_request
      and not exists(select 1 from private.financial_reset_objects o where o.owner_id=r.owner_id and o.request_id=r.request_id);
  end if;
end $$;

-- The existing deletion protocol keeps the profile tombstone. Only still due
-- storage instructions need to survive that transition; completion retires them.
create function private.retire_deleted_owner_reset_receipts() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  delete from private.financial_reset_epochs where owner_id=new.id;
  delete from private.financial_reset_receipts r where r.owner_id=new.id
    and not exists(select 1 from private.financial_reset_objects o where o.owner_id=r.owner_id and o.request_id=r.request_id);
  return new;
end $$;
revoke all on function private.retire_deleted_owner_reset_receipts() from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;
create trigger retire_deleted_owner_reset_receipts after update of status on public.profiles for each row
  when(new.status='deleted' and old.status is distinct from new.status)
  execute function private.retire_deleted_owner_reset_receipts();

create function private.financial_notification_type(p_type text) returns boolean
language sql immutable set search_path='' as $$
  select p_type ~ '^(transaction|transfer|balance|ledger|planning|salary|budget|obligation|savings|report|voice|assistant|import|unsupported|tracking|credit_card)[.]'
    or p_type in ('account.credit_card_payment_due','ai.budget_threshold.v1','export.ready',
    'reminder.financial_inactive.7d','reminder.first_transaction.1d')
$$;
create function private.allow_financial_notification(p_owner text,p_occurred_at timestamptz) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles where id=p_owner and status='active' for share;
  if not found or p_occurred_at is null then return false; end if;
  perform 1 from private.financial_reset_epochs where owner_id=p_owner for share;
  return not exists(select 1 from private.financial_reset_receipts where owner_id=p_owner and reset_at>=p_occurred_at);
end $$;
revoke all on function private.financial_notification_type(text),private.allow_financial_notification(text,timestamptz)
  from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;
grant execute on function private.allow_financial_notification(text,timestamptz) to masarifi_worker;

create function private.allow_balance_reconciliation(p_account uuid,p_ledger_version bigint,p_observed_at timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_key text;
begin
  select a.user_id into owner_key from public.accounts a where a.id=p_account;
  if owner_key is null or not private.allow_financial_notification(owner_key,p_observed_at) then return false; end if;
  perform 1 from public.account_balances b where b.account_id=p_account and b.ledger_version=p_ledger_version for share;
  return found;
end $$;
revoke all on function private.allow_balance_reconciliation(uuid,bigint,timestamptz)
  from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;
grant execute on function private.allow_balance_reconciliation(uuid,bigint,timestamptz) to masarifi_worker;

-- Finance-only idempotency records contain replayable payload and resource IDs.
create function private.financial_reset_scope(p_scope text) returns boolean
language sql immutable set search_path='' as $$
  select p_scope ~ '^(ledger|planning|reference|reports?|tracking|ai|assistant|voice|sync)[.]'
    and p_scope !~ '(consent|preferences|keyword-rule|sender-rule|installation)'
$$;
-- Reserve a durable cleanup row BEFORE an object PUT. The existing registration
-- function attaches this same row to the import, and ordinary retention workers
-- purge unregistered uploads after the bounded upload window.
alter table private.raw_ingestion_payloads add column upload_protect_until timestamptz;
create function private.tracking_upload_prefix(p_owner text) returns text
language sql immutable set search_path='' as $$
  select 'tracking/'||substr(h,1,8)||'-'||substr(h,9,4)||'-4'||substr(h,14,3)||'-8'||substr(h,18,3)||'-'||substr(h,21,12)||'/'
  from (select encode(extensions.digest(p_owner,'sha256'),'hex') h) d
$$;
create function private.reserve_tracking_upload(p_owner text,p_ref text,p_hash text,p_content_type text,p_bytes bigint)
returns void language plpgsql security definer set search_path='' as $$
declare active_generation bigint; horizon timestamptz:=clock_timestamp()+interval '2 minutes';
begin
  perform private.assert_active_profile(p_owner);
  select generation into strict active_generation from private.financial_reset_epochs where owner_id=p_owner for share;
  if active_generation>0 and nullif(current_setting('masarifi.financial_generation',true),'') is null then
    raise exception using errcode='40001',message='FINANCIAL_CLIENT_UPDATE_REQUIRED'; end if;
  if coalesce(nullif(current_setting('masarifi.financial_generation',true),''),'0')<>active_generation::text then
    raise exception using errcode='40001',message='FINANCIAL_GENERATION_STALE'; end if;
  if p_ref is null or not starts_with(p_ref,private.tracking_upload_prefix(p_owner)) then
    raise exception using errcode='22023',message='RAW_PAYLOAD_INVALID'; end if;
  insert into private.raw_ingestion_payloads(storage_ref,payload_hash,content_type,size_bytes,scan_status,expires_at,upload_protect_until)
    values(p_ref,p_hash,p_content_type,p_bytes,'cleanup',horizon,horizon)
    on conflict(storage_ref) do update set expires_at=greatest(private.raw_ingestion_payloads.expires_at,horizon),
      upload_protect_until=horizon
    where private.raw_ingestion_payloads.scan_status in ('clean','cleanup')
      and private.raw_ingestion_payloads.payload_hash=p_hash and private.raw_ingestion_payloads.content_type=p_content_type
      and private.raw_ingestion_payloads.size_bytes=p_bytes;
  if not found then raise exception using errcode='40001',message='RAW_UPLOAD_BUSY'; end if;
end $$;
revoke all on function private.reserve_tracking_upload(text,text,text,text,bigint),private.tracking_upload_prefix(text)
  from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;
grant execute on function private.reserve_tracking_upload(text,text,text,text,bigint) to masarifi_api;

-- An identity-only privacy package contains profile, preferences, onboarding,
-- and devices. An export containing another domain can include financial data.
create function private.financial_export_scope(p_scope jsonb) returns boolean
language sql immutable set search_path='' as $$
  select exists(select 1 from jsonb_array_elements_text(p_scope) x(entry) where split_part(entry,'@',1)<>'identity')
$$;
revoke all on function private.financial_export_scope(jsonb) from public,anon,authenticated,service_role,masarifi_api,masarifi_worker;

create function private.reset_financial_data(p_owner text,p_request uuid)
returns table(generation bigint,reset_at timestamptz,request_id uuid,cleanup_pending boolean)
language plpgsql security definer set search_path='' as $$
declare previous bigint; item regclass; resource record; attempt uuid; cutoff timestamptz;
  ledger_setting text:=current_setting('masarifi.ledger_command',true);
begin
  if p_owner is null or p_request is null or p_owner is distinct from public.current_clerk_user_id() then
    raise exception using errcode='28000',message='AUTH_TOKEN_INVALID'; end if;
  perform 1 from public.profiles where id=p_owner and status='active' for update;
  if not found then raise exception using errcode='42501',message='PROFILE_INACTIVE'; end if;
  if exists(select 1 from private.financial_reset_receipts r where r.owner_id=p_owner and r.request_id=p_request) then
    return query select * from private.financial_reset_receipt(p_owner,p_request);
    return;
  end if;
  select e.generation into strict previous from private.financial_reset_epochs e where e.owner_id=p_owner for update;
  if previous>0 and nullif(current_setting('masarifi.financial_generation',true),'') is null then
    raise exception using errcode='40001',message='FINANCIAL_CLIENT_UPDATE_REQUIRED'; end if;
  if coalesce(nullif(current_setting('masarifi.financial_generation',true),''),'0')<>previous::text then
    raise exception using errcode='40001',message='FINANCIAL_GENERATION_STALE'; end if;
  if exists(select 1 from private.financial_reset_objects where owner_id=p_owner) then
    raise exception using errcode='55000',message='FINANCIAL_RESET_CLEANUP_PENDING'; end if;
  cutoff:=clock_timestamp();
  update private.financial_reset_epochs set generation=previous+1 where owner_id=p_owner;
  insert into private.financial_reset_receipts values(p_owner,p_request,previous+1,cutoff);
  insert into private.financial_reset_context values(txid_current(),p_owner,p_request);
  -- Index lookup by aggregate_id also covers old events whose payload has no owner field.
  for resource in select * from (values
    ('public.transactions','transaction'),('public.categories','category'),
    ('public.salary_profiles','salary-profile'),('public.salary_receipts','salary-receipt'),
    ('public.budgets','budget'),('public.budget_categories','budget-category'),
    ('public.obligations','obligation'),('public.obligation_schedule_items','obligation-schedule'),
    ('public.obligation_payments','obligation-payment'),('public.obligation_payment_allocations','payment-allocation'),
    ('public.payment_matches','payment-match'),('public.savings_goals','savings-goal'),
    ('public.savings_goal_movements','savings-movement'),('public.voice_sessions','voice-session'),
    ('public.voice_proposals','voice-proposal'),('public.voice_transcripts','voice-transcript'),
    ('public.voice_proposal_fields','voice-field'),('public.assistant_conversations','assistant-conversation'),
    ('public.assistant_messages','assistant-message'),('public.assistant_response_snapshots','assistant-snapshot'),
    ('public.assistant_feedback','assistant-feedback'),('public.assistant_action_previews','assistant-action'),
    ('public.financial_insights','financial-insight'),('public.import_sessions','import-session'),
    ('public.import_items','import-item'),('public.unsupported_formats','unsupported-format'),('public.review_items','review-item'),
    ('public.duplicate_candidates','duplicate-candidate'),('public.tracking_history','tracking-history'),
    ('public.tracking_feedback','tracking-feedback'),('public.client_mutations','client-mutation'),
    ('public.transaction_conflicts','transaction-conflict'),('public.report_schedules','report-schedule'),
    ('private.report_output_attempts','report-attempt'),('public.ai_response_reports','ai-response-report')
  ) as v(tbl,kind) loop
    execute format('insert into private.financial_reset_resources select txid_current(),id,$2 from %s where user_id=$1 on conflict do nothing',resource.tbl::regclass)
      using p_owner,resource.kind;
  end loop;
  insert into private.financial_reset_resources select txid_current(),id,'privacy-export' from private.privacy_export_requests
    where user_id=p_owner and private.financial_export_scope(scope) on conflict do nothing;
  if exists(select 1 from private.retention_holds h where h.starts_at<=cutoff and (h.ends_at is null or h.ends_at>cutoff)
    and (h.resource_id=p_owner or exists(select 1 from public.accounts a where a.user_id=p_owner and a.id::text=h.resource_id)
      or exists(select 1 from private.financial_reset_resources r
      where r.xid=txid_current() and r.resource_id::text=h.resource_id))) then
    raise exception using errcode='55000',message='FINANCIAL_RESET_ACTIVE_HOLD'; end if;
  if exists(select 1 from private.privacy_export_requests e where e.user_id=p_owner and e.status='processing' and private.financial_export_scope(e.scope)) then
    raise exception using errcode='55000',message='FINANCIAL_RESET_WORK_BUSY'; end if;
  for attempt in select a.id from private.report_output_attempts a where a.user_id=p_owner order by a.id loop
    if not pg_try_advisory_xact_lock(hashtextextended(attempt::text,0))
      or not pg_try_advisory_xact_lock(hashtextextended(attempt::text,1)) then
      raise exception using errcode='55000',message='FINANCIAL_RESET_WORK_BUSY'; end if;
  end loop;
  insert into private.financial_reset_objects(owner_id,request_id,kind,storage_ref,protect_until)
    select p_owner,p_request,'voice',s.storage_ref,greatest(s.media_capability_expires_at,s.upload_lease_until)+interval '1 minute'
      from public.voice_sessions s where s.user_id=p_owner and s.storage_ref is not null
    union all select p_owner,p_request,'tracking',r.storage_ref,r.upload_protect_until from private.raw_ingestion_payloads r
      left join public.import_sessions s on s.id=r.session_id where r.storage_ref is not null and
      (s.user_id=p_owner or (r.session_id is null and starts_with(r.storage_ref,private.tracking_upload_prefix(p_owner))))
    union all select p_owner,p_request,'report',coalesce(a.storage_ref,'reports/'||encode(extensions.digest(p_owner,'sha256'),'hex')
      ||'/'||a.id||'.'||(a.snapshot->>'format')),null from private.report_output_attempts a
      where a.user_id=p_owner and (a.storage_ref is not null or a.snapshot->>'format' in ('pdf','csv','json'))
    union all select p_owner,p_request,'export',coalesce(e.storage_ref,'exports/'||e.id||'/privacy.zip'),null
      from private.privacy_export_requests e where e.user_id=p_owner and private.financial_export_scope(e.scope);

  delete from private.raw_ingestion_payloads r where r.session_id is null and starts_with(r.storage_ref,private.tracking_upload_prefix(p_owner));
  delete from private.privacy_export_requests e where e.user_id=p_owner and private.financial_export_scope(e.scope);
  delete from private.planning_job_claims j using private.financial_reset_resources r
    where r.xid=txid_current() and j.resource_id=r.resource_id and r.resource_type=case j.job_name
      when 'planning.salary-cycle.generate' then 'salary-profile' when 'planning.obligation-schedule.generate' then 'obligation'
      when 'planning.payment-match.propose' then 'transaction' when 'planning.overdue.mark' then 'obligation-schedule'
      when 'planning.reminders.emit' then 'obligation-schedule' end;
  delete from private.outbox_events o where exists(select 1 from private.financial_reset_resources r
      where r.xid=txid_current() and r.resource_id=o.aggregate_id
      and r.resource_type=case when o.aggregate_type='ai-action' then case when o.event_type like 'voice.%' then 'voice-proposal'
          when o.event_type like 'assistant.%' then 'assistant-action' end
        when o.aggregate_type='ai-work' then case o.payload->>'workKind' when 'voice' then 'voice-session'
          when 'assistant' then 'assistant-message' end else replace(o.aggregate_type,'_','-') end)
    or (coalesce(o.payload#>>'{sync,userId}',o.payload->>'userId')=p_owner and
      (o.payload#>>'{sync,domain}' in ('transactions','categories','planning') or
       private.financial_notification_type(o.event_type)
       and o.event_type !~ '(consent|preference|rule|installation)'));
  delete from private.notification_deliveries d using public.notification_events e
    where d.event_id=e.id and d.user_id=p_owner and e.user_id=p_owner and
      private.financial_notification_type(e.type);
  delete from public.notification_events e where e.user_id=p_owner and
    private.financial_notification_type(e.type);
  delete from private.idempotency_keys where actor_id=p_owner and private.financial_reset_scope(scope);
  delete from private.voice_provider_attempts a using public.voice_sessions s where a.session_id=s.id and s.user_id=p_owner;
  delete from private.staging_voice_members where user_id=p_owner;
  foreach item in array array['private.report_output_attempts','public.report_schedules',
    'public.assistant_conversations','public.voice_sessions','public.financial_insights',
    'public.tracking_feedback','public.tracking_history','private.tracking_capture_reservations','public.import_sessions',
    'private.planning_reminder_intents','public.transaction_conflicts','public.client_sync_state','public.client_mutations',
    'public.obligation_payment_allocations','public.payment_matches','public.savings_goal_movements',
    'public.obligation_payments','public.obligation_schedule_items','public.salary_receipts','public.salary_profiles',
    'public.budget_categories','public.budgets','public.obligations','public.savings_goals']::regclass[] loop
    execute format('delete from %s where user_id=$1',item) using p_owner;
  end loop;
  delete from audit.transaction_revisions r using public.transactions t where r.transaction_id=t.id and t.user_id=p_owner;
  delete from public.transaction_postings p using public.transactions t where p.transaction_id=t.id and t.user_id=p_owner;
  delete from public.transactions where user_id=p_owner;
  -- Keep classification rules and preferences that refer to global categories.
  update public.user_keyword_rules k set category_id=null where k.user_id=p_owner
    and exists(select 1 from public.categories c where c.id=k.category_id and c.user_id=p_owner);
  delete from public.category_rules k using public.categories c where k.user_id=p_owner and c.user_id=p_owner and k.category_id=c.id;
  delete from public.voice_category_preferences k using public.categories c where k.user_id=p_owner and c.user_id=p_owner and k.category_id=c.id;
  delete from public.categories where user_id=p_owner;
  perform set_config('masarifi.ledger_command','on',true);
  insert into public.account_balances(account_id,confirmed_minor,pending_minor,reconciled_at)
    select id,0,0,cutoff from public.accounts where user_id=p_owner
    on conflict(account_id) do update set confirmed_minor=0,pending_minor=0,
      ledger_version=public.account_balances.ledger_version+1,reconciled_at=cutoff,updated_at=cutoff;
  perform set_config('masarifi.ledger_command',coalesce(ledger_setting,''),true);
  delete from private.financial_reset_context where xid=txid_current();
  return query select * from private.financial_reset_receipt(p_owner,p_request);
end $$;

-- The lock survives through worker commit. Source roots are erased on reset,
-- so lookup after acquiring the profile lock also rejects claims seen earlier.
create function private.bind_financial_worker_generation(p_kind text,p_id uuid,p_token uuid)
returns bigint language plpgsql security definer set search_path='' as $$
declare owner_key text; current_gen bigint; j private.planning_job_claims;
begin
  case p_kind
  when 'import' then
    select user_id into owner_key from public.import_sessions where id=p_id and claim_token=p_token and lease_until>clock_timestamp() for share;
  when 'sync' then
    select user_id into owner_key from public.client_mutations where id=p_id and lease_token=p_token and locked_until>clock_timestamp() for share;
  when 'assistant' then
    select user_id into owner_key from private.assistant_agent_jobs where id=p_id and claim_token=p_token and lease_until>clock_timestamp() for share;
    if owner_key is null then
      select user_id into owner_key from public.assistant_messages where id=p_id and claim_token=p_token and lease_until>clock_timestamp() for share;
    end if;
  when 'voice' then
    select user_id into owner_key from public.voice_sessions where id=p_id and claim_token=p_token and lease_until>clock_timestamp() for share;
  when 'voice-batch' then
    select user_id into owner_key from private.voice_batches where id=p_id and lease_token=p_token and lease_until>clock_timestamp() for share;
  when 'planning' then
    select * into j from private.planning_job_claims where id=p_id and lease_token=p_token and locked_until>clock_timestamp() for share;
    case j.job_name
      when 'planning.salary-cycle.generate' then select user_id into owner_key from public.salary_profiles where id=j.resource_id for share;
      when 'planning.obligation-schedule.generate' then select user_id into owner_key from public.obligations where id=j.resource_id for share;
      when 'planning.payment-match.propose' then select user_id into owner_key from public.transactions where id=j.resource_id for share;
      when 'planning.overdue.mark','planning.reminders.emit' then select user_id into owner_key from public.obligation_schedule_items where id=j.resource_id for share;
      else owner_key:=null;
    end case;
  when 'report' then
    select user_id into owner_key from private.report_output_attempts where id=p_id for share;
  when 'report-schedule' then
    select user_id into owner_key from public.report_schedules where id=p_id for share;
  else raise exception using errcode='22023',message='FINANCIAL_WORK_KIND_INVALID';
  end case;
  if owner_key is null then raise exception using errcode='40001',message='FINANCIAL_GENERATION_STALE'; end if;
  perform 1 from public.profiles where id=owner_key and status='active' for share;
  if not found then raise exception using errcode='42501',message='PROFILE_INACTIVE'; end if;
  select generation into strict current_gen from private.financial_reset_epochs where owner_id=owner_key for share;
  perform set_config('masarifi.financial_generation',current_gen::text,true);
  return current_gen;
end $$;

-- The checkout header is optional only until the owner's first reset. Workers
-- claiming persisted rows can prove freshness from a row the reset would delete.
create function private.fence_financial_generation() returns trigger
language plpgsql security definer set search_path='' as $$
declare row_data record; owner_key text; req text; current_generation bigint;
  worker boolean:=current_setting('role',true)='masarifi_worker'; live_source boolean:=false;
begin
  if tg_op='DELETE' then row_data:=old; else row_data:=new; end if;
  if tg_table_name='idempotency_keys' then
    if private.financial_reset_scope(row_data.scope) then owner_key:=row_data.actor_id; end if;
  elsif tg_table_name in ('transaction_postings','account_balances') then
    select a.user_id into owner_key from public.accounts a where a.id=row_data.account_id;
  elsif tg_table_schema='audit' and tg_table_name='transaction_revisions' then
    select t.user_id into owner_key from public.transactions t where t.id=row_data.transaction_id;
  else owner_key:=row_data.user_id; end if;
  if owner_key is not null then
    -- Frozen owners remain subject to the separately verified account erasure protocol.
    perform 1 from public.profiles where id=owner_key and status='active' for share;
    if found and not private.financial_reset_active(owner_key) then
      select e.generation into strict current_generation from private.financial_reset_epochs e where e.owner_id=owner_key for share;
      req:=nullif(current_setting('masarifi.financial_generation',true),'');
      if req is null and worker and current_generation>0 then
        -- Lease-claim UPDATE/maintenance targets a persisted post-reset row.
        if tg_op='UPDATE' and tg_table_name in ('import_sessions','import_items','assistant_messages','assistant_agent_jobs',
          'voice_sessions','voice_batches','voice_events','client_mutations','report_output_attempts','report_schedules',
          'salary_receipts','obligation_schedule_items','financial_insights') then
          live_source:=true;
        elsif tg_op='INSERT' then
          case tg_table_name
          when 'financial_insights' then select exists(select 1 from public.budgets b where b.user_id=owner_key and row_data.signal_key='budget:'||b.id::text||':85') into live_source;
          when 'salary_receipts' then select exists(select 1 from public.salary_profiles where user_id=owner_key and id=row_data.salary_profile_id) into live_source;
          when 'obligation_schedule_items','payment_matches' then select exists(select 1 from public.obligations where user_id=owner_key and id=row_data.obligation_id) into live_source;
          when 'report_output_attempts' then select exists(select 1 from public.report_schedules where user_id=owner_key and id=row_data.schedule_id) into live_source;
          when 'import_items' then select exists(select 1 from public.import_sessions where user_id=owner_key and id=row_data.session_id) into live_source;
          when 'voice_transcripts','voice_proposals','voice_batches','voice_batch_context' then select exists(select 1 from public.voice_sessions where user_id=owner_key and id=row_data.session_id) into live_source;
          when 'assistant_response_snapshots','assistant_action_previews' then select exists(select 1 from public.assistant_messages where user_id=owner_key and id=row_data.message_id) into live_source;
          else live_source:=false;
          end case;
        end if;
      end if;
      if current_generation>0 and req is null and not worker then
        raise exception using errcode='40001',message='FINANCIAL_CLIENT_UPDATE_REQUIRED'; end if;
      if coalesce(req,'0')<>current_generation::text and not live_source then
        raise exception using errcode='40001',message='FINANCIAL_GENERATION_STALE'; end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

do $$ declare item regclass; begin
  foreach item in array array['public.accounts','public.categories','public.transactions','public.transaction_postings',
    'audit.transaction_revisions','public.account_balances','public.salary_profiles','public.salary_receipts','public.budgets',
    'public.budget_categories','public.obligations','public.obligation_schedule_items','public.obligation_payments',
    'public.obligation_payment_allocations','public.payment_matches','public.savings_goals','public.savings_goal_movements',
    'public.client_mutations','public.transaction_conflicts','public.client_sync_state','public.import_sessions','public.import_items',
    'public.review_items','public.duplicate_candidates','public.tracking_history','public.tracking_feedback','public.unsupported_formats',
    'public.voice_sessions','public.voice_transcripts','public.voice_proposals','public.voice_proposal_fields','public.assistant_conversations',
    'public.assistant_messages','public.assistant_response_snapshots','public.assistant_action_previews','public.assistant_feedback',
    'public.financial_insights','public.report_schedules','private.report_output_attempts','private.assistant_agent_jobs',
    'private.voice_batch_context','private.voice_batches','private.voice_events','private.voice_event_commands',
    'private.planning_reminder_intents','private.tracking_capture_reservations','private.idempotency_keys']::regclass[] loop
    execute format('create trigger financial_generation_fence before insert or update or delete on %s for each row execute function private.fence_financial_generation()',item);
  end loop;
end $$;

do $$ declare sig text; begin
  foreach sig in array array['private.financial_reset_active(text)','private.financial_reset_ledger_delete(uuid,uuid)',
    'private.financial_reset_scope(text)','private.financial_reset_state(text)','private.financial_reset_receipt(text,uuid)',
    'private.reset_financial_data(text,uuid)',
    'private.complete_financial_reset_object(text,uuid,text,text)','private.list_pending_financial_reset_objects(integer,text)',
    'private.bind_financial_worker_generation(text,uuid,uuid)','private.fence_financial_generation()'] loop
    execute 'revoke all on function '||sig||' from public,anon,authenticated,service_role,masarifi_api,masarifi_worker';
  end loop;
end $$;
grant execute on function private.financial_reset_state(text),private.financial_reset_receipt(text,uuid),
  private.reset_financial_data(text,uuid) to masarifi_api;
grant execute on function private.complete_financial_reset_object(text,uuid,text,text) to masarifi_worker;
grant execute on function private.list_pending_financial_reset_objects(integer,text),
  private.bind_financial_worker_generation(text,uuid,uuid) to masarifi_worker;
-- Trigger WHEN predicates run with the invoking role. They expose only the presence
-- of the current transaction's migration-owned reset context.
grant execute on function private.financial_reset_active(text),private.financial_reset_ledger_delete(uuid,uuid)
  to masarifi_api,masarifi_worker;
select private.register_job('privacy.financial-reset-cleanup',4::smallint,'privacy.financial-reset-cleanup',
  '{"kind":"interval","everySeconds":15,"timezone":"UTC"}'::jsonb,true,60,5::smallint,'{}'::jsonb,true,false);
reset role;
do $role$
begin
  if current_setting('masarifi.financial_reset_grant') = 'temporary' then
    execute format('revoke masarifi_migration from %I granted by %I', current_user, current_user);
  end if;
end
$role$;
