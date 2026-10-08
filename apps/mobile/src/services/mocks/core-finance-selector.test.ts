import {
  createLiveCoreFinanceService,
  createProductionCoreFinanceService
} from './core-finance-service';
import { registerLiveClerkBridge } from '@/services/live/auth-service';
import { emptyTransactionFilters } from '@/domain/core-finance';

let mockUuid = 0;
const mockPersistCategory = jest.fn(async () => undefined);
jest.mock('@/storage/database', () => ({
  runExclusiveDatabaseTransaction: async (
    database: unknown,
    action: (database: unknown) => Promise<void>
  ) => action(database),
  openDatabase: async () => ({
    execAsync: async () => undefined,
    getAllAsync: async () => [],
    runAsync: mockPersistCategory
  })
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => `operation-key-${String(++mockUuid)}`
}));

beforeEach(() => {
  registerLiveClerkBridge({
    getSession: async () => ({
      id: 'session-owner',
      userId: 'user_owner',
      method: 'google',
      issuedAt: 1,
      expiresAt: 9999999999999
    }),
    getToken: async () => 'owner-token',
    startPhone: jest.fn(),
    verifyPhone: jest.fn(),
    resendPhone: jest.fn(),
    signInWithGoogle: jest.fn(),
    reverifyConflict: jest.fn(),
    signOut: jest.fn()
  });
  mockUuid = 0;
  mockPersistCategory.mockReset().mockResolvedValue(undefined);
});

const account = {
  id: '20000000-0000-4000-8000-000000000001',
  name: 'Cash',
  type: 'cash',
  currency: 'SAR',
  institutionName: null,
  lastFour: null,
  creditLimitMinor: null,
  statementDay: null,
  paymentDueDay: null,
  monthlyInterestRateBasisPoints: null,
  minimumPaymentMinor: null,
  automaticTrackingEnabled: false,
  version: 2,
  status: 'active',
  isDefault: false,
  iconKey: null,
  colorKey: null,
  notes: null,
  sortOrder: 1,
  includeInTotals: true,
  openedAt: null,
  closedAt: null,
  createdAt: '2026-09-06T00:00:00Z',
  updatedAt: '2026-09-06T00:00:00Z'
};
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
const category = {
  id: '10000000-0000-4000-8000-000000000001',
  scope: 'custom',
  kind: 'expense',
  labelAr: 'سفر',
  labelEn: 'Travel',
  icon: null,
  color: null,
  systemKey: null,
  parentId: null,
  mergedIntoId: null,
  sortOrder: 2,
  active: true,
  status: 'active',
  version: 1,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z'
};

it('keeps live Home expenses from older pages without changing full-history financial totals', async () => {
  const rows = Array.from({ length: 7 }, (_, index) => ({
    id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    kind: index < 5 ? 'income' : 'expense',
    status: 'confirmed',
    amountMinor: 100,
    currency: 'SAR',
    accountIds: [account.id],
    sourceAccountId: account.id,
    destinationAccountId: null,
    feeMinor: 0,
    categoryId: null,
    title: `Row ${index}`,
    merchant: null,
    note: null,
    occurredAt: new Date(
      Date.UTC(2026, 9, 8, 17) - index * 60_000
    ).toISOString(),
    source: 'voice',
    version: 1
  }));
  const request = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(
    async (url) => {
      const path = String(url);
      if (path.includes('/categories?'))
        return response({ items: [], nextCursor: null });
      if (path.includes('/summary'))
        return response({
          accountId: account.id,
          currency: 'SAR',
          balance: {
            accountId: account.id,
            currency: 'SAR',
            confirmedMinor: 300,
            pendingMinor: 0,
            ledgerVersion: 7,
            reconciledAt: '2026-10-08T17:30:00.000Z'
          },
          recentTransactions: [],
          ledgerVersion: 7,
          requestId: 'balance'
        });
      if (path.includes('/accounts?'))
        return response({ items: [account], nextCursor: null });
      if (path.includes('/transactions?'))
        return response({
          items: path.includes('cursor=older')
            ? rows.slice(5)
            : rows.slice(0, 5),
          nextCursor: path.includes('cursor=older') ? null : 'older',
          ledgerVersion: 7,
          requestId: 'list'
        });
      throw new Error(`Unexpected request: ${path}`);
    }
  );
  const summary = await createLiveCoreFinanceService({
    baseUrl: 'https://inert.invalid',
    request
  }).getHomeSummary('SAR');
  expect(
    summary.recentTransactions
      .filter((item) => item.type === 'expense')
      .map((item) => item.title)
  ).toEqual(['Row 5', 'Row 6']);
  expect(
    summary.recentTransactions
      .filter((item) => item.type === 'income')
      .slice(0, 2)
      .map((item) => item.title)
  ).toEqual(['Row 0', 'Row 1']);
  expect(summary).toMatchObject({
    totalBalanceMinor: 300,
    periodIncomeMinor: 500,
    periodExpenseMinor: 200
  });
  expect(
    request.mock.calls.every(
      ([, init]) => !init?.method || init.method === 'GET'
    )
  ).toBe(true);
});

