BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();
GRANT masarifi_migration,masarifi_api,masarifi_worker TO current_user WITH INHERIT true,SET true;
GRANT USAGE ON SCHEMA extensions TO masarifi_worker;
SET LOCAL ROLE masarifi_migration;
INSERT INTO public.profiles(id,status,timezone) VALUES
 ('readiness_20261105_salary_semantics','active','Asia/Riyadh'),
 ('readiness_20261105_assistant_semantics','active','Asia/Riyadh'),
 ('readiness_20261105_assistant_foreign','active','Asia/Riyadh');
INSERT INTO public.salary_profiles(id,user_id,name,amount_minor,currency_code,frequency,expected_day,automatic_detection_enabled)
 SELECT ('c6110580-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'readiness_20261105_salary_semantics','Synthetic salary '||n,125000,'SAR','monthly',20,false FROM generate_series(1,5) n;
INSERT INTO public.transactions(id,user_id,kind,status,amount_minor,currency_code,title,occurred_at)
 SELECT ('c6110581-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'readiness_20261105_salary_semantics','income','confirmed',
   CASE WHEN n=5 THEN 124999 ELSE 125000 END,'SAR','Synthetic salary',
   CASE WHEN n=2 THEN '2026-10-24T00:01:00+03'::timestamptz ELSE '2026-10-19T23:59:00+03'::timestamptz END FROM generate_series(1,5) n;
INSERT INTO public.salary_receipts(id,user_id,salary_profile_id,transaction_id,expected_at,received_at,amount_minor,status,automatically_detected)
 SELECT ('c6110582-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'readiness_20261105_salary_semantics',
 ('c6110580-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('c6110581-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '2026-10-20T00:00:00+03',CASE WHEN n=4 THEN NULL ELSE '2026-10-20T00:01:00+03'::timestamptz END,
 125000,CASE WHEN n=4 THEN 'undone' ELSE 'received' END,n<>3 FROM generate_series(1,5) n;
RESET ROLE;
CREATE TEMP TABLE salary_before AS SELECT id,expected_at,version,received_at FROM public.salary_receipts WHERE user_id='readiness_20261105_salary_semantics';
CREATE TEMP TABLE financial_before AS SELECT md5(string_agg(to_jsonb(t)::text,'' ORDER BY id)) h FROM public.transactions t WHERE user_id='readiness_20261105_salary_semantics';
SET LOCAL ROLE masarifi_worker;
SELECT lives_ok(format('SELECT private.detect_salary_receipts(%L,%L,50)','readiness_20261105_salary_semantics','c6110580-0000-4000-8000-'||lpad(n::text,12,'0')),'salary reconciliation executes for scenario '||n) FROM generate_series(1,5) n;
RESET ROLE;
SELECT is((SELECT status FROM public.salary_receipts WHERE id='c6110582-0000-4000-8000-000000000001'),'corrected','valid local-midnight date edit corrects automatic receipt');
SELECT is((SELECT received_at FROM public.salary_receipts WHERE id='c6110582-0000-4000-8000-000000000001'),'2026-10-19T23:59:00+03'::timestamptz,'salary anchor follows source occurrence');
SELECT is((SELECT status FROM public.salary_receipts WHERE id='c6110582-0000-4000-8000-000000000002'),'undone','outside local date window undoes automatic receipt');
SELECT is((SELECT status FROM public.salary_receipts WHERE id='c6110582-0000-4000-8000-000000000003'),'received','manual link stays unchanged');
SELECT is((SELECT received_at FROM public.salary_receipts WHERE id='c6110582-0000-4000-8000-000000000003'),'2026-10-20T00:01:00+03'::timestamptz,'manual anchor stays unchanged');
SELECT is((SELECT status FROM public.salary_receipts WHERE id='c6110582-0000-4000-8000-000000000004'),'undone','owner undo is not rediscovered');
SELECT is((SELECT status FROM public.salary_receipts WHERE id='c6110582-0000-4000-8000-000000000005'),'undone','amount mismatch undoes automatic receipt');
SELECT ok(NOT EXISTS(SELECT 1 FROM public.salary_receipts r JOIN salary_before b USING(id) WHERE r.expected_at IS DISTINCT FROM b.expected_at),'expected occurrence is preserved');
SELECT is((SELECT count(*) FROM private.outbox_events WHERE aggregate_id='c6110582-0000-4000-8000-000000000001' AND event_type='planning.salary_receipt_corrected'),1::bigint,'one correction event emitted');
SET LOCAL ROLE masarifi_worker;
SELECT lives_ok($$SELECT private.detect_salary_receipts('readiness_20261105_salary_semantics','c6110580-0000-4000-8000-000000000001',50)$$,'corrected receipt retry succeeds');
RESET ROLE;
SELECT is((SELECT version FROM public.salary_receipts WHERE id='c6110582-0000-4000-8000-000000000001'),2::bigint,'retry does not repeat correction');
SELECT is((SELECT md5(string_agg(to_jsonb(t)::text,'' ORDER BY id)) FROM public.transactions t WHERE user_id='readiness_20261105_salary_semantics'),(SELECT h FROM financial_before),'salary reconciliation never changes ledger transactions');
SET LOCAL ROLE masarifi_migration;
INSERT INTO public.assistant_consents(user_id,policy_version) VALUES('readiness_20261105_assistant_semantics','assistant-privacy-v1');
INSERT INTO public.assistant_conversations(id,user_id) VALUES('c6110583-0000-4000-8000-000000000001','readiness_20261105_assistant_semantics');
INSERT INTO public.assistant_messages(id,user_id,conversation_id,role,content_redacted,work_status,context_scope)
 VALUES('c6110583-0000-4000-8000-000000000002','readiness_20261105_assistant_semantics','c6110583-0000-4000-8000-000000000001','user','Synthetic currency ranking','processing',array['recent_transactions']);
INSERT INTO private.assistant_agent_jobs(id,user_id,state,claim_token,lease_until)
 VALUES('c6110583-0000-4000-8000-000000000002','readiness_20261105_assistant_semantics','processing','c6110583-0000-4000-8000-000000000003',clock_timestamp()+interval '5 minutes');
INSERT INTO public.transactions(user_id,kind,status,amount_minor,currency_code,title,occurred_at) VALUES
 ('readiness_20261105_assistant_semantics','expense','confirmed',12345,'SAR','SAR larger','2026-10-01'),
 ('readiness_20261105_assistant_semantics','expense','confirmed',200,'SAR','SAR smaller','2026-10-01'),
 ('readiness_20261105_assistant_semantics','expense','confirmed',900000,'JPY','JPY larger','2026-10-01'),
 ('readiness_20261105_assistant_semantics','expense','confirmed',800000,'JPY','JPY smaller','2026-10-01'),
 ('readiness_20261105_assistant_semantics','expense','confirmed',2,'KWD','KWD larger','2026-10-01'),
 ('readiness_20261105_assistant_semantics','expense','confirmed',1,'KWD','KWD smaller','2026-10-01'),
 ('readiness_20261105_assistant_foreign','expense','confirmed',999999,'SAR','Foreign private row','2026-10-01');
RESET ROLE;
CREATE TEMP TABLE assistant_results(result jsonb);
GRANT INSERT ON assistant_results TO masarifi_worker;
SET LOCAL ROLE masarifi_worker;
INSERT INTO assistant_results SELECT private.read_assistant_agent_data('c6110583-0000-4000-8000-000000000002','c6110583-0000-4000-8000-000000000003','{"tool":"transactions","kind":"expense","sort":"largest","limit":3}');
SELECT throws_ok($$SELECT private.read_assistant_agent_data('c6110583-0000-4000-8000-000000000002','c6110583-0000-4000-8000-000000000099','{"tool":"transactions"}')$$,'42501','ASSISTANT_DATA_FENCE_DENIED','assistant requires valid lease');
RESET ROLE;
SELECT is((SELECT jsonb_agg(i->>'currency' ORDER BY ord) FROM assistant_results,jsonb_array_elements(result#>'{data,transactions,items}') WITH ORDINALITY a(i,ord)),'["JPY","KWD","SAR"]'::jsonb,'largest ranks separately in each currency');
SELECT is((SELECT jsonb_agg(i->>'amountMinor' ORDER BY ord) FROM assistant_results,jsonb_array_elements(result#>'{data,transactions,items}') WITH ORDINALITY a(i,ord)),'["900000","2","12345"]'::jsonb,'largest page returns each currency leader');
SELECT ok((SELECT result::text NOT LIKE '%999999%' AND result::text NOT LIKE '%Foreign private row%' FROM assistant_results),'assistant result excludes foreign owner');
SELECT ok(NOT has_function_privilege('masarifi_api','private.read_assistant_agent_data(uuid,uuid,jsonb)','EXECUTE'),'API cannot invoke worker assistant reader');
SELECT ok(NOT has_function_privilege('masarifi_worker','private.tracking_original_compensation(uuid)','EXECUTE'),'worker cannot bypass compensation wrapper');
SELECT * FROM finish();
ROLLBACK;
