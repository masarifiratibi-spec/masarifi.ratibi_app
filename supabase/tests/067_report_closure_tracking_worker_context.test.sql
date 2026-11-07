begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
grant masarifi_migration,masarifi_api,masarifi_worker to current_user with inherit true,set true;
grant usage on schema extensions to masarifi_api,masarifi_worker;
set local role masarifi_migration;
insert into public.profiles(id,status) values ('closure_worker_ctx_owner','active');
insert into public.accounts(id,user_id,name,type,currency_code,last_four,automatic_tracking_enabled)
 values ('67000000-0000-4000-8000-000000000001','closure_worker_ctx_owner','Synthetic context fixture','bank','AED','4242',true);
insert into public.tracking_preferences(user_id,enabled,review_required) values ('closure_worker_ctx_owner',true,false)
 on conflict(user_id) do update set enabled=true,review_required=false;
insert into public.user_sender_rules(user_id,sender_pattern,display_label,trusted,enabled)
 values ('closure_worker_ctx_owner','ADCBAlert','Synthetic source',true,true);
insert into public.import_sessions(id,user_id,source_type,request_hash,schema_version,status,claim_token,claimed_by,lease_until,item_count) values
 ('67000000-0000-4000-8000-000000000011','closure_worker_ctx_owner','sms',repeat('a',64),2,'processing','67000000-0000-4000-8000-000000000021','context-fixture',clock_timestamp()+interval '1 minute',1),
 ('67000000-0000-4000-8000-000000000012','closure_worker_ctx_owner','sms',repeat('b',64),2,'processing','67000000-0000-4000-8000-000000000022','context-fixture',clock_timestamp()+interval '1 minute',1);
insert into public.import_items(id,user_id,session_id,source_item_key,normalized_hash,source_hash,amount_minor,currency_code,normalized_payload,status)
 select case when s.id='67000000-0000-4000-8000-000000000011' then '67000000-0000-4000-8000-000000000031'::uuid else '67000000-0000-4000-8000-000000000032'::uuid end,'closure_worker_ctx_owner',s.id,'context-'||s.id::text,repeat('c',64),repeat('d',64),-1250,'AED',
 $payload${"sender":"ADCBAlert","amountMinor":-1250,"currency":"AED","accountId":"67000000-0000-4000-8000-000000000001","classification":{"direction":"outgoing","subtype":"card_purchase","status":"completed","disposition":"capture_candidate","amountMinor":1250,"currency":"AED","merchant":"SAMPLE SHOP","instruments":[{"role":"card","suffix":"4242"}],"providerReference":null,"occurredAt":"2026-10-24T00:00:00.000Z","timeProvenance":"received","reasonCodes":[],"appliedRuleKeys":["action.card"],"releaseId":"bundled-report-closure-2026-10-24","engineVersion":"2.0.0"},"metadata":{"ruleConfigurationRevision":"intentionally-stale"},"transport":{"deviceId":"fixture-context-device","channel":"android_sms","nativeIdDigest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","revisionDigest":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}}$payload$::jsonb,'parsed' from public.import_sessions s where s.user_id='closure_worker_ctx_owner';
reset role;
select set_config('request.jwt.claims','{"sub":"prior-worker-context","role":"authenticated","sid":"prior"}',true);
set local role masarifi_worker;
select lives_ok($$select private.finalize_import_session('67000000-0000-4000-8000-000000000011','67000000-0000-4000-8000-000000000021')$$,'valid lease supplies owner context to guarded configuration lookup');
reset role;
select is((select reason from public.review_items where user_id='closure_worker_ctx_owner' limit 1),'configuration_stale','stale configuration is reviewed without bypassing its guard');
set local role masarifi_worker;
select is(current_setting('request.jwt.claims',true),'{"sub":"prior-worker-context","role":"authenticated","sid":"prior"}','successful worker call restores prior claims');
select throws_ok($$select private.finalize_import_session('67000000-0000-4000-8000-000000000012','67000000-0000-4000-8000-000000000099')$$,'40001','IMPORT_LEASE_STALE','wrong fence cannot borrow owner context');
select is(current_setting('request.jwt.claims',true),'{"sub":"prior-worker-context","role":"authenticated","sid":"prior"}','wrong fence leaves prior claims intact');
select throws_ok($$select private.set_tracking_worker_context('session','67000000-0000-4000-8000-000000000012','67000000-0000-4000-8000-000000000099')$$,'40001','IMPORT_LEASE_STALE','context binding rejects a wrong lease');
select is(current_setting('request.jwt.claims',true),'{"sub":"prior-worker-context","role":"authenticated","sid":"prior"}','failed context binding preserves claims');
select lives_ok($$select private.set_tracking_worker_context('session','67000000-0000-4000-8000-000000000012','67000000-0000-4000-8000-000000000022')$$,'session lease binds a worker transaction');
select is(current_setting('request.jwt.claims',true)::jsonb->>'sub','closure_worker_ctx_owner','context owner comes from the session');
select set_config('request.jwt.claims','{"sub":"prior-worker-context","role":"authenticated","sid":"prior"}',true);
select lives_ok($$select private.set_tracking_worker_context('item','67000000-0000-4000-8000-000000000032','67000000-0000-4000-8000-000000000022')$$,'item lease binds through its owned session');
select is(current_setting('request.jwt.claims',true)::jsonb->>'sub','closure_worker_ctx_owner','item caller cannot supply another owner');
select set_config('request.jwt.claims','{"sub":"prior-worker-context","role":"authenticated","sid":"prior"}',true);
select throws_ok($$select private.set_tracking_worker_context('unknown','67000000-0000-4000-8000-000000000012','67000000-0000-4000-8000-000000000022')$$,'22023','IMPORT_CLAIM_INVALID','unknown context kinds are rejected');
reset role;
set local role masarifi_migration;
update public.profiles set status='suspended' where id='closure_worker_ctx_owner';
reset role;
set local role masarifi_worker;
select throws_ok($$select private.finalize_import_session('67000000-0000-4000-8000-000000000012','67000000-0000-4000-8000-000000000022')$$,'42501','PROFILE_INACTIVE','frozen owner remains denied');
select throws_ok($$select private.set_tracking_worker_context('session','67000000-0000-4000-8000-000000000012','67000000-0000-4000-8000-000000000022')$$,'42501','PROFILE_INACTIVE','context binding denies a frozen owner');
select is(current_setting('request.jwt.claims',true),'{"sub":"prior-worker-context","role":"authenticated","sid":"prior"}','failure restores prior claims');
reset role;
select ok(not has_function_privilege('masarifi_api','private.finalize_import_session(uuid,uuid)','EXECUTE'),'API cannot invoke worker finalization');
select ok(not has_function_privilege('masarifi_worker','private.finalize_import_session_before_owner_context(uuid,uuid)','EXECUTE'),'worker cannot bypass the owner-context wrapper');
select ok(not has_function_privilege('masarifi_api','private.set_tracking_worker_context(text,uuid,uuid)','EXECUTE'),'API cannot assume a worker owner context');
select * from finish();
rollback;
