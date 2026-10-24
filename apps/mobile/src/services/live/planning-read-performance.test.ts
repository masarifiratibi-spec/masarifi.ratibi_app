import { registerLiveClerkBridge, type LiveClerkBridge } from './auth-service';
import { createLiveFinancialPlanningService } from './financial-planning-service';
import { savingsGoalWireFixture } from '@/test-utils/financial-planning-api-fixtures';

const session = {
  id: 'read-session',
  userId: 'read-owner',
  method: 'google' as const,
  issuedAt: 1,
  expiresAt: 9_999_999_999_999
};
const response = (value: unknown): Response =>
  ({ ok: true, status: 200, json: async () => value }) as Response;

it('uses cached read authentication for planning GETs and fresh authentication for writes', async () => {
  const getToken = jest.fn(async ({ skipCache }: { skipCache: boolean }) =>
    skipCache ? 'write-token' : 'read-token'
  );
  registerLiveClerkBridge({
    getSession: async () => session,
    getToken,
    startPhone: jest.fn(),
    verifyPhone: jest.fn(),
    resendPhone: jest.fn(),
    signInWithGoogle: jest.fn(),
    reverifyConflict: jest.fn(),
    signOut: jest.fn()
  } satisfies LiveClerkBridge);
  const request = jest.fn(async (_url, init?: RequestInit) =>
    response(
      init?.method === 'POST'
        ? { resource: savingsGoalWireFixture, replayed: false }
        : { items: [savingsGoalWireFixture], nextCursor: null }
    )
  );
  const service = createLiveFinancialPlanningService({
    baseUrl: 'https://inert.invalid',
    request
  });
  await service.listGoals({});
  expect(
    new Headers(request.mock.calls[0][1]?.headers).get('authorization')
  ).toBe('Bearer read-token');
  // A definite rejection still exercises the write authentication boundary.
  request.mockImplementation(
    async () =>
      ({
        ok: false,
        status: 403,
        json: async () => ({ code: 'FORBIDDEN' })
      }) as Response
  );
  await expect(
    service.setGoalStatus(
      savingsGoalWireFixture.id,
      1,
      'paused',
      'write-operation'
    )
  ).rejects.toMatchObject({ code: 'forbidden' });
  expect(
    new Headers(request.mock.calls[1][1]?.headers).get('authorization')
  ).toBe('Bearer write-token');
  expect(getToken.mock.calls).toEqual([
    [{ skipCache: false }],
    [{ skipCache: true }]
  ]);
});

it('starts obligation summaries before the independent list completes', async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const paths: string[] = [];
  const service = createLiveFinancialPlanningService({
    baseUrl: 'https://inert.invalid',
    request: async (url) => {
      paths.push(String(url));
      if (String(url).includes('/obligations?')) {
        await pending;
        return response({ items: [], nextCursor: null });
      }
      return response({
        period: '2026-10',
        dataState: 'empty',
        ledgerVersion: 0,
        salary: null,
        budgets: [],
        obligations: { payables: [], receivables: [] },
        savings: []
      });
    }
  });
  const read = service.getObligationsOverview({});
  try {
    for (let i = 0; i < 30; i++) await Promise.resolve();
    expect(paths.some((path) => path.includes('/planning/summary'))).toBe(true);
  } finally {
    release();
    await read;
  }
});
