BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();
GRANT masarifi_migration,masarifi_api,masarifi_worker TO current_user WITH INHERIT true,SET true;
GRANT USAGE ON SCHEMA extensions TO masarifi_api,masarifi_worker;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id LIKE 'readiness_20261105_production%') THEN RAISE EXCEPTION 'SYNTHETIC_NAMESPACE_EXISTS'; END IF;
 IF EXISTS(SELECT 1 FROM public.import_sessions WHERE status IN ('received','processing') AND next_attempt_at<='1900-01-01'::timestamptz) THEN RAISE EXCEPTION 'SYNTHETIC_CLAIM_PRIORITY_UNSAFE'; END IF;
END $$;
CREATE TEMP TABLE proof(k text PRIMARY KEY,v jsonb);
GRANT SELECT,INSERT,UPDATE ON proof TO masarifi_api,masarifi_worker,masarifi_migration;
INSERT INTO proof VALUES('events',$events${"android_sms":{"sourceItemKey":"readiness-20261105-android_sms","receivedAt":"2026-11-05T08:15:47.726Z","accountingPolicy":"default_account_nominal_v1","sourceAmountDecimal":"2","activatedAt":"2026-11-05T08:15:47.726Z","sender":"+966500000099","amountMinor":-200,"currency":"SAR","metadata":{"sourceAdmissionPolicy":"financial_content_v1","ruleConfigurationRevision":"replace-from-live-fixture"},"classification":{"direction":"outgoing","subtype":"payment","status":"completed","disposition":"capture_candidate","amountMinor":200,"currency":"SAR","merchant":null,"instruments":[],"occurredAt":"2026-11-05T08:15:47.726Z","timeProvenance":"received","reasonCodes":[],"appliedRuleKeys":["action.payment"],"releaseId":"bundled-currency-identity-2026-10-18","engineVersion":"2.0.0"},"transport":{"deviceId":"c6110590-0000-4000-8000-000000000002","channel":"android_sms","nativeIdDigest":"a5f8cf09e38b6cbd00aef95f78a8bf59b0e4f73b4bb6c89bd10fb8bbc519f573","revisionDigest":"e93a292f94797f6f119ab587ab93358870c38525c803de594c1de963afa11706","installationGeneration":"c6110590-0000-4000-8000-000000000099","installationVersion":1}},"android_notification":{"sourceItemKey":"readiness-20261105-android_notification","receivedAt":"2026-11-05T08:15:47.763Z","accountingPolicy":"default_account_nominal_v1","sourceAmountDecimal":"3","activatedAt":"2026-11-05T08:15:47.763Z","sender":"com.synthetic.payment","amountMinor":-300,"currency":"SAR","metadata":{"sourceAdmissionPolicy":"financial_content_v1","ruleConfigurationRevision":"replace-from-live-fixture","sourcePackage":"com.synthetic.payment"},"classification":{"direction":"outgoing","subtype":"payment","status":"completed","disposition":"capture_candidate","amountMinor":300,"currency":"SAR","merchant":null,"instruments":[],"occurredAt":"2026-11-05T08:15:47.763Z","timeProvenance":"received","reasonCodes":[],"appliedRuleKeys":["action.payment"],"releaseId":"bundled-currency-identity-2026-10-18","engineVersion":"2.0.0"},"transport":{"deviceId":"c6110590-0000-4000-8000-000000000002","channel":"android_notification","nativeIdDigest":"4146c535e0841a112a7f13b9787c058d7cb87c7312577f6df13d2748d709c447","revisionDigest":"2e2a33d0719b2c4a3685d670cea618fceaf1b8e87c7e6beaec18b09bf81d8bcd","installationGeneration":"c6110590-0000-4000-8000-000000000099","installationVersion":1}}}$events$::jsonb);
SET LOCAL ROLE masarifi_migration;
INSERT INTO public.profiles(id,status) VALUES('readiness_20261105_production','active'),('readiness_20261105_production_foreign','active');
INSERT INTO public.accounts(id,user_id,name,type,currency_code,is_default,automatic_tracking_enabled)
 VALUES('c6110590-0000-4000-8000-000000000001','readiness_20261105_production','Synthetic production account','cash','SAR',true,true);
