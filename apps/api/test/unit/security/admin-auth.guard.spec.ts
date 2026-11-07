import { HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import {
  AdminAuthGuard,
  adminPermission,
  type AdminPrincipalRequest,
} from '../../../src/security/admin-auth.guard';

const execution = (request: AdminPrincipalRequest, handler = () => undefined): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => class TestController {},
  }) as unknown as ExecutionContext;

describe('AdminAuthGuard', () => {
  const principal = {
    userId: 'user_1',
    sessionId: 'sess_1',
    factorAgeSeconds: 30,
    mfaAgeSeconds: 30,
  };
  const clerk = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest<AdminPrincipalRequest>();
      request.clerkPrincipal = principal;
      return Promise.resolve(true);
    }),
  };
  const repository = { assertAdminPermission: jest.fn(() => Promise.resolve()) };
  const reflector = { getAllAndOverride: jest.fn() };
  const config = {
    get: jest.fn<boolean | number, [string]>((key) =>
      key === 'MASARIFI_ADMIN_ROUTES_ENABLED' ? true : 600,
    ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clerk.canActivate.mockImplementation((context: ExecutionContext) => {
      context.switchToHttp().getRequest<AdminPrincipalRequest>().clerkPrincipal = principal;
      return Promise.resolve(true);
    });
    repository.assertAdminPermission.mockResolvedValue(undefined);
    config.get.mockImplementation((key) => (key === 'MASARIFI_ADMIN_ROUTES_ENABLED' ? true : 600));
  });

  it('requires one exact manifest permission and ignores client assertions', async () => {
    reflector.getAllAndOverride.mockReturnValue({ permission: 'audit.read', recentAuth: false });
    const guard = new AdminAuthGuard(
      clerk as never,
      repository as never,
      reflector as never,
      config as never,
    );
    const request = {
      headers: { 'x-admin-role': 'super-admin' },
      query: { role: 'super-admin' },
    } as never;
    await expect(guard.canActivate(execution(request))).resolves.toBe(true);
    expect(repository.assertAdminPermission).toHaveBeenCalledWith(principal, 'audit.read');
  });

  it('reuses only the same subject and permission within one request', async () => {
    reflector.getAllAndOverride.mockReturnValue({ permission: 'audit.read', recentAuth: false });
    const guard = new AdminAuthGuard(
      clerk as never,
      repository as never,
      reflector as never,
      config as never,
    );
    const request = {} as AdminPrincipalRequest;
    await guard.canActivate(execution(request));
    await guard.canActivate(execution(request));
    expect(repository.assertAdminPermission).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['routes disabled', false, { permission: 'audit.read', recentAuth: false }, principal, 404],
    ['missing metadata', true, undefined, principal, 403],
    ['unknown key', true, { permission: '*', recentAuth: false }, principal, 403],
    [
      'missing login age',
      true,
      { permission: 'audit.read', recentAuth: true },
      { ...principal, factorAgeSeconds: null, mfaAgeSeconds: 0 },
      403,
    ],
    [
      'stale login with fresh MFA',
      true,
      { permission: 'audit.read', recentAuth: true },
      { ...principal, factorAgeSeconds: 601, mfaAgeSeconds: 0 },
      403,
    ],
  ])('fails closed for %s', async (_label, enabled, metadata, authPrincipal, status) => {
    config.get.mockImplementation((key: string) =>
      key === 'MASARIFI_ADMIN_ROUTES_ENABLED' ? enabled : 600,
    );
    reflector.getAllAndOverride.mockReturnValue(metadata);
    clerk.canActivate.mockImplementation((context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest<AdminPrincipalRequest>();
      request.clerkPrincipal = authPrincipal;
      return Promise.resolve(true);
    });
    const guard = new AdminAuthGuard(
      clerk as never,
      repository as never,
      reflector as never,
      config as never,
    );
    await expect(guard.canActivate(execution({} as AdminPrincipalRequest))).rejects.toMatchObject({
      status,
    });
  });

  it('maps evaluator failures to a safe unavailable response', async () => {
    reflector.getAllAndOverride.mockReturnValue({ permission: 'audit.read', recentAuth: false });
    repository.assertAdminPermission.mockRejectedValueOnce(new Error('database detail'));
    const guard = new AdminAuthGuard(
      clerk as never,
      repository as never,
      reflector as never,
      config as never,
    );
    await expect(guard.canActivate(execution({} as AdminPrincipalRequest))).rejects.toEqual(
      new HttpException({ code: 'AUTHORIZATION_UNAVAILABLE' }, 503),
    );
  });

  it('exports a decorator that writes only canonical metadata', () => {
    expect(() => adminPermission('audit.read', { recentAuth: true })).not.toThrow();
    expect(() => adminPermission('*')).toThrow('ADMIN_PERMISSION_INVALID');
  });

  it.each([null, undefined, 99_999])(
    'allows a recent authorized login without a verified second factor (%s)',
    async (mfaAgeSeconds) => {
      reflector.getAllAndOverride.mockReturnValue({
        permission: 'ai.routes.manage',
        recentAuth: true,
      });
      const authPrincipal = { ...principal, factorAgeSeconds: 600, mfaAgeSeconds };
      clerk.canActivate.mockImplementation((context: ExecutionContext) => {
        context.switchToHttp().getRequest<AdminPrincipalRequest>().clerkPrincipal = authPrincipal;
        return Promise.resolve(true);
      });
      const guard = new AdminAuthGuard(
        clerk as never,
        repository as never,
        reflector as never,
        config as never,
      );
      await expect(guard.canActivate(execution({} as AdminPrincipalRequest))).resolves.toBe(true);
      expect(repository.assertAdminPermission).toHaveBeenCalledWith(
        authPrincipal,
        'ai.routes.manage',
      );
    },
  );

  it.each([undefined, -1, NaN, Infinity, 601])(
    'denies invalid/stale login age even with fresh MFA (%s)',
    async (factorAgeSeconds) => {
      reflector.getAllAndOverride.mockReturnValue({
        permission: 'ai.routes.manage',
        recentAuth: true,
      });
      clerk.canActivate.mockImplementation((context: ExecutionContext) => {
        context.switchToHttp().getRequest<AdminPrincipalRequest>().clerkPrincipal = {
          ...principal,
          factorAgeSeconds,
          mfaAgeSeconds: 0,
        } as typeof principal;
        return Promise.resolve(true);
      });
      const guard = new AdminAuthGuard(
        clerk as never,
        repository as never,
        reflector as never,
        config as never,
      );
      await expect(guard.canActivate(execution({} as AdminPrincipalRequest))).rejects.toEqual(
        new HttpException({ code: 'RECENT_AUTH_REQUIRED' }, 403),
      );
      expect(repository.assertAdminPermission).not.toHaveBeenCalled();
    },
  );

  it('denies a signed-out caller before permission evaluation', async () => {
    clerk.canActivate.mockRejectedValueOnce(new HttpException({ code: 'AUTH_TOKEN_INVALID' }, 401));
    const guard = new AdminAuthGuard(
      clerk as never,
      repository as never,
      reflector as never,
      config as never,
    );
    await expect(guard.canActivate(execution({} as AdminPrincipalRequest))).rejects.toMatchObject({
      status: 401,
    });
    expect(repository.assertAdminPermission).not.toHaveBeenCalled();
  });

  it.each(['normal-user', 'admin-without-required-permission'])(
    'denies %s despite a recent valid login',
    async (userId) => {
      reflector.getAllAndOverride.mockReturnValue({
        permission: 'ai.routes.manage',
        recentAuth: true,
      });
      const authPrincipal = { ...principal, userId, mfaAgeSeconds: null };
      clerk.canActivate.mockImplementation((context: ExecutionContext) => {
        context.switchToHttp().getRequest<AdminPrincipalRequest>().clerkPrincipal = authPrincipal;
        return Promise.resolve(true);
      });
      repository.assertAdminPermission.mockRejectedValueOnce(
        Object.assign(new Error('ADMIN_PERMISSION_DENIED'), { code: '42501' }),
      );
      const guard = new AdminAuthGuard(
        clerk as never,
        repository as never,
        reflector as never,
        config as never,
      );
      await expect(guard.canActivate(execution({} as AdminPrincipalRequest))).rejects.toEqual(
        new HttpException({ code: 'ADMIN_PERMISSION_DENIED' }, 403),
      );
      expect(repository.assertAdminPermission).toHaveBeenCalledWith(
        authPrincipal,
        'ai.routes.manage',
      );
    },
  );
});
