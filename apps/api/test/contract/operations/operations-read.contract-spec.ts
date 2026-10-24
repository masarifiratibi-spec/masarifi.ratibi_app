import { OPERATIONS_ROUTES } from '../../../src/operations/operations.controller';
import { OPERATIONS_PERMISSION_KEYS } from '../../../src/security/permission-manifest';

describe('operations route contract', () => {
  it('maps every approved Admin operation to an exact permission', () => {
    expect(OPERATIONS_ROUTES).toHaveLength(24);
    expect(new Set(OPERATIONS_ROUTES.map((route) => route.operation)).size).toBe(24);
    expect(OPERATIONS_ROUTES).toContainEqual({
      method: 'GET',
      path: 'api/v1/admin/ai/usage-limits',
      operation: 'getAiUsageLimits',
      status: 200,
      permission: 'operations.settings.read',
      recentAuth: false,
    });
    for (const route of OPERATIONS_ROUTES) {
      expect(OPERATIONS_PERMISSION_KEYS).toContain(route.permission);
      expect(route.permission).not.toContain('*');
      expect(route.path).toMatch(/^api\/v1\/admin\//);
    }
  });

  it('requires recent Clerk login on every operational mutation except safe preview', () => {
    for (const route of OPERATIONS_ROUTES.filter((candidate) => candidate.method !== 'GET')) {
      expect(route.recentAuth).toBe(route.operation === 'previewFeatureFlag' ? false : true);
    }
  });

  it('contains no billing, payment, plan, subscription, promotion, or Stripe route', () => {
    expect(JSON.stringify(OPERATIONS_ROUTES)).not.toMatch(
      /billing|payment|subscription|promotion|stripe|checkout/i,
    );
  });
});
