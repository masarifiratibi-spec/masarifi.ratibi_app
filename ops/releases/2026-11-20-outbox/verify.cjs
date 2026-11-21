'use strict';
const assert = require('node:assert/strict');
const { publishBatch, database, cutoff } = require('./publisher.cjs');
const job = 'platform.outbox.dispatch';

async function verify() {
  await database.withClient(async client => {
    await client.query(`CREATE TEMP TABLE test_events (
      id uuid PRIMARY KEY, created_at timestamptz, available_at timestamptz, published_at timestamptz,
      locked_until timestamptz, locked_by text, last_error_code text, aggregate_type text DEFAULT 'job_run',
      aggregate_id uuid, event_type text DEFAULT 'operations.job-succeeded',
      attempt_count integer DEFAULT 0, payload jsonb DEFAULT '{}')`);
    await client.query('CREATE TEMP TABLE test_queue(envelope jsonb)');
    const add = async (offset, available, payload) => {
      const result = await client.query(`INSERT INTO test_events(id,created_at,available_at,payload)
        VALUES(gen_random_uuid(),$1::timestamptz+$2::interval,now()+$3::interval,$4) RETURNING id`,
        [cutoff, offset, available, payload]);
      return result.rows[0].id;
    };
    await add('-1 day','-1 hour',{});
    await add('-1 day','1 day',{});
    await add('0 seconds','-1 hour',{});
    const fresh = await add('1 second','-1 hour',{sync:{test:true},ok:true});
    await add('1 second','-1 hour',{password:'test'});
    let failReceipt = true;
    let calls = 0;
    const isolated = { withClient: fn => fn({ query: (sql, args) => {
      calls++;
      if (sql.includes('pgmq.send')) return client.query('INSERT INTO test_queue VALUES($1::jsonb)', [args[1]]);
      if (failReceipt && sql.includes('published_at = clock_timestamp()')) throw Error('Injected failure');
      return client.query(sql.replaceAll('private.outbox_events','pg_temp.test_events'), args);
    } }) };
    await assert.rejects(publishBatch('unrelated.job', isolated));
    await assert.rejects(publishBatch(job, isolated), /Injected failure/);
    assert.equal((await client.query('SELECT count(*)::int AS n FROM test_queue')).rows[0].n, 0);
    failReceipt = false;
    assert.equal((await publishBatch(job, isolated)).processed, 1);
    const delayed = await add('2 seconds','1 hour',{});
    const leased = await add('3 seconds','-1 hour',{});
    await client.query("UPDATE test_events SET locked_until=now()+interval '1 hour' WHERE id=$1", [leased]);
    calls = 0;
    assert.equal((await publishBatch(job, isolated)).processed, 0);
    assert.equal(calls, 1, 'idle batch should only probe readiness');
    const messages = await client.query('SELECT envelope FROM test_queue');
    assert.equal(messages.rowCount, 1);
    assert.equal(messages.rows[0].envelope.eventId, fresh);
    assert.deepEqual(messages.rows[0].envelope.payload, {ok:true});
    const protectedRows = await client.query('SELECT count(*)::int AS n FROM test_events WHERE created_at <= $1 AND published_at IS NULL AND attempt_count=0', [cutoff]);
    assert.equal(protectedRows.rows[0].n, 3);
    await client.query("UPDATE test_events SET available_at=now() WHERE id=$1", [delayed]);
    await client.query("UPDATE test_events SET locked_until=now() WHERE id=$1", [leased]);
    assert.equal((await publishBatch(job, isolated)).processed, 2);
    const awakened = await client.query("SELECT envelope->>'eventId' AS id FROM test_queue");
    assert.deepEqual(awakened.rows.map(row => row.id).sort(), [fresh, delayed, leased].sort());
    assert.equal((await publishBatch(job, isolated)).processed, 0);
    const arriving = await add('4 seconds','-1 hour',{});
    let competing = true;
    const raced = { withClient: fn => isolated.withClient(client => fn({ query: async (sql, args) => {
      const result = await client.query(sql, args);
      if (competing && sql.includes('SELECT EXISTS')) {
        competing = false;
        await client.query("UPDATE pg_temp.test_events SET locked_until=now()+interval '1 hour' WHERE id=$1", [arriving]);
      }
      return result;
    } })) };
    assert.equal((await publishBatch(job, raced)).processed, 0);
    await client.query("UPDATE test_events SET locked_until=now() WHERE id=$1", [arriving]);
    assert.equal((await publishBatch(job, isolated)).processed, 1);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM test_queue WHERE envelope->>'eventId'=$1", [arriving])).rows[0].n, 1);
  });
  console.log('Passed old, boundary, delayed, retry, redaction, rollback and job scope tests');
}
verify().catch(e => { console.error(e.code || e.name, e.message.slice(0,100)); process.exitCode=1; }).finally(() => database.onModuleDestroy());