it.each([
  ['expense', 'food', '04000000-0000-4000-8000-000000000002'],
  ['income', 'salary', '04000000-0000-4000-8000-000000000016'],
  ['expense', null, '10000000-0000-4000-8000-000000000001']
] as const)(
  'saves the selected %s category using its server UUID and restores its picker identity',
  async (kind, systemKey, serverId) => {
    const occurredAt = '2026-10-06T09:00:00.000Z';
    const transaction = {
      id: '30000000-0000-4000-8000-000000000001',
      kind,
      status: 'confirmed',
      amountMinor: 5000,
      currency: 'SAR',
      accountIds: [account.id],
      sourceAccountId: account.id,
      destinationAccountId: null,
      feeMinor: 0,
      categoryId: serverId,
      title: 'Food',
      merchant: null,
      note: null,
      occurredAt,
      source: 'manual',
      version: 1
    };
    const receipt = {
      transaction,
      postings: [
        {
          id: '40000000-0000-4000-8000-000000000001',
          accountId: account.id,
          amountMinor: kind === 'income' ? 5000 : -5000,
          clearingState: 'confirmed',
          postingRole: kind === 'income' ? 'destination' : 'source',
          occurredAt
        }
      ],
      revisions: [],
      ledgerVersion: 1,
      requestId: 'request-save'
    };
    const writes: RequestInit[] = [];
    const request = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(
      async (url, init) => {
        if (String(url).includes('/categories?'))
          return response({
            items: [
              {
                ...category,
                id: serverId,
                scope: systemKey ? 'system' : 'custom',
                kind,
                systemKey
              }
            ],
            nextCursor: null
          });
        if (init?.method === 'POST') {
          writes.push(init);
          if (JSON.parse(String(init.body)).categoryId !== serverId)
            return response(
              { code: 'VALIDATION_FAILED', requestId: 'request-save' },
              400
            );
          return response(
            {
              transaction: receipt,
              balances: [
                {
                  accountId: account.id,
                  currency: 'SAR',
                  confirmedMinor: kind === 'income' ? 5000 : -5000,
                  pendingMinor: 0,
                  ledgerVersion: 1,
                  reconciledAt: occurredAt
                }
              ],
              ledgerVersion: 1,
              requestId: 'request-save'
            },
            201
          );
        }
        if (String(url).includes('/transactions?'))
          return response({
            items: [transaction],
            nextCursor: null,
            ledgerVersion: 1,
            requestId: 'request-list'
          });
        return response(receipt);
      }
    );
    const service = createLiveCoreFinanceService({
      baseUrl: 'https://inert.invalid',
      request
    });
    const choices = await service.listCategories();
    const pickerId = systemKey ?? serverId;
    expect(choices[0]?.id).toBe(pickerId);
    const input = {
      type: kind,
      amountMinor: 5000,
      currencyCode: 'SAR',
      accountId: account.id,
      categoryId: choices[0]!.id,
      title: 'Food',
      occurredAt: Date.parse(occurredAt)
    };
    const operationId = '90000000-0000-4000-8000-000000000099';
    await expect(
      service.createTransaction(input, operationId)
    ).resolves.toMatchObject({
      value: { categoryId: pickerId }
    });
    expect(writes).toHaveLength(1);
    expect(JSON.parse(String(writes[0]!.body))).toMatchObject({
      categoryId: serverId
    });
    expect(writes[0]!.headers).toMatchObject({
      'Idempotency-Key': operationId
    });
    expect(input.categoryId).toBe(pickerId);
    await expect(service.getTransaction(transaction.id)).resolves.toMatchObject(
      { categoryId: pickerId }
    );
    const page = await service.listTransactions({
      ...emptyTransactionFilters,
      categoryIds: [pickerId]
    });
    expect(page.items[0]?.categoryId).toBe(pickerId);
    const listUrl = request.mock.calls.find(([url]) =>
      String(url).includes('/transactions?')
    )![0];
    expect(new URL(String(listUrl)).searchParams.get('categoryId')).toBe(
      serverId
    );
  }
);

