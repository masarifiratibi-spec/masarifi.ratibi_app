import { resolve } from 'node:path';

import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { createQaApplication } from '../../performance/qa-api/qa-application';
import { buildQaChildEnvironment } from '../../performance/qa-api/qa-environment';
import {
  FixtureClerkVerifier,
  type FixtureCredential,
} from '../../performance/qa-api/fixture-clerk-verifier';

const token = 'qa-composition-primary-zero-token-0000';
const unavailableToken = 'qa-composition-unavailable-token-0000';
const now = Date.now();
const credential: FixtureCredential = {
  reference: 'primary_0',
  token,
  userId: 'perf_20261102_t0',
  sessionId: 'qa_session_primary_0',
  notBeforeMs: now - 1000,
  expiresAtMs: now + 600000,
  sessionStatus: 'active',
  role: 'authenticated',
  factorVerificationAge: [0, 0],
};

describe('bounded real-service QA API composition', () => {
  let app: NestExpressApplication;
  let verifier: FixtureClerkVerifier;
  beforeEach(async () => {
    const environment = buildQaChildEnvironment({
      parent: {},
      binding: {
        schemaVersion: 1,
        projectId: 'masarifi_perf_20261102_d959_r2',
        systemIdentifier: '12345',
        role: 'masarifi_perf_r2_api_20261102',
        password: Buffer.alloc(32, 5).toString('base64url'),
        validUntil: new Date(now + 600000).toISOString(),
        host: '127.0.0.1',
        port: 54332,
        database: 'postgres',
        ssl: false,
      },
      keys: {
        pushHash: Buffer.alloc(32, 1).toString('base64url'),
        pushEncryption: Buffer.alloc(32, 2).toString('base64url'),
        syncCursor: Buffer.alloc(32, 3).toString('base64url'),
        ipHash: Buffer.alloc(32, 4).toString('base64url'),
      },
      admission: {
        systemIdentifier: '12345',
        profileRoot: resolve('qa-composition-unit-profile'),
        sourceRevision: 'a'.repeat(40),
      },
      nowMs: now,
    });
    verifier = new FixtureClerkVerifier([
      credential,
      {
        ...credential,
        reference: 'provider_unavailable',
        token: unavailableToken,
        unavailable: true,
      },
    ]);
    app = await createQaApplication(environment, verifier);
    await app.listen(0, '127.0.0.1');
  });
  afterEach(async () => {
    await app.close();
  });

  it('uses original guards on each included feature and preserves safe HTTP headers', async () => {
    for (const path of [
      '/api/v1/me',
      '/api/v1/me/preferences',
      '/api/v1/accounts',
      '/api/v1/categories',
      '/api/v1/transactions',
      '/api/v1/reports/summary',
      '/api/v1/dashboard/home',
      '/api/v1/sync/bootstrap',
      '/api/v1/meta',
    ]) {
      const response = await request(app.getHttpServer())
        .get(path)
        .set('X-Request-Id', 'qa-anonymous')
        .expect(401);
      expect(response.body).toMatchObject({
        code: path === '/api/v1/meta' ? 'UNAUTHORIZED' : 'AUTH_TOKEN_INVALID',
      });
      expect(response.headers).toMatchObject({
        'x-request-id': 'qa-anonymous',
        'x-content-type-options': 'nosniff',
      });
    }
    expect(verifier.snapshot().forbiddenBoundaryCalls).toBe(0);
  });

  it('rejects unadmitted provider, deletion, admin and unknown surfaces before business execution', async () => {
    for (const [method, path] of [
      ['post', '/api/v1/reports'],
      ['post', '/api/v1/reports/00000000-0000-4000-8000-000000000000/retry-delivery'],
      ['post', '/api/v1/report-schedules/verify-recipient'],
      ['patch', '/api/v1/report-schedules/00000000-0000-4000-8000-000000000000'],
      ['delete', '/api/v1/me/devices/00000000-0000-4000-8000-000000000000'],
      ['get', '/api/v1/admin/reference/currencies'],
      ['get', '/api/v1/accounts/provider-status'],
      ['get', '/api/v1/reports/provider-status'],
      ['get', '/api/v1/report-schedules/provider-status'],
      ['post', '/webhooks/clerk'],
      ['get', '/api/v1/accounts/one/extra'],
      ['get', '/api/v1/unknown'],
    ] as const) {
      const client = request(app.getHttpServer());
      const response = await client[method](path)
        .set('Authorization', 'Bearer ' + token)
        .set('Content-Type', 'application/json')
        .send(method === 'get' ? undefined : {})
        .expect(404);
      expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
    }
    expect(verifier.snapshot().forbiddenBoundaryCalls).toBe(0);
  });

  it('retains verifier503 without provider details through both original guards', async () => {
    const server = app.getHttpServer();
    for (const path of ['/api/v1/me', '/api/v1/meta']) {
      const response = await request(server)
        .get(path)
        .set('Authorization', 'Bearer ' + unavailableToken)
        .expect(503);
      expect(response.body).toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
      expect(JSON.stringify(response.body)).not.toContain(unavailableToken);
    }
    expect(verifier.snapshot().forbiddenBoundaryCalls).toBe(0);
  });

  it('revokes only the fixture credential and retains the original401 fence', async () => {
    verifier.revoke('primary_0');
    await request(app.getHttpServer())
      .get('/api/v1/accounts')
      .set('Authorization', 'Bearer ' + token)
      .expect(401);
    expect(verifier.snapshot().forbiddenBoundaryCalls).toBe(0);
  });

  it.each([
    ['application/json', '{broken', 400],
    ['text/plain', 'text', 415],
  ])('preserves HTTP input rejection for %s', async (contentType, body, status) => {
    await request(app.getHttpServer())
      .post('/api/v1/transactions')
      .set('Content-Type', contentType)
      .send(body)
      .expect(status);
    expect(verifier.snapshot().forbiddenBoundaryCalls).toBe(0);
  });
});