INSERT INTO public.tracking_preferences(user_id,enabled,review_required) VALUES('readiness_20261105_production',true,false);
INSERT INTO public.user_devices(id,user_id,device_fingerprint,clerk_session_id,platform,app_version) VALUES
 ('c6110590-0000-4000-8000-000000000003','readiness_20261105_production','h1:'||repeat('a',64),'synthetic-production-session','android','1.0.0'),
 ('c6110590-0000-4000-8000-000000000004','readiness_20261105_production_foreign','h1:'||repeat('b',64),'synthetic-production-session','android','1.0.0'),
 ('c6110590-0000-4000-8000-000000000005','readiness_20261105_production','h1:'||repeat('c',64),'foreign-session','android','1.0.0'),
 ('c6110590-0000-4000-8000-000000000006','readiness_20261105_production','h1:'||repeat('d',64),'synthetic-production-session','ios','1.0.0');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"readiness_20261105_production","role":"authenticated","sid":"synthetic-production-session"}',true);
SET LOCAL ROLE masarifi_api;
INSERT INTO proof SELECT 'read',private.get_tracking_device_rule_snapshot('readiness_20261105_production','c6110590-0000-4000-8000-000000000002');
RESET ROLE;
SELECT is((SELECT count(*) FROM private.tracking_installations WHERE user_id='readiness_20261105_production'),0::bigint,'GET does not enroll production installation');
SET LOCAL ROLE masarifi_api;
SELECT throws_ok(format($q$SELECT private.configure_tracking_installation('readiness_20261105_production','c6110590-0000-4000-8000-000000000002',%L,0,'{"smsEnabled":false,"notificationEnabled":false}')$q$,id),'22023','DEVICE_NOT_FOUND',label) FROM (VALUES
 ('c6110590-0000-4000-8000-000000000004','foreign device denied'),('c6110590-0000-4000-8000-000000000005','foreign SDK session denied'),('c6110590-0000-4000-8000-000000000006','iOS device denied')) t(id,label);
INSERT INTO proof SELECT 'config',private.configure_tracking_installation('readiness_20261105_production','c6110590-0000-4000-8000-000000000002','c6110590-0000-4000-8000-000000000003',0,
 '{"smsEnabled":true,"smsActivatedAt":"2026-01-01T00:00:00Z","smsActivationId":"42","notificationEnabled":true,"notificationActivatedAt":"2026-01-01T00:00:00Z"}');
