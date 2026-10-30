const { createHash } = require('node:crypto');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SQL = {
  list: 'select * from private.list_report_work($1,$2)',
  read: 'select * from private.read_report_work($1::uuid)',
  transition: 'select private.transition_report_output($1,$2,$3,$4,$5)',
  event: 'select private.enqueue_outbox_event($1,$2,$3,$4::jsonb)',
  lock: 'select pg_try_advisory_lock(hashtextextended($1,0)) locked',
  unlock: 'select pg_advisory_unlock(hashtextextended($1,0))',
};
const ELIGIBLE_SQL = `encode(sha256(convert_to(r.user_id,'UTF8')),'hex')=$2
  and r.status='queued' and r.attempt_count=0 and r.expires_at>clock_timestamp()
  and r.snapshot->>'format'='pdf' and r.snapshot->>'delivery'='download'
  and r.snapshot->>'reportType'='financial_summary'
  and coalesce(r.snapshot#>>'{summary,adminAggregate}','false')='false'
  and (r.snapshot->>'generatedAt')::timestamptz >= $3::timestamptz
  and (r.snapshot->>'generatedAt')::timestamptz <= $4::timestamptz`;
function requireCondition(condition, code) {
  if (!condition) throw new Error(code);
}
function createGuardedReportPool(pool, policy, reserve, now = () => new Date()) {
  const start = Date.parse(policy.notBefore),
    end = Date.parse(policy.deadline);
  requireCondition(
    /^[a-f0-9]{64}$/.test(policy.ownerSha256) &&
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      end > start &&
      end - start <= 600000 &&
      Number.isInteger(policy.maximumJobs) &&
      policy.maximumJobs >= 1 &&
      policy.maximumJobs <= 6,
    'REPORT_QA_POLICY_INVALID',
  );
  const consumed = new Set();
  let lastStatus;
  const scopedParameters = (id) => [id, policy.ownerSha256, policy.notBefore, policy.deadline];
  function withinWindow(grace = 0) {
    requireCondition(
      now().getTime() >= start && now().getTime() <= end + grace,
      'REPORT_QA_DEADLINE',
    );
  }
  function eligible(row) {
    const snapshot = row.snapshot;
    const generatedAt = Date.parse(snapshot?.generatedAt);
    const ordinary =
      snapshot?.summary?.adminAggregate === undefined || snapshot.summary.adminAggregate === false;
    return (
      UUID.test(row.id) &&
      typeof row.user_id === 'string' &&
      createHash('sha256').update(row.user_id).digest('hex') === policy.ownerSha256 &&
      row.status === 'queued' &&
      row.attempt_count === 0 &&
      new Date(row.expires_at).getTime() > now().getTime() &&
      snapshot?.format === 'pdf' &&
      snapshot.delivery === 'download' &&
      snapshot.reportType === 'financial_summary' &&
      ordinary &&
      generatedAt >= start &&
      generatedAt <= Math.min(end, now().getTime())
    );
  }
  function consume(id) {
    requireCondition(!consumed.has(id), 'REPORT_QA_ALREADY_CONSUMED');
    requireCondition(consumed.size < policy.maximumJobs, 'REPORT_QA_BUDGET_EXHAUSTED');
    reserve(id);
    consumed.add(id);
  }
  function guardedClient(client) {
    let lockId,
      admittedId,
      initialTransition = false,
      completedStatus;
    async function transition(parameters) {
      const [id, status, storageRef, providerMessage, errorCode] = parameters;
      requireCondition(
        id === admittedId && id === lockId && providerMessage === null,
        'REPORT_QA_OUTCOME_FORBIDDEN',
      );
      if (status === 'generating') {
        withinWindow();
        requireCondition(
          !initialTransition && storageRef === null && errorCode === null,
          'REPORT_QA_OUTCOME_FORBIDDEN',
        );
        consume(id);
        initialTransition = true;
      } else {
        withinWindow(120000);
        const key = `reports/${policy.ownerSha256}/${id}.pdf`;
        requireCondition(
          initialTransition &&
            !completedStatus &&
            ((status === 'ready' && storageRef === key && errorCode === null) ||
              (status === 'failed' &&
                storageRef === null &&
                typeof errorCode === 'string' &&
                /^[A-Z][A-Z0-9_]{1,79}$/.test(errorCode))),
          'REPORT_QA_OUTCOME_FORBIDDEN',
        );
        completedStatus = status;
      }
      const transitioned = await client.query(SQL.transition, parameters);
      lastStatus = status;
      return transitioned;
    }
    return {
      query: async (sql, parameters = []) => {
        if (
          [
            'begin',
            'begin read only',
            'commit',
            'rollback',
            'set local role masarifi_worker',
          ].includes(sql)
        )
          return client.query(sql, parameters);
        if (sql === "select set_config('request.jwt.claims',$1,true)") {
          requireCondition(
            parameters.length === 1 && parameters[0] === '{"role":"worker"}',
            'REPORT_QA_ROLE_FORBIDDEN',
          );
          return client.query(sql, parameters);
        }
        if (sql === SQL.list) {
          withinWindow();
          requireCondition(
            parameters[0] === 'report.generate' && parameters[1] === 1,
            'REPORT_QA_JOB_FORBIDDEN',
          );
          return client.query(
            `select w.id from private.list_report_work($1,100) w join lateral private.read_report_work(w.id) r on true where ${ELIGIBLE_SQL} limit 1`,
            scopedParameters('report.generate'),
          );
        }
        if (sql === SQL.lock || sql === SQL.unlock) {
          requireCondition(
            UUID.test(parameters[0]) && (sql === SQL.lock || lockId === parameters[0]),
            'REPORT_QA_LOCK_FORBIDDEN',
          );
          if (sql === SQL.lock) {
            withinWindow();
            lockId = parameters[0];
          }
          return client.query(sql, parameters);
        }
        if (sql === SQL.read) {
          withinWindow();
          requireCondition(parameters[0] === lockId, 'REPORT_QA_LOCK_FORBIDDEN');
          const found = await client.query(
            `select r.* from private.read_report_work($1::uuid) r where ${ELIGIBLE_SQL}`,
            scopedParameters(lockId),
          );
          requireCondition(found.rows.length <= 1, 'REPORT_QA_SCOPE_INVALID');
          const rows = found.rows.filter(eligible);
          if (rows.length) admittedId = rows[0].id;
          return { ...found, rows };
        }
        if (sql === SQL.transition) return transition(parameters);
        if (sql === SQL.event) {
          const event = JSON.parse(parameters[3]);
          requireCondition(
            completedStatus === 'ready' &&
              parameters[0] === 'report.ready' &&
              parameters[1] === 'report_attempt' &&
              parameters[2] === admittedId &&
              event.type === 'report.ready' &&
              event.data.attemptId === admittedId &&
              event.data.format === 'pdf',
            'REPORT_QA_EVENT_FORBIDDEN',
          );
          return client.query(sql, parameters);
        }
        throw new Error('REPORT_QA_SQL_FORBIDDEN');
      },
    };
  }
  return {
    withClient: (action) => pool.withClient((client) => action(guardedClient(client))),
    get progress() {
      return { consumed: consumed.size, lastStatus };
    },
  };
}
module.exports = { createGuardedReportPool };
