-- Default-OFF, owner-scoped nonfinancial capability. No policy is enabled here.
grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

create table private.voice_analysis_policy (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false, owner_id text,
  check(not enabled or (owner_id is not null and char_length(owner_id) between 1 and 128))
);
insert into private.voice_analysis_policy(singleton) values(true);
alter table private.voice_analysis_policy enable row level security;
revoke all on private.voice_analysis_policy from public,anon,authenticated,masarifi_api,masarifi_worker;
alter table private.voice_batch_context
  add column analysis_only boolean not null default false,
  add column analysis_events jsonb not null default '[]' check(jsonb_typeof(analysis_events)='array' and jsonb_array_length(analysis_events)<=10 and pg_column_size(analysis_events)<=24000),
  add column analysis_expires_at timestamptz;
alter table private.voice_media_tombstones add column analysis_only boolean not null default false;
create or replace function private.retain_voice_media_tombstone()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.storage_ref is not null then
    insert into private.voice_media_tombstones(id,storage_ref,capability_expires_at,analysis_only)
      values(old.id,old.storage_ref,greatest(clock_timestamp(),coalesce(old.media_capability_expires_at,clock_timestamp()),coalesce(old.upload_lease_until,clock_timestamp())),
        coalesce((select analysis_only from private.voice_batch_context where session_id=old.id),false))
      on conflict(id) do update set capability_expires_at=greatest(private.voice_media_tombstones.capability_expires_at,excluded.capability_expires_at),
        analysis_only=private.voice_media_tombstones.analysis_only or excluded.analysis_only;
  end if;
  return old;
end $$;

create function private.expire_voice_analysis_results(p_limit integer) returns integer
language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  if p_limit is null or p_limit not between 1 and 25 then raise exception 'VOICE_LIMIT_INVALID'; end if;
  update private.voice_batch_context c set analysis_events='[]' where c.session_id in (select a.session_id from private.voice_batch_context a where a.analysis_only and a.analysis_expires_at<=clock_timestamp() and a.analysis_events<>'[]'::jsonb order by a.analysis_expires_at limit p_limit);
  get diagnostics changed=row_count; return changed;
end $$;
revoke all on function private.expire_voice_analysis_results(integer) from public,anon,authenticated,masarifi_api;
grant execute on function private.expire_voice_analysis_results(integer) to masarifi_worker;
alter function private.purge_expired_voice_commands(integer) rename to purge_expired_voice_posting_commands;
revoke all on function private.purge_expired_voice_posting_commands(integer) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.purge_expired_voice_commands(p_limit integer) returns integer
language plpgsql security definer set search_path='' as $$
begin
  perform private.expire_voice_analysis_results(p_limit);
  return private.purge_expired_voice_posting_commands(p_limit);
end $$;
revoke all on function private.purge_expired_voice_commands(integer) from public,anon,authenticated,masarifi_api;
grant execute on function private.purge_expired_voice_commands(integer) to masarifi_worker;