it('fails missing production configuration explicitly before any local computation', async () => {
  const previous = process.env.EXPO_PUBLIC_API_URL;
  try {
    delete process.env.EXPO_PUBLIC_API_URL;
    const selected = createLiveCoreFinanceService();

    expect(selected.metadata).toMatchObject({
      kind: 'live',
      availability: 'unavailable'
    });
    await expect(selected.getHomeSummary('SAR')).rejects.toMatchObject({
      code: 'offline'
    });
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = previous;
  }
});

it.each([
  ['missing category', 400],
  ['unavailable catalog', 503],
  ['owner switch', 401]
] as const)(
  'does not dispatch a financial write during %s in category preparation',
  async (scenario, status) => {
    let userId = 'user_owner';
    registerLiveClerkBridge({
      getSession: async () => ({
        id: 'session-' + userId,
        userId,
        method: 'google',
        issuedAt: 1,
        expiresAt: 9999999999999
      }),
      getToken: async () => 'fixture-token',
      startPhone: jest.fn(),
      verifyPhone: jest.fn(),
      resendPhone: jest.fn(),
      signInWithGoogle: jest.fn(),
      reverifyConflict: jest.fn(),
      signOut: jest.fn()
    });
    const request = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(
      async () => {
        if (scenario === 'unavailable catalog')
          return response({ code: 'SERVICE_UNAVAILABLE' }, 503);
        if (scenario === 'owner switch') userId = 'user_other';
        return response({
          items:
            scenario === 'missing category'
              ? []
              : [
                  {
                    ...category,
                    id: '04000000-0000-4000-8000-000000000002',
                    scope: 'system',
                    systemKey: 'food'
                  }
                ],
          nextCursor: null
        });
      }
    );
    const service = createLiveCoreFinanceService({
      baseUrl: 'https://inert.invalid',
      request
    });
    await expect(
      service.createTransaction(
        {
          type: 'expense',
          amountMinor: 5000,
          currencyCode: 'SAR',
          accountId: account.id,
          categoryId: 'food',
          title: 'Food',
          occurredAt: Date.parse('2026-10-06T09:00:00.000Z')
        },
        '90000000-0000-4000-8000-000000000099'
      )
    ).rejects.toMatchObject({ metadata: { status } });
    expect(request.mock.calls.some(([, init]) => init?.method !== 'GET')).toBe(
      false
    );
  }
);

it('selects the live provider from the actual production factory', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousApiUrl = process.env.EXPO_PUBLIC_API_URL;
  const previousDemo = process.env.EXPO_PUBLIC_DEMO_MODE;
  try {
    process.env.NODE_ENV = 'production';
    process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
    delete process.env.EXPO_PUBLIC_DEMO_MODE;

    expect(createProductionCoreFinanceService().metadata).toMatchObject({
      id: 'phase04-core-finance-http',
      kind: 'live',
      availability: 'available'
    });
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = previousApiUrl;
    if (previousDemo === undefined) delete process.env.EXPO_PUBLIC_DEMO_MODE;
    else process.env.EXPO_PUBLIC_DEMO_MODE = previousDemo;
  }
});

