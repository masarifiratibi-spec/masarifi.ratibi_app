import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

import { describeLiveDatabase } from '../../live-database';

// Regression: recurring sync polls amplified durable success events even at zero claims.
// Zero returned executable mutations does not mean no dependency rejection occurred.
describeLiveDatabase('empty sync success event policy', () => {
  let client: Client;

  beforeAll(async () => {
    const target = new URL(process.env.DATABASE_URL ?? '');
    if (
      !['127.0.0.1', 'localhost'].includes(target.hostname) ||
      target.pathname !== `/${process.env.CROSS_FEATURE_DISPOSABLE_DATABASE_NAME ?? ''}`
    )
      throw new Error('EXPLICIT_DISPOSABLE_OPERATIONS_DATABASE_REQUIRED');
    client = new Client({ connectionString: target.toString() });
    await client.connect();
  });
  afterAll(async () => client.end());
  beforeEach(async () => client.query('begin'));
  afterEach(async () => client.query('rollback'));

  async function fixture(jobKey = 'sync-mutations.retry', attemptNo = 1) {
    const runId = randomUUID();
    const attemptId = randomUUID();
    await client.query(
      `insert into private.job_runs(id,scheduled_job_id,job_key,job_type,owner_spec,status,queued_at,started_at,correlation_id)
       select $1::uuid,id,job_key,job_type,owner_spec,'running',now(),now(),$1::uuid::text
       from private.scheduled_jobs where job_key=$2`,
      [runId, jobKey],
    );
    await client.query(
      `insert into private.job_attempts(id,run_id,attempt_no,worker_id,status,started_at,heartbeat_at)
       values($1,$2,$3,'event-policy-worker','running',now(),now())`,
      [attemptId, runId, attemptNo],
    );
    return { runId, attemptId };
  }

  async function complete(
    attemptId: string,
    summary: unknown,
    outcome = 'succeeded',
    workerId = 'event-policy-worker',
  ) {
    return client.query<{ value: { status: string } }>(
      'select private.complete_job_attempt($1,$2,$3,$4,$5::jsonb,clock_timestamp()) value',
      [
        attemptId,
        workerId,
        outcome,
        outcome === 'failed' ? 'JOB_FAILED' : null,
        JSON.stringify(summary),
      ],
    );
  }

  async function events(runId: string) {
    return (
      await client.query<{ event_type: string }>(
        'select event_type from private.outbox_events where aggregate_id=$1 order by id',
        [runId],
      )
    ).rows.map((row) => row.event_type);
  }

  it('retains successful terminal history and unrelated events while suppressing only the zero-claim success event', async () => {
    const unrelatedId = randomUUID();
    await client.query(
      `select private.enqueue_outbox_event('fixture.unrelated','fixture',$1,'{"preserved":true}'::jsonb)`,
      [unrelatedId],
    );
    const unrelatedBefore = await client.query(
      'select to_jsonb(e) value from private.outbox_events e where aggregate_id=$1',
      [unrelatedId],
    );
    const { runId, attemptId } = await fixture();
    const summary = { outcome: 'succeeded', processed: 0 };
    const result = await complete(attemptId, summary);
    expect(result.rows[0]?.value.status).toBe('succeeded');
    const history = await client.query<{ version: string }>(
      `select r.status run_status,a.status attempt_status,r.result_summary,
        r.completed_at is not null run_completed,a.completed_at is not null attempt_completed,
        a.next_attempt_at,r.version from private.job_runs r join private.job_attempts a on a.run_id=r.id
       where r.id=$1 and a.id=$2`,
      [runId, attemptId],
    );
    expect(history.rows).toEqual([
      expect.objectContaining({
        run_status: 'succeeded',
        attempt_status: 'succeeded',
        result_summary: summary,
        run_completed: true,
        attempt_completed: true,
        next_attempt_at: null,
      }),
    ]);
    expect(Number(history.rows[0]?.version)).toBeGreaterThan(1);
    expect(await events(runId)).toEqual([]);
    expect(
      (
        await client.query(
          'select to_jsonb(e) value from private.outbox_events e where aggregate_id=$1',
          [unrelatedId],
        )
      ).rows,
    ).toEqual(unrelatedBefore.rows);
  });

  it.each([
    ['nonempty', 'sync-mutations.retry', { outcome: 'succeeded', processed: 1 }],
    ['other job', 'idempotency.cleanup', { outcome: 'succeeded', processed: 0 }],
    ['missing count', 'sync-mutations.retry', { outcome: 'succeeded' }],
    ['missing outcome', 'sync-mutations.retry', { processed: 0 }],
    ['string count', 'sync-mutations.retry', { outcome: 'succeeded', processed: '0' }],
    ['null count', 'sync-mutations.retry', { outcome: 'succeeded', processed: null }],
    ['boolean count', 'sync-mutations.retry', { outcome: 'succeeded', processed: false }],
    ['negative count', 'sync-mutations.retry', { outcome: 'succeeded', processed: -1 }],
    ['unknown outcome', 'sync-mutations.retry', { outcome: 'unknown', processed: 0 }],
  ])('still emits success for %s summaries', async (_name, jobKey, summary) => {
    const { runId, attemptId } = await fixture(jobKey);
    await complete(attemptId, summary);
    expect(await events(runId)).toEqual(['operations.job-succeeded']);
  });

  it.each([
    [1, 'retrying', 'operations.job-failed'],
    [8, 'dead_lettered', 'operations.job-dead-lettered'],
  ])('preserves failed attempt %s and its event', async (attemptNo, status, eventType) => {
    const { runId, attemptId } = await fixture('sync-mutations.retry', attemptNo);
    const result = await complete(attemptId, { outcome: 'succeeded', processed: 0 }, 'failed');
    expect(result.rows[0]?.value.status).toBe(status);
    expect(await events(runId)).toEqual([eventType]);
    const history = (
      await client.query<{ status: string; safe_error_code: string; next_attempt_at: Date | null }>(
        'select status,safe_error_code,next_attempt_at from private.job_attempts where id=$1',
        [attemptId],
      )
    ).rows[0];
    expect(history?.status).toBe('failed');
    expect(history?.safe_error_code).toBe('JOB_FAILED');
    expect(history?.next_attempt_at !== null).toBe(status === 'retrying');
  });

  it('keeps owner, running-status, missing-attempt and summary-validation guards', async () => {
    const { runId, attemptId } = await fixture();
    async function rejects(action: () => Promise<unknown>, message: string) {
      await client.query('savepoint rejected_completion');
      await expect(action()).rejects.toThrow(message);
      await client.query('rollback to savepoint rejected_completion');
    }
    await rejects(
      () =>
        complete(attemptId, { outcome: 'succeeded', processed: 0 }, 'succeeded', 'wrong-worker'),
      'OPERATIONS_ATTEMPT_UNAVAILABLE',
    );
    await rejects(() => complete(randomUUID(), {}), 'OPERATIONS_ATTEMPT_UNAVAILABLE');
    await rejects(
      () => complete(attemptId, { outcome: 'succeeded', processed: [] }),
      'OPERATIONS_COMPLETION_INPUT_INVALID',
    );
    await rejects(() => complete(attemptId, {}, 'unknown'), 'OPERATIONS_COMPLETION_INPUT_INVALID');
    await rejects(
      () =>
        client.query(
          "select private.complete_job_attempt($1,'event-policy-worker','succeeded',null,'{}',null)",
          [attemptId],
        ),
      'OPERATIONS_COMPLETION_INPUT_INVALID',
    );
    await rejects(
      () =>
        client.query(
          "select private.complete_job_attempt($1,'event-policy-worker','succeeded','bad code','{}',clock_timestamp())",
          [attemptId],
        ),
      'OPERATIONS_COMPLETION_INPUT_INVALID',
    );
    expect(
      (
        await client.query<{ status: string }>(
          'select status from private.job_attempts where id=$1',
          [attemptId],
        )
      ).rows[0]?.status,
    ).toBe('running');
    expect(await events(runId)).toEqual([]);
    await complete(attemptId, { outcome: 'succeeded', processed: 0 });
    await rejects(() => complete(attemptId, {}), 'OPERATIONS_ATTEMPT_UNAVAILABLE');
    expect(await events(runId)).toEqual([]);
  });

  it('preserves canceled-run completion without producing a success notification', async () => {
    const { runId, attemptId } = await fixture();
    await client.query(
      "update private.job_runs set status='canceled',completed_at=clock_timestamp() where id=$1",
      [runId],
    );
    const result = await complete(attemptId, { outcome: 'succeeded', processed: 0 });
    expect(result.rows[0]?.value.status).toBe('canceled');
    expect(
      (
        await client.query('select status,safe_error_code from private.job_attempts where id=$1', [
          attemptId,
        ])
      ).rows,
    ).toEqual([{ status: 'failed', safe_error_code: 'JOB_CANCELED' }]);
    expect(await events(runId)).toEqual([]);
  });
});