create function private.create_voice_analysis_session(p_user text,p_input jsonb,p_operation uuid,p_seconds integer,p_auth_age integer,p_max_age integer,p_thresholds jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; sid uuid; default_id uuid;
begin
  perform private.ai_assert_owner(p_user);
  if not exists(select 1 from private.voice_analysis_policy where enabled and owner_id=p_user)
    or (select enabled from private.voice_automatic_policy) then raise exception 'VOICE_AUTOMATIC_UNAVAILABLE'; end if;
  if p_max_age not between 60 and 3600 or jsonb_typeof(p_thresholds)<>'object' then raise exception 'VOICE_AUTH_INVALID'; end if;
  result:=private.create_voice_session_v2(p_user,p_input,p_operation,p_seconds); sid:=(result->>'id')::uuid;
  select id into default_id from public.accounts where user_id=p_user and is_default and status='active' and deleted_at is null;
  insert into private.voice_batch_context(session_id,user_id,default_account_id,auth_expires_at,thresholds,analysis_only)
    values(sid,p_user,default_id,case when p_auth_age>=0 then clock_timestamp()+make_interval(secs=>p_max_age-p_auth_age) else null end,p_thresholds,true)
    on conflict(session_id) do nothing;
  if not exists(select 1 from private.voice_batch_context where session_id=sid and analysis_only) then raise exception 'VOICE_CONTRACT_INVALID'; end if;
  update public.voice_sessions set contract_version=3 where id=sid;
  select to_jsonb(s) into result from public.voice_sessions s where id=sid;
  return result;
end $$;
revoke all on function private.create_voice_analysis_session(text,jsonb,uuid,integer,integer,integer,jsonb) from public,anon,authenticated,masarifi_worker;
grant execute on function private.create_voice_analysis_session(text,jsonb,uuid,integer,integer,integer,jsonb) to masarifi_api;

alter function private.accept_voice_batch(uuid,uuid,jsonb,text) rename to accept_voice_posting_batch;
revoke all on function private.accept_voice_posting_batch(uuid,uuid,jsonb,text) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.accept_voice_batch(p_session uuid,p_token uuid,p_decisions jsonb,p_policy text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.voice_sessions; ctx private.voice_batch_context; decision jsonb; cmd jsonb; events jsonb:='[]'; normalized jsonb:='[]'; reason text; ordinal integer:=0; bid uuid; totals jsonb;
begin
  select * into s from public.voice_sessions where id=p_session and contract_version=3 for update;
  if s.id is null then raise exception 'VOICE_SESSION_NOT_FOUND'; end if;
  select * into ctx from private.voice_batch_context where session_id=s.id;
  if not found or ctx.user_id is distinct from s.user_id then raise exception 'VOICE_CONTRACT_INVALID'; end if;
  if not ctx.analysis_only then return private.accept_voice_posting_batch(p_session,p_token,p_decisions,p_policy); end if;
  if exists(select 1 from private.voice_batches where session_id=s.id) then return jsonb_build_object('accepted',true); end if;
  if p_token is null or s.claim_token is null or s.lease_until is null or s.status<>'processing' or s.claim_token is distinct from p_token or s.lease_until<=clock_timestamp() or s.cancelled_at is not null or s.deleted_at is not null or s.expires_at<=clock_timestamp() then raise exception 'AI_WORK_FENCE_INVALID'; end if;
  if p_policy is distinct from 'automatic-or-skip-v3.1' or jsonb_typeof(p_decisions) is distinct from 'array' or jsonb_array_length(p_decisions)>10 or pg_column_size(p_decisions)>24000 then raise exception 'AI_SCHEMA_INVALID'; end if;
  for decision in select value from jsonb_array_elements(p_decisions) loop
    if jsonb_typeof(decision)='object' and decision->>'status'='eligible' and (decision-array['status','command'])='{}'::jsonb then
      cmd:=decision->'command'; reason:=private.voice_command_skip_reason(cmd,null);
      if reason is null and not exists(select 1 from public.accounts where id=(cmd->>'accountId')::uuid and user_id=s.user_id and status='active' and deleted_at is null and currency_code=cmd->>'currency') then reason:='ambiguous_account'; end if;
      if reason is null and cmd->'categoryId'<>'null'::jsonb and not exists(select 1 from public.categories where id=(cmd->>'categoryId')::uuid and (user_id=s.user_id or user_id is null) and deleted_at is null) then reason:='invalid_category'; end if;
      if reason is null then normalized:=normalized||jsonb_build_array(decision); else normalized:=normalized||jsonb_build_array(jsonb_build_object('status','skipped')); end if;
    else normalized:=normalized||jsonb_build_array(jsonb_build_object('status','skipped')); end if;
  end loop;
  select coalesce(jsonb_object_agg(x.currency,x.total),'{}') into totals from (
    select d->'command'->>'currency' currency,sum((d->'command'->>'amountMinor')::numeric) total from jsonb_array_elements(normalized) d where d->>'status'='eligible' group by 1
  ) x;
  for decision in select value from jsonb_array_elements(normalized) loop
    if decision->>'status'='eligible' then
      cmd:=decision->'command';
      if not coalesce((ctx.thresholds->>(cmd->>'currency'))::numeric<=(totals->>(cmd->>'currency'))::numeric and (ctx.auth_expires_at is null or ctx.auth_expires_at<clock_timestamp()),false) then
        events:=events||jsonb_build_array((cmd-array['source','externalRef','paymentMethod','note'])||jsonb_build_object('ordinal',ordinal));
      end if;
    end if;
    ordinal:=ordinal+1;
  end loop;
  insert into private.voice_batches(session_id,user_id,policy_version,status,completed_at) values(s.id,s.user_id,p_policy,'completed',clock_timestamp()) returning id into bid;
  update private.voice_batch_context set analysis_events=events,analysis_expires_at=least(s.expires_at,clock_timestamp()+interval '15 minutes') where session_id=s.id;
  update public.voice_sessions set status='confirmed',confirmed_at=clock_timestamp(),claim_token=null,claimed_by=null,lease_until=null where id=s.id;
  return jsonb_build_object('accepted',true,'batchId',bid);
end $$;
revoke all on function private.accept_voice_batch(uuid,uuid,jsonb,text) from public,anon,authenticated,masarifi_api;
grant execute on function private.accept_voice_batch(uuid,uuid,jsonb,text) to masarifi_worker;

alter function private.get_voice_batch_result(text,uuid) rename to get_voice_posting_batch_result;
revoke all on function private.get_voice_posting_batch_result(text,uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.get_voice_batch_result(p_user text,p_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; ctx private.voice_batch_context;
begin
  result:=private.get_voice_posting_batch_result(p_user,p_session);
  select * into ctx from private.voice_batch_context where session_id=p_session and user_id=p_user;
  if ctx.analysis_only and ctx.analysis_expires_at<=clock_timestamp() and ctx.analysis_events<>'[]'::jsonb then
    update private.voice_batch_context set analysis_events='[]' where session_id=p_session and user_id=p_user;
    ctx.analysis_events:='[]';
  end if;
  if ctx.analysis_only and ctx.analysis_expires_at is not null and result->>'status'='completed' then
    result:=result||jsonb_build_object('analysis',jsonb_build_object('mode','analysis_only','persisted',false,'events',case when ctx.analysis_expires_at>clock_timestamp() then ctx.analysis_events else '[]'::jsonb end,'expiresAt',ctx.analysis_expires_at));
  end if;
  return result;
end $$;
revoke all on function private.get_voice_batch_result(text,uuid) from public,anon,authenticated,masarifi_worker;
grant execute on function private.get_voice_batch_result(text,uuid) to masarifi_api;

create function private.claim_voice_analysis_work(p_worker text,p_limit integer,p_lease integer)
returns table(kind text,id uuid,user_id text,claim_token uuid,attempt_count integer)
language plpgsql security definer set search_path='' as $$
begin
  if p_limit is null or p_lease is null or p_worker is null or p_limit not between 1 and 25 or p_lease not between 10 and 300 or char_length(p_worker) not between 1 and 128 then raise exception 'AI_CLAIM_INVALID'; end if;
  return query with due as (
    select s.id from public.voice_sessions s join private.voice_batch_context c on c.session_id=s.id join private.voice_analysis_policy p on p.enabled and p.owner_id=s.user_id
    where c.analysis_only and s.contract_version=3 and s.status in ('uploaded','processing') and s.finalized_at is not null and s.expires_at>clock_timestamp() and s.deleted_at is null and s.cancelled_at is null and s.next_attempt_at<=clock_timestamp() and (s.lease_until is null or s.lease_until<=clock_timestamp())
    order by s.next_attempt_at,s.id for update of s skip locked limit p_limit
  ), updated as (
    update public.voice_sessions s set status='processing',claim_token=extensions.gen_random_uuid(),claimed_by=p_worker,lease_until=clock_timestamp()+make_interval(secs=>p_lease),attempt_count=s.attempt_count+1 from due where s.id=due.id returning s.id,s.user_id,s.claim_token,s.attempt_count
  ) select 'voice.transcribe_extract'::text,u.id,u.user_id,u.claim_token,u.attempt_count from updated u;
end $$;
revoke all on function private.claim_voice_analysis_work(text,integer,integer) from public,anon,authenticated,masarifi_api;
grant execute on function private.claim_voice_analysis_work(text,integer,integer) to masarifi_worker;

create function private.claim_voice_analysis_purge(p_worker text,p_limit integer,p_lease integer)
returns table(id uuid,storage_ref text,purge_token uuid)
language plpgsql security definer set search_path='' as $$
declare claimed integer;
begin
  if p_limit is null or p_lease is null or p_worker is null or p_limit not between 1 and 25 or p_lease not between 10 and 300 or char_length(p_worker) not between 1 and 128 then raise exception 'AI_CLAIM_INVALID'; end if;
  perform private.expire_voice_analysis_results(p_limit);
  return query with due as (
    select s.id from public.voice_sessions s join private.voice_batch_context c on c.session_id=s.id
    where c.analysis_only and s.storage_ref is not null and s.next_attempt_at<=clock_timestamp()
    and (s.expires_at<=clock_timestamp() or s.status in ('proposed','confirmed','failed','expired') or s.cancelled_at is not null or (s.uploaded_at is null and s.upload_deadline<=clock_timestamp()))
    and (s.lease_until is null or s.lease_until<=clock_timestamp()) order by s.next_attempt_at,s.id for update of s skip locked limit p_limit
  ), updated as (
    update public.voice_sessions s set claim_token=extensions.gen_random_uuid(),claimed_by=p_worker,lease_until=clock_timestamp()+make_interval(secs=>p_lease) from due where s.id=due.id returning s.id,s.storage_ref,s.claim_token
  ) select u.id,u.storage_ref,u.claim_token from updated u;
  get diagnostics claimed=row_count;
  if claimed<p_limit then
    return query with due as (
      select t.id from private.voice_media_tombstones t where t.analysis_only and t.next_attempt_at<=clock_timestamp() and (t.lease_until is null or t.lease_until<=clock_timestamp())
      order by t.next_attempt_at,t.id for update skip locked limit p_limit-claimed
    ), updated as (
      update private.voice_media_tombstones t set claim_token=extensions.gen_random_uuid(),lease_until=clock_timestamp()+make_interval(secs=>p_lease) from due where t.id=due.id returning t.id,t.storage_ref,t.claim_token
    ) select u.id,u.storage_ref,u.claim_token from updated u;
  end if;
end $$;
revoke all on function private.claim_voice_analysis_purge(text,integer,integer) from public,anon,authenticated,masarifi_api;
grant execute on function private.claim_voice_analysis_purge(text,integer,integer) to masarifi_worker;
reset role;
revoke masarifi_migration from current_user granted by current_user;
