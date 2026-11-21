import { createLiveCategoryLifecycleService } from './category-lifecycle-service';
import { createLiveFinancialPlanningService } from './financial-planning-service';
import { registerLiveClerkBridge } from './auth-service';
import { budgetWireFixture } from '@/test-utils/financial-planning-api-fixtures';
import { resolveReportPeriod } from '@/domain/reports';

jest.mock('@/storage/database', () => ({
  openDatabase: async () => ({
    execAsync: async () => undefined,
    getAllAsync: async () => [],
    runAsync: async () => undefined
  }),
  runExclusiveDatabaseTransaction: async (db: unknown, action: (db: unknown) => Promise<void>) => action(db)
}));

const housing = '04000000-0000-4000-8000-000000000001';
const custom = '70000000-0000-4000-8000-000000000096';
const timestamp = '2026-10-19T00:00:00.000Z';
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

it('round trips system and custom category IDs through budget save, reads and moves', async () => {
  registerLiveClerkBridge({
    getSession: async () => ({ id: 'budget-session', userId: 'budget-owner', method: 'google', issuedAt: 1, expiresAt: 9999999999999 }),
    getToken: async () => 'test-token', startPhone: jest.fn(), verifyPhone: jest.fn(),
    resendPhone: jest.fn(), signInWithGoogle: jest.fn(), reverifyConflict: jest.fn(), signOut: jest.fn()
  });
  let wire = { ...budgetWireFixture, status: 'draft', version: 1 };
  let allocations: Record<string, unknown>[] = [];
  const request = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(async (url, init) => {
    const path = String(url);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (path.includes('/api/v1/categories?')) return response({ items: [housing, custom].map((id, index) => ({
      id, scope: index ? 'custom' : 'system', kind: 'expense', labelAr: 'فئة', labelEn: 'Category',
      systemKey: index ? null : 'housing', sortOrder: index, active: true, status: 'active', version: 1,
      createdAt: timestamp, updatedAt: timestamp
    })), nextCursor: null });
    if (init?.method === 'POST') return response({ resource: wire, operationId: '70000000-0000-4000-8000-000000000099', replayed: false });
    if (init?.method === 'PATCH') {
      wire = { ...wire, ...body.patch, version: wire.version + 1 };
      return response({ resource: wire, operationId: '70000000-0000-4000-8000-000000000099', replayed: false });
    }
    if (init?.method === 'PUT') {
      if (body.allocations.some((item: { categoryId: string }) => ![housing, custom].includes(item.categoryId)))
        return response({ code: 'VALIDATION_FAILED' }, 400);
      allocations = body.allocations.map((item: Record<string, unknown>, index: number) => ({
        ...item, id: `70000000-0000-4000-8000-00000000009${index + 7}`, version: 1,
        createdAt: timestamp, updatedAt: timestamp
      }));
      wire = { ...wire, version: wire.version + 1 };
      return response({ resource: { id: wire.id, version: wire.version, allocationCount: allocations.length }, operationId: '70000000-0000-4000-8000-000000000099', replayed: false });
    }
    const summary = { budgetId: wire.id, currencyCode: 'SAR', periodStart: wire.periodStart, periodEnd: wire.periodEnd,
      totalMinor: wire.totalMinor, spentMinor: '0', remainingMinor: wire.totalMinor, dataState: 'complete',
      unavailableReason: null, ledgerVersion: 1, items: [] };
    if (path.includes('/planning/summary')) return response({ period: '2026-09', dataState: 'ready', ledgerVersion: 1,
      salary: null, budgets: [{ id: wire.id, name: wire.name, currencyCode: 'SAR', totalMinor: wire.totalMinor,
        spentMinor: '0', remainingMinor: wire.totalMinor, ledgerVersion: 1, dataState: 'complete',
        categories: allocations.map(item => ({ ...item, budgetId: wire.id })) }],
      obligations: { payables: [], receivables: [] }, savings: [] });
    if (path.endsWith('/summary')) return response(summary);
    if (path.includes('/budgets?')) return response({ items: [wire], nextCursor: null });
    if (path.includes('/obligations') || path.includes('/savings-goals')) return response({ items: [], nextCursor: null });
    return response({ ...wire, categories: allocations });
  });
  const categories = createLiveCategoryLifecycleService({ baseUrl: 'https://inert.invalid', request });
  const service = createLiveFinancialPlanningService({ baseUrl: 'https://inert.invalid', request,
    categoryIds: { prepare: categories.prepareCategoryIds, toServer: categories.serverCategoryId, toLocal: categories.localCategoryId }
  });
  const categoryInputs = ['housing', custom].map((categoryId) => ({
    id: categoryId, budgetId: wire.id, categoryId, limitMinor: 125, alertThresholds: [75, 90],
    status: 'active' as const, version: 1, syncStatus: 'synced' as const, createdAt: 1, updatedAt: 1
  }));
  await expect(service.saveBudget({ name: 'Acceptance', periodKey: '2026-09', currencyCode: 'SAR',
    configuredExpenseLimitMinor: 1000, incomeTargetMinor: 0, savingsTargetMinor: 0, categories: categoryInputs
  }, 'new-budget-key')).resolves.toMatchObject({ value: { status: 'active' } });
  expect((await service.getBudgetById(wire.id)).categories.map(item => item.categoryId)).toEqual(['housing', custom]);
  expect((await service.listBudgets('2026-09'))[0].categories.map(item => item.categoryId)).toEqual(['housing', custom]);
  const report = await service.getReportingSnapshot(resolveReportPeriod({
    kind: 'monthly', anchorDate: '2026-09-09', timeZone: 'UTC', now: Date.parse(timestamp)
  }));
  expect(report.categoryBudgets.map(item => item.categoryId)).toEqual(['housing', custom]);
  const preview = await service.previewBudgetMove({ budgetId: wire.id, fromCategoryId: 'housing', toCategoryId: custom, amountMinor: 25 });
  const moved = await service.confirmBudgetMove(preview.previewId, 'move-key');
  expect(moved.value.categories.map(item => [item.categoryId, item.limitMinor])).toEqual([['housing', 100], [custom, 150]]);
  expect(request.mock.calls.filter(([url]) => String(url).includes('/api/v1/categories?'))).toHaveLength(1);
  expect(request.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
});

it.each(['unmapped', 'owner-change'])('does not create a partial budget when category preparation fails: %s', async (scenario) => {
  let owner = 'owner-a';
  registerLiveClerkBridge({
    getSession: async () => ({ id: owner, userId: owner, method: 'google', issuedAt: 1, expiresAt: 9999999999999 }),
    getToken: async () => 'test-token', startPhone: jest.fn(), verifyPhone: jest.fn(),
    resendPhone: jest.fn(), signInWithGoogle: jest.fn(), reverifyConflict: jest.fn(), signOut: jest.fn()
  });
  const request = jest.fn();
  const service = createLiveFinancialPlanningService({ baseUrl: 'https://inert.invalid', request,
    categoryIds: {
      prepare: async () => { if (scenario === 'owner-change') owner = 'owner-b'; },
      toServer: () => { throw new Error('CATEGORY_INVALID'); }, toLocal: id => id
    }
  });
  await expect(service.saveBudget({ name: 'Invalid category', periodKey: '2026-09', currencyCode: 'SAR',
    configuredExpenseLimitMinor: 1000, incomeTargetMinor: 0, savingsTargetMinor: 0,
    categories: [{ id: 'unknown', budgetId: budgetWireFixture.id, categoryId: 'unknown', limitMinor: 125,
      alertThresholds: [75], status: 'active', version: 1, syncStatus: 'synced', createdAt: 1, updatedAt: 1 }]
  }, 'invalid-category-key')).rejects.toThrow(scenario === 'unmapped' ? 'CATEGORY_INVALID' : undefined);
  expect(request).not.toHaveBeenCalled();
});
