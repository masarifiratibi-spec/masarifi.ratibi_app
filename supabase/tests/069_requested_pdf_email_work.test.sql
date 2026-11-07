begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_function('private','list_requested_pdf_email_work',array['text','integer','timestamp with time zone'],'requested PDF email selector exists');
select ok(has_function_privilege('masarifi_worker','private.list_requested_pdf_email_work(text,integer,timestamptz)','EXECUTE'),'existing worker role may select email work');
select ok(not has_function_privilege('masarifi_api','private.list_requested_pdf_email_work(text,integer,timestamptz)','EXECUTE'),'API cannot select worker work');
select ok(not has_function_privilege('authenticated','private.list_requested_pdf_email_work(text,integer,timestamptz)','EXECUTE'),'client cannot select worker work');
select ok(not has_function_privilege('anon','private.list_requested_pdf_email_work(text,integer,timestamptz)','EXECUTE'),'anonymous cannot select worker work');
select ok(not has_function_privilege('service_role','private.list_requested_pdf_email_work(text,integer,timestamptz)','EXECUTE'),'storage service role does not gain report work access');

grant masarifi_migration,masarifi_worker to current_user with inherit true,set true;
grant usage on schema extensions to masarifi_worker;
create temporary table requested_email_cutoff as select clock_timestamp()-interval '10 minutes' cutoff;
grant select on requested_email_cutoff to masarifi_worker;
set local role masarifi_migration;
insert into public.profiles(id,status) values('requested-email-worker-fixture','active');
insert into public.profiles(id,status,deleted_at) values
('requested-email-suspended','active',null),
('requested-email-deletion-pending','active',null),
('requested-email-deleted','active',null);
insert into public.report_schedules(id,user_id,report_type,frequency,timezone,next_run_at,delivery_channel,recipient,enabled)
values('99100000-0000-4000-8000-000000000099','requested-email-worker-fixture','financial_summary','monthly','Asia/Riyadh',clock_timestamp()+interval '1 day','email','synthetic@example.test',false);
-- More than one ordinary RPC page of legacy downloads must not starve a new email.
insert into private.report_output_attempts(user_id,report_type,period_start,period_end,ledger_version,snapshot,expires_at,created_at)
select 'requested-email-worker-fixture','financial_summary','2026-10-01','2026-10-31',0,
  '{"format":"pdf","delivery":"download"}',clock_timestamp()+interval '1 hour',clock_timestamp()-interval '5 minutes'
from generate_series(1,101);
insert into private.report_output_attempts(user_id,report_type,period_start,period_end,ledger_version,snapshot,expires_at)
select id,'financial_summary','2026-10-01','2026-10-31',0,'{"format":"pdf","delivery":"email"}',clock_timestamp()+interval '1 hour'
from public.profiles where id in ('requested-email-suspended','requested-email-deletion-pending','requested-email-deleted');
insert into private.report_output_attempts(id,user_id,report_type,period_start,period_end,ledger_version,snapshot,delivery_status,expires_at,created_at,schedule_id)
values
('99100000-0000-4000-8000-000000000001','requested-email-worker-fixture','financial_summary','2026-10-01','2026-10-31',0,'{"format":"pdf","delivery":"email"}','queued',clock_timestamp()+interval '1 hour',clock_timestamp(),null),
('99100000-0000-4000-8000-000000000002','requested-email-worker-fixture','financial_summary','2026-10-01','2026-10-31',0,'{"format":"pdf","delivery":"email"}','ready',clock_timestamp()+interval '1 hour',clock_timestamp(),null),
('99100000-0000-4000-8000-000000000003','requested-email-worker-fixture','financial_summary','2026-10-01','2026-10-31',0,'{"format":"pdf","delivery":"email"}','queued',clock_timestamp()+interval '1 hour',clock_timestamp()-interval '2 hours',null),
('99100000-0000-4000-8000-000000000004','requested-email-worker-fixture','financial_summary','2026-10-01','2026-10-31',0,'{"format":"csv","delivery":"email"}','queued',clock_timestamp()+interval '1 hour',clock_timestamp(),null),
('99100000-0000-4000-8000-000000000005','requested-email-worker-fixture','financial_summary','2026-10-01','2026-10-31',0,'{"format":"pdf","delivery":"email"}','queued',clock_timestamp()+interval '1 hour',clock_timestamp(),'99100000-0000-4000-8000-000000000099'),
('99100000-0000-4000-8000-000000000006','requested-email-worker-fixture','financial_summary','2026-10-01','2026-10-31',0,'{"format":"pdf","delivery":"email"}','queued',clock_timestamp()-interval '1 minute',clock_timestamp()-interval '5 minutes',null);
-- Seed through normal active-owner triggers before freezing the fixture owners.
update public.profiles set status='suspended' where id='requested-email-suspended';
update public.profiles set status='deletion_pending' where id='requested-email-deletion-pending';
update public.profiles set status='deleted',deleted_at=clock_timestamp() where id='requested-email-deleted';
reset role;
select set_config('request.jwt.claims','{"role":"worker"}',true);
set local role masarifi_worker;
select results_eq(
  $$select id from private.list_requested_pdf_email_work('report.generate',1,(select cutoff from requested_email_cutoff))$$,
  $$values ('99100000-0000-4000-8000-000000000001'::uuid)$$,
  'scoped selection filters legacy, old, non-PDF, schedule, ready and expired rows before limit');