SELECT ok((SELECT (v#>>'{installation,captureAllowed}')::boolean AND v->>'rolloutMode'='automatic' FROM proof WHERE k='config'),'explicit consent admits production capture');
SELECT is((SELECT v#>>'{installation,version}' FROM proof WHERE k='config'),'1','first consent version is one');
SELECT ok((SELECT (v#>>'{installation,sources,smsActivatedAt}')::timestamptz>='2026-11-05T00:00:00Z' FROM proof WHERE k='config'),'delayed source activation is clamped to server acceptance');
SELECT is(private.configure_tracking_installation('readiness_20261105_production','c6110590-0000-4000-8000-000000000002','c6110590-0000-4000-8000-000000000003',0,
 '{"smsEnabled":true,"smsActivatedAt":"2026-01-01T00:00:00Z","smsActivationId":"42","notificationEnabled":true,"notificationActivatedAt":"2026-01-01T00:00:00Z"}'),(SELECT v FROM proof WHERE k='config'),'retry returns identical consent receipt');
RESET ROLE;
SELECT is((SELECT count(*) FROM private.tracking_automatic_cohorts WHERE user_id='readiness_20261105_production'),0::bigint,'production enrollment creates no DEV cohort');
-- Use the real parser/normalizer output; bind only server-issued configuration and timestamps.
INSERT INTO proof SELECT channel,jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set((SELECT v->channel FROM proof WHERE k='events'),
 '{transport,installationGeneration}',(SELECT v#>'{installation,generation}' FROM proof WHERE k='config')),
 '{transport,installationVersion}',(SELECT v#>'{installation,version}' FROM proof WHERE k='config')),
 '{metadata,ruleConfigurationRevision}',(SELECT v->'configurationRevision' FROM proof WHERE k='config')),
 '{receivedAt}',to_jsonb(clock_timestamp())),
 '{activatedAt}',(SELECT v#>ARRAY['installation','sources',CASE WHEN channel='android_sms' THEN 'smsActivatedAt' ELSE 'notificationActivatedAt' END] FROM proof WHERE k='config')) FROM (VALUES('android_sms'),('android_notification')) c(channel);
SET LOCAL ROLE masarifi_api;
SELECT throws_ok($$SELECT private.create_import_session('readiness_20261105_production','sms',null,3,repeat('a',64),jsonb_build_array((SELECT v#-'{transport,installationGeneration}' FROM proof WHERE k='android_sms')))$$,'40001','TRACKING_INSTALLATION_STALE','missing generation rejected before capture');
SELECT throws_ok($$SELECT private.create_import_session('readiness_20261105_production','sms',null,3,repeat('b',64),jsonb_build_array((SELECT jsonb_set(v,'{receivedAt}','"2026-01-01T00:00:00Z"') FROM proof WHERE k='android_sms')))$$,'40001','TRACKING_INSTALLATION_STALE','pre-consent event rejected');
INSERT INTO proof SELECT 'sms-session',private.create_import_session('readiness_20261105_production','sms',null,3,repeat('c',64),jsonb_build_array((SELECT v FROM proof WHERE k='android_sms')));
RESET ROLE;
UPDATE public.import_sessions SET next_attempt_at='1900-01-01' WHERE id=(SELECT (v->>'id')::uuid FROM proof WHERE k='sms-session') AND user_id='readiness_20261105_production';
SET LOCAL ROLE masarifi_worker;
INSERT INTO proof SELECT 'sms-claim',to_jsonb(c) FROM private.claim_import_session('synthetic-production-worker',1,120) c;
SELECT is((SELECT v->>'user_id' FROM proof WHERE k='sms-claim'),'readiness_20261105_production','real worker claim consumes only synthetic owner');
SELECT lives_ok($$SELECT private.set_tracking_worker_context('session',(SELECT (v->>'id')::uuid FROM proof WHERE k='sms-claim'),(SELECT (v->>'claim_token')::uuid FROM proof WHERE k='sms-claim'))$$,'worker context derives from actual lease');
SELECT lives_ok($$SELECT private.prepare_import_session((SELECT (v->>'id')::uuid FROM proof WHERE k='sms-claim'),(SELECT (v->>'claim_token')::uuid FROM proof WHERE k='sms-claim'))$$,'SMS preparation succeeds');
INSERT INTO proof SELECT 'sms-finalized',private.finalize_import_session((SELECT (v->>'id')::uuid FROM proof WHERE k='sms-claim'),(SELECT (v->>'claim_token')::uuid FROM proof WHERE k='sms-claim'));
SELECT is((SELECT jsonb_array_length(v->'autoItems') FROM proof WHERE k='sms-finalized'),1,'SMS finalizer returns one automatic item');
RESET ROLE;
INSERT INTO proof SELECT 'sms-item',to_jsonb(i) FROM public.import_items i WHERE session_id=(SELECT (v->>'id')::uuid FROM proof WHERE k='sms-session');
SET LOCAL ROLE masarifi_worker;
INSERT INTO proof SELECT 'sms-saved',private.commit_tracking_nominal_capture((SELECT (v->>'id')::uuid FROM proof WHERE k='sms-item'),(SELECT (v->>'claim_token')::uuid FROM proof WHERE k='sms-claim'));
SELECT is((SELECT v->>'status' FROM proof WHERE k='sms-saved'),'accepted','SMS creates accepted ledger receipt');
SELECT is(private.commit_tracking_nominal_capture((SELECT (v->>'id')::uuid FROM proof WHERE k='sms-item'),(SELECT (v->>'claim_token')::uuid FROM proof WHERE k='sms-claim')),(SELECT v FROM proof WHERE k='sms-saved'),'commit retry returns exact receipt');
SELECT lives_ok($$SELECT private.complete_import_attempt((SELECT (v->>'id')::uuid FROM proof WHERE k='sms-claim'),(SELECT (v->>'claim_token')::uuid FROM proof WHERE k='sms-claim'),'succeeded',null)$$,'SMS worker completes claimed attempt');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.transactions WHERE user_id='readiness_20261105_production'),1::bigint,'SMS retry creates one transaction');
SELECT is((SELECT confirmed_minor FROM public.account_balances WHERE account_id='c6110590-0000-4000-8000-000000000001'),(-200)::bigint,'SMS posting updates account by exact amount');
SELECT is((SELECT count(*) FROM public.tracking_history WHERE user_id='readiness_20261105_production' AND outcome='accepted'),1::bigint,'SMS confirmation history records acceptance');
SELECT is((SELECT status FROM public.import_sessions WHERE id=(SELECT (v->>'id')::uuid FROM proof WHERE k='sms-session')),'complete','SMS session reaches completed status');
SELECT set_config('request.jwt.claims','{"sub":"readiness_20261105_production","role":"authenticated","sid":"synthetic-production-session"}',true);
SET LOCAL ROLE masarifi_api;
INSERT INTO proof SELECT 'notification-session',private.create_import_session('readiness_20261105_production','provider',null,3,repeat('d',64),jsonb_build_array((SELECT v FROM proof WHERE k='android_notification')));
RESET ROLE;
UPDATE public.import_sessions SET next_attempt_at='1900-01-01' WHERE id=(SELECT (v->>'id')::uuid FROM proof WHERE k='notification-session') AND user_id='readiness_20261105_production';
SET LOCAL ROLE masarifi_worker;
INSERT INTO proof SELECT 'notification-claim',to_jsonb(c) FROM private.claim_import_session('synthetic-production-worker',1,120) c;
SELECT lives_ok($$SELECT private.set_tracking_worker_context('session',(SELECT (v->>'id')::uuid FROM proof WHERE k='notification-claim'),(SELECT (v->>'claim_token')::uuid FROM proof WHERE k='notification-claim'))$$,'notification context derives from actual lease');
SELECT lives_ok($$SELECT private.prepare_import_session((SELECT (v->>'id')::uuid FROM proof WHERE k='notification-claim'),(SELECT (v->>'claim_token')::uuid FROM proof WHERE k='notification-claim'))$$,'notification preparation succeeds');
INSERT INTO proof SELECT 'notification-finalized',private.finalize_import_session((SELECT (v->>'id')::uuid FROM proof WHERE k='notification-claim'),(SELECT (v->>'claim_token')::uuid FROM proof WHERE k='notification-claim'));
SELECT is((SELECT jsonb_array_length(v->'autoItems') FROM proof WHERE k='notification-finalized'),1,'notification finalizer returns one automatic item');
RESET ROLE;
INSERT INTO proof SELECT 'notification-item',to_jsonb(i) FROM public.import_items i WHERE session_id=(SELECT (v->>'id')::uuid FROM proof WHERE k='notification-session');
SET LOCAL ROLE masarifi_worker;
INSERT INTO proof SELECT 'notification-saved',private.commit_tracking_nominal_capture((SELECT (v->>'id')::uuid FROM proof WHERE k='notification-item'),(SELECT (v->>'claim_token')::uuid FROM proof WHERE k='notification-claim'));
SELECT is((SELECT v->>'status' FROM proof WHERE k='notification-saved'),'accepted','notification creates accepted ledger receipt');
SELECT lives_ok($$SELECT private.complete_import_attempt((SELECT (v->>'id')::uuid FROM proof WHERE k='notification-claim'),(SELECT (v->>'claim_token')::uuid FROM proof WHERE k='notification-claim'),'succeeded',null)$$,'notification worker completes claimed attempt');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.transactions WHERE user_id='readiness_20261105_production'),2::bigint,'SMS and notification create exactly two operations');
SELECT is((SELECT confirmed_minor FROM public.account_balances WHERE account_id='c6110590-0000-4000-8000-000000000001'),(-500)::bigint,'account contains exact SMS and notification amounts');
SELECT set_config('request.jwt.claims','{"sub":"readiness_20261105_production","role":"authenticated","sid":"synthetic-production-session"}',true);
SET LOCAL ROLE masarifi_api;
INSERT INTO proof SELECT 'disabled',private.configure_tracking_installation('readiness_20261105_production','c6110590-0000-4000-8000-000000000002','c6110590-0000-4000-8000-000000000003',1,'{"smsEnabled":false,"notificationEnabled":false}');
SELECT ok((SELECT v#>>'{installation,captureAllowed}'='false' AND v#>>'{installation,version}'='2' FROM proof WHERE k='disabled'),'disable rotates consent and stops admission');
SELECT throws_ok($$SELECT private.create_import_session('readiness_20261105_production','sms',null,3,repeat('e',64),jsonb_build_array((SELECT v FROM proof WHERE k='android_sms')))$$,'40001','TRACKING_INSTALLATION_STALE','old consent cannot admit a new operation');
SELECT is(private.create_import_session('readiness_20261105_production','sms',null,3,repeat('c',64),jsonb_build_array((SELECT v FROM proof WHERE k='android_sms')))->>'id',(SELECT v->>'id' FROM proof WHERE k='sms-session'),'accepted request retains original identity after revocation');
INSERT INTO proof SELECT 'reenabled',private.configure_tracking_installation('readiness_20261105_production','c6110590-0000-4000-8000-000000000002','c6110590-0000-4000-8000-000000000003',2,
 '{"smsEnabled":true,"smsActivatedAt":"2026-01-01T00:00:00Z","smsActivationId":"43","notificationEnabled":true,"notificationActivatedAt":"2026-01-01T00:00:00Z"}');
SELECT ok((SELECT v#>>'{installation,captureAllowed}'='true' AND v#>>'{installation,version}'='3' AND v#>>'{installation,generation}'<>(SELECT v#>>'{installation,generation}' FROM proof WHERE k='config') FROM proof WHERE k='reenabled'),'re-enable requires new generation and approval');
SELECT throws_ok($$SELECT private.create_import_session('readiness_20261105_production','sms',null,3,repeat('f',64),jsonb_build_array((SELECT v FROM proof WHERE k='android_sms')))$$,'40001','TRACKING_INSTALLATION_STALE','re-enable never admits old generation');
RESET ROLE;
UPDATE public.tracking_preferences SET enabled=false WHERE user_id='readiness_20261105_production';
UPDATE public.tracking_preferences SET enabled=true WHERE user_id='readiness_20261105_production';
SET LOCAL ROLE masarifi_api;
SELECT ok(NOT (private.get_tracking_device_rule_snapshot('readiness_20261105_production','c6110590-0000-4000-8000-000000000002')#>>'{installation,captureAllowed}')::boolean,'unpause does not resurrect revoked authority');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.transactions WHERE user_id='readiness_20261105_production'),2::bigint,'retries and consent transitions create no additional ledger effects');
SELECT ok(NOT has_table_privilege(role,'private.tracking_installations','SELECT,INSERT,UPDATE,DELETE'),'private production metadata denied to '||role) FROM unnest(array['anon','authenticated','masarifi_api','masarifi_worker']) role;
SELECT * FROM finish();
ROLLBACK;
