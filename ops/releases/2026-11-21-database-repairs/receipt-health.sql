begin read only;
set local statement_timeout='2s';
-- Alert if the oldest due, owned receipt is over two cron intervals old.
with oldest as (
  select q.enqueued_at from private.report_receipt_consumer_start s join pgmq."q_platform-events" q
    on q.enqueued_at >= s.activated_at
  where q.message->>'eventType'='report.delivery_succeeded' and q.vt <= now()
    and not exists(select from private.report_receipt_issues i where i.msg_id=q.msg_id)
  order by q.enqueued_at,q.msg_id limit 1
)
select (select max(accepted_at) from private.report_delivery_receipts) as latest_recorded_smtp_acceptance,
  s.activated_at, s.last_completed_at, coalesce(j.active,false) as cron_enabled, last_run.status as latest_cron_status,
  (s.activated_at is null or j.jobid is null or not j.active or coalesce(last_run.status='failed' and last_run.start_time >= coalesce(s.last_completed_at,s.activated_at),false)
   or (s.activated_at < now()-interval '15 minutes'
       and coalesce(s.last_completed_at,s.activated_at) < now()-interval '15 minutes')) as worker_alert, (select now()-enqueued_at from oldest) as oldest_due_age,
  coalesce((select now()-enqueued_at > interval '10 minutes' from oldest),false) as lag_alert,
  (select count(*) from (select from private.report_receipt_issues limit 101) issues) as issues_capped_at_101
from (values(true)) expected(singleton)
left join private.report_receipt_consumer_start s using(singleton)
left join cron.job j on j.jobname='masarifi-report-delivery-receipts' and j.username=current_user
left join lateral (select status,start_time from cron.job_run_details d where d.jobid=j.jobid
  order by runid desc limit 1) last_run on true;
commit;
