grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

alter table public.voice_sessions drop constraint voice_sessions_contract_version_check;
alter table public.voice_sessions add constraint voice_sessions_contract_version_check check(contract_version in (1,2,3));
create table private.voice_automatic_policy (
  singleton boolean primary key default true check(singleton), enabled boolean not null default false
);
insert into private.voice_automatic_policy(singleton) values(true);
create unique index if not exists accounts_voice_owner_identity_uq on public.accounts(id,user_id);
create table private.voice_batch_context (
  session_id uuid primary key, user_id text not null,
  default_account_id uuid, auth_expires_at timestamptz, thresholds jsonb not null,
  foreign key(session_id,user_id) references public.voice_sessions(id,user_id) on delete cascade,
  foreign key(default_account_id,user_id) references public.accounts(id,user_id) on delete set null(default_account_id)
);
create table private.voice_batches (
  id uuid primary key default extensions.gen_random_uuid(), session_id uuid not null unique,
  user_id text not null, policy_version text not null check(policy_version='automatic-or-skip-v3.1'),
  schema_version integer not null default 3 check(schema_version=3),
  status text not null default 'finalizing' check(status in ('finalizing','completed','cancelled','failed')),
  accepted_at timestamptz not null default clock_timestamp(), completed_at timestamptz,
  lease_token uuid, lease_until timestamptz, next_attempt_at timestamptz not null default clock_timestamp(),
  attempt_count integer not null default 0,
  unique(id,user_id), foreign key(session_id,user_id) references public.voice_sessions(id,user_id) on delete cascade
);
create table private.voice_events (
  id uuid primary key default extensions.gen_random_uuid(), batch_id uuid not null, user_id text not null,
  ordinal smallint not null check(ordinal between 0 and 4),
  status text not null check(status in ('eligible','committed','skipped','cancelled','execution_failed')),
  reason_code text check(reason_code in ('missing_amount','ambiguous_account','invalid_category','invalid_date','currency_mismatch','unsupported_event','authorization_required','invalid_event')),
  transaction_id uuid unique, ledger_version bigint,
  attempt_count smallint not null default 0 check(attempt_count between 0 and 5),
  next_attempt_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(), completed_at timestamptz,
  unique(batch_id,ordinal), unique(id,user_id),
  foreign key(batch_id,user_id) references private.voice_batches(id,user_id) on delete cascade,
  foreign key(transaction_id,user_id) references public.transactions(id,user_id),
  check((status='skipped')=(reason_code is not null)),
  check((status='committed')=(transaction_id is not null))
);
create table private.voice_event_commands (
  event_id uuid primary key, user_id text not null, command jsonb not null check(pg_column_size(command)<=4096),
  command_hash text not null, requires_recent_auth boolean not null default false, foreign key(event_id,user_id) references private.voice_events(id,user_id) on delete cascade
);
-- Internal tables have no customer, API or Worker DML grants. All access uses bounded capabilities.
do $$ declare t text; begin
  foreach t in array array['voice_automatic_policy','voice_batch_context','voice_batches','voice_events','voice_event_commands'] loop
    execute format('alter table private.%I enable row level security',t);
    execute format('revoke all on private.%I from public,anon,authenticated,masarifi_api,masarifi_worker',t);
  end loop;
end $$;

