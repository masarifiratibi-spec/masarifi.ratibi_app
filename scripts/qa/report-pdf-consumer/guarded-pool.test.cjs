const assert = require('node:assert/strict');
const test = require('node:test');
const { createHash } = require('node:crypto');
const { createGuardedReportPool } = require('./guarded-pool.cjs');
const { ReportsRepository } = require(
  process.env.REPORT_QA_REPOSITORY_MODULE ||
    '../../../.superpowers/sdd/2026-10-29-predeployment-consolidation/api-source-build/src/reports/reports.repository.js',
);
const id = '99000000-0000-4000-8000-000000000001';
const owner = 'synthetic-report-owner';
const ownerSha256 = createHash('sha256').update(owner).digest('hex');
const policy = {
  ownerSha256,
  notBefore: '2026-10-29T13:00:00Z',
  deadline: '2026-10-29T13:10:00Z',
  maximumJobs: 6,
};
const now = () => new Date('2026-10-29T13:01:00Z');
function fixture(overrides = {}, uncertainCommit = false) {
  const writes = [],
    reservations = new Set();
  let generating = false;
  const row = {
    id,
    user_id: owner,
    status: 'queued',
    attempt_count: 0,
    expires_at: new Date('2026-10-30T00:00:00Z'),
    snapshot: {
      generatedAt: '2026-10-29T13:00:30Z',
      format: 'pdf',
      delivery: 'download',
      reportType: 'financial_summary',
      summary: {},
    },
    ...overrides,
  };
  const client = {
    query: async (sql, parameters = []) => {
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked: true }] };
      if (sql.includes('read_report_work')) return { rows: [row] };
      if (sql.includes('transition_report_output')) {
        writes.push({ status: parameters[1], id: parameters[0] });
        generating = true;
      }
      if (sql.includes('enqueue_outbox_event'))
        writes.push({ event: parameters[0], id: parameters[2] });
      if (sql === 'commit' && generating && uncertainCommit)
        throw new Error('synthetic-uncertain-commit');
      return { rows: [] };
    },
  };
  const guarded = createGuardedReportPool(
    { withClient: (action) => action(client) },
    policy,
    (nextId) => {
      assert.equal(reservations.has(nextId), false, 'REPORT_QA_ALREADY_CONSUMED');
      reservations.add(nextId);
    },
    now,
  );
  return { guarded, repository: new ReportsRepository(guarded), writes, reservations, row };
}

test('scope rejection occurs before the existing repository transitions or renders an output', async () => {
  for (const overrides of [
    { user_id: 'another-owner' },
    { status: 'generating' },
    { attempt_count: 1 },
    { expires_at: new Date('2026-10-29T12:00:00Z') },
    {
      snapshot: {
        generatedAt: '2026-10-29T13:00:30Z',
        format: 'csv',
        delivery: 'download',
        reportType: 'financial_summary',
        summary: {},
      },
    },
    {
      snapshot: {
        generatedAt: '2026-10-29T13:00:30Z',
        format: 'pdf',
        delivery: 'email',
        reportType: 'financial_summary',
        summary: {},
      },
    },
    {
      snapshot: {
        generatedAt: '2026-10-29T12:59:59Z',
        format: 'pdf',
        delivery: 'download',
        reportType: 'financial_summary',
        summary: {},
      },
    },
    {
      snapshot: {
        generatedAt: '2026-10-29T13:00:30Z',
        format: 'pdf',
        delivery: 'download',
        reportType: 'financial_summary',
        summary: { adminAggregate: true },
      },
    },
    {
      snapshot: {
        generatedAt: '2026-10-29T13:00:30Z',
        format: 'pdf',
        delivery: 'download',
        reportType: 'financial_summary',
        summary: { adminAggregate: 'true' },
      },
    },
  ]) {
    const current = fixture(overrides);
    const completed = await current.repository.withWorkLock('report.generate', id, async () => {
      assert.fail('Excluded output reached renderer');
    });
    assert.equal(completed, false);
    assert.deepEqual(current.writes, []);
    assert.equal(current.reservations.size, 0);
  }
});

