'use strict';

const { createServer } = require('node:http');
const { performance } = require('node:perf_hooks');

const workerPort = 8081;

function workerReadiness(now = () => performance.now()) {
  let lastComplete = null;
  return {
    ready: () => lastComplete !== null && now() - lastComplete <= 30_000,
    async poll(runJob, stopping = () => false) {
      try {
        for (const kind of ['report.generate', 'report.output.expire']) {
          if (stopping()) return;
          await runJob(kind);
        }
        lastComplete = now();
      } catch (error) {
        lastComplete = null;
        throw error;
      }
    },
  };
}

function serveWorkerReadiness(health) {
  const server = createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/health/ready') {
      response.writeHead(404).end();
      return;
    }
    const ready = health.ready();
    response.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ status: ready ? 'ready' : 'unavailable' }));
  });
  server.listen(workerPort, '127.0.0.1');
  return server;
}

async function checkReady(port) {
  const response = await fetch(`http://127.0.0.1:${port}/health/ready`, {
    signal: AbortSignal.timeout(1500), redirect: 'error',
  });
  if (response.status !== 200 || (await response.json()).status !== 'ready') {
    throw new Error('QA_REPORT_NOT_READY');
  }
}

if (require.main === module) {
  const port = { worker: workerPort, storage: 8080 }[process.argv[2]];
  if (typeof port !== 'number') process.exitCode = 2;
  else checkReady(port).catch(() => { process.exitCode = 1; });
}

module.exports = { workerReadiness, serveWorkerReadiness, checkReady };
