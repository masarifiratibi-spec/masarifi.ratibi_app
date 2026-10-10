-- Preparation only: keep existing enabled/owner values and the owner audience.
-- An authenticated audience is a separately approved Staging release operation.
grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

alter table private.voice_analysis_policy
  add column audience text not null default 'owner'
    check(audience in ('owner','authenticated'));
alter table private.voice_analysis_policy drop constraint voice_analysis_policy_check;
alter table private.voice_analysis_policy add constraint voice_analysis_owner_required
  check(not enabled or audience='authenticated' or
    (owner_id is not null and char_length(owner_id) between 1 and 128));

-- Worker eligibility is independent of a caller-supplied owner/claim. Admission
-- still invokes ai_assert_owner to bind the authenticated subject before this check.
create function private.voice_analysis_eligible(p_user text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.voice_analysis_policy p
    join public.profiles u on u.id=p_user and u.status='active'
    where p.enabled and (p.audience='authenticated' or p.owner_id=p_user)
      and not exists(select 1 from public.admin_profiles a where a.user_id=p_user))
$$;
revoke all on function private.voice_analysis_eligible(text)
  from public,anon,authenticated,masarifi_api,masarifi_worker;

create or replace function private.create_voice_review_session(p_user text,p_input jsonb,p_operation uuid,p_seconds integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; sid uuid;
begin
  perform private.ai_assert_owner(p_user);
  if not private.voice_analysis_eligible(p_user)
    then raise exception 'VOICE_AUTOMATIC_UNAVAILABLE'; end if;
  result:=private.create_voice_session_v2(p_user,p_input,p_operation,p_seconds);
  sid:=(result->>'id')::uuid;
  if not exists(select 1 from public.voice_sessions where id=sid and user_id=p_user and contract_version=2)
    then raise exception 'VOICE_CONTRACT_INVALID'; end if;
  insert into private.voice_batch_context(session_id,user_id,default_account_id,auth_expires_at,thresholds,analysis_only)
    values(sid,p_user,null,null,'{}',true) on conflict(session_id) do nothing;
  if not exists(select 1 from private.voice_batch_context where session_id=sid and user_id=p_user and analysis_only)
    then raise exception 'VOICE_CONTRACT_INVALID'; end if;
  return result;
end $$;

create or replace function private.create_voice_analysis_session(p_user text,p_input jsonb,p_operation uuid,p_seconds integer,p_auth_age integer,p_max_age integer,p_thresholds jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; sid uuid; default_id uuid;
begin
  perform private.ai_assert_owner(p_user);
  if not private.voice_analysis_eligible(p_user)
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

create or replace function private.claim_voice_analysis_work(p_worker text,p_limit integer,p_lease integer)
returns table(kind text,id uuid,user_id text,claim_token uuid,attempt_count integer)
language plpgsql security definer set search_path='' as $$
begin
  if p_limit is null or p_lease is null or p_worker is null or p_limit not between 1 and 25 or p_lease not between 10 and 300 or char_length(p_worker) not between 1 and 128 then raise exception 'AI_CLAIM_INVALID'; end if;
  return query with due as (
    select s.id from public.voice_sessions s join private.voice_batch_context c on c.session_id=s.id and c.user_id=s.user_id
    where private.voice_analysis_eligible(s.user_id) and c.analysis_only and s.contract_version in (2,3) and s.status in ('uploaded','processing')
      and s.finalized_at is not null and s.expires_at>clock_timestamp() and s.deleted_at is null
      and s.cancelled_at is null and s.next_attempt_at<=clock_timestamp()
      and (s.lease_until is null or s.lease_until<=clock_timestamp())
    order by s.next_attempt_at,s.id for update of s skip locked limit p_limit
  ), updated as (
    update public.voice_sessions s set status='processing',claim_token=extensions.gen_random_uuid(),claimed_by=p_worker,
      lease_until=clock_timestamp()+make_interval(secs=>p_lease),attempt_count=s.attempt_count+1
      from due where s.id=due.id returning s.id,s.user_id,s.claim_token,s.attempt_count
  ) select 'voice.transcribe_extract'::text,u.id,u.user_id,u.claim_token,u.attempt_count from updated u;
end $$;

-- CREATE OR REPLACE retains existing capability grants; helper has no runtime grant.
reset role;
revoke masarifi_migration from current_user granted by current_user;
