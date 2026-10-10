'use strict';
// Hermetic compiled-worker acceptance: no bootstrap, listener, database or provider.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { resolve } = require('node:path');
const test = require('node:test');

if (process.argv[2] === 'child') {
  const scope = process.argv[3];
  assert.ok(['analysis', 'assistant'].includes(scope));
  const { AiWorker } = require(resolve(__dirname, '../../apps/api/dist/src/ai/ai.worker.js'));
  const worker = new AiWorker(
    { claimAnalysisPurges: async () => [] }, {}, {},
    {
      get: key => (scope === 'analysis' && key === 'MASARIFI_VOICE_ANALYSIS_ONLY') ||
        (scope === 'assistant' && key === 'MASARIFI_AI_ASSISTANT_ONLY'),
      getRequired: key => key === 'MASARIFI_AI_PROVIDER_ENABLED' ? false :
        key === 'MASARIFI_AI_WORKER_POLL_MS' ? 1000 : 1
    }
  );
  let polls = 0;
  const runOnce = worker.runOnce.bind(worker);
  worker.runOnce = async () => {
    await runOnce();
    console.info(`POLL ${++polls}`);
  };
  worker.start();
  if (process.argv[4] === 'unref-control') {
    assert.ok(worker.timer);
    worker.timer.unref();
  }
  console.info('IDLE_WORKER_STARTED');
  process.on('SIGTERM', async () => {
    await worker.stop();
    process.exit(0);
  });
} else {
  function childEnvironment() {
    const env = { NODE_ENV: 'test' };
    for (const name of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP'])
      if (process.env[name]) env[name] = process.env[name];
    return env;
  }
  function observe(scope, control = false) {
    const child = spawn(process.execPath, [__filename, 'child', scope, ...(control ? ['unref-control'] : [])], {
      env: childEnvironment(), stdio: ['ignore', 'pipe', 'pipe']
    });
    let started = false, polls = 0, tail = '', stderr = '';
    let settled = false, resolveStarted;
    const startedPromise = new Promise(resolveReady => { resolveStarted = resolveReady; });
    const completion = new Promise((resolveExit, rejectExit) => {
      child.stdout.on('data', bytes => {
        tail += bytes.toString();
        const lines = tail.split('\n'); tail = lines.pop();
        for (const line of lines) {
          if (line.trim() === 'IDLE_WORKER_STARTED') { started = true; resolveStarted(); }
          const match = /^POLL (\d+)\r?$/.exec(line);
          if (match) polls = Number(match[1]);
        }
      });
      child.stderr.on('data', bytes => { stderr = (stderr + bytes.toString()).slice(-2048); });
      child.once('error', error => { settled = true; rejectExit(error); });
      child.once('close', (code, signal) => { settled = true; resolveExit({ code, signal }); });
    });
    return { child, completion, startedPromise, state: () => ({ started, polls, settled, stderr }) };
  }
  const delay = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms));
  async function stop(observation) {
    if (!observation.state().settled) observation.child.kill('SIGTERM');
    await observation.completion;
  }

  for (const scope of ['analysis', 'assistant']) {
    test(`compiled ${scope} worker remains alive through twelve empty polls`, { timeout: 25000 }, async t => {
      const observation = observe(scope);
      t.after(() => stop(observation));
      await Promise.race([
        observation.startedPromise,
        delay(10000).then(() => { throw new Error('Compiled worker did not start within ten seconds'); }),
        observation.completion.then(result => {
          throw new Error(`Scoped worker exited before startup (${result.code}, ${result.signal}): ${observation.state().stderr}`);
        })
      ]);
      await Promise.race([
        delay(12500),
        observation.completion.then(result => {
          throw new Error(`Scoped worker exited early (${result.code}, ${result.signal}): ${observation.state().stderr}`);
        })
      ]);
      const state = observation.state();
      assert.equal(state.started, true, state.stderr);
      assert.equal(state.settled, false);
      assert.ok(state.polls >= 12, `Only ${state.polls} complete empty polls`);
      assert.equal(state.stderr, '');
    });
  }

  test('compiled-worker control exits when its only polling interval is unreferenced', { timeout: 10000 }, async t => {
    const observation = observe('analysis', true);
    t.after(() => stop(observation));
    const result = await observation.completion;
    assert.equal(result.code, 0, observation.state().stderr);
    assert.equal(observation.state().started, true);
    assert.ok(observation.state().polls >= 1);
  });
}
