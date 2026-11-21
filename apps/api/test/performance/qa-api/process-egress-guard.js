// QA-process policy, not an arbitrary-code sandbox. Install before app imports.
const { syncBuiltinESMExports } = require('node:module');
const net = require('node:net');
const tls = require('node:tls');
const dns = require('node:dns');
const dnsPromises = require('node:dns/promises');
const dgram = require('node:dgram');
const http = require('node:http');
const https = require('node:https');
const childProcess = require('node:child_process');
const workerThreads = require('node:worker_threads');

let installed = false;

function installQaEgressGuard() {
  if (installed) throw new Error('QA_EGRESS_GUARD_ALREADY_INSTALLED');
  if (
    [
      'NODE_OPTIONS',
      'NODE_PATH',
      'NODE_EXTRA_CA_CERTS',
      'LD_PRELOAD',
      'DYLD_INSERT_LIBRARIES',
    ].some((key) => process.env[key])
  )
    throw new Error('QA_EGRESS_UNSAFE_ENVIRONMENT');
  installed = true;
  const counters = { tcp: 0, tls: 0, dns: 0, udp: 0, process: 0, worker: 0 };
  function deny(kind) {
    counters[kind] = Math.min(counters[kind] + 1, Number.MAX_SAFE_INTEGER);
    const error = new Error('QA_EGRESS_DENIED');
    error.code = 'QA_EGRESS_DENIED';
    throw error;
  }
  function blocked(kind) {
    return function deniedOperation() {
      return deny(kind);
    };
  }

  const originalConnect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function guardedConnect(...input) {
    // Node also passes its normalized [options, callback] pair as one argument.
    const args = input.length === 1 && Array.isArray(input[0]) ? input[0] : input;
    let options, callback;
    if (typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
      if (args.length > 2 || Object.keys(args[0]).some((key) => !['host', 'port'].includes(key)))
        return deny('tcp');
      options = args[0];
      callback = args[1];
    } else {
      if (args.length > 3) return deny('tcp');
      options = { port: args[0], host: args[1] };
      callback = args[2];
    }
    if (
      options.host !== '127.0.0.1' ||
      ![54332, '54332'].includes(options.port) ||
      (callback !== undefined && callback !== null && typeof callback !== 'function')
    )
      return deny('tcp');
    // Pass a fresh destination, never a caller getter or custom lookup/path/fd.
    return Reflect.apply(originalConnect, this, [{ host: '127.0.0.1', port: 54332 }, callback]);
  };

  function guardLookup(target) {
    const original = target.lookup;
    target.lookup = function literalLoopbackLookup(...args) {
      if (args[0] !== '127.0.0.1') return deny('dns');
      return Reflect.apply(original, this, args);
    };
    for (const name of Object.keys(target)) {
      if (name.startsWith('resolve') || ['lookupService', 'setServers'].includes(name))
        target[name] = blocked('dns');
    }
    let prototype = target.Resolver?.prototype;
    while (prototype && prototype !== Object.prototype) {
      for (const name of Object.getOwnPropertyNames(prototype)) {
        if (
          (name.startsWith('resolve') || name === 'setServers') &&
          typeof prototype[name] === 'function'
        ) {
          prototype[name] = blocked('dns');
        }
      }
      prototype = Object.getPrototypeOf(prototype);
    }
  }
  guardLookup(dns);
  guardLookup(dnsPromises);

  for (const name of ['send', 'connect', 'bind']) dgram.Socket.prototype[name] = blocked('udp');
  dgram.createSocket = blocked('udp');
  dgram.Socket = blocked('udp');
  tls.connect = blocked('tls');
  tls.TLSSocket = blocked('tls');
  http.request = blocked('tcp');
  http.get = blocked('tcp');
  https.request = blocked('tls');
  https.get = blocked('tls');
  globalThis.fetch = blocked('tcp');
  for (const name of [
    'spawn',
    'spawnSync',
    'exec',
    'execSync',
    'execFile',
    'execFileSync',
    'fork',
  ]) {
    childProcess[name] = blocked('process');
  }
  childProcess.ChildProcess.prototype.spawn = blocked('process');
  workerThreads.Worker = blocked('worker');
  syncBuiltinESMExports();

  return Object.freeze({ snapshot: () => ({ ...counters }) });
}

module.exports = { installQaEgressGuard };
