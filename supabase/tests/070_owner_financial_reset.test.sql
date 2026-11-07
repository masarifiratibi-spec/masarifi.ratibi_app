begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
grant masarifi_migration,masarifi_api,masarifi_worker to current_user with inherit true,set true;
grant usage on schema extensions to masarifi_api,masarifi_worker;
set local role masarifi_migration;
insert into public.profiles(id,status) values('reset_fixture_a','active'),('reset_fixture_b','active');
insert into public.admin_profiles(user_id,status) values('reset_fixture_a','active');
insert into private.retention_policies(resource_type,retention_days,deletion_mode,legal_basis)
values ('reset-test',30,'delete','Synthetic hold policy');
insert into private.retention_holds(resource_type,resource_id,reason,created_by)
values ('reset-test','70000000-0000-4000-8000-000000000004','Synthetic category hold','reset_fixture_a');
insert into public.accounts(id,user_id,name,type,currency_code,is_default) values
 ('70000000-0000-4000-8000-000000000001','reset_fixture_a','Current','bank','SAR',true),
 ('70000000-0000-4000-8000-000000000002','reset_fixture_b','Other','cash','SAR',true);
insert into public.accounts(id,user_id,name,type,currency_code,status,deleted_at) values
 ('70000000-0000-4000-8000-000000000003','reset_fixture_a','Archived','wallet','USD','archived',now());
insert into public.user_devices(id,user_id,device_fingerprint,clerk_session_id,platform,app_version)
values('70000000-0000-4000-8000-000000000007','reset_fixture_a','h1:'||repeat('f',64),'reset-session','android','1.0.0');
insert into public.voice_sessions(user_id,locale,content_type,size_bytes,duration_ms,expires_at,operation_id,storage_ref,media_capability_expires_at)
values('reset_fixture_a','en','audio/mp4',10,100,now()+interval '2 hours',gen_random_uuid(),
  'voice/70000000-0000-4000-8000-000000000008/70000000-0000-4000-8000-000000000009',now()+interval '1 hour');
insert into public.security_events(user_id,event_type,severity) values('reset_fixture_a','security.fixture','info');
insert into public.categories(id,user_id,kind,label_ar,label_en)
values ('70000000-0000-4000-8000-000000000004','reset_fixture_a','expense','Fixture','Fixture');
insert into public.user_keyword_rules(user_id,keyword,group_key,language_code,match_type,category_id)
values('reset_fixture_a','test keyword','financial','en','exact','70000000-0000-4000-8000-000000000004');
insert into private.report_output_attempts(id,user_id,report_type,period_start,period_end,ledger_version,snapshot,expires_at)
values ('70000000-0000-4000-8000-000000000004','reset_fixture_b','financial_summary','2026-10-01','2026-10-31',0,'{"format":"pdf"}',clock_timestamp()+interval '1 hour');
select private.enqueue_outbox_event('report.requested','report_attempt','70000000-0000-4000-8000-000000000004','{"format":"pdf"}');
insert into private.privacy_export_requests(user_id,status,scope,verified_at)
values('reset_fixture_a','verified','["identity@1"]',clock_timestamp());
insert into private.report_output_attempts(user_id,report_type,period_start,period_end,ledger_version,snapshot,expires_at)
values ('reset_fixture_a','financial_summary','2026-10-01','2026-10-31',0,'{"format":"pdf"}',clock_timestamp()+interval '1 hour');
reset role;
set local role masarifi_api;
select set_config('request.jwt.claims','{"sub":"reset_fixture_b","role":"authenticated"}',true);
select private.post_opening_transaction('reset_fixture_b','70000000-0000-4000-8000-000000000002',60,'Opening',now(),'manual');
select throws_ok($$select * from private.reset_financial_data('reset_fixture_a',gen_random_uuid())$$,
 '28000','AUTH_TOKEN_INVALID','cross-owner reset denied');
select set_config('request.jwt.claims','{"sub":"reset_fixture_a","sid":"reset-session","role":"authenticated"}',true);
reset role;
create temporary table scoped_raw as select private.tracking_upload_prefix('reset_fixture_a')||'70000000-0000-4000-8000-000000000012' as ref;
grant select on scoped_raw to masarifi_api,masarifi_worker;
set local role masarifi_api;
select lives_ok(format($$select private.reserve_tracking_upload('reset_fixture_a',%L,%L,'text/csv',25)$$,ref,repeat('c',64)),
  'owner upload has durable cleanup before the first byte is sent') from scoped_raw;
select throws_ok($$select private.reserve_tracking_upload('reset_fixture_a','tracking/70000000-0000-4000-8000-000000000011/70000000-0000-4000-8000-000000000012',repeat('c',64),'text/csv',25)$$,
  '22023','RAW_PAYLOAD_INVALID','another owner path cannot be reserved');
