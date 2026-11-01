import { SecurityService } from '../../../src/security/security.service';
import type { SecurityRepository } from '../../../src/security/security.repository';
import type { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import type { ClerkClientService } from '../../../src/identity/clerk-client.service';

test('accepts Express transport params without a prototype when reading the Admin session', async () => {
  const service = new SecurityService(
    {
      consumeRateLimit: jest.fn().mockResolvedValue(true),
      execute: jest.fn().mockResolvedValue({
        id: 'transport-admin',
        displayName: 'Test admin',
        roleKeys: ['super-admin'],
        effectivePermissionKeys: ['admin.overview.read'],
        version: 1,
      }),
    } as unknown as SecurityRepository,
    { get: () => undefined } as unknown as PlatformConfigService,
    { countActiveSessions: () => Promise.resolve(0) } as unknown as ClerkClientService,
    {} as never,
    {} as never,
  );
  await expect(
    service.execute({
      operation: 'getAdminSelf',
      permission: 'admin.overview.read',
      principal: { userId: 'transport-admin', sessionId: 'test', factorAgeSeconds: 30 },
      body: undefined,
      query: {},
      params: Object.create(null) as Record<string, string>,
      requestId: 'transport-test',
    }),
  ).resolves.toMatchObject({ id: 'transport-admin' });
});
