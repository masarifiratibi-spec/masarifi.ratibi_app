-- Disposable/local database only. Caller wraps the test in a rolled-back transaction.
DO $test$
DECLARE
  test_case record;
  job private.scheduled_jobs%rowtype;
  run_id uuid;
  attempt_id uuid;
  retry_parent uuid;
  observed text[];
BEGIN
  FOR test_case IN SELECT * FROM (VALUES
    ('platform.outbox.dispatch', 'succeeded', '0', 1, false, NULL),
    ('platform.outbox.dispatch', 'succeeded', '5', 1, false, NULL),
    ('import.parse', 'succeeded', '0', 1, false, NULL),
    ('privacy.financial-reset-cleanup', 'succeeded', '0', 1, false, NULL),
    ('sync-mutations.retry', 'succeeded', '0', 1, false, NULL),
    ('import.parse', 'succeeded', '1', 1, false, 'operations.job-succeeded'),
    ('privacy.financial-reset-cleanup', 'succeeded', '2', 1, false, 'operations.job-succeeded'),
    ('privacy.account-delete', 'succeeded', '0', 1, false, 'operations.job-succeeded'),
    ('platform.outbox.dispatch', 'succeeded', '"0"', 1, false, 'operations.job-succeeded'),
    ('platform.outbox.dispatch', 'succeeded', 'null', 1, false, 'operations.job-succeeded'),
    ('platform.outbox.dispatch', 'succeeded', '-1', 1, false, 'operations.job-succeeded'),
    ('platform.outbox.dispatch', 'succeeded', '2', 2, false, 'operations.job-succeeded'),
    ('platform.outbox.dispatch', 'succeeded', '0', 1, true, 'operations.job-succeeded'),
    ('platform.outbox.dispatch', 'failed', '0', 8, false, 'operations.job-dead-lettered'),
    ('platform.outbox.dispatch', 'failed', '0', 1, false, 'operations.job-failed')
  ) AS t(key, outcome, processed, attempt_no, explicit_retry, event_type)
  LOOP
    -- The local fixture uses a retry-safe schedule, including for keys introduced later.
    SELECT * INTO STRICT job FROM private.scheduled_jobs WHERE job_key='sync-mutations.retry';
    run_id := gen_random_uuid();
    attempt_id := gen_random_uuid();
    retry_parent := NULL;
    IF test_case.explicit_retry THEN
      INSERT INTO private.job_runs(scheduled_job_id,job_key,job_type,owner_spec,status,queued_at,started_at,completed_at,correlation_id)
      VALUES(job.id,test_case.key,job.job_type,job.owner_spec,'dead_lettered',now(),now(),now(),gen_random_uuid()::text)
      RETURNING id INTO retry_parent;
    END IF;
    INSERT INTO private.job_runs(id,scheduled_job_id,job_key,job_type,owner_spec,status,queued_at,started_at,correlation_id,retry_of_run_id)
    VALUES(run_id,job.id,test_case.key,job.job_type,job.owner_spec,'running',now(),now(),run_id::text,retry_parent);
    INSERT INTO private.job_attempts(id,run_id,attempt_no,worker_id,status,started_at,heartbeat_at)
    VALUES(attempt_id,run_id,test_case.attempt_no,'routine-event-test','running',now(),now());
    PERFORM private.complete_job_attempt(attempt_id,'routine-event-test',test_case.outcome,
      CASE WHEN test_case.outcome='failed' THEN 'JOB_FAILED' END,
      jsonb_build_object('outcome','succeeded','processed',test_case.processed::jsonb),clock_timestamp());
    SELECT array_agg(event_type ORDER BY id) INTO observed FROM private.outbox_events WHERE aggregate_id=run_id;
    IF observed IS DISTINCT FROM (CASE WHEN test_case.event_type IS NULL THEN NULL ELSE ARRAY[test_case.event_type] END) THEN
      RAISE EXCEPTION 'Unexpected event for %, attempt %, processed %, outcome %',test_case.key,test_case.attempt_no,test_case.processed,test_case.outcome;
    END IF;
    IF NOT EXISTS (SELECT FROM private.job_attempts a WHERE a.id=attempt_id AND a.status=test_case.outcome AND a.completed_at IS NOT NULL)
      OR NOT EXISTS (SELECT FROM private.job_runs r WHERE r.id=run_id AND r.version>1
        AND r.result_summary->'processed'=test_case.processed::jsonb
        AND (test_case.outcome='failed' OR (r.status='succeeded' AND r.completed_at IS NOT NULL))) THEN
      RAISE EXCEPTION 'Missing completion history for %',test_case.key;
    END IF;
  END LOOP;
END
$test$;
