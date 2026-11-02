import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { ClerkAuthGuard } from '../../../src/identity/clerk-auth.guard';
import { ClerkClientService } from '../../../src/identity/clerk-client.service';
import { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import type { PlatformEnvironment } from '../../../src/platform/config/environment.types';
import {
  FixtureClerkVerifier,
  type FixtureCredential,
} from '../../performance/qa-api/fixture-clerk-verifier';

const origin = 'https://performance.qa.invalid';
const token = 'qa-test-only-opaque-primary-zero-0000';
function credential(overrides: Partial<FixtureCredential> = {}): FixtureCredential {
  return {
    reference: 'primary_0',
    token,
    userId: 'perf_20261102_t0',
    sessionId: 'qa_session_primary_0',
    notBeforeMs: 1000,
    expiresAtMs: 5000,
    sessionStatus: 'active',
    role: 'authenticated',
    factorVerificationAge: [2, 3],
    ...overrides,
  };
}

describe('isolated fixture external verifier with real ClerkAuthGuard', () => {
  let module: TestingModule | undefined;
  afterEach(async () => {
    await module?.close();
    module = undefined;
  });

  async function guardFor(adapter: FixtureClerkVerifier): Promise<ClerkAuthGuard> {
    const config = new ConfigService<PlatformEnvironment, true>({
      CLERK_AUTHORIZED_PARTIES: [origin],
      CLERK_SECRET_KEY: '',
    });
    module = await Test.createTestingModule({
      providers: [
        { provide: ConfigService, useValue: config },
        PlatformConfigService,
        ClerkClientService,
        ClerkAuthGuard,
      ],
    })
      .overrideProvider(ClerkClientService)
      .useValue(adapter)
      .compile();
    return module.get(ClerkAuthGuard);
  }

  it('retains the original principal and minute-to-second conversion without constructing the SDK client', async () => {
    const guard = await guardFor(new FixtureClerkVerifier([credential()], () => 2000));
    await expect(guard.verifyToken(token)).resolves.toEqual({
      userId: 'perf_20261102_t0',
      sessionId: 'qa_session_primary_0',
      factorAgeSeconds: 120,
      mfaAgeSeconds: 180,
    });
    // Explicit empty internal secret prevents recovery from test/setup's environment fallback.
  });

  it('binds retained correctness fixtures to their separate owner with fresh and stale auth ages', async () => {
    const fresh = credential({
      reference: 'correctness',
      userId: 'perf_20261102_admission',
      sessionId: 'qa_session_admission',
      factorVerificationAge: [0, 0],
    });
    const stale = credential({
      reference: 'correctness_stale',
      token: token + '-stale',
      userId: fresh.userId,
      sessionId: 'qa_session_admission_stale',
      factorVerificationAge: [100, 100],
    });
    const guard = await guardFor(new FixtureClerkVerifier([fresh, stale], () => 2000));
    await expect(guard.verifyToken(fresh.token)).resolves.toMatchObject({
      userId: fresh.userId,
      factorAgeSeconds: 0,
    });
    await expect(guard.verifyToken(stale.token)).resolves.toMatchObject({
      userId: fresh.userId,
      factorAgeSeconds: 6000,
    });
    expect(() => new FixtureClerkVerifier([{ ...fresh, userId: 'perf_20261102_t0' }])).toThrow(
      'QA_CREDENTIAL_CONFIGURATION_INVALID',
    );
  });

  it('rejects unknown, not-yet-valid, expired and revoked tokens with the same real401 result', async () => {
    let now = 2000;
    const adapter = new FixtureClerkVerifier([credential()], () => now);
    const guard = await guardFor(adapter);
    for (const rejected of ['unknown-token', token]) {
      if (rejected === token) now = 999;
      await expect(guard.verifyToken(rejected)).rejects.toMatchObject({ status: 401 });
    }
    now = 5000;
    await expect(guard.verifyToken(token)).rejects.toMatchObject({ status: 401 });
    now = 2000;
    adapter.revoke('primary_0');
    await expect(guard.verifyToken(token)).rejects.toMatchObject({ status: 401 });
  });

  it.each([
    { sessionStatus: 'inactive' as const },
    { role: 'fixture_invalid' as const },
    { azp: 'https://wrong.qa.invalid' },
  ])('lets the real guard reject invalid provider claims: %j', async (invalid) => {
    const guard = await guardFor(new FixtureClerkVerifier([credential(invalid)], () => 2000));
    await expect(guard.verifyToken(token)).rejects.toMatchObject({ status: 401 });
  });

  it('retains provider-unavailable503 and refuses bootstrap/revocation provider calls', async () => {
    const adapter = new FixtureClerkVerifier([credential({ unavailable: true })], () => 2000);
    const guard = await guardFor(adapter);
    await expect(guard.verifyToken(token)).rejects.toBeInstanceOf(HttpException);
    await expect(guard.verifyToken(token)).rejects.toMatchObject({ status: 503 });
    await expect(adapter.getIdentityUser('perf_20261102_t0')).rejects.toThrow(
      'QA_PROVIDER_BOUNDARY_DENIED',
    );
    await expect(adapter.revokeSession('qa_session_primary_0')).rejects.toThrow(
      'QA_PROVIDER_BOUNDARY_DENIED',
    );
    expect(adapter.snapshot()).toEqual({ credentialCount: 1, forbiddenBoundaryCalls: 2 });
  });

  it('accepts only a single exact bearer credential and never derives ownership from other input', async () => {
    const adapter = new FixtureClerkVerifier([credential()], () => 2000);
    for (const authorization of [
      undefined,
      ['Bearer ' + token],
      'Bearer ' + token + ' ',
      'bearer ' + token,
    ]) {
      const request = {
        headers: {
          authorization,
          cookie: 'user=perf_20261102_t0',
          'x-user-id': 'perf_20261102_t0',
        },
      };
      await expect(adapter.authenticateRequest(request)).resolves.toEqual({
        isAuthenticated: false,
      });
    }
  });

  it('refuses a mislabeled dataset credential and malformed or duplicate configuration', () => {
    for (const entries of [
      [credential({ userId: 'perf_20261102_t1000' })],
      [credential(), credential({ reference: 'expired' })],
      [credential({ expiresAtMs: 1000 })],
      [credential({ factorVerificationAge: 'invalid' as unknown as [number, number] })],
    ])
      expect(() => new FixtureClerkVerifier(entries, () => 2000)).toThrow(
        'QA_CREDENTIAL_CONFIGURATION_INVALID',
      );
  });

  it('keeps owner and age bindings detached from input, output and spoofed headers', async () => {
    const input = credential();
    const adapter = new FixtureClerkVerifier([input], () => 2000);
    input.userId = 'perf_20261102_t1000';
    const request = { headers: { authorization: 'Bearer ' + token, 'x-user-id': input.userId } };
    const first = await adapter.authenticateRequest(request);
    expect(first.isAuthenticated).toBe(true);
    if (!first.isAuthenticated || first.factorVerificationAge === null)
      throw new Error('EXPECTED_TEST_PRINCIPAL');
    (first.factorVerificationAge as [number, number])[0] = 999;
    await expect(adapter.authenticateRequest(request)).resolves.toMatchObject({
      isAuthenticated: true,
      userId: 'perf_20261102_t0',
      factorVerificationAge: [2, 3],
    });
    expect(adapter.snapshot()).toEqual({ credentialCount: 1, forbiddenBoundaryCalls: 0 });
  });
});
