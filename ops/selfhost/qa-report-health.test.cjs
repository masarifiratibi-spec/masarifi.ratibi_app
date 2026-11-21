const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { workerReadiness, checkReady } = require('./qa-report-health.cjs');

test('reports readiness only after both permitted queues were polled, including empty queues', async () => {
  let now = 0;
  const health = workerReadiness(() => now);
  const kinds = [];
  assert.equal(health.ready(), false);
  await health.poll(async kind => { kinds.push(kind); return 0; });
  assert.deepEqual(kinds, ['report.generate', 'report.output.expire']);
  assert.equal(health.ready(), true);
  now = 31_000;
  assert.equal(health.ready(), false);
  await assert.rejects(health.poll(async kind => { if (kind === 'report.output.expire') throw Error('poll failed'); }));
  assert.equal(health.ready(), false);
  await health.poll(async () => 0);
  assert.equal(health.ready(), true);
});

test('validates the storage status as well as its HTTP response', async () => {
  let body = { status: 'starting' };
  const server = createServer((req, res) => {
    assert.equal(req.url, '/health/ready');
    res.end(JSON.stringify(body));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    await assert.rejects(checkReady(port));
    body = { status: 'ready' };
    await checkReady(port);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('a slow expiry poll cannot renew the last successful generation poll', async () => {
  let now = 0;
  const health = workerReadiness(() => now);
  await health.poll(async kind => {
    if (kind === 'report.output.expire') now = 31_000;
  });
  assert.equal(health.ready(), false);
});

test('shutdown during a poll immediately withdraws readiness even if that poll succeeds later', async () => {
  const health = workerReadiness(() => 0);
  await health.poll(async () => 0);
  await health.poll(async kind => {
    if (kind === 'report.generate') health.stop();
    assert.equal(health.ready(), false);
  });
  assert.equal(health.ready(), false);
});