create function private.create_voice_session_v3(p_user text,p_input jsonb,p_operation uuid,p_seconds integer,p_auth_age integer,p_max_age integer,p_thresholds jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; sid uuid; default_id uuid;
begin
  perform private.ai_assert_owner(p_user);
  if not (select enabled from private.voice_automatic_policy) then raise exception 'VOICE_AUTOMATIC_UNAVAILABLE'; end if;
  if p_max_age not between 60 and 3600 or jsonb_typeof(p_thresholds)<>'object' then raise exception 'VOICE_AUTH_INVALID'; end if;
  result:=private.create_voice_session_v2(p_user,p_input,p_operation,p_seconds); sid:=(result->>'id')::uuid;
  select id into default_id from public.accounts where user_id=p_user and is_default and status='active' and deleted_at is null;
  insert into private.voice_batch_context(session_id,user_id,default_account_id,auth_expires_at,thresholds)
    values(sid,p_user,default_id,case when p_auth_age>=0 then clock_timestamp()+make_interval(secs=>p_max_age-p_auth_age) else null end,p_thresholds)
    on conflict(session_id) do nothing;
  update public.voice_sessions set contract_version=3 where id=sid;
  select to_jsonb(s) into result from public.voice_sessions s where id=sid;
  return result;
end $$;

create function private.get_voice_batch_result(p_user text,p_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.voice_sessions; b private.voice_batches; ids jsonb; lv bigint; state text;
begin
  perform private.ai_assert_owner(p_user);
  select * into s from public.voice_sessions where id=p_session and user_id=p_user and contract_version=3 and deleted_at is null;
  if not found then raise exception 'VOICE_SESSION_NOT_FOUND'; end if;
  select * into b from private.voice_batches where session_id=s.id;
  select coalesce(jsonb_agg(e.transaction_id order by ordinal),'[]'),coalesce(max(e.ledger_version),0) into ids,lv
    from private.voice_events e where e.batch_id=b.id and e.status='committed';
  state:=coalesce(b.status,case when s.expires_at<=clock_timestamp() or (s.uploaded_at is null and s.upload_deadline<=clock_timestamp()) then 'failed' when s.cancelled_at is not null then 'cancelled' when s.status in ('failed','expired') then 'failed' when s.finalized_at is null then 'uploading' when s.status='processing' then 'analyzing' else 'queued' end);
  return jsonb_build_object('sessionId',s.id,'batchId',b.id,'status',state,'transactionIds',ids,'addedCount',jsonb_array_length(ids),'ledgerVersion',lv);
end $$;
create function private.list_voice_batch_recovery(p_user text,p_after timestamptz,p_after_id uuid,p_limit integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare items jsonb;
begin
  perform private.ai_assert_owner(p_user);
  if p_limit not between 1 and 100 then raise exception 'VOICE_LIMIT_INVALID'; end if;
  select coalesce(jsonb_agg(private.get_voice_batch_result(p_user,s.id)||jsonb_build_object('createdAt',s.created_at) order by s.created_at,s.id),'[]') into items
    from (select * from public.voice_sessions s where user_id=p_user and contract_version=3 and deleted_at is null
      and (created_at>=clock_timestamp()-interval '7 days' or exists(select 1 from private.voice_batches b where b.session_id=s.id and b.status='finalizing'))
      and (p_after is null or (created_at,id)>(p_after,p_after_id)) order by created_at,id limit p_limit) s;
  return jsonb_build_object('items',items);
end $$;

-- Defence in depth at the narrow Worker capability, independently of TypeScript normalization.
create function private.voice_command_skip_reason(cmd jsonb,expected_external text) returns text
language plpgsql set search_path='' as $$
declare occurrence timestamptz;
begin
  if not coalesce(jsonb_typeof(cmd)='object'
    and cmd ?& array['kind','amountMinor','currency','accountId','categoryId','title','merchant','paymentMethod','note','occurredAt','source','externalRef']
    and (cmd-array['kind','amountMinor','currency','accountId','categoryId','title','merchant','paymentMethod','note','occurredAt','source','externalRef'])='{}'::jsonb
    and cmd->>'kind' in ('expense','income') and cmd->>'source'='voice'
    and jsonb_typeof(cmd->'amountMinor')='number' and cmd->>'amountMinor' ~ '^[1-9][0-9]{0,15}$'
    and (cmd->>'amountMinor')::numeric<=9007199254740991
    and cmd->>'currency' ~ '^[A-Z]{3}$'
    and cmd->>'accountId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and (cmd->'categoryId'='null'::jsonb or cmd->>'categoryId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
    and cmd->'note'='null'::jsonb and cmd->'paymentMethod'='null'::jsonb
    and jsonb_typeof(cmd->'title')='string' and private.ledger_safe_text(cmd->>'title',1,40)
    and (cmd->'merchant'='null'::jsonb or (jsonb_typeof(cmd->'merchant')='string' and private.ledger_safe_text(cmd->>'merchant',1,40)))
    and cmd::text !~ U&'[\202A-\202E\2066-\2069]'
    and (cmd->>'externalRef') is not distinct from expected_external,false) then return 'invalid_event'; end if;
  begin
    if not coalesce(jsonb_typeof(cmd->'occurredAt')='string' and cmd->>'occurredAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$',false) then return 'invalid_date'; end if;
    occurrence:=(cmd->>'occurredAt')::timestamptz;
    if occurrence is null or occurrence<'1900-01-01T00:00:00Z'::timestamptz or occurrence>clock_timestamp()+interval '5 minutes' then return 'invalid_date'; end if;
  exception when invalid_datetime_format or datetime_field_overflow then return 'invalid_date'; end;
  return null;
exception when invalid_text_representation or numeric_value_out_of_range then return 'invalid_event';
end $$;
revoke all on function private.voice_command_skip_reason(jsonb,text) from public,anon,authenticated,masarifi_api,masarifi_worker;

create function private.accept_voice_batch(p_session uuid,p_token uuid,p_decisions jsonb,p_policy text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.voice_sessions; b private.voice_batches; ctx private.voice_batch_context; decision jsonb; cmd jsonb; eid uuid; ord integer:=0; totals jsonb; currency text; normalized jsonb:='[]'; reason text;
begin
  select * into s from public.voice_sessions where id=p_session and contract_version=3 for update;
  if s.id is null then raise exception 'VOICE_SESSION_NOT_FOUND'; end if;
  if exists(select 1 from private.voice_batches where session_id=s.id) then return jsonb_build_object('accepted',true); end if;
  if s.status<>'processing' or s.claim_token is distinct from p_token or s.lease_until<=clock_timestamp() or s.cancelled_at is not null or s.deleted_at is not null or s.expires_at<=clock_timestamp() then raise exception 'AI_WORK_FENCE_INVALID'; end if;
  if p_policy<>'automatic-or-skip-v3.1' or jsonb_typeof(p_decisions)<>'array' or jsonb_array_length(p_decisions)>5 or pg_column_size(p_decisions)>24000 then raise exception 'AI_SCHEMA_INVALID'; end if;
  for decision in select value from jsonb_array_elements(p_decisions) loop
    if jsonb_typeof(decision)='object' and decision->>'status'='eligible' and (decision-array['status','command'])='{}'::jsonb then
      reason:=private.voice_command_skip_reason(decision->'command',null);
      if reason is not null then decision:=jsonb_build_object('status','skipped','reason',reason); end if;
    elsif not coalesce(jsonb_typeof(decision)='object' and decision->>'status'='skipped' and (decision-array['status','reason'])='{}'::jsonb and decision->>'reason'=any(array['missing_amount','ambiguous_account','invalid_category','invalid_date','currency_mismatch','unsupported_event','authorization_required','invalid_event']),false) then
      decision:=jsonb_build_object('status','skipped','reason','invalid_event');
    end if;
    normalized:=normalized||jsonb_build_array(decision);
  end loop;
  p_decisions:=normalized;
  select * into ctx from private.voice_batch_context where session_id=s.id;
  select coalesce(jsonb_object_agg(x.currency,x.total),'{}') into totals from (
    select d->'command'->>'currency' currency,sum((d->'command'->>'amountMinor')::numeric) total from jsonb_array_elements(p_decisions) d where d->>'status'='eligible' group by 1
  ) x;
  insert into private.voice_batches(session_id,user_id,policy_version) values(s.id,s.user_id,p_policy) returning * into b;
  for decision in select value from jsonb_array_elements(p_decisions) loop
    if decision->>'status'='eligible' then
      cmd:=decision->'command'; currency:=cmd->>'currency';
      if (ctx.thresholds->>currency)::numeric <= (totals->>currency)::numeric and (ctx.auth_expires_at is null or ctx.auth_expires_at<clock_timestamp()) then
        decision:=jsonb_build_object('status','skipped','reason','authorization_required');
      end if;
    end if;
    if decision->>'status'='skipped' then
      if (decision-array['status','reason'])<>'{}'::jsonb then raise exception 'AI_SCHEMA_INVALID'; end if;
      insert into private.voice_events(batch_id,user_id,ordinal,status,reason_code,completed_at) values(b.id,s.user_id,ord,'skipped',decision->>'reason',clock_timestamp());
    elsif decision->>'status'='eligible' then
      if (decision-array['status','command'])<>'{}'::jsonb or jsonb_typeof(cmd)<>'object' or cmd->>'kind' not in ('expense','income') or cmd->>'source'<>'voice' or (cmd->>'amountMinor')::numeric not between 1 and 9007199254740991 then raise exception 'AI_SCHEMA_INVALID'; end if;
      insert into private.voice_events(batch_id,user_id,ordinal,status) values(b.id,s.user_id,ord,'eligible') returning id into eid;
      cmd:=cmd||jsonb_build_object('externalRef','voice-event:'||eid);
      insert into private.voice_event_commands(event_id,user_id,command,command_hash,requires_recent_auth) values(eid,s.user_id,cmd,encode(extensions.digest(cmd::text,'sha256'),'hex'),coalesce((ctx.thresholds->>currency)::numeric <= (totals->>currency)::numeric,false));
    else raise exception 'AI_SCHEMA_INVALID'; end if;
    ord:=ord+1;
  end loop;
  update public.voice_sessions set status='proposed',claim_token=null,claimed_by=null,lease_until=null where id=s.id;
  if not exists(select 1 from private.voice_events where batch_id=b.id and status='eligible') then
    update private.voice_batches set status='completed',completed_at=clock_timestamp() where id=b.id;
    update public.voice_sessions set status='confirmed',confirmed_at=clock_timestamp() where id=s.id;
  end if;
  return jsonb_build_object('accepted',true,'batchId',b.id);
end $$;

create function private.purge_expired_voice_commands(p_limit integer) returns integer
language plpgsql security definer set search_path='' as $$
declare candidate record; expired boolean; removed integer:=0;
begin
  if p_limit not between 1 and 25 then raise exception 'VOICE_LIMIT_INVALID'; end if;
  for candidate in select s.id,s.user_id,b.id batch_id from public.voice_sessions s join private.voice_batches b on b.session_id=s.id
    where s.expires_at<=clock_timestamp() and exists(select 1 from private.voice_events e join private.voice_event_commands c on c.event_id=e.id where e.batch_id=b.id)
    order by s.expires_at,s.id limit p_limit loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(candidate.user_id,0));
    select expires_at<=clock_timestamp() into expired from public.voice_sessions where id=candidate.id for update;
    perform id from private.voice_batches where id=candidate.batch_id for update;
    if expired then
      update private.voice_events set status='execution_failed',completed_at=clock_timestamp() where batch_id=candidate.batch_id and status='eligible';
      delete from private.voice_event_commands where event_id in (select id from private.voice_events where batch_id=candidate.batch_id);
      update private.voice_batches set status='failed',completed_at=clock_timestamp(),lease_token=null,lease_until=null where id=candidate.batch_id and status='finalizing';
      update public.voice_sessions set status='failed',failure_code='VOICE_SESSION_EXPIRED' where id=candidate.id and status not in ('confirmed','failed','expired');
      removed:=removed+1;
    end if;
  end loop;
  return removed;
end $$;

create function private.claim_voice_finalization(p_limit integer) returns table(batch_id uuid,token uuid)
language plpgsql security definer set search_path='' as $$
begin
  if p_limit not between 1 and 25 then raise exception 'VOICE_LIMIT_INVALID'; end if;
  if not (select enabled from private.voice_automatic_policy) then return; end if;
  return query with pending as (select id from private.voice_batches where status='finalizing' and next_attempt_at<=clock_timestamp() and (lease_until is null or lease_until<=clock_timestamp()) order by next_attempt_at,id for update skip locked limit p_limit)
    update private.voice_batches b set lease_token=extensions.gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes' from pending p where b.id=p.id returning b.id,b.lease_token;
end $$;
create function private.list_voice_finalization_events(p_batch uuid,p_token uuid) returns jsonb
language sql security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('eventId',e.id) order by e.ordinal),'[]'::jsonb)
    from private.voice_events e join private.voice_batches b on b.id=e.batch_id
    where b.id=p_batch and b.lease_token=p_token and b.lease_until>clock_timestamp() and b.status='finalizing' and e.status='eligible' and e.next_attempt_at<=clock_timestamp()
$$;

create function private.execute_voice_event(p_batch uuid,p_token uuid,p_event uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
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
end $$;

create function private.retry_voice_event(p_batch uuid,p_token uuid,p_event uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare b private.voice_batches; attempts integer;
begin
  select * into b from private.voice_batches where id=p_batch and lease_token=p_token
    and lease_until>clock_timestamp() and status='finalizing' for update;
  if not found or not (select enabled from private.voice_automatic_policy) then return false; end if;
  update private.voice_events set attempt_count=attempt_count+1,next_attempt_at=clock_timestamp()+interval '30 seconds',
    status=case when attempt_count+1>=5 then 'execution_failed' else 'eligible' end,
    completed_at=case when attempt_count+1>=5 then clock_timestamp() else null end
    where id=p_event and batch_id=b.id and status='eligible' returning attempt_count into attempts;
  if attempts>=5 then delete from private.voice_event_commands where event_id=p_event; end if;
  if not exists(select 1 from private.voice_events where batch_id=b.id and status='eligible') then
    update private.voice_batches set status='failed',completed_at=clock_timestamp(),lease_token=null,lease_until=null where id=b.id;
    update public.voice_sessions set status='failed',failure_code='VOICE_FINALIZATION_FAILED' where id=b.session_id;
  end if;
  return attempts is not null;
end $$;
create function private.retry_voice_finalization(p_batch uuid,p_token uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  if not (select enabled from private.voice_automatic_policy) then
    update private.voice_batches set lease_token=null,lease_until=null where id=p_batch and lease_token=p_token;
    return true;
  end if;
  update private.voice_batches b set attempt_count=attempt_count+1,
    next_attempt_at=coalesce((select min(e.next_attempt_at) from private.voice_events e where e.batch_id=b.id and e.status='eligible'),clock_timestamp()+interval '30 seconds'),
    lease_token=null,lease_until=null where id=p_batch and lease_token=p_token and status='finalizing';
  get diagnostics changed=row_count;
  return changed=1;
end $$;

alter function private.cancel_voice_session(text,uuid) rename to cancel_voice_session_v2;
create function private.cancel_voice_session(p_user text,p_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.voice_sessions; bid uuid;
begin
  perform private.ai_assert_owner(p_user);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user,0));
  select * into s from public.voice_sessions where id=p_session and user_id=p_user and deleted_at is null for update;
  if s.id is null then raise exception 'VOICE_SESSION_NOT_FOUND'; end if;
  if s.contract_version<>3 then return private.cancel_voice_session_v2(p_user,p_session); end if;
  select id into bid from private.voice_batches where session_id=s.id for update;
  if not exists(select 1 from private.voice_batches where id=bid and status='completed') then
    update public.voice_sessions set status='failed',failure_code='VOICE_CANCELLED',cancelled_at=clock_timestamp(),claim_token=null,claimed_by=null,lease_until=null where id=s.id;
    update private.voice_batches set status='cancelled',completed_at=clock_timestamp(),lease_token=null,lease_until=null where id=bid;
    update private.voice_events set status='cancelled',reason_code=null,completed_at=clock_timestamp() where batch_id=bid and status in ('eligible','execution_failed');
    delete from private.voice_event_commands where event_id in (select id from private.voice_events where batch_id=bid and status='cancelled');
  end if;
  return private.get_voice_batch_result(p_user,p_session);
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure signature,p.proname name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('create_voice_session_v3','get_voice_batch_result','list_voice_batch_recovery','accept_voice_batch','purge_expired_voice_commands','claim_voice_finalization','list_voice_finalization_events','execute_voice_event','retry_voice_event','retry_voice_finalization','cancel_voice_session') loop
    execute format('alter function %s owner to masarifi_migration',f.signature);
    execute format('revoke all on function %s from public,anon,authenticated,masarifi_api,masarifi_worker',f.signature);
    execute format('grant execute on function %s to %I',f.signature,case when f.name in ('create_voice_session_v3','get_voice_batch_result','list_voice_batch_recovery','cancel_voice_session') then 'masarifi_api' else 'masarifi_worker' end);
  end loop;
end $$;
create or replace function private.begin_voice_upload(p_user_id text,p_session_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.voice_sessions%rowtype; token uuid:=extensions.gen_random_uuid();
begin
  perform private.ai_assert_owner(p_user_id);
  select * into s from public.voice_sessions where id=p_session_id and user_id=p_user_id and deleted_at is null for update;
  if not found then raise exception using errcode='P0002',message='VOICE_SESSION_NOT_FOUND'; end if;
  if s.contract_version not in (2,3) or s.cancelled_at is not null or s.status in ('expired','failed') then
    raise exception using errcode='40001',message='VOICE_UPLOAD_CONFLICT'; end if;
  if s.uploaded_at is null then
    if s.upload_deadline<=clock_timestamp() or s.expires_at<=clock_timestamp() then
      raise exception using errcode='22023',message='VOICE_UPLOAD_EXPIRED'; end if;
    if s.upload_lease_until>clock_timestamp() then raise exception using errcode='40001',message='VOICE_UPLOAD_IN_PROGRESS'; end if;
    update public.voice_sessions set upload_claim_token=token,
      upload_lease_until=least(clock_timestamp()+interval '1 minute',upload_deadline)
      where id=s.id returning * into s;
  else token:=null; end if;
  return jsonb_build_object('storageRef',s.storage_ref,'contentType',s.content_type,'sizeBytes',s.size_bytes,
    'contentHash',s.content_hash,'uploadToken',token,'completed',s.uploaded_at is not null,'version',s.version);
end $$;
alter function private.begin_voice_upload(text,uuid) owner to masarifi_migration;
revoke all on function private.begin_voice_upload(text,uuid) from public;
grant execute on function private.begin_voice_upload(text,uuid) to masarifi_api;


create or replace function private.finish_voice_upload(p_user_id text,p_session_id uuid,p_token uuid,p_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.voice_sessions%rowtype;
begin
  perform private.ai_assert_owner(p_user_id);
  update public.voice_sessions set uploaded_at=clock_timestamp(),upload_claim_token=null,upload_lease_until=null
    where id=p_session_id and user_id=p_user_id and contract_version in (2,3) and status='uploaded'
      and cancelled_at is null and deleted_at is null and expires_at>clock_timestamp()
      and upload_claim_token=p_token and upload_lease_until>clock_timestamp()
      and upload_deadline>clock_timestamp() and content_hash=p_hash
    returning * into s;
  if not found then raise exception using errcode='40001',message='VOICE_UPLOAD_FENCE_INVALID'; end if;
  return jsonb_build_object('id',s.id,'version',s.version,'contentHash',s.content_hash,'sizeBytes',s.size_bytes);
end $$;
alter function private.finish_voice_upload(text,uuid,uuid,text) owner to masarifi_migration;
revoke all on function private.finish_voice_upload(text,uuid,uuid,text) from public;
grant execute on function private.finish_voice_upload(text,uuid,uuid,text) to masarifi_api;


alter function private.get_ai_work_input(text,uuid,uuid) rename to get_ai_work_input_v2;
create function private.get_ai_work_input(p_kind text,p_id uuid,p_token uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; ctx private.voice_batch_context; version_value integer;
begin
  result:=private.get_ai_work_input_v2(p_kind,p_id,p_token);
  if p_kind='voice.transcribe_extract' then
    select contract_version into version_value from public.voice_sessions where id=p_id;
    if version_value=3 then
      select * into ctx from private.voice_batch_context where session_id=p_id;
      result:=result||jsonb_build_object('contractVersion',3,'defaultAccountId',ctx.default_account_id);
    end if;
  end if;
  return result;
end $$;
alter function private.get_ai_work_input(text,uuid,uuid) owner to masarifi_migration;
revoke all on function private.get_ai_work_input(text,uuid,uuid) from public,anon,authenticated;
grant execute on function private.get_ai_work_input(text,uuid,uuid) to masarifi_worker;

alter function private.save_voice_result(uuid,uuid,text,text,text,numeric,text,jsonb) rename to save_voice_result_v2;
revoke all on function private.save_voice_result_v2(uuid,uuid,text,text,text,numeric,text,jsonb) from masarifi_worker;
create function private.save_voice_result(p_session uuid,p_token uuid,p_provider text,p_model text,p_transcript text,p_confidence numeric,p_language text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.voice_sessions where id=p_session and contract_version=3) then raise exception 'VOICE_CONTRACT_INVALID'; end if;
  return private.save_voice_result_v2(p_session,p_token,p_provider,p_model,p_transcript,p_confidence,p_language,p_payload);
end $$;
alter function private.save_voice_result(uuid,uuid,text,text,text,numeric,text,jsonb) owner to masarifi_migration;
revoke all on function private.save_voice_result(uuid,uuid,text,text,text,numeric,text,jsonb) from public,anon,authenticated;
grant execute on function private.save_voice_result(uuid,uuid,text,text,text,numeric,text,jsonb) to masarifi_worker;

alter function private.get_voice_recovery(text,uuid) rename to get_voice_recovery_v2;
create function private.get_voice_recovery(p_user text,p_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform private.ai_assert_owner(p_user);
  if exists(select 1 from public.voice_sessions where id=p_session and user_id=p_user and contract_version=3) then
    return private.get_voice_batch_result(p_user,p_session)||jsonb_build_object('contractVersion',3);
  end if;
  return private.get_voice_recovery_v2(p_user,p_session);
end $$;
alter function private.get_voice_recovery(text,uuid) owner to masarifi_migration;
revoke all on function private.get_voice_recovery(text,uuid) from public,anon,authenticated;
grant execute on function private.get_voice_recovery(text,uuid) to masarifi_api;

-- No inference is performed by this governed job. The automatic policy gate controls claims.
select private.register_job('voice.finalize',9::smallint,'voice.finalize','{"kind":"interval","everySeconds":10,"timezone":"UTC"}'::jsonb,true,300,8::smallint,'{}'::jsonb,true,false);

-- V3 upload expiry preserves the accepted purge/tombstone capability lifecycle.
create or replace function private.claim_voice_media_purge(p_worker_id text,p_limit integer,p_lease_seconds integer)
returns table(id uuid,storage_ref text,purge_token uuid) language plpgsql security definer set search_path='' as $$
declare claimed integer;
begin
  if p_limit is null or p_limit not between 1 and 100 or p_lease_seconds is null or p_lease_seconds not between 10 and 300
    or p_worker_id is null or char_length(p_worker_id) not between 1 and 128 then
    raise exception using errcode='22023',message='AI_CLAIM_INVALID'; end if;
  return query with due as (
    select s.id from public.voice_sessions s where s.storage_ref is not null and s.next_attempt_at<=clock_timestamp()
      and (s.expires_at<=clock_timestamp() or s.status in ('proposed','confirmed','failed','expired')
        or (s.contract_version in (2,3) and s.uploaded_at is null and s.upload_deadline<=clock_timestamp()))
      and (s.lease_until is null or s.lease_until<=clock_timestamp())
      order by s.next_attempt_at,s.id for update skip locked limit p_limit
  ), updated as (
    update public.voice_sessions s set claim_token=extensions.gen_random_uuid(),claimed_by=p_worker_id,
      lease_until=clock_timestamp()+make_interval(secs=>p_lease_seconds)
      from due where s.id=due.id returning s.id,s.storage_ref,s.claim_token
  ) select u.id,u.storage_ref,u.claim_token from updated u;
  get diagnostics claimed=row_count;
  if claimed<p_limit then
    return query with due as (
      select t.id from private.voice_media_tombstones t where t.next_attempt_at<=clock_timestamp()
        and (t.lease_until is null or t.lease_until<=clock_timestamp())
        order by t.next_attempt_at,t.id for update skip locked limit p_limit-claimed
    ), updated as (
      update private.voice_media_tombstones t set claim_token=extensions.gen_random_uuid(),
        lease_until=clock_timestamp()+make_interval(secs=>p_lease_seconds)
        from due where t.id=due.id returning t.id,t.storage_ref,t.claim_token
    ) select u.id,u.storage_ref,u.claim_token from updated u;
  end if;
end $$;

create or replace function private.complete_voice_media_purge(p_id uuid,p_purge_token uuid,p_deleted boolean,p_error_code text)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer; t private.voice_media_tombstones%rowtype;
begin
  update public.voice_sessions set
    storage_ref=case when p_deleted and coalesce(media_capability_expires_at,clock_timestamp())<=clock_timestamp()
      and coalesce(upload_lease_until,clock_timestamp())<=clock_timestamp() then null else storage_ref end,
    status=case when p_deleted and status='uploaded' and finalized_at is null and
      contract_version in (2,3) and upload_deadline<=clock_timestamp() then 'expired' else status end,
    next_attempt_at=clock_timestamp()+interval '1 minute',
    claim_token=null,claimed_by=null,lease_until=null
    where id=p_id and claim_token=p_purge_token and lease_until>clock_timestamp();
  get diagnostics changed=row_count;
  if changed=1 then return true; end if;
  select * into t from private.voice_media_tombstones where id=p_id and claim_token=p_purge_token
    and lease_until>clock_timestamp() for update;
  if not found then return false; end if;
  if p_deleted and t.capability_expires_at<=clock_timestamp() then
    delete from private.voice_media_tombstones where id=p_id;
  else
    update private.voice_media_tombstones set claim_token=null,lease_until=null,
      next_attempt_at=clock_timestamp()+interval '1 minute' where id=p_id;
  end if;
  return true;
end $$;
reset role;
