-- Read-only. The five job keys below had completed runs in the Nov 21 production sample.
-- Collect the specialized worker health checks alongside this output.
begin read only;
set local statement_timeout='3s';
select j.job_key,j.owner_spec,j.enabled,j.next_run_at,
  case when j.job_key='platform.outbox.dispatch' then 'OutboxWorkerService / forward publisher'
       when j.job_key like 'clerk.%' then 'ClerkWebhookWorker'
       when j.job_key='privacy.financial-reset-cleanup' then 'FinancialResetWorker'
       when j.job_key ~ '^(security|privacy|retention)\.' then 'SecurityWorkerService'
       when j.job_key='ledger.reconcile' then 'LedgerWorker'
       when j.job_key ~ '^(sync-mutations|idempotency|sync-state|conflicts)\.' then 'SyncWorker'
       when j.job_key like 'planning.%' then 'PlanningWorker'
       when j.job_key ~ '^(import|parser|raw|tracking)\.' then 'TrackingWorker'
       when j.job_key ~ '^(voice-media|voice|ai|assistant|financial-insights)\.' then 'AiWorker'
       when j.job_key like 'report.%' then 'ReportsWorker'
       when j.job_key ~ '^(source|notification|support-attachment)\.' then 'EngagementWorker'
       when j.job_key like 'operations.%' then 'OperationsService'
       else 'unmapped' end as registered_handler,
  r.status,r.queued_at as last_queued_at,
  case when not j.enabled then 'disabled in registry'
       when j.schedule is null then 'event/manual'
       when j.job_key in ('platform.outbox.dispatch','sync-mutations.retry','privacy.financial-reset-cleanup',
         'privacy.account-delete','import.parse') then 'observed scheduler scope'
       when j.job_key='operations.job-history-retain' then 'retention release scope'
       else 'verify worker scope with feature owner' end as runtime_evidence,
  case when j.enabled and j.schedule is not null and j.next_run_at < now() - interval '1 day'
      then 'overdue' end as schedule_alert
from private.scheduled_jobs j left join lateral (
  select status,queued_at from private.job_runs where job_key=j.job_key
  order by queued_at desc,id desc limit 1
) r on true order by j.owner_spec,j.job_key;
-- Inventory at most the oldest 3000 queue entries; counts are sample counts.
select coalesce(message->>'eventType','(missing type)') as event_type,count(*) as sampled,
  min(enqueued_at) as oldest, max(read_ct) as highest_read_count from (
  select message,enqueued_at,read_ct from pgmq."q_platform-events" order by msg_id limit 3000
) oldest group by 1 order by 2 desc;
commit;