it('serves account balances from the live BE005 summary endpoint', async () => {
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(response({ items: [account], nextCursor: null }))
    .mockResolvedValueOnce(
      response({
        accountId: account.id,
        currency: 'SAR',
        balance: {
          accountId: account.id,
          currency: 'SAR',
          confirmedMinor: 50_000,
          pendingMinor: 0,
          ledgerVersion: 3,
          reconciledAt: null
        },
        recentTransactions: [],
        ledgerVersion: 3,
        requestId: 'request-1'
      })
    );
  const service = createLiveCoreFinanceService({
    baseUrl: 'https://api.test',
    token: async () => 'owner-token',
    request
  });

  await expect(service.listAccountBalances(true)).resolves.toEqual([
    {
      accountId: account.id,
      balanceMinor: 50_000,
      currencyCode: 'SAR',
      asOf: null
    }
  ]);
});

it('reuses the same account-create idempotency key after an uncertain failure', async () => {
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockRejectedValueOnce(new TypeError('connection lost'))
    .mockResolvedValueOnce(
      response({ account, openingTransactionId: null }, 201)
    );
  const service = createLiveCoreFinanceService({
    baseUrl: 'https://api.test',
    token: async () => 'owner-token',
    request
  });
  const input = {
    name: 'Cash',
    type: 'cash' as const,
    currencyCode: 'SAR',
    openingBalanceMinor: 0
  };

  await expect(service.createAccount(input)).rejects.toMatchObject({
    code: 'offline'
  });
  await expect(service.createAccount(input)).resolves.toBeDefined();
  const first = request.mock.calls[0]?.[1]?.headers as Record<string, string>;
  const second = request.mock.calls[1]?.[1]?.headers as Record<string, string>;
  expect(second['Idempotency-Key']).toBe(first['Idempotency-Key']);
});

it('reuses the same category-create idempotency key after an uncertain failure', async () => {
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockRejectedValueOnce(new TypeError('connection lost'))
    .mockResolvedValueOnce(response(category, 201));
  const service = createLiveCoreFinanceService({
    baseUrl: 'https://api.test',
    token: async () => 'owner-token',
    request
  });
  const input = {
    labelAr: 'سفر',
    labelEn: 'Travel',
    financialType: 'expense' as const
  };

  await expect(service.createCategory(input)).rejects.toMatchObject({
    code: 'offline'
  });
  await expect(service.createCategory(input)).resolves.toBeDefined();
  const first = request.mock.calls[0]?.[1]?.headers as Record<string, string>;
  const second = request.mock.calls[1]?.[1]?.headers as Record<string, string>;
  expect(second['Idempotency-Key']).toBe(first['Idempotency-Key']);
});

it('retains category retry identity when the server succeeds but favorite persistence fails', async () => {
  mockPersistCategory.mockRejectedValueOnce(new Error('disk unavailable'));
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockImplementation(async () => response(category, 201));
  const service = createLiveCoreFinanceService({
    baseUrl: 'https://api.test',
    token: async () => 'owner-token',
    request
  });
  const input = {
    labelAr: 'سفر',
    labelEn: 'Travel',
    financialType: 'expense' as const,
    isFavorite: true
  };

  await expect(service.createCategory(input)).rejects.toMatchObject({
    code: 'offline'
  });
  await expect(service.createCategory(input)).resolves.toMatchObject({
    value: { isFavorite: true }
  });
  const first = request.mock.calls[0]?.[1]?.headers as Record<string, string>;
  const second = request.mock.calls[1]?.[1]?.headers as Record<string, string>;
  expect(second['Idempotency-Key']).toBe(first['Idempotency-Key']);
});