select private.post_opening_transaction('reset_fixture_a','70000000-0000-4000-8000-000000000001',100,'Opening',now(),'manual');
select throws_ok($$select * from private.reset_financial_data('reset_fixture_a','70000000-0000-4000-8000-000000000005')$$,
  '55000','FINANCIAL_RESET_ACTIVE_HOLD','active hold on a child resource blocks the whole reset');
select is((select generation from private.financial_reset_state('reset_fixture_a')),0::bigint,'failed attempt has no generation or receipt');
reset role;
delete from private.retention_holds where resource_type='reset-test';
set local role masarifi_api;
select is((select generation from private.reset_financial_data('reset_fixture_a','70000000-0000-4000-8000-000000000005')),
 1::bigint,'reset commits first generation');
select ok((select cleanup_pending from private.financial_reset_receipt('reset_fixture_a','70000000-0000-4000-8000-000000000005')),
  'receipt remains pending while a report object needs removal');
select is((select generation from private.reset_financial_data('reset_fixture_a','70000000-0000-4000-8000-000000000005')),
 1::bigint,'same UUID replays prior receipt even without updating generation');
select is((select count(*) from public.transactions where user_id='reset_fixture_a'),0::bigint,'ledger cleared');
select throws_ok($$select private.post_opening_transaction('reset_fixture_a','70000000-0000-4000-8000-000000000001',25,'Old client',now(),'manual')$$,
 '40001','FINANCIAL_CLIENT_UPDATE_REQUIRED','old client must upgrade after the owner reset');
select set_config('masarifi.financial_generation','0',true);
select throws_ok($$select private.post_opening_transaction('reset_fixture_a','70000000-0000-4000-8000-000000000001',25,'Stale client',now(),'manual')$$,
 '40001','FINANCIAL_GENERATION_STALE','explicit old generation cannot recreate deleted work');
select ok(not has_function_privilege('masarifi_api','private.complete_financial_reset_object(text,uuid,text,text)','execute'),
  'API cannot acknowledge external object deletion');
reset role;
set local role masarifi_worker;
select private.complete_financial_reset_object('reset_fixture_a','70000000-0000-4000-8000-000000000005','voice',
 'voice/70000000-0000-4000-8000-000000000008/70000000-0000-4000-8000-000000000009');
reset role;
set local role masarifi_api;
select ok((select cleanup_pending from private.financial_reset_receipt('reset_fixture_a','70000000-0000-4000-8000-000000000005')),'live voice upload capability keeps removal pending');
select set_config('masarifi.financial_generation','1',true);
select * from private.receive_client_mutation('reset_fixture_a','70000000-0000-4000-8000-000000000007',0,
 '70000000-0000-4000-8000-000000000010','transactions','transaction',1,'{}','update','local-item',1,'sha256:'||repeat('d',64),'{}');
select throws_ok($$select * from private.reset_financial_data('reset_fixture_a',gen_random_uuid())$$,
 '55000','FINANCIAL_RESET_CLEANUP_PENDING','distinct reset waits for prior cleanup');
reset role;
select is((select count(*) from private.financial_reset_objects
  where owner_id='reset_fixture_a' and request_id='70000000-0000-4000-8000-000000000005' and kind='report' and storage_ref like 'reports/%.pdf'),1::bigint,'deterministic path recovered for unfinished report');
reset role;
select ok(exists(select 1 from public.admin_profiles where user_id='reset_fixture_a' and status='active'),'dashboard membership retained');
select ok(exists(select 1 from private.outbox_events where aggregate_type='report_attempt' and aggregate_id='70000000-0000-4000-8000-000000000004'),
  'different-owner report with same UUID as erased category keeps its ownerless legacy event');
select ok(exists(select 1 from private.privacy_export_requests where user_id='reset_fixture_a' and scope='["identity@1"]'),
  'identity-only privacy export survives financial reset');
select ok(exists(select 1 from private.financial_reset_objects where owner_id='reset_fixture_a' and kind='tracking'
  and storage_ref=(select ref from scoped_raw) and protect_until>clock_timestamp()),
  'unregistered tracking file moves into protected cleanup');
select is((select count(*) from public.security_events where user_id='reset_fixture_a' and event_type='security.fixture'),1::bigint,'security evidence retained');
select ok(exists(select 1 from public.accounts where id='70000000-0000-4000-8000-000000000003' and currency_code='USD' and status='archived'),'archived account identity/currency preserved');
select ok(exists(select 1 from public.accounts where id='70000000-0000-4000-8000-000000000001' and is_default),'default bank preserved');
select is((select count(*) from public.account_balances b join public.accounts a on a.id=b.account_id
 where a.user_id='reset_fixture_a' and b.confirmed_minor=0 and b.pending_minor=0),2::bigint,'all owner balances zero including archived account');
