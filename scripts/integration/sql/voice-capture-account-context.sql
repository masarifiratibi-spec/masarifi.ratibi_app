-- Synthetic owner/account fixtures only. Never uploads media, schedules work or commits data.
begin;
grant masarifi_migration to current_user with inherit false,set true;
set local role masarifi_migration;
insert into public.profiles(id,status) values ('voice_context_fixture_a','active'),('voice_context_fixture_b','active');
insert into public.accounts(id,user_id,name,type,currency_code,is_default,sort_order) values
 ('72000000-0000-4000-8000-000000000001','voice_context_fixture_a','Synthetic SAR','cash','SAR',true,0),
 ('72000000-0000-4000-8000-000000000002','voice_context_fixture_a','Synthetic EGP','cash','EGP',false,10000),
 ('72000000-0000-4000-8000-000000000003','voice_context_fixture_b','Synthetic other owner','cash','EGP',true,0),
 ('72000000-0000-4000-8000-000000000004','voice_context_fixture_a','Synthetic archived','cash','SAR',false,0);
update public.accounts set status='archived',deleted_at=clock_timestamp() where id='72000000-0000-4000-8000-000000000004';
insert into public.accounts(user_id,name,type,currency_code,sort_order)
 select 'voice_context_fixture_a','Synthetic extra '||i,'cash','SAR',i from generate_series(1,22) i;

do $test$
declare input jsonb; result jsonb; sid uuid; claim uuid:=extensions.gen_random_uuid(); work jsonb; invalid_account uuid;
  conversation uuid:=extensions.gen_random_uuid(); message uuid:=extensions.gen_random_uuid();
begin
  perform set_config('request.jwt.claims','{"sub":"voice_context_fixture_a","role":"authenticated"}',true);
  input:=jsonb_build_object('locale','ar','contentType','audio/m4a','durationMs',1000,'sizeBytes',100,
    'contentHash',repeat('a',64),'recordedAt',clock_timestamp(),'timezoneOffsetMinutes',-180,
    'accountId','72000000-0000-4000-8000-000000000002');
  result:=private.create_voice_session_v3('voice_context_fixture_a',input,extensions.gen_random_uuid(),300,0,600,'{}');
  sid:=(result->>'id')::uuid;
  if (select default_account_id from private.voice_batch_context where session_id=sid) is distinct from '72000000-0000-4000-8000-000000000002'::uuid then
    raise exception 'SELECTED_ACCOUNT_NOT_CAPTURED';
  end if;
  -- Give this synthetic row a work lease inside this uncommitted transaction only.
  update public.voice_sessions set status='processing',claim_token=claim,claimed_by='synthetic-rollback-test',lease_until=clock_timestamp()+interval '1 minute' where id=sid;
  work:=private.get_ai_work_input_v2('voice.transcribe_extract',sid,claim);
  if not exists(select 1 from jsonb_array_elements(work->'aliases') a where a->>'id'='72000000-0000-4000-8000-000000000002'
    and a->'data'->>'currency'='EGP') then raise exception 'SELECTED_ACCOUNT_OUTSIDE_ALIAS_WINDOW'; end if;
  if exists(select 1 from jsonb_array_elements(work->'aliases') a where a->>'id'='72000000-0000-4000-8000-000000000003') then
    raise exception 'FOREIGN_ACCOUNT_ALIAS_EXPOSED';
  end if;
  result:=private.create_voice_session_v3('voice_context_fixture_a',input-'accountId',extensions.gen_random_uuid(),300,0,600,'{}');
  if (select default_account_id from private.voice_batch_context where session_id=(result->>'id')::uuid) is distinct from '72000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'LEGACY_DEFAULT_CHANGED';
  end if;
  foreach invalid_account in array array['72000000-0000-4000-8000-000000000003'::uuid,'72000000-0000-4000-8000-000000000004'::uuid] loop
    begin
      perform private.create_voice_session_v3('voice_context_fixture_a',input||jsonb_build_object('accountId',invalid_account),extensions.gen_random_uuid(),300,0,600,'{}');
      raise exception 'INVALID_ACCOUNT_ACCEPTED';
    exception when sqlstate 'P0001' then if sqlerrm<>'ACCOUNT_INVALID' then raise; end if; end;
  end loop;
  perform set_config('request.jwt.claims','{"sub":"voice_context_fixture_b","role":"authenticated"}',true);
  result:=private.create_voice_session_v3('voice_context_fixture_b',input||jsonb_build_object('accountId','72000000-0000-4000-8000-000000000003'),extensions.gen_random_uuid(),300,0,600,'{}');
  if (select default_account_id from private.voice_batch_context where session_id=(result->>'id')::uuid) is distinct from '72000000-0000-4000-8000-000000000003'::uuid then
    raise exception 'SECOND_OWNER_CONTEXT_FAILED';
  end if;
  -- Execute the aliases query in the separate branch, including an actual consent and leased message.
  insert into public.assistant_consents(user_id,policy_version) values('voice_context_fixture_b','assistant-privacy-v1');
  insert into public.assistant_conversations(id,user_id) values(conversation,'voice_context_fixture_b');
  insert into public.assistant_messages(id,user_id,conversation_id,role,content_redacted,context_scope,operation_id,
    work_status,claim_token,claimed_by,lease_until) values(message,'voice_context_fixture_b',conversation,'user',
    'Synthetic rollback fixture',array['accounts_summary'],extensions.gen_random_uuid(),'processing',claim,
    'synthetic-rollback-test',clock_timestamp()+interval '1 minute');
  work:=private.get_ai_work_input_v2('assistant.respond',message,claim);
  if not exists(select 1 from jsonb_array_elements(work->'aliases') a where a->>'id'='72000000-0000-4000-8000-000000000003') then
    raise exception 'ASSISTANT_ACCOUNT_ALIASES_BROKEN';
  end if;
end $test$;
rollback;
select 'VOICE_CONTEXT_ROLLBACK_CHECKS_PASSED' as result;
