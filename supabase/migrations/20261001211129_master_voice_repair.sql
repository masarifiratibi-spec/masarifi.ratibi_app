grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

alter table public.voice_sessions
  add column contract_version smallint not null default 1 check (contract_version in (1,2)),
  add column capture_at timestamptz,
  add column capture_timezone_offset smallint check (capture_timezone_offset between -840 and 840),
  add column process_operation_id uuid,
  add column upload_deadline timestamptz,
  add column uploaded_at timestamptz,
  add column upload_claim_token uuid,
  add column upload_lease_until timestamptz,
  add column cancelled_at timestamptz,
  add column media_capability_expires_at timestamptz;
create unique index voice_sessions_process_operation_uq on public.voice_sessions(process_operation_id)
  where process_operation_id is not null;
-- Legacy upload capabilities can remain usable for two hours. Delete early,
-- retain the key, then sweep again after that capability is certainly expired.
update public.voice_sessions set media_capability_expires_at=clock_timestamp()+interval '2 hours'
  where storage_ref is not null;

create function private.create_voice_session_v2(p_user_id text,p_input jsonb,p_operation_id uuid,p_upload_seconds integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; session_id uuid; row_value public.voice_sessions%rowtype; captured timestamptz;
begin
  perform private.ai_assert_owner(p_user_id);
  if p_input is null or jsonb_typeof(p_input)<>'object' or p_upload_seconds is null or p_upload_seconds not between 1 and 7200
    or p_input->>'contentHash' is null or p_input->>'contentHash' !~ '^[0-9a-f]{64}$'
    or p_input->>'recordedAt' is null or p_input->>'timezoneOffsetMinutes' is null
    or (p_input->>'durationMs')::integer not between 1 and 60000
    or (p_input->>'timezoneOffsetMinutes')::integer not between -840 and 840 then
    raise exception using errcode='22023',message='VOICE_CAPTURE_INVALID';
  end if;
  captured:=(p_input->>'recordedAt')::timestamptz;
  if captured>clock_timestamp()+interval '5 minutes' or captured<clock_timestamp()-interval '24 hours' then
    raise exception using errcode='22023',message='VOICE_CAPTURE_INVALID';
  end if;
  result:=private.create_voice_session(p_user_id,p_input->>'locale',(p_input->>'durationMs')::integer,
    p_input->>'contentType',(p_input->>'sizeBytes')::bigint,p_operation_id);
  session_id:=(result->>'id')::uuid;
  update public.voice_sessions set contract_version=2,capture_at=captured,
    capture_timezone_offset=(p_input->>'timezoneOffsetMinutes')::smallint,
    content_hash=p_input->>'contentHash',upload_deadline=clock_timestamp()+make_interval(secs=>p_upload_seconds),
    media_capability_expires_at=null
    where id=session_id and contract_version=1 returning * into row_value;
  if not found then select * into row_value from public.voice_sessions where id=session_id; end if;
  return to_jsonb(row_value);
end $$;

create or replace function private.claim_ai_work(p_kind text,p_worker_id text,p_limit integer,p_lease_seconds integer)
returns table(kind text,id uuid,user_id text,claim_token uuid,attempt_count integer) language plpgsql security definer set search_path='' as $$
begin
  if p_limit not between 1 and 100 or p_lease_seconds not between 10 and 300 or char_length(p_worker_id) not between 1 and 128 then raise exception using errcode='22023',message='AI_CLAIM_INVALID'; end if;
  if p_kind='voice.transcribe_extract' then
    return query with claimed as (select s.id from public.voice_sessions s where s.status in ('uploaded','processing') and s.finalized_at is not null and s.expires_at>clock_timestamp() and s.deleted_at is null and s.cancelled_at is null and s.next_attempt_at<=clock_timestamp() and (s.lease_until is null or s.lease_until<=clock_timestamp()) order by s.next_attempt_at,s.id for update skip locked limit p_limit), updated as (
      update public.voice_sessions s set status='processing',claim_token=extensions.gen_random_uuid(),claimed_by=p_worker_id,lease_until=clock_timestamp()+make_interval(secs=>p_lease_seconds),attempt_count=s.attempt_count+1 from claimed where s.id=claimed.id returning s.id,s.user_id,s.claim_token,s.attempt_count)
      select p_kind,u.id,u.user_id,u.claim_token,u.attempt_count from updated u;
  elsif p_kind='assistant.respond' then
    return query with claimed as (select m.id from public.assistant_messages m where m.role='user' and m.work_status in ('queued','processing') and m.next_attempt_at<=clock_timestamp() and (m.lease_until is null or m.lease_until<=clock_timestamp()) order by m.next_attempt_at,m.id for update skip locked limit p_limit), updated as (
      update public.assistant_messages m set work_status='processing',claim_token=extensions.gen_random_uuid(),claimed_by=p_worker_id,lease_until=clock_timestamp()+make_interval(secs=>p_lease_seconds),attempt_count=m.attempt_count+1 from claimed where m.id=claimed.id returning m.id,m.user_id,m.claim_token,m.attempt_count)
      select p_kind,u.id,u.user_id,u.claim_token,u.attempt_count from updated u;
  elsif p_kind='ai.evaluate_route' then
    return query with claimed as (select p.id from private.ai_prompt_versions p where p.status='testing' and p.next_attempt_at<=clock_timestamp() and (p.lease_until is null or p.lease_until<=clock_timestamp()) order by p.next_attempt_at,p.id for update skip locked limit p_limit), updated as (
      update private.ai_prompt_versions p set claim_token=extensions.gen_random_uuid(),claimed_by=p_worker_id,lease_until=clock_timestamp()+make_interval(secs=>p_lease_seconds),attempt_count=p.attempt_count+1 from claimed where p.id=claimed.id returning p.id,p.claim_token,p.attempt_count)
      select p_kind,u.id,null::text,u.claim_token,u.attempt_count from updated u;
  else raise exception using errcode='22023',message='AI_JOB_KIND_INVALID'; end if;
end $$;
alter function private.claim_ai_work(text,text,integer,integer) owner to masarifi_migration;
revoke all on function private.claim_ai_work(text,text,integer,integer) from public;


create or replace function private.save_voice_result(p_session_id uuid,p_claim_token uuid,p_provider text,p_model text,p_transcript text,p_confidence numeric,p_language text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare session_row public.voice_sessions%rowtype; proposal_row public.voice_proposals%rowtype; item record;
begin
  select * into session_row from public.voice_sessions where id=p_session_id and claim_token=p_claim_token and status='processing' and lease_until>clock_timestamp() and expires_at>clock_timestamp() and deleted_at is null and cancelled_at is null for update;
  if not found then raise exception using errcode='40001',message='AI_WORK_FENCE_INVALID'; end if;
  perform private.validate_ai_proposal('voice_transcription',1,p_payload,session_row.user_id);
  insert into public.voice_transcripts(user_id,session_id,provider,model,text_redacted,confidence,language)
    values(session_row.user_id,session_row.id,p_provider,p_model,left(p_transcript,8192),p_confidence,p_language);
  insert into public.voice_proposals(user_id,session_id,schema_version,proposal_type,payload,status,expires_at)
    values(session_row.user_id,session_row.id,1,'transaction.create',p_payload,'validated',now()+interval '15 minutes') returning * into proposal_row;
  for item in select key,value from jsonb_each(p_payload) where key in ('amountMinor','currency','categoryId','accountId','date','merchant','note') loop
    insert into public.voice_proposal_fields(user_id,proposal_id,field_name,value_json,confidence)
    values(session_row.user_id,proposal_row.id,item.key,item.value,null);
  end loop;
  update public.voice_sessions set status='proposed',claim_token=null,claimed_by=null,lease_until=null where id=session_row.id;
  perform private.enqueue_outbox_event('voice.proposal_ready.v1','voice-proposal',proposal_row.id,
    jsonb_build_object('sessionId',session_row.id,'proposalId',proposal_row.id,'schemaVersion',1,'version',proposal_row.version,'expiresAt',proposal_row.expires_at,'occurredAt',clock_timestamp()));
  return jsonb_build_object('sessionId',session_row.id,'proposalId',proposal_row.id,'version',proposal_row.version);
end $$;
alter function private.save_voice_result(uuid,uuid,text,text,text,numeric,text,jsonb) owner to masarifi_migration;
revoke all on function private.save_voice_result(uuid,uuid,text,text,text,numeric,text,jsonb) from public;


create or replace function private.complete_ai_work(p_kind text,p_id uuid,p_claim_token uuid,p_status text,p_error_code text)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  if p_status not in ('completed','failed','retry') then raise exception using errcode='22023',message='AI_WORK_STATUS_INVALID'; end if;
  if p_kind='voice.transcribe_extract' then
    update public.voice_sessions set status=case when p_status='failed' then 'failed' else status end,failure_code=case when p_status='failed' then p_error_code else null end,
      next_attempt_at=case when p_status='retry' then clock_timestamp()+interval '30 seconds' else next_attempt_at end,claim_token=null,claimed_by=null,lease_until=null
      where id=p_id and claim_token=p_claim_token and status='processing' and lease_until>clock_timestamp() and expires_at>clock_timestamp() and deleted_at is null and cancelled_at is null; get diagnostics changed=row_count;
    if changed=1 and p_status='failed' then
      perform private.enqueue_outbox_event('voice.proposal_failed.v1','voice-session',p_id,jsonb_build_object('sessionId',p_id,'failureCode',p_error_code,'occurredAt',clock_timestamp()));
    end if;
  elsif p_kind='assistant.respond' then
    update public.assistant_messages set work_status=case when p_status='retry' then 'queued' else p_status end,failure_code=p_error_code,
      next_attempt_at=case when p_status='retry' then clock_timestamp()+interval '30 seconds' else next_attempt_at end,claim_token=null,claimed_by=null,lease_until=null
      where id=p_id and claim_token=p_claim_token; get diagnostics changed=row_count;
  elsif p_kind='ai.evaluate_route' then
    update private.ai_prompt_versions set evaluation_passed=p_status='completed',evaluation_summary=jsonb_build_object('status',p_status,'errorCode',p_error_code),
      status=case when p_status='completed' then 'testing' when p_status='retry' then 'testing' else 'draft' end,
      next_attempt_at=case when p_status='retry' then clock_timestamp()+interval '30 seconds' else next_attempt_at end,claim_token=null,claimed_by=null,lease_until=null
      where id=p_id and claim_token=p_claim_token; get diagnostics changed=row_count;
  else raise exception using errcode='22023',message='AI_JOB_KIND_INVALID'; end if;
  if changed=1 and p_status='failed' and p_kind in ('assistant.respond','ai.evaluate_route') then
    perform private.enqueue_outbox_event('ai.provider_failed.v1','ai-work',p_id,jsonb_build_object('workKind',p_kind,'failureCode',p_error_code,'occurredAt',clock_timestamp()));
  end if;
  return changed=1;
end $$;
alter function private.complete_ai_work(text,uuid,uuid,text,text) owner to masarifi_migration;
revoke all on function private.complete_ai_work(text,uuid,uuid,text,text) from public;


create function private.renew_voice_work(p_id uuid,p_claim_token uuid,p_lease_seconds integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  if p_lease_seconds is null or p_lease_seconds not between 10 and 300 then
    raise exception using errcode='22023',message='AI_CLAIM_INVALID'; end if;
  update public.voice_sessions set lease_until=least(expires_at,clock_timestamp()+make_interval(secs=>p_lease_seconds))
    where id=p_id and claim_token=p_claim_token and status='processing' and lease_until>clock_timestamp()
    and expires_at>clock_timestamp() and deleted_at is null and cancelled_at is null;
  get diagnostics changed=row_count; return changed=1;
end $$;
alter function private.renew_voice_work(uuid,uuid,integer) owner to masarifi_migration;
revoke all on function private.renew_voice_work(uuid,uuid,integer) from public;
grant execute on function private.renew_voice_work(uuid,uuid,integer) to masarifi_worker;
alter function private.create_voice_session_v2(text,jsonb,uuid,integer) owner to masarifi_migration;
revoke all on function private.create_voice_session_v2(text,jsonb,uuid,integer) from public;
grant execute on function private.create_voice_session_v2(text,jsonb,uuid,integer) to masarifi_api;

create function private.begin_voice_upload(p_user_id text,p_session_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.voice_sessions%rowtype; token uuid:=extensions.gen_random_uuid();
begin
  perform private.ai_assert_owner(p_user_id);
  select * into s from public.voice_sessions where id=p_session_id and user_id=p_user_id and deleted_at is null for update;
  if not found then raise exception using errcode='P0002',message='VOICE_SESSION_NOT_FOUND'; end if;
  if s.contract_version<>2 or s.cancelled_at is not null or s.status in ('expired','failed') then
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

create function private.finish_voice_upload(p_user_id text,p_session_id uuid,p_token uuid,p_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.voice_sessions%rowtype;
begin
  perform private.ai_assert_owner(p_user_id);
  update public.voice_sessions set uploaded_at=clock_timestamp(),upload_claim_token=null,upload_lease_until=null
    where id=p_session_id and user_id=p_user_id and contract_version=2 and status='uploaded'
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

create function private.release_voice_upload(p_user_id text,p_session_id uuid,p_token uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.ai_assert_owner(p_user_id);
  update public.voice_sessions set upload_claim_token=null,upload_lease_until=null
    where id=p_session_id and user_id=p_user_id and upload_claim_token=p_token;
end $$;
alter function private.release_voice_upload(text,uuid,uuid) owner to masarifi_migration;
revoke all on function private.release_voice_upload(text,uuid,uuid) from public;
grant execute on function private.release_voice_upload(text,uuid,uuid) to masarifi_api;

create function private.finalize_voice_session(p_user_id text,p_session_id uuid,p_expected_version bigint,p_content_hash text,p_process_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.voice_sessions%rowtype;
begin
  perform private.ai_assert_owner(p_user_id);
  if p_process_id is null or p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='22023',message='VOICE_MEDIA_INVALID'; end if;
  update public.voice_sessions set finalized_at=coalesce(finalized_at,clock_timestamp()),
    content_hash=coalesce(content_hash,p_content_hash),process_operation_id=p_process_id,next_attempt_at=clock_timestamp()
    where id=p_session_id and user_id=p_user_id and version=p_expected_version and status='uploaded'
      and deleted_at is null and cancelled_at is null and expires_at>clock_timestamp()
      and (content_hash is null or content_hash=p_content_hash)
      and (process_operation_id is null or process_operation_id=p_process_id)
      and (contract_version=1 or uploaded_at is not null)
    returning * into s;
  if not found then raise exception using errcode='40001',message='VOICE_VERSION_CONFLICT'; end if;
  return to_jsonb(s)-array['user_id','storage_ref','content_hash','claim_token','claimed_by','lease_until','upload_claim_token'];
end $$;
alter function private.finalize_voice_session(text,uuid,bigint,text,uuid) owner to masarifi_migration;
revoke all on function private.finalize_voice_session(text,uuid,bigint,text,uuid) from public;
grant execute on function private.finalize_voice_session(text,uuid,bigint,text,uuid) to masarifi_api;

create function private.cancel_voice_session(p_user_id text,p_session_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.voice_sessions%rowtype; p public.voice_proposals%rowtype;
begin
  perform private.ai_assert_owner(p_user_id);
  select * into s from public.voice_sessions where id=p_session_id and user_id=p_user_id and deleted_at is null for update;
  if not found then raise exception using errcode='P0002',message='VOICE_SESSION_NOT_FOUND'; end if;
  select * into p from public.voice_proposals where session_id=s.id and user_id=p_user_id and deleted_at is null order by created_at desc limit 1 for update;
  if p.status in ('confirmed','executed') or s.status='confirmed' then
    return jsonb_build_object('id',s.id,'status',case when p.status='executed' or s.status='confirmed' then 'confirmed' else 'confirming' end,
      'transactionId',p.executed_transaction_id);
  end if;
  if s.cancelled_at is null then
    update public.voice_proposals set status='rejected' where session_id=s.id and status in ('draft','validated');
    update public.voice_sessions set status='failed',failure_code='VOICE_CANCELLED',cancelled_at=clock_timestamp(),
      claim_token=null,claimed_by=null,lease_until=null,next_attempt_at=clock_timestamp(),
      media_capability_expires_at=case when contract_version=2 then clock_timestamp()+interval '1 minute' else media_capability_expires_at end
      where id=s.id;
  end if;
  return jsonb_build_object('id',s.id,'status','cancelled','transactionId',null);
end $$;
alter function private.cancel_voice_session(text,uuid) owner to masarifi_migration;
revoke all on function private.cancel_voice_session(text,uuid) from public;
grant execute on function private.cancel_voice_session(text,uuid) to masarifi_api;

create function private.get_voice_recovery(p_user_id text,p_session_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.voice_sessions%rowtype; p public.voice_proposals%rowtype; t public.voice_transcripts%rowtype; receipt_id uuid;
begin
  perform private.ai_assert_owner(p_user_id);
  select * into s from public.voice_sessions where id=p_session_id and user_id=p_user_id and deleted_at is null for update;
  if not found then raise exception using errcode='P0002',message='VOICE_SESSION_NOT_FOUND'; end if;
  select * into p from public.voice_proposals where session_id=s.id and user_id=p_user_id and deleted_at is null order by created_at desc,id desc limit 1 for update;
  if p.status in ('confirmed','executed') then
    receipt_id:=private.voice_committed_receipt(p.id);
    if receipt_id is not null then
      update public.voice_proposals set status='executed',executed_transaction_id=receipt_id,
        decision_token=null,decision_action=null,decision_lease_until=null where id=p.id and status='confirmed';
      if found then
        perform private.enqueue_outbox_event('voice.proposal_confirmed.v1','ai-action',p.id,
          jsonb_build_object('sourceId',p.id,'resourceId',receipt_id,'occurredAt',clock_timestamp()));
      end if;
      update public.voice_sessions set status='confirmed',confirmed_at=coalesce(confirmed_at,clock_timestamp()),claim_token=null,claimed_by=null,lease_until=null
        where id=s.id and status<>'confirmed' returning * into s;
      if not found then select * into s from public.voice_sessions where id=p_session_id; end if;
    end if;
  elsif s.status not in ('confirmed','failed','expired') and s.expires_at<=clock_timestamp() then
    update public.voice_sessions set status='expired',claim_token=null,claimed_by=null,lease_until=null,
      next_attempt_at=clock_timestamp() where id=s.id returning * into s;
    update public.voice_proposals set status='expired' where id=p.id and status='validated';
  end if;
  select * into t from public.voice_transcripts where session_id=s.id and user_id=p_user_id order by created_at desc,id desc limit 1;
  return jsonb_build_object('phase',case when s.cancelled_at is not null then 'cancelled'
    when p.status='confirmed' and private.voice_committed_receipt(p.id) is not null then 'confirmed'
    when p.status='confirmed' then 'confirming' when s.status='uploaded' and s.finalized_at is not null then 'queued'
    when s.status='uploaded' and s.uploaded_at is null then 'awaiting_audio' else s.status end,
    'session',private.get_voice_session(p_user_id,s.id),'proposalId',p.id,
    'recordedAt',coalesce(s.capture_at,s.created_at),'timezoneOffsetMinutes',coalesce(s.capture_timezone_offset,0),
    'captureContextLegacy',s.capture_at is null,'transcriptLanguage',t.language,'transcriptConfidence',t.confidence,
    'transactionId',coalesce(receipt_id,p.executed_transaction_id));
end $$;
alter function private.get_voice_recovery(text,uuid) owner to masarifi_migration;
revoke all on function private.get_voice_recovery(text,uuid) from public;
grant execute on function private.get_voice_recovery(text,uuid) to masarifi_api;

create or replace function private.get_ai_work_input(p_kind text,p_id uuid,p_claim_token uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; work_user text; scopes text[];
begin
  if p_kind='voice.transcribe_extract' then
    select jsonb_build_object('id',s.id,'userId',s.user_id,'storageRef',s.storage_ref,'contentType',s.content_type,
      'sizeBytes',s.size_bytes,'durationMs',s.duration_ms,'locale',s.locale,'operationId',coalesce(s.process_operation_id,s.operation_id),'contentHash',s.content_hash,
      'recordedAt',coalesce(s.capture_at,s.created_at),'timezoneOffsetMinutes',coalesce(s.capture_timezone_offset,0),'captureContextLegacy',s.capture_at is null,
      'aliases',coalesce((select jsonb_agg(reference order by reference->>'alias') from (
        select jsonb_build_object('alias','ACCOUNT-'||a.ordinality,'kind','account','id',a.id,'version',a.version,
          'data',jsonb_build_object('currency',btrim(a.currency_code::text),'type',a.type,'isDefault',a.is_default)) reference
          from (select a.*,row_number() over(order by a.is_default desc,a.sort_order,a.id) ordinality from public.accounts a
            where a.user_id=s.user_id and a.status='active' and a.deleted_at is null) a where a.ordinality<=20
        union all
        select jsonb_build_object('alias','CATEGORY-'||c.ordinality,'kind','category','id',c.id,'version',c.version,
          'data',jsonb_build_object('kind',c.kind,'labelAr',c.label_ar,'labelEn',c.label_en))
          from (select c.*,row_number() over(order by c.user_id nulls first,c.sort_order,c.id) ordinality from public.categories c
            where c.active and c.deleted_at is null and (c.user_id is null or c.user_id=s.user_id)) c where c.ordinality<=80
      ) aliases),'[]'::jsonb))
      into result from public.voice_sessions s where s.id=p_id and s.claim_token=p_claim_token and s.status='processing' and s.lease_until>clock_timestamp() and s.expires_at>clock_timestamp() and s.deleted_at is null and s.cancelled_at is null;
  elsif p_kind='assistant.respond' then
    select m.user_id,m.context_scope into work_user,scopes from public.assistant_messages m
      where m.id=p_id and m.claim_token=p_claim_token and m.work_status='processing' and m.lease_until>clock_timestamp();
    if work_user is not null and exists(select 1 from public.assistant_consents c where c.user_id=work_user and c.revoked_at is null) then
      select jsonb_build_object('id',m.id,'userId',m.user_id,'operationId',m.operation_id,'content',m.content_redacted,
        'contextScope',m.context_scope,'evidence',coalesce((
          select jsonb_agg(entry order by entry->>'alias') from (
            select jsonb_build_object('kind','accounts_summary','alias','ACCOUNTS-1','version',coalesce(max(a.version),0),
              'data',jsonb_build_object('count',count(*),'currencies',coalesce(jsonb_agg(distinct btrim(a.currency_code::text)),'[]'::jsonb))) entry
              from public.accounts a where a.user_id=work_user and a.deleted_at is null having 'accounts_summary'=any(scopes)
            union all
            select jsonb_build_object('kind','recent_transactions','alias','TRANSACTIONS-1','version',coalesce(max(t.version),0),
              'data',jsonb_build_object('count',count(*),'amountMinor',coalesce(sum(t.amount_minor),0)::text))
              from (select * from public.transactions where user_id=work_user and deleted_at is null order by occurred_at desc,id desc limit 50) t having 'recent_transactions'=any(scopes)
            union all
            select jsonb_build_object('kind','budgets','alias','BUDGETS-1','version',coalesce(max(b.version),0),'data',jsonb_build_object('count',count(*)))
              from public.budgets b where b.user_id=work_user and b.deleted_at is null having 'budgets'=any(scopes)
            union all
            select jsonb_build_object('kind','obligations','alias','OBLIGATIONS-1','version',coalesce(max(o.version),0),'data',jsonb_build_object('count',count(*)))
              from public.obligations o where o.user_id=work_user and o.deleted_at is null having 'obligations'=any(scopes)
            union all
            select jsonb_build_object('kind','tracking_reviews','alias','REVIEWS-1','version',coalesce(max(r.version),0),'data',jsonb_build_object('count',count(*)))
              from public.review_items r where r.user_id=work_user and r.status='pending' having 'tracking_reviews'=any(scopes)
          ) x
        ),'[]'::jsonb),
        'aliases',coalesce((select jsonb_agg(reference order by reference->>'alias') from (
          select jsonb_build_object('alias','ACCOUNT-'||a.ordinality,'kind','account','id',a.id,'version',a.version,
            'data',jsonb_build_object('currency',btrim(a.currency_code::text),'type',a.type,'isDefault',a.is_default)) reference
            from (select a.*,row_number() over(order by a.is_default desc,a.sort_order,a.id) ordinality from public.accounts a
              where a.user_id=work_user and a.status='active' and a.deleted_at is null) a where a.ordinality<=10
          union all
          select jsonb_build_object('alias','CATEGORY-'||c.ordinality,'kind','category','id',c.id,'version',c.version,
            'data',jsonb_build_object('kind',c.kind,'labelAr',c.label_ar,'labelEn',c.label_en))
            from (select c.*,row_number() over(order by c.user_id nulls first,c.sort_order,c.id) ordinality from public.categories c
              where c.active and c.deleted_at is null and (c.user_id is null or c.user_id=work_user)) c where c.ordinality<=20
          union all
          select jsonb_build_object('alias','TRANSACTION-'||t.ordinality,'kind','transaction','id',t.id,'version',t.version,
            'data',jsonb_build_object('kind',t.kind,'amountMinor',t.amount_minor::text,'currency',btrim(t.currency_code::text),'occurredAt',t.occurred_at))
            from (select t.*,row_number() over(order by t.occurred_at desc,t.id) ordinality from public.transactions t
              where t.user_id=work_user and t.deleted_at is null) t where t.ordinality<=20
          union all
          select jsonb_build_object('alias','BUDGET-'||b.ordinality,'kind','budget','id',b.id,'version',b.version,
            'data',jsonb_build_object('currency',btrim(b.currency_code::text),'periodStart',b.period_start,'periodEnd',b.period_end,'status',b.status))
            from (select b.*,row_number() over(order by b.period_start desc,b.id) ordinality from public.budgets b
              where b.user_id=work_user and b.deleted_at is null) b where b.ordinality<=10
          union all
          select jsonb_build_object('alias','OBLIGATION-'||o.ordinality,'kind','obligation','id',o.id,'version',o.version,
            'data',jsonb_build_object('currency',btrim(o.currency_code::text),'direction',o.direction,'status',o.status))
            from (select o.*,row_number() over(order by o.created_at desc,o.id) ordinality from public.obligations o
              where o.user_id=work_user and o.deleted_at is null) o where o.ordinality<=10
          union all
          select jsonb_build_object('alias','SCHEDULE-'||i.ordinality,'kind','schedule','id',i.id,'version',i.version,
            'data',jsonb_build_object('amountMinor',i.amount_minor::text,'paidMinor',i.paid_minor::text,'dueAt',i.due_at,'status',i.status))
            from (select i.*,row_number() over(order by i.due_at,i.id) ordinality from public.obligation_schedule_items i
              where i.user_id=work_user and i.status in ('due','partial','overdue')) i where i.ordinality<=20
          union all
          select jsonb_build_object('alias','REVIEW-'||r.ordinality,'kind','review','id',r.id,'version',r.version,
            'data',jsonb_build_object('reason',r.reason,'status',r.status))
            from (select r.*,row_number() over(order by r.created_at desc,r.id) ordinality from public.review_items r
              where r.user_id=work_user and r.status='pending') r where r.ordinality<=10
        ) aliases),'[]'::jsonb)) into result from public.assistant_messages m where m.id=p_id;
    end if;
  elsif p_kind='ai.evaluate_route' then
    select jsonb_build_object('id',p.id,'workload',p.workload,'template',p.template,'schemaVersion',p.schema_version,
      'cases',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'fixture',c.fixture_redacted,'expected',c.expected_rules) order by c.id)
        from private.ai_prompt_test_cases c where c.prompt_version_id=p.id and c.enabled and c.deleted_at is null),'[]'::jsonb))
      into result from private.ai_prompt_versions p where p.id=p_id and p.claim_token=p_claim_token and p.lease_until>clock_timestamp();
  else raise exception using errcode='22023',message='AI_JOB_KIND_INVALID'; end if;
  if result is null then raise exception using errcode='40001',message='AI_WORK_FENCE_INVALID'; end if;
  return result;
end $$;

create table private.voice_media_tombstones (
  id uuid primary key,
  storage_ref text not null unique check(storage_ref ~ '^voice/[0-9a-f-]{36}/[0-9a-f-]{36}$'),
  capability_expires_at timestamptz not null,
  next_attempt_at timestamptz not null default now(),
  claim_token uuid,
  lease_until timestamptz
);
alter table private.voice_media_tombstones owner to masarifi_migration;
alter table private.voice_media_tombstones enable row level security;
alter table private.voice_media_tombstones force row level security;
create policy voice_media_tombstones_migration on private.voice_media_tombstones
  to masarifi_migration using(true) with check(true);
create index voice_media_tombstones_due_idx on private.voice_media_tombstones(next_attempt_at);

create function private.retain_voice_media_tombstone()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.storage_ref is not null then
    insert into private.voice_media_tombstones(id,storage_ref,capability_expires_at)
      values(old.id,old.storage_ref,greatest(clock_timestamp(),coalesce(old.media_capability_expires_at,clock_timestamp()),
        coalesce(old.upload_lease_until,clock_timestamp())))
      on conflict(id) do update set capability_expires_at=greatest(
        private.voice_media_tombstones.capability_expires_at,excluded.capability_expires_at);
  end if;
  return old;
end $$;
alter function private.retain_voice_media_tombstone() owner to masarifi_migration;
revoke all on function private.retain_voice_media_tombstone() from public;
create trigger voice_media_retain_on_delete before delete on public.voice_sessions
  for each row execute function private.retain_voice_media_tombstone();

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
        or (s.contract_version=2 and s.uploaded_at is null and s.upload_deadline<=clock_timestamp()))
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
      contract_version=2 and upload_deadline<=clock_timestamp() then 'expired' else status end,
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
-- One durable dispatch ledger per PROCESS operation; it survives Worker reclaim and account deletion.
create table private.voice_provider_attempts (
  operation_id uuid not null, attempt_no smallint not null check(attempt_no between 1 and 2),
  session_id uuid not null, model text not null, provider text not null,
  status text not null default 'dispatched' check(status in ('dispatched','completed','failed','unknown')),
  reserved_cost numeric(18,8) not null check(reserved_cost>=0),
  max_input_tokens integer not null, max_output_tokens integer not null,
  input_tokens integer not null default 0 check(input_tokens>=0), output_tokens integer not null default 0 check(output_tokens>=0),
  billed_cost numeric(18,8) check(billed_cost>=0), generation_hash text check(generation_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(), primary key(operation_id,attempt_no)
);
alter table private.voice_provider_attempts owner to masarifi_migration;
alter table private.voice_provider_attempts enable row level security;
alter table private.voice_provider_attempts force row level security;
create policy voice_provider_attempts_migration on private.voice_provider_attempts to masarifi_migration using(true) with check(true);

create function private.authorize_voice_dispatch(p_session_id uuid,p_claim_token uuid,p_model text,p_provider text,p_policy jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.voice_sessions%rowtype; route jsonb; u private.ai_usage_events%rowtype;
  attempts integer; reservation numeric; spent numeric; budget numeric; op uuid;
  global_spent numeric; global_budget numeric; crossed smallint[]; threshold smallint;
begin
  perform pg_advisory_xact_lock(hashtextextended('ai-budget:global:'||date_trunc('month',current_date)::date,0));
  perform pg_advisory_xact_lock(hashtextextended('ai-budget:voice_transcription:'||date_trunc('month',current_date)::date,0));
  select * into s from public.voice_sessions where id=p_session_id and claim_token=p_claim_token
    and status='processing' and lease_until>clock_timestamp() and expires_at>clock_timestamp()
    and cancelled_at is null and deleted_at is null for update;
  if not found then raise exception using errcode='40001',message='AI_WORK_FENCE_INVALID'; end if;
  op:=coalesce(s.process_operation_id,s.operation_id);
  route:=private.get_effective_ai_route('voice_transcription');
  if route is null or route is distinct from p_policy or not exists(select 1 from jsonb_array_elements(jsonb_build_array(route->'primary')||(route->'fallbacks')) candidate
    where candidate->>'modelId'=p_model and candidate->>'provider'=p_provider) then
    raise exception using errcode='55000',message='AI_ROUTE_POLICY_INVALID'; end if;
  select * into u from private.ai_usage_events where request_id=op::text and user_id=s.user_id and reservation_status<>'released' for update;
  if not found then raise exception using errcode='55000',message='AI_RESERVATION_REQUIRED'; end if;
  select count(*) into attempts from private.voice_provider_attempts where operation_id=op;
  if attempts>=2 then raise exception using errcode='55000',message='AI_DISPATCH_LIMIT'; end if;
  if exists(select 1 from private.voice_provider_attempts where operation_id=op and status in ('dispatched','unknown')) then
    raise exception using errcode='55000',message='AI_DISPATCH_OUTCOME_UNKNOWN'; end if;
  reservation:=(route->'limits'->>'inputTokens')::numeric*(route->'maxPrice'->>'prompt')::numeric
    +(route->'limits'->>'outputTokens')::numeric*(route->'maxPrice'->>'completion')::numeric;
  if attempts=0 and u.estimated_cost<reservation then raise exception using errcode='55000',message='AI_RESERVATION_REQUIRED'; end if;
  if attempts>0 then
    budget:=(route->'limits'->>'monthlyBudget')::numeric;
    select coalesce(sum(estimated_cost),0) into spent from private.ai_usage_events where workload='voice_transcription'
      and budget_period=date_trunc('month',current_date)::date and reservation_status in ('reserved','completed','failed');
    select coalesce((select (value#>>'{}')::numeric from private.system_settings where setting_key='ai.global.monthly_budget'),200) into global_budget;
    select coalesce(sum(estimated_cost),0) into global_spent from private.ai_usage_events
      where budget_period=date_trunc('month',current_date)::date and reservation_status in ('reserved','completed','failed');
    if budget is null or budget<=0 or global_budget<=0 or spent+reservation>=budget or global_spent+reservation>=global_budget
      or u.budget_period<>date_trunc('month',current_date)::date then
      raise exception using errcode='55000',message='AI_BUDGET_EXHAUSTED'; end if;
    crossed:=array(select candidate::smallint from unnest(array[70,85,95]) candidate
      where spent/budget*100<candidate and floor((spent+reservation)/budget*100)>=candidate and not exists(
        select 1 from private.ai_usage_events prior where prior.workload='voice_transcription'
          and prior.budget_period=u.budget_period and candidate=any(prior.threshold_events)));
    update private.ai_usage_events set estimated_cost=estimated_cost+reservation,reservation_status='reserved',
      threshold_events=threshold_events||crossed where id=u.id;
    foreach threshold in array crossed loop
      perform private.enqueue_outbox_event('ai.budget_threshold.v1','ai-budget',op,
        jsonb_build_object('workload','voice_transcription','period',u.budget_period,'threshold',threshold,'occurredAt',clock_timestamp()));
    end loop;
  end if;
  insert into private.voice_provider_attempts(operation_id,attempt_no,session_id,model,provider,reserved_cost,max_input_tokens,max_output_tokens)
    values(op,attempts+1,s.id,p_model,p_provider,reservation,(route->'limits'->>'inputTokens')::integer,(route->'limits'->>'outputTokens')::integer);
  return jsonb_build_object('operationId',op,'attemptNo',attempts+1);
end $$;
alter function private.authorize_voice_dispatch(uuid,uuid,text,text,jsonb) owner to masarifi_migration;
revoke all on function private.authorize_voice_dispatch(uuid,uuid,text,text,jsonb) from public;
grant execute on function private.authorize_voice_dispatch(uuid,uuid,text,text,jsonb) to masarifi_worker;

create function private.record_voice_attempt(p_operation_id uuid,p_attempt integer,p_receipt jsonb,p_response_received boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a private.voice_provider_attempts%rowtype; route jsonb; cost numeric; input_count integer; output_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('ai-budget:voice_transcription:'||date_trunc('month',current_date)::date,0));
  select * into a from private.voice_provider_attempts where operation_id=p_operation_id and attempt_no=p_attempt for update;
  if not found then raise exception using errcode='55000',message='AI_DISPATCH_NOT_FOUND'; end if;
  if a.status<>'dispatched' then return jsonb_build_object('recorded',true); end if;
  if p_receipt is null then
    update private.voice_provider_attempts set status=case when p_response_received is true then 'failed' else 'unknown' end
      where operation_id=p_operation_id and attempt_no=p_attempt;
  else
    if jsonb_typeof(p_receipt)<>'object' or p_receipt-array['inputTokens','outputTokens','cost','generationHash','latencyMs','fallbackUsed']<>'{}'::jsonb
      or coalesce(p_receipt->>'inputTokens','') !~ '^[0-9]{1,9}$' or coalesce(p_receipt->>'outputTokens','') !~ '^[0-9]{1,9}$'
      or coalesce(p_receipt->>'cost','') !~ '^(0|[1-9][0-9]*)([.][0-9]{1,12})?$'
      or coalesce(p_receipt->>'generationHash','') !~ '^[0-9a-f]{64}$' then
      raise exception using errcode='22023',message='AI_USAGE_ACCOUNTING_INCOMPLETE'; end if;
    route:=private.get_effective_ai_route('voice_transcription');
    input_count:=(p_receipt->>'inputTokens')::integer; output_count:=(p_receipt->>'outputTokens')::integer;
    cost:=(p_receipt->>'cost')::numeric;
    if cost>a.reserved_cost or input_count>a.max_input_tokens
      or output_count>a.max_output_tokens then
      raise exception using errcode='22023',message='AI_USAGE_ACCOUNTING_INCOMPLETE'; end if;
    update private.voice_provider_attempts set status='completed',input_tokens=input_count,output_tokens=output_count,
      billed_cost=cost,generation_hash=p_receipt->>'generationHash' where operation_id=p_operation_id and attempt_no=p_attempt;
    update private.ai_usage_events set model=a.model,provider=a.provider,
      latency_ms=greatest(latency_ms,coalesce((p_receipt->>'latencyMs')::integer,0)),
      fallback_used=fallback_used or p_attempt>1,provider_generation_hash=p_receipt->>'generationHash' where request_id=p_operation_id::text;
  end if;
  update private.ai_usage_events u set
    input_tokens=(select coalesce(sum(input_tokens),0) from private.voice_provider_attempts where operation_id=p_operation_id),
    output_tokens=(select coalesce(sum(output_tokens),0) from private.voice_provider_attempts where operation_id=p_operation_id),
    estimated_cost=(select sum(coalesce(billed_cost,reserved_cost)) from private.voice_provider_attempts where operation_id=p_operation_id),
    reservation_status=case when exists(select 1 from private.voice_provider_attempts where operation_id=p_operation_id and status<>'completed')
      then 'reserved' else 'completed' end where u.request_id=p_operation_id::text;
  return jsonb_build_object('recorded',true);
end $$;
alter function private.record_voice_attempt(uuid,integer,jsonb,boolean) owner to masarifi_migration;
revoke all on function private.record_voice_attempt(uuid,integer,jsonb,boolean) from public;
grant execute on function private.record_voice_attempt(uuid,integer,jsonb,boolean) to masarifi_worker;

create or replace function private.rollup_ai_usage(p_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare released integer;
begin
  if p_limit is null or p_limit not between 1 and 1000 then raise exception using errcode='22023',message='AI_LIMIT_INVALID'; end if;
  with stale as (select u.id from private.ai_usage_events u where reservation_status='reserved'
    and created_at<clock_timestamp()-interval '2 hours'
    and not exists(select 1 from private.voice_provider_attempts a where a.operation_id::text=u.request_id and a.status<>'completed')
    order by created_at,u.id for update skip locked limit p_limit)
  update private.ai_usage_events u set reservation_status='released' from stale where u.id=stale.id;
  get diagnostics released=row_count;
  return jsonb_build_object('released',released,'rolledUpAt',clock_timestamp());
end $$;

alter table public.voice_proposals add column decision_request jsonb,
  add column normalized_command jsonb,add column ledger_command_key text;
alter table public.voice_proposals add constraint voice_decision_metadata_size check(
  decision_request is null or octet_length(decision_request::text)<=24000);

create function private.voice_committed_receipt(p_id uuid) returns uuid
language sql stable security definer set search_path='' as $$
  select t.id from public.voice_proposals p join public.transactions t
    on t.user_id=p.user_id and t.source='voice' and t.external_ref='voice:'||p.confirmation_operation_id::text
  where p.id=p_id and p.user_id=public.current_clerk_user_id() and p.deleted_at is null
    and ((p.status='executed' and p.executed_transaction_id=t.id)
    or (p.normalized_command is not null and t.kind=p.normalized_command->>'kind'
    and t.amount_minor=(p.normalized_command->>'amountMinor')::bigint
    and btrim(t.currency_code::text)=p.normalized_command->>'currency'
    and t.category_id::text is not distinct from p.normalized_command->>'categoryId'
    and t.merchant is not distinct from p.normalized_command->>'merchant'
    and t.note is not distinct from p.normalized_command->>'note'
    and t.occurred_at=(p.normalized_command->>'occurredAt')::timestamptz
    and exists(select 1 from public.transaction_postings x where x.transaction_id=t.id
      and x.account_id=(p.normalized_command->>'accountId')::uuid))
    or (p.normalized_command is null and (p.executed_transaction_id=t.id or (
      t.amount_minor=abs((p.payload->>'amountMinor')::bigint)
      and t.kind=(case when (p.payload->>'amountMinor')::bigint<0 then 'income' else 'expense' end)
      and btrim(t.currency_code::text)=p.payload->>'currency'
      and t.category_id::text is not distinct from p.payload->>'categoryId'
      and t.merchant is not distinct from p.payload->>'merchant'
      and t.note is not distinct from p.payload->>'note'
      and (t.occurred_at at time zone 'UTC')::date::text=p.payload->>'date'
      and exists(select 1 from public.transaction_postings x where x.transaction_id=t.id and x.account_id::text=p.payload->>'accountId')))))
  limit 1
$$;
alter function private.voice_committed_receipt(uuid) owner to masarifi_migration;
revoke all on function private.voice_committed_receipt(uuid) from public;
create function private.claim_voice_action(p_preview_id uuid,p_expected_version bigint,p_operation_id uuid,p_patch jsonb,p_command jsonb,p_offset integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.voice_proposals%rowtype; s public.voice_sessions%rowtype; session_id uuid; final_payload jsonb;
  request_value jsonb; token uuid:=extensions.gen_random_uuid(); amount numeric; selected_date date; receipt_id uuid;
begin
  perform private.ai_assert_owner(public.current_clerk_user_id());
  select v.session_id into session_id from public.voice_proposals v where v.id=p_preview_id and v.user_id=public.current_clerk_user_id() and v.deleted_at is null;
  select * into s from public.voice_sessions where id=session_id and user_id=public.current_clerk_user_id() and deleted_at is null for update;
  if not found then raise exception using errcode='P0002',message='AI_ACTION_NOT_FOUND'; end if;
  select * into p from public.voice_proposals where id=p_preview_id and user_id=s.user_id and deleted_at is null for update;
  request_value:=jsonb_build_object('expectedVersion',p_expected_version,'editedFields',p_patch,'command',p_command,'timezoneOffsetMinutes',p_offset);
  if p.confirmation_operation_id is not null then
    if p.decision_request is null then raise exception using errcode='40001',message='VOICE_LEGACY_CONFIRMATION_REVIEW_REQUIRED'; end if;
    if p.confirmation_operation_id<>p_operation_id or p.decision_request<>request_value then
      raise exception using errcode='40001',message='IDEMPOTENCY_KEY_REUSED'; end if;
    if p.status='executed' then return jsonb_build_object('id',p.id,'resourceId',p.executed_transaction_id,'replayed',true); end if;
    if p.status='confirmed' then
      receipt_id:=private.voice_committed_receipt(p.id);
      if receipt_id is not null then
        update public.voice_proposals set decision_token=token,decision_lease_until=clock_timestamp()+interval '2 minutes' where id=p.id;
        perform private.complete_voice_action(p.id,token,receipt_id);
        return jsonb_build_object('id',p.id,'resourceId',receipt_id,'replayed',true);
      end if;
      if p.decision_lease_until>clock_timestamp() then return jsonb_build_object('id',p.id,'inProgress',true); end if;
      update public.voice_proposals set decision_token=token,decision_lease_until=clock_timestamp()+interval '2 minutes' where id=p.id;
      return jsonb_build_object('id',p.id,'command',p.normalized_command,'ledgerKey',p.ledger_command_key,'decisionToken',token,'replayed',false);
    end if;
  end if;
  if p.version is distinct from p_expected_version or p.status<>'validated' or s.status<>'proposed' or s.cancelled_at is not null
    or p.expires_at<=clock_timestamp() or s.expires_at<=clock_timestamp() then
    raise exception using errcode='40001',message='AI_ACTION_CONFLICT'; end if;
  if p_patch is null or jsonb_typeof(p_patch)<>'object' or
    p_patch-array['amountMinor','currency','categoryId','accountId','date','merchant','note']<>'{}'::jsonb or
    not(p_patch ?& array['amountMinor','currency','categoryId','accountId','date','merchant','note']) then
    raise exception using errcode='22023',message='AI_EDIT_INVALID'; end if;
  final_payload:=p.payload||p_patch;
  perform private.validate_ai_proposal('voice_transcription',p.schema_version,final_payload,s.user_id);
  amount:=(final_payload->>'amountMinor')::numeric;
  if amount>0 and final_payload->>'categoryId' is null then raise exception using errcode='22023',message='AI_CATEGORY_INVALID'; end if;
  if amount is null or amount=0 or abs(amount)>9007199254740991 or p_offset is null or p_offset not between -840 and 840
    or p_operation_id is null or p_expected_version is null then raise exception using errcode='22023',message='AI_FINANCIAL_VALUE_INVALID'; end if;
  if coalesce(final_payload->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception using errcode='22023',message='AI_DATE_INVALID'; end if;
  selected_date:=(final_payload->>'date')::date;
  if to_char(selected_date,'YYYY-MM-DD')<>final_payload->>'date' or p_command is null or jsonb_typeof(p_command)<>'object'
    or p_command-array['kind','amountMinor','currency','accountId','categoryId','title','merchant','paymentMethod','note','occurredAt','source','externalRef']<>'{}'::jsonb
    or not(p_command ?& array['kind','amountMinor','currency','accountId','categoryId','title','merchant','paymentMethod','note','occurredAt','source','externalRef'])
    or (p_command->>'kind') is distinct from (case when amount<0 then 'income' else 'expense' end)
    or (p_command->>'amountMinor')::numeric is distinct from abs(amount)
    or p_command->>'currency' is distinct from final_payload->>'currency'
    or p_command->>'accountId' is distinct from final_payload->>'accountId'
    or p_command->>'categoryId' is distinct from final_payload->>'categoryId'
    or p_command->>'merchant' is distinct from final_payload->>'merchant'
    or p_command->>'note' is distinct from final_payload->>'note'
    or p_command->>'title' is distinct from coalesce(final_payload->>'merchant','Voice transaction')
    or p_command->>'paymentMethod' is not null
    or p_command->>'source' is distinct from 'voice' or p_command->>'externalRef' is distinct from 'voice:'||p_operation_id::text
    or p_command->>'occurredAt' is null
    or (((p_command->>'occurredAt')::timestamptz-make_interval(mins=>p_offset)) at time zone 'UTC')::date<>selected_date
    or (p_command->>'occurredAt')::timestamptz>clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='AI_FINANCIAL_VALUE_INVALID'; end if;
  if not exists(select 1 from public.accounts a where a.id=(p_command->>'accountId')::uuid and a.user_id=s.user_id
    and a.status='active' and a.deleted_at is null and btrim(a.currency_code::text)=p_command->>'currency') then
    raise exception using errcode='22023',message='AI_ACCOUNT_INVALID'; end if;
  if p_command->>'categoryId' is not null and not exists(select 1 from public.categories c where c.id=(p_command->>'categoryId')::uuid
    and c.active and c.deleted_at is null and (c.user_id is null or c.user_id=s.user_id) and c.kind=p_command->>'kind') then
    raise exception using errcode='22023',message='AI_CATEGORY_INVALID'; end if;
  update public.voice_proposals set payload=final_payload,status='confirmed',confirmed_at=clock_timestamp(),
    confirmation_operation_id=p_operation_id,decision_request=request_value,normalized_command=p_command,
    ledger_command_key='voice-action:'||p.id::text||':'||p_operation_id::text,decision_token=token,decision_action='confirm',
    decision_lease_until=clock_timestamp()+interval '2 minutes' where id=p.id;
  return jsonb_build_object('id',p.id,'command',p_command,'ledgerKey','voice-action:'||p.id::text||':'||p_operation_id::text,
    'decisionToken',token,'replayed',false);
end $$;
alter function private.claim_voice_action(uuid,bigint,uuid,jsonb,jsonb,integer) owner to masarifi_migration;
revoke all on function private.claim_voice_action(uuid,bigint,uuid,jsonb,jsonb,integer) from public;
grant execute on function private.claim_voice_action(uuid,bigint,uuid,jsonb,jsonb,integer) to masarifi_api;

create function private.complete_voice_action(p_preview_id uuid,p_token uuid,p_resource_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.voice_proposals%rowtype; session_id uuid;
begin
  select v.session_id into session_id from public.voice_proposals v where v.id=p_preview_id and v.user_id=public.current_clerk_user_id();
  perform 1 from public.voice_sessions where id=session_id and user_id=public.current_clerk_user_id() for update;
  select * into p from public.voice_proposals where id=p_preview_id and user_id=public.current_clerk_user_id() for update;
  if not found or p.status<>'confirmed' or p.decision_token is distinct from p_token or p.decision_lease_until<=clock_timestamp() then
    raise exception using errcode='40001',message='AI_ACTION_FENCE_INVALID'; end if;
  if private.voice_committed_receipt(p.id) is distinct from p_resource_id then
    raise exception using errcode='22023',message='AI_ACTION_RESULT_INVALID'; end if;
  update public.voice_proposals set status='executed',executed_transaction_id=p_resource_id,
    decision_token=null,decision_action=null,decision_lease_until=null where id=p.id;
  update public.voice_sessions set status='confirmed',confirmed_at=clock_timestamp() where id=p.session_id;
  perform private.enqueue_outbox_event('voice.proposal_confirmed.v1','ai-action',p.id,
    jsonb_build_object('sourceId',p.id,'resourceId',p_resource_id,'occurredAt',clock_timestamp()));
  return jsonb_build_object('id',p.id,'resourceId',p_resource_id);
end $$;
alter function private.complete_voice_action(uuid,uuid,uuid) owner to masarifi_migration;
revoke all on function private.complete_voice_action(uuid,uuid,uuid) from public;
grant execute on function private.complete_voice_action(uuid,uuid,uuid) to masarifi_api;

create function private.abandon_voice_action(p_preview_id uuid,p_token uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare p public.voice_proposals%rowtype; session_id uuid;
begin
  select v.session_id into session_id from public.voice_proposals v where v.id=p_preview_id and v.user_id=public.current_clerk_user_id();
  perform 1 from public.voice_sessions where id=session_id and user_id=public.current_clerk_user_id() for update;
  select * into p from public.voice_proposals where id=p_preview_id and user_id=public.current_clerk_user_id() for update;
  if not found or p.status<>'confirmed' or p.decision_token is distinct from p_token
    or exists(select 1 from public.transactions t where t.user_id=p.user_id and t.source='voice'
      and t.external_ref='voice:'||p.confirmation_operation_id::text) then return false; end if;
  update public.voice_proposals set status='validated',confirmed_at=null,confirmation_operation_id=null,
    decision_request=null,normalized_command=null,ledger_command_key=null,decision_token=null,decision_action=null,decision_lease_until=null where id=p.id;
  return true;
end $$;
alter function private.abandon_voice_action(uuid,uuid) owner to masarifi_migration;
revoke all on function private.abandon_voice_action(uuid,uuid) from public;
grant execute on function private.abandon_voice_action(uuid,uuid) to masarifi_api;
create or replace function private.confirm_ai_action(p_preview_id uuid,p_expected_version bigint,p_operation_id uuid,p_patch jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare voice_row public.voice_proposals%rowtype; assistant_row public.assistant_action_previews%rowtype; token uuid:=extensions.gen_random_uuid(); owner_id text; final_payload jsonb;
begin
  owner_id:=public.current_clerk_user_id();
  if exists(select 1 from public.voice_proposals where id=p_preview_id and user_id=owner_id) then
    raise exception using errcode='40001',message='VOICE_CONTRACT_REQUIRED'; end if;
  select * into assistant_row from public.assistant_action_previews where id=p_preview_id and user_id=owner_id for update;
  if not found then raise exception using errcode='P0002',message='AI_ACTION_NOT_FOUND'; end if;
  if assistant_row.status='executed' and assistant_row.confirmation_operation_id=p_operation_id then
    return jsonb_build_object('sourceKind','assistant','id',assistant_row.id,'actionType',assistant_row.action_type,'resourceId',assistant_row.executed_resource_id,'operationId',p_operation_id,'replayed',true);
  end if;
  if p_patch is null or p_patch<>'{}'::jsonb then raise exception using errcode='22023',message='AI_EDIT_INVALID'; end if;
  if assistant_row.status='confirmed' and assistant_row.confirmation_operation_id=p_operation_id then
    update public.assistant_action_previews set decision_token=token,decision_lease_until=clock_timestamp()+interval '2 minutes' where id=assistant_row.id;
    return jsonb_build_object('sourceKind','assistant','id',assistant_row.id,'actionType',assistant_row.action_type,'payload',assistant_row.payload,'decisionToken',token,'operationId',p_operation_id,'replayed',false,'resumed',true);
  end if;
  if assistant_row.version<>p_expected_version or assistant_row.status<>'validated' then raise exception using errcode='40001',message='AI_ACTION_CONFLICT'; end if;
  if assistant_row.expires_at<=clock_timestamp() then raise exception using errcode='P0001',message='AI_ACTION_EXPIRED'; end if;
  if not exists(select 1 from public.assistant_consents where user_id=owner_id and revoked_at is null) then raise exception using errcode='42501',message='AI_CONSENT_REQUIRED'; end if;
  update public.assistant_action_previews set status='confirmed',confirmed_at=clock_timestamp(),confirmation_operation_id=p_operation_id,decision_token=token,decision_action='confirm',decision_lease_until=clock_timestamp()+interval '2 minutes' where id=assistant_row.id;
  return jsonb_build_object('sourceKind','assistant','id',assistant_row.id,'actionType',assistant_row.action_type,'payload',assistant_row.payload,'decisionToken',token,'operationId',p_operation_id,'replayed',false);
end $$;
alter function private.confirm_ai_action(uuid,bigint,uuid,jsonb) owner to masarifi_migration;
revoke all on function private.confirm_ai_action(uuid,bigint,uuid,jsonb) from public;

reset role;
revoke masarifi_migration from current_user granted by current_user;