select is((select confirmed_minor from public.account_balances where account_id='70000000-0000-4000-8000-000000000002'),60::bigint,'other owner balance preserved');
select is((select count(*) from public.transactions where user_id='reset_fixture_b'),1::bigint,'other owner ledger preserved');
select ok(not exists(select 1 from public.categories where user_id='reset_fixture_a'),'custom categories cleared');
select ok(exists(select 1 from public.user_keyword_rules where user_id='reset_fixture_a' and keyword='test keyword' and category_id is null),'tracking rule survives its erased category');
select ok(not exists(select 1 from private.outbox_events where payload#>>'{sync,userId}'='reset_fixture_a' and payload#>>'{sync,domain}'='transactions'),'old ledger snapshots cleared');
select ok(not has_function_privilege('authenticated','private.reset_financial_data(text,uuid)','execute')
  and not has_table_privilege('masarifi_api','private.financial_reset_context','insert'),'clients cannot bypass the reset command');
set local role masarifi_worker;
select set_config('masarifi.financial_generation','',true);
create temporary table reset_sync_claim as select w.*,private.bind_financial_worker_generation('sync',w.id,w.lease_token) generation
  from private.claim_client_mutations('reset-fixture',100,60) w where w.user_id='reset_fixture_a';
select is((select generation from reset_sync_claim where user_id='reset_fixture_a'),1::bigint,'current sync claim binds generation in the claiming SELECT');
select lives_ok(format($$select private.complete_client_mutation('%s','%s','applied','{}',null)$$,
  (select id from reset_sync_claim),(select lease_token from reset_sync_claim)),'valid worker generation permits a new financial mutation');
select ok(not private.allow_financial_notification('reset_fixture_a',now()-interval '1 hour'),'pre-reset finance notice suppressed');
select ok(private.allow_financial_notification('reset_fixture_a',clock_timestamp()),'fresh financial notice admitted');
select is((select count(*) from private.list_pending_financial_reset_objects(5,'reset_fixture_b')),0::bigint,'scoped worker cannot enumerate unrelated pending objects');
select throws_ok($$select private.bind_financial_worker_generation('import',gen_random_uuid(),gen_random_uuid())$$,'40001','FINANCIAL_GENERATION_STALE','obsolete job cannot bind to current generation');
reset role;
set local role masarifi_api;
select private.post_opening_transaction('reset_fixture_a','70000000-0000-4000-8000-000000000001',25,'Fresh start',now(),'manual');
select is((select generation from private.reset_financial_data('reset_fixture_a','70000000-0000-4000-8000-000000000005')),
  1::bigint,'retry after new ledger work does not erase it');
select is((select confirmed_minor from public.account_balances where account_id='70000000-0000-4000-8000-000000000001'),
  25::bigint,'new ledger work stays posted');
reset role;
-- Run the established destructive account-erasure functions with a reset manifest still pending.
set local role masarifi_migration;
insert into private.account_deletion_requests(id,user_id,status,requested_at,verified_at,cooling_off_ends_at)
values ('70000000-0000-4000-8000-000000000006','reset_fixture_a','processing',clock_timestamp()-interval '2 hours',
 clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour');
reset role;
set local role masarifi_worker;
select private.freeze_account_deletion_owner('70000000-0000-4000-8000-000000000006','reset_fixture_a');
select private.prepare_account_owner_erasure('70000000-0000-4000-8000-000000000006','reset_fixture_a');
select * from private.lock_account_erasure_objects('70000000-0000-4000-8000-000000000006','reset_fixture_a');
select lives_ok($$select private.erase_account_owner_payload('70000000-0000-4000-8000-000000000006','reset_fixture_a')$$,
 'full account erasure succeeds after financial reset');
reset role;
set local role masarifi_migration;
update public.profiles set status='deleted',deleted_at=clock_timestamp() where id='reset_fixture_a';
reset role;
select is((select count(*) from private.financial_reset_objects where owner_id='reset_fixture_a'),3::bigint,'pending objects remain discoverable after profile deletion');
set local role masarifi_worker;
select private.complete_financial_reset_object(owner_id,request_id,kind,storage_ref) from private.list_pending_financial_reset_objects(10,'reset_fixture_a');
reset role;
select is((select count(*) from private.financial_reset_objects where owner_id='reset_fixture_a' and kind='voice'),1::bigint,
 'voice object instruction survives until upload capability expires');
set local role masarifi_migration;
update private.financial_reset_objects set protect_until=now()-interval '1 second',next_attempt_at=now()-interval '1 second' where owner_id='reset_fixture_a';
reset role;
set local role masarifi_worker;
select private.complete_financial_reset_object(owner_id,request_id,kind,storage_ref) from private.list_pending_financial_reset_objects(10,'reset_fixture_a');
reset role;
select is((select count(*) from private.financial_reset_receipts where owner_id='reset_fixture_a'),0::bigint,'finished account erasure retires final reset receipt');
select * from finish();
rollback;