select results_eq(
  $$select id from private.list_requested_pdf_email_work('report.generate',100,(select cutoff from requested_email_cutoff))$$,
  $$values ('99100000-0000-4000-8000-000000000001'::uuid)$$,
  'suspended, deletion-pending and deleted owners are excluded too');
select results_eq(
  $$select id from private.list_requested_pdf_email_work('report.email.deliver',100,(select cutoff from requested_email_cutoff))$$,
  $$values ('99100000-0000-4000-8000-000000000002'::uuid)$$,
  'delivery selects only eligible ready PDF email work');
select is((select status from private.read_report_work('99100000-0000-4000-8000-000000000001')),'queued','selection does not claim or mutate the request');
select throws_ok($$select * from private.list_requested_pdf_email_work('report.schedule.enqueue',1,now())$$,'42501','REPORT_EMAIL_WORK_FORBIDDEN','does not enqueue schedules');
select throws_ok($$select * from private.list_requested_pdf_email_work('report.output.expire',1,now())$$,'42501','REPORT_EMAIL_WORK_FORBIDDEN','does not expire/delete existing outputs');
select throws_ok($$select * from private.list_requested_pdf_email_work('report.generate',0,now())$$,'42501','REPORT_EMAIL_WORK_FORBIDDEN','rejects zero limit');
select throws_ok($$select * from private.list_requested_pdf_email_work('report.generate',101,now())$$,'42501','REPORT_EMAIL_WORK_FORBIDDEN','bounds the batch');
select throws_ok($$select * from private.list_requested_pdf_email_work('report.generate',1,null)$$,'42501','REPORT_EMAIL_WORK_FORBIDDEN','requires an acceptance floor');
select throws_ok($$select * from private.list_requested_pdf_email_work('report.generate',1,'-infinity')$$,'42501','REPORT_EMAIL_WORK_FORBIDDEN','rejects unbounded history');
select throws_ok($$select * from private.list_requested_pdf_email_work('report.generate',1,now()+interval '1 day')$$,'42501','REPORT_EMAIL_WORK_FORBIDDEN','rejects future activation');
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select throws_ok($$select * from private.list_requested_pdf_email_work('report.generate',1,now())$$,'42501','REPORT_EMAIL_WORK_FORBIDDEN','requires worker request context too');
select set_config('request.jwt.claims','{}',true);
select throws_ok($$select * from private.list_requested_pdf_email_work('report.generate',1,now())$$,'42501','REPORT_EMAIL_WORK_FORBIDDEN','missing role fails closed');
reset role;
select * from finish();
rollback;
