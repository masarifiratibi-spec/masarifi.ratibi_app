'use strict';

const { createRequire } = require('node:module');
const { readFileSync } = require('node:fs');
const runtime = createRequire('/app/package.json');
const { PoolService } = runtime('./dist/src/platform/database/pool.service');
const { OperationsWorker } = runtime('./dist/src/operations/operations.worker');
const { OperationsRepository } = runtime('./dist/src/operations/operations.repository');
const { QueuePublisher } = runtime('./dist/src/platform/outbox/queue-publisher');
const { buildEventEnvelope } = runtime('./dist/src/platform/outbox/event-envelope');

const job = 'platform.outbox.dispatch';
const cutoff = readFileSync('/release/cutoff', 'utf8').trim();
if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(cutoff) || new Date(cutoff).toISOString() !== cutoff)
  throw new Error('Invalid activation time');

// PostgreSQL can match this validated constant to the partial index even with a generic plan.
const eligible = `created_at > TIMESTAMPTZ '${cutoff}' AND published_at IS NULL`;
const due = `${eligible} AND available_at <= now() AND (locked_until IS NULL OR locked_until <= now())`;
const batchSize = 16;
const connection = new URL(process.env.DATABASE_URL);
if (connection.hostname !== 'masarifi-postgres17.internal' || connection.pathname !== '/postgres' ||
    connection.searchParams.get('sslmode') !== 'verify-full' ||
    connection.searchParams.get('sslrootcert') !== '/run/secrets/masarifi-database-ca.crt')
  throw new Error('Unexpected database target');
connection.searchParams.set('application_name', 'masarifi-outbox-forward');
const config = {
  DATABASE_URL: connection.toString(),
  MASARIFI_DATABASE_POOL_MAX: 2,
  MASARIFI_PROCESS_KIND: 'worker',
  MASARIFI_OPERATIONS_JOB_KEYS: job,
};
const settings = { get: key => config[key] };
const database = new PoolService(settings);

async function publishBatch(key, db = database) {
  if (key !== job) throw new Error('Unexpected job');
  return db.withClient(async client => {
    // The worker pool has already selected masarifi_worker. Only open the
    // publishing transaction when the forward-only index contains due work.
    const ready = await client.query(`SELECT EXISTS (SELECT 1 FROM private.outbox_events WHERE ${due}) AS ready`);
    if (!ready.rows[0].ready) return { outcome: 'succeeded', processed: 0 };

    await client.query('BEGIN');
    try {
      await client.query("SET LOCAL ROLE masarifi_worker");
      await client.query("SET LOCAL lock_timeout = '250ms'");
      await client.query("SET LOCAL statement_timeout = '1500ms'");
      const selected = await client.query(`
        SELECT id, created_at AS "createdAt", aggregate_type AS "aggregateType",
               aggregate_id AS "aggregateId", event_type AS "eventType", payload,
               attempt_count AS "attemptCount"
        FROM private.outbox_events
        WHERE ${due}
        ORDER BY available_at, id LIMIT $1 FOR UPDATE SKIP LOCKED`, [batchSize]);
      // The runtime QueuePublisher accepts a timeout as its third DAL argument.
      // Adapt to pg.Client, whose third argument would otherwise be a callback.
      const boundPublisher = new QueuePublisher({ query: (sql, values) => client.query(sql, values) });
      let processed = 0;
      for (const row of selected.rows) {
        await client.query('SAVEPOINT event_publish');
        try {
          const envelope = buildEventEnvelope(row, row.id);
          await boundPublisher.publish(envelope);
          const marked = await client.query(`
            UPDATE private.outbox_events SET published_at = clock_timestamp(),
              locked_by = NULL, locked_until = NULL, last_error_code = NULL
            WHERE id = $1 AND ${eligible}`, [row.id]);
          if (marked.rowCount !== 1) throw new Error('Publication receipt mismatch');
          processed++;
        } catch (error) {
          await client.query('ROLLBACK TO SAVEPOINT event_publish');
          // Transport and database failures roll back the send and marker together.
          if (!/^OUTBOX_(EVENT_TYPE_INVALID|AGGREGATE_TYPE_INVALID|PAYLOAD_INVALID|PAYLOAD_SENSITIVE|ID_INVALID|CORRELATION_ID_INVALID|ATTEMPT_INVALID)$/.test(error.message)) throw error;
          await client.query(`
            UPDATE private.outbox_events SET attempt_count = attempt_count + 1,
              available_at = clock_timestamp() + interval '5 minutes',
              last_error_code = $2, locked_by = NULL, locked_until = NULL
            WHERE id = $1 AND ${eligible}`, [row.id, error.message]);
          console.error('Outbox envelope rejected', error.message);
        }
        await client.query('RELEASE SAVEPOINT event_publish');
      }
      await client.query('COMMIT');
      return { outcome: 'succeeded', processed };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

async function main() {
  const check = await database.query("SELECT current_user AS role, to_regclass('private.outbox_forward_due_20261120')::text AS idx, pg_is_in_recovery() AS standby");
  if (check.rows[0].role !== 'masarifi_worker' || !check.rows[0].idx || check.rows[0].standby)
    throw new Error('Unexpected worker role or index');
  if (process.argv.includes('--check')) {
    await database.onModuleDestroy();
    console.log('Outbox preflight passed');
    return;
  }
  const repo = new OperationsRepository(database);
  const store = {
    claim: (id, limit, keys) => {
      if (limit !== 1 || keys?.length !== 1 || keys[0] !== job) throw new Error('Unexpected job scope');
      return repo.claim(id, 1, [job]);
    },
    heartbeat: (...args) => repo.heartbeat(...args),
    complete: (...args) => repo.complete(...args),
  };
  const worker = new OperationsWorker(store, { run: publishBatch }, settings);
  const stop = async () => { await worker.stop(); await database.onModuleDestroy(); };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  worker.start();
  console.log('Outbox publisher started', cutoff);
}
if (require.main === module)
  main().catch(() => { console.error('Outbox preflight failed'); process.exitCode = 1; });
module.exports = { publishBatch, database, cutoff };
