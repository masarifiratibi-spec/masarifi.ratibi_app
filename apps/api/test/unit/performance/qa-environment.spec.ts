import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateEnvironment } from '../../../src/platform/config/environment.schema';
import {
  buildQaChildEnvironment,
  type QaRuntimeBinding,
} from '../../performance/qa-api/qa-environment';

const now = Date.parse('2026-11-02T00:00:00.000Z');
const admission = {
  systemIdentifier: '1234567890',
  profileRoot: resolve('qa-test-private-profile'),
  sourceRevision: 'a'.repeat(40),
};
const binding: QaRuntimeBinding = {
  schemaVersion: 1,
  projectId: 'masarifi_perf_20261102_d959_r2',
  systemIdentifier: admission.systemIdentifier,
  role: 'masarifi_perf_r2_api_20261102',
  password: Buffer.alloc(32, 7).toString('base64url'),
  validUntil: '2026-11-03T00:00:00.000Z',
  host: '127.0.0.1',
  port: 54332,
  database: 'postgres',
  ssl: false,
};
const keys = {
  pushHash: Buffer.alloc(32, 1).toString('base64url'),
  pushEncryption: Buffer.alloc(32, 2).toString('base64url'),
  syncCursor: Buffer.alloc(32, 3).toString('base64url'),
  ipHash: Buffer.alloc(32, 4).toString('base64url'),
};

describe('fresh isolated QA API child environment', () => {
  it('validates with real API defaults while excluding inherited hosts, credentials and preloads', () => {
    const parent = Object.freeze({
      PATH: 'fixture-path',
      NODE_OPTIONS: '--require inherited-preload',
      DATABASE_URL: 'postgresql://hosted-secret@remote/db',
      OPENROUTER_API_KEY: 'inherited-provider-secret',
      CLERK_SECRET_KEY: 'inherited-clerk-secret',
      HTTP_PROXY: 'inherited-proxy',
      PGHOST: 'remote-host',
      USERPROFILE: 'real-user-profile',
      MASARIFI_STAGING_VOICE_CONTINUOUS: 'true',
    });
    const child = buildQaChildEnvironment({ parent, binding, keys, admission, nowMs: now });
    const validated = validateEnvironment(child);
    expect(validated).toMatchObject({
      NODE_ENV: 'test',
      MASARIFI_PROCESS_KIND: 'api',
      MASARIFI_HTTP_PORT: 8082,
      MASARIFI_DATABASE_POOL_MAX: 4,
      MASARIFI_RECENT_AUTH_MAX_AGE_SECONDS: 600,
      MASARIFI_LEDGER_RECENT_AUTH_THRESHOLDS: { SAR: 1000000, USD: 1000000 },
      MASARIFI_ADMIN_ROUTES_ENABLED: false,
      MASARIFI_AI_PROVIDER_ENABLED: false,
      MASARIFI_ASSISTANT_AGENT_ENABLED: false,
      MASARIFI_ASSISTANT_AGENT_PUBLIC_ENABLED: false,
      MASARIFI_MOBILE_AUTOMATION_ENABLED: false,
      MASARIFI_RETURN_REMINDERS_ENABLED: false,
    });
    expect(child.USERPROFILE).toBe(admission.profileRoot);
    expect(child.PATH).toBe('fixture-path');
    for (const name of [
      'NODE_OPTIONS',
      'OPENROUTER_API_KEY',
      'HTTP_PROXY',
      'PGHOST',
      'MASARIFI_STAGING_VOICE_CONTINUOUS',
    ])
      expect(child[name]).toBeUndefined();
    expect(
      Object.values(child).some(
        (value) => value.includes('inherited-') || value.includes('hosted-secret'),
      ),
    ).toBe(false);
    const database = new URL(validated.DATABASE_URL);
    expect([
      database.hostname,
      database.port,
      database.pathname,
      database.username,
      database.search,
    ]).toEqual(['127.0.0.1', '54332', '/postgres', binding.role, '']);
  });

  it('prevents real ConfigService fallback in a guarded fresh process before app imports', () => {
    const child = buildQaChildEnvironment({
      parent: {
        ...process.env,
        NODE_OPTIONS: '--require qa-inherited-preload-must-not-run',
        OPENROUTER_API_KEY: 'qa-inherited-provider-must-not-arrive',
        DATABASE_URL: 'postgresql://qa-inherited-host/db',
      },
      binding,
      keys,
      admission,
      nowMs: now,
    });
    const apiRoot = resolve(__dirname, '../../..');
    const script = `
      const guard=require(${JSON.stringify(resolve(__dirname, '../../performance/qa-api/process-egress-guard.js'))}).installQaEgressGuard();
      require('ts-node').register({project:${JSON.stringify(resolve(apiRoot, 'tsconfig.json'))},transpileOnly:true});
      const {validateEnvironment}=require(${JSON.stringify(resolve(apiRoot, 'src/platform/config/environment.schema.ts'))});
      const {ConfigService}=require('@nestjs/config');
      const config=new ConfigService(validateEnvironment(process.env));
      process.stdout.write(JSON.stringify({providerAbsent:config.get('OPENROUTER_API_KEY')===undefined,
        preloadAbsent:process.env.NODE_OPTIONS===undefined,host:new URL(config.get('DATABASE_URL')).hostname,counters:guard.snapshot()}));
    `;
    const output: unknown = JSON.parse(
      execFileSync(process.execPath, ['-e', script], {
        cwd: apiRoot,
        env: child,
        encoding: 'utf8',
        timeout: 20000,
      }),
    );
    expect(output).toEqual({
      providerAbsent: true,
      preloadAbsent: true,
      host: '127.0.0.1',
      counters: { tcp: 0, tls: 0, dns: 0, udp: 0, process: 0, worker: 0 },
    });
  });

  it.each([
    { host: 'remote.invalid' },
    { port: 54322 },
    { role: 'postgres' },
    { database: 'other' },
    { ssl: true },
    { systemIdentifier: '999' },
    { validUntil: '2026-11-01T00:00:00.000Z' },
    { password: 'invalid' },
  ])('rejects an unadmitted binding before producing any child configuration: %j', (invalid) => {
    expect(() =>
      buildQaChildEnvironment({
        parent: {},
        binding: { ...binding, ...invalid },
        keys,
        admission,
        nowMs: now,
      }),
    ).toThrow('QA_RUNTIME_BINDING_INVALID');
  });
});
