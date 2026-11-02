import { resolve } from 'node:path';

import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { ClerkAuthGuard } from '../../../src/identity/clerk-auth.guard';
import { ClerkClientService } from '../../../src/identity/clerk-client.service';
import { LedgerRepository } from '../../../src/ledger/ledger.repository';
import { LedgerService } from '../../../src/ledger/ledger.service';
import { validateEnvironment } from '../../../src/platform/config/environment.schema';
import { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import { PoolService } from '../../../src/platform/database/pool.service';
import { SecurityRepository } from '../../../src/security/security.repository';
import { FixtureClerkVerifier } from '../../performance/qa-api/fixture-clerk-verifier';
import { buildQaChildEnvironment } from '../../performance/qa-api/qa-environment';

const token = 'qa-policy-boundary-opaque-token-00000';
const now = Date.now();
const environment = buildQaChildEnvironment({
  parent: {},
  binding: {
    schemaVersion: 1,
    projectId: 'masarifi_perf_20261102_d959_r2',
    systemIdentifier: '12345',
    role: 'masarifi_perf_r2_api_20261102',
    password: Buffer.alloc(32, 9).toString('base64url'),
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
    profileRoot: resolve('qa-policy-unit-profile'),
    sourceRevision: 'a'.repeat(40),
  },
  nowMs: now,
});

describe('synthetic QA recent-auth guard and real policy boundary', () => {
  let module: TestingModule;
  afterEach(async () => {
    await module.close();
  });
  it.each([
    { ages: [10, 10] as const, seconds: 600, allowed: true },
    { ages: [11, 11] as const, seconds: 660, allowed: false },
    { ages: null, seconds: null, allowed: false },
    { ages: [-1, -1] as const, seconds: null, allowed: false },
  ])('keeps the exact age boundary for %j', async ({ ages, seconds, allowed }) => {
    const verifier = new FixtureClerkVerifier([
      {
        reference: 'correctness',
        token,
        userId: 'perf_20261102_admission',
        sessionId: 'qa_session_policy_unit',
        notBeforeMs: now - 1000,
        expiresAtMs: now + 600000,
        sessionStatus: 'active',
        role: 'authenticated',
        factorVerificationAge: ages,
      },
    ]);
    module = await Test.createTestingModule({
      providers: [
        { provide: ConfigService, useValue: new ConfigService(validateEnvironment(environment)) },
        PlatformConfigService,
        PoolService,
        LedgerRepository,
        SecurityRepository,
        LedgerService,
        ClerkClientService,
        ClerkAuthGuard,
      ],
    })
      .overrideProvider(ClerkClientService)
      .useValue(verifier)
      .compile();
    const principal = await module.get(ClerkAuthGuard).verifyToken(token);
    expect(principal.factorAgeSeconds).toBe(seconds);
    const ledger = module.get(LedgerService);
    const atThreshold = () => {
      ledger.assertTrackingRecentAuth(principal, 'SAR', 1000000);
    };
    if (allowed) expect(atThreshold).not.toThrow();
    else {
      let rejection: unknown;
      try {
        atThreshold();
      } catch (error) {
        rejection = error;
      }
      expect(rejection).toMatchObject({ status: 403, response: { code: 'RECENT_AUTH_REQUIRED' } });
    }
    expect(() => {
      ledger.assertTrackingRecentAuth(principal, 'SAR', 999999);
    }).not.toThrow();
    expect(verifier.snapshot().forbiddenBoundaryCalls).toBe(0);
  });
});
