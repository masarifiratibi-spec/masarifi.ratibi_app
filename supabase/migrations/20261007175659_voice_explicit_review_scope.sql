-- Review admission uses the existing owner-scoped extraction capability.
-- It never enables automatic Posting and never converts a v3 analysis receipt.
grant masarifi_migration to current_user with set true,inherit false;
set local role masarifi_migration;

create function private.create_voice_review_session(p_user text,p_input jsonb,p_operation uuid,p_seconds integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; sid uuid;
begin
  perform private.ai_assert_owner(p_user);
  if not exists(select 1 from private.voice_analysis_policy where enabled and owner_id=p_user)
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
revoke all on function private.create_voice_review_session(text,jsonb,uuid,integer) from public,anon,authenticated,masarifi_worker;
grant execute on function private.create_voice_review_session(text,jsonb,uuid,integer) to masarifi_api;

create or replace function private.claim_voice_analysis_work(p_worker text,p_limit integer,p_lease integer)
returns table(kind text,id uuid,user_id text,claim_token uuid,attempt_count integer)
language plpgsql security definer set search_path='' as $$
begin
  if p_limit is null or p_lease is null or p_worker is null or p_limit not between 1 and 25 or p_lease not between 10 and 300 or char_length(p_worker) not between 1 and 128 then raise exception 'AI_CLAIM_INVALID'; end if;
  return query with due as (
    select s.id from public.voice_sessions s join private.voice_batch_context c on c.session_id=s.id and c.user_id=s.user_id
      join private.voice_analysis_policy p on p.enabled and p.owner_id=s.user_id
    where c.analysis_only and s.contract_version in (2,3) and s.status in ('uploaded','processing')
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

-- Preserve the existing fence, ownership and canary evidence wrapper.
alter function private.get_ai_work_input(text,uuid,uuid) rename to get_ai_work_input_before_review;
revoke all on function private.get_ai_work_input_before_review(text,uuid,uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.get_ai_work_input(p_kind text,p_id uuid,p_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; owner_id text;
begin
  result:=private.get_ai_work_input_before_review(p_kind,p_id,p_token);
  if p_kind='voice.transcribe_extract' then
    select s.user_id into owner_id from public.voice_sessions s
      join private.voice_batch_context c on c.session_id=s.id and c.user_id=s.user_id
      where s.id=p_id and s.contract_version=2 and c.analysis_only;
    if owner_id is not null then
      result:=result||jsonb_build_object('contractVersion',2);
      result:=jsonb_set(result,'{aliases}',coalesce((
        select jsonb_agg(case when ref->>'kind'='account' then
          jsonb_set(ref,'{data}',ref->'data'||coalesce((
            select jsonb_build_object('name',a.name,'minorUnit',c.minor_unit)
              from public.accounts a join public.currencies c on c.code=a.currency_code
              where a.id=(ref->>'id')::uuid and a.user_id=owner_id and a.status='active' and a.deleted_at is null and c.enabled
          ),'{}'::jsonb)) else ref end order by ref->>'alias')
          from jsonb_array_elements(result->'aliases') ref
      ),'[]'::jsonb));
    end if;
  end if;
  return result;
end $$;
revoke all on function private.get_ai_work_input(text,uuid,uuid) from public,anon,authenticated,masarifi_api;
grant execute on function private.get_ai_work_input(text,uuid,uuid) to masarifi_worker;

reset role;
revoke masarifi_migration from current_user granted by current_user;
