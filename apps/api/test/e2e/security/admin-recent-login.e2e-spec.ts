import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AiAdminController } from '../../../src/ai/ai.admin.controller';
import { AiService } from '../../../src/ai/ai.service';
import { ClerkAuthGuard } from '../../../src/identity/clerk-auth.guard';
import { ClerkClientService } from '../../../src/identity/clerk-client.service';
import { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import { SafeExceptionFilter } from '../../../src/platform/http/safe-exception.filter';
import { AdminAuthGuard } from '../../../src/security/admin-auth.guard';
import { SecurityRepository } from '../../../src/security/security.repository';

describe('governed Admin HTTP recent-login policy', () => {
  let app: INestApplication;
  const identity = {
    isAuthenticated: true,
    sessionStatus: 'active',
    userId: 'fixture-super-admin',
    sessionId: 'fixture-session',
    role: 'authenticated',
    azp: 'https://admin.example.test',
    factorVerificationAge: [1, -1],
  };
  const authenticateRequest = jest.fn();
  const adminMutate = jest.fn().mockResolvedValue({ id: 'fixture-model', version: 2 });
  const assertAdminPermission = jest.fn((principal: { userId: string }, permission: string) => {
    if (principal.userId !== identity.userId || permission !== 'ai.models.manage') {
      throw Object.assign(new Error('ADMIN_PERMISSION_DENIED'), { code: '42501' });
    }
  });
  const body = {
    providerId: '99010000-0000-4000-8000-000000000007',
    expectedVersion: 1,
    reason: 'Approved existing Voice provider association',
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AiAdminController],
      providers: [
        AdminAuthGuard,
        ClerkAuthGuard,
        { provide: ClerkClientService, useValue: { authenticateRequest } },
        { provide: SecurityRepository, useValue: { assertAdminPermission } },
        { provide: AiService, useValue: { adminMutate } },
        {
          provide: PlatformConfigService,
          useValue: {
            get: (key: string) => (key === 'MASARIFI_ADMIN_ROUTES_ENABLED' ? true : 600),
            getRequired: () => ['https://admin.example.test'],
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new SafeExceptionFilter());
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    authenticateRequest.mockResolvedValue(identity);
  });

  const mutate = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0])
      .patch('/api/v1/admin/ai/models/99020000-0000-4000-8000-000000000006')
      .set('Authorization', 'Bearer opaque-provider-verified-fixture')
      .set('Idempotency-Key', 'fixture-governed-key')
      .set('x-admin-role', 'super-admin')
      .send(body);

  it.each([
    ['signed out', { ...identity, isAuthenticated: false }, 401, 'AUTH_TOKEN_INVALID'],
    ['revoked session', { ...identity, sessionStatus: 'ended' }, 401, 'AUTH_TOKEN_INVALID'],
    ['normal authenticated user', { ...identity, userId: 'fixture-normal-user' }, 403, 'FORBIDDEN'],
    [
      'Admin without exact permission',
      { ...identity, userId: 'fixture-admin-other-permission' },
      403,
      'FORBIDDEN',
    ],
    [
      'Super Admin with stale login and fresh MFA',
      { ...identity, factorVerificationAge: [11, 0] },
      403,
      'RECENT_AUTH_REQUIRED',
    ],
    [
      'Super Admin without login-age claim',
      { ...identity, factorVerificationAge: [] },
      403,
      'RECENT_AUTH_REQUIRED',
    ],
  ])('denies %s before any governed effect', async (_label, state, status, code) => {
    authenticateRequest.mockResolvedValueOnce(state);
    await mutate()
      .expect(status)
      .expect((response) => {
        expect(response.body).toMatchObject({ code });
      });
    expect(adminMutate).not.toHaveBeenCalled();
  });

  it.each([[1, -1], [1], [10, -1]])(
    'allows recent valid Super Admin login with no verified MFA (%j)',
    async (...ages) => {
      authenticateRequest.mockResolvedValueOnce({ ...identity, factorVerificationAge: ages });
      await mutate().expect(200);
      expect(assertAdminPermission).toHaveBeenCalledWith(
        expect.objectContaining({ userId: identity.userId }),
        'ai.models.manage',
      );
      expect(adminMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: identity.userId,
          factorAgeSeconds: ages[0] * 60,
          mfaAgeSeconds: null,
        }),
        'models',
        '99020000-0000-4000-8000-000000000006',
        body,
        'fixture-governed-key',
        expect.any(String),
      );
    },
  );
});