test('eligible output reuses the real repository lock, transitions and report-ready event', async () => {
  const current = fixture();
  const storageRef = `reports/${ownerSha256}/${id}.pdf`;
  assert.equal(
    await current.repository.withWorkLock('report.generate', id, async (claim) => {
      assert.equal(claim.userId, owner);
      assert.equal(claim.attemptCount, 1);
      return {
        status: 'ready',
        storageRef,
        event: {
          type: 'report.ready',
          data: { attemptId: id, format: 'pdf', bytes: 1000, expiresAt: claim.expiresAt },
        },
      };
    }),
    true,
  );
  assert.deepEqual(current.writes, [
    { status: 'generating', id },
    { status: 'ready', id },
    { event: 'report.ready', id },
  ]);
  assert.deepEqual([...current.reservations], [id]);
});

test('an uncertain first transition stays consumed and cannot be replayed by a new poll', async () => {
  const current = fixture({}, true);
  const render = async () => {
    assert.fail('Uncertain claim reached renderer');
  };
  await assert.rejects(
    current.repository.withWorkLock('report.generate', id, render),
    /synthetic-uncertain-commit/,
  );
  await assert.rejects(
    current.repository.withWorkLock('report.generate', id, render),
    /REPORT_QA_ALREADY_CONSUMED/,
  );
  assert.deepEqual(current.writes, [{ status: 'generating', id }]);
});

test('unexpected SQL and foreign storage/event outcomes fail before database writes', async () => {
  const current = fixture();
  await assert.rejects(
    current.guarded.withClient((client) => client.query('delete from public.transactions')),
    /REPORT_QA_SQL_FORBIDDEN/,
  );
  await assert.rejects(
    current.repository.withWorkLock('report.generate', id, async () => ({
      status: 'ready',
      storageRef: `reports/${'f'.repeat(64)}/${id}.pdf`,
    })),
    /REPORT_QA_OUTCOME_FORBIDDEN/,
  );
  assert.deepEqual(current.writes, [{ status: 'generating', id }]);
});

test('deadline and job-kind restrictions prevent even a work-list request outside the finite policy', async () => {
  let requests = 0;
  const underlying = {
    withClient: (action) =>
      action({
        query: async () => {
          requests++;
          return { rows: [] };
        },
      }),
  };
  const expired = createGuardedReportPool(
    underlying,
    policy,
    () => {},
    () => new Date('2026-10-29T13:10:01Z'),
  );
  await assert.rejects(
    expired.withClient((client) =>
      client.query('select * from private.list_report_work($1,$2)', ['report.generate', 1]),
    ),
    /REPORT_QA_DEADLINE/,
  );
  const active = createGuardedReportPool(underlying, policy, () => {}, now);
  await assert.rejects(
    active.withClient((client) =>
      client.query('select * from private.list_report_work($1,$2)', ['report.email.deliver', 1]),
    ),
    /REPORT_QA_JOB_FORBIDDEN/,
  );
  assert.equal(requests, 0);
});

test('a seventh distinct output cannot exceed the six-output budget across connections', async () => {
  const current = fixture();
  for (let index = 1; index <= 7; index++) {
    current.row.id = `99000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
    const pending = current.repository.withWorkLock(
      'report.generate',
      current.row.id,
      async () => ({ status: 'failed', errorCode: 'REPORT_STORAGE_UNAVAILABLE' }),
    );
    if (index <= 6) assert.equal(await pending, true);
    else await assert.rejects(pending, /REPORT_QA_BUDGET_EXHAUSTED/);
  }
  assert.equal(current.reservations.size, 6);
  assert.equal(current.writes.length, 12);
  assert.deepEqual(current.guarded.progress, { consumed: 6, lastStatus: 'failed' });
});
