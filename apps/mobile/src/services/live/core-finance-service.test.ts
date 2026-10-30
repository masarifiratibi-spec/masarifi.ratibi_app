import {
  emptyTransactionFilters,
  draftInputSchema,
  type Transaction
} from '@/domain/core-finance';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import * as database from '@/storage/database';
import { HttpError, configureRecentAuthHandler } from './http-client';
import { registerLiveClerkBridge, type LiveClerkBridge } from './auth-service';
import {
  createLiveCoreFinanceSync,
  createLiveLedgerService
} from './core-finance-service';
import { readRecoveryNetwork } from '@/services/platform/read-recovery-network';
import { createLiveCoreFinanceService } from '@/services/core-finance-runtime';
import { TRANSACTION_EDIT_JOURNAL_PREFIX } from '@/storage/transaction-edit-journal';
import { useAppShellStore } from '@/state/app-shell';
import { SyncRepository } from '@/storage/sync-repository';
import { resetRuntimeIdentityData } from '@/storage/runtime-user-data-reset';
import { AppState, type AppStateStatus } from 'react-native';
import { fixtureTransactions } from '@/test-utils/core-finance-fixtures';

jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));

it('retries a failed row read and keeps each owner draft isolated', async () => {
  const first = draftInputSchema.parse({
    id: 'manual-entry',
    transactionType: 'expense',
    amountText: '50',
    accountId,
    destinationAccountId: null,
    categoryId,
    merchant: null,
    notes: null,
    occurredAt: Date.now(),
    status: 'editing',
    updatedAt: Date.now(),
    submission: {
      version: 1,
      operationId: '90000000-0000-4000-8000-000000000002',
      input: {
        type: 'expense',
        amountMinor: 5000,
        currencyCode: 'SAR',
        accountId,
        categoryId,
        title: 'Owner A',
        occurredAt: Date.now()
      },
      firstAttemptAt: Date.now(),
      phase: 'unknown'
    }
  });
  const second = draftInputSchema.parse({
    ...first,
    amountText: '20',
    submission: {
      ...first.submission!,
      operationId: '90000000-0000-4000-8000-000000000003',
      input: { ...first.submission!.input, amountMinor: 2000, title: 'Owner B' }
    }
  });
  let userId = 'user_owner-a';
  registerLiveClerkBridge({
    ...bridge,
    getSession: async () => ({
      id: 'session-' + userId,
      userId,
      method: 'google',
      issuedAt: 1,
      expiresAt: 9_999_999_999_999
    })
  });
  const open = jest
    .spyOn(database, 'openDatabase')
    .mockRejectedValueOnce(new Error('temporary SQLite open failure'))
    .mockImplementation(
      async (owner) =>
        ({
          getFirstAsync: async () => ({
            payload: JSON.stringify(owner === 'user_owner-a' ? first : second)
          })
        }) as never
    );
  const request = jest.fn();
  const service = createLiveLedgerService({
    baseUrl: 'https://inert.invalid',
    request,
    drafts: new CoreFinanceRepository()
  });
  try {
    await expect(service.loadDraft('manual-entry')).rejects.toThrow(
      'temporary SQLite open failure'
    );
    const recovered = await Promise.all([
      service.loadDraft('manual-entry'),
      service.loadDraft('manual-entry')
    ]);
    expect(recovered).toEqual([first, first]);
    expect(open).toHaveBeenCalledTimes(3);
    userId = 'user_owner-b';
    await expect(service.loadDraft('manual-entry')).resolves.toEqual(second);
    userId = 'user_owner-a';
    await expect(service.loadDraft('manual-entry')).resolves.toEqual(first);
    // Returning to the same still-valid session can reuse its checked snapshot.
    expect(open).toHaveBeenCalledTimes(4);
    expect(request).not.toHaveBeenCalled();
  } finally {
    open.mockRestore();
    registerLiveClerkBridge(bridge);
  }
});

jest.mock('expo-crypto', () => ({
  randomUUID: () => '90000000-0000-4000-8000-000000000001'
}));

const accountId = '10000000-0000-4000-8000-000000000001';
const destinationId = '10000000-0000-4000-8000-000000000002';
const categoryId = '20000000-0000-4000-8000-000000000001';
const transactionId = '30000000-0000-4000-8000-000000000001';
const linkedId = '30000000-0000-4000-8000-000000000002';
const occurredAt = '2026-09-08T12:00:00.000Z';

const bridge = {
  getSession: async () => ({
    id: 'session-a',
    userId: 'user_owner-a',
    method: 'google' as const,
    issuedAt: 1,
    expiresAt: 9_999_999_999_999
  }),
  getToken: jest.fn(async () => 'owner-token'),
  startPhone: jest.fn(),
  verifyPhone: jest.fn(),
  resendPhone: jest.fn(),
  signInWithGoogle: jest.fn(),
  reverifyConflict: jest.fn(),
  signOut: jest.fn()
} satisfies LiveClerkBridge;

it('lists transactions with one token capture while preserving category preparation', async () => {
  bridge.getToken.mockClear();
  const prepare = jest.fn(async () => undefined);
  const request = jest.fn(async () =>
    response({
      items: [],
      nextCursor: null,
      ledgerVersion: 0,
      requestId: 'one-capture'
    })
  );
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request,
    categoryIds: { prepare, toServer: (id) => id, toLocal: (id) => id }
  });
  await expect(
    service.listTransactions(emptyTransactionFilters)
  ).resolves.toEqual({ items: [], nextCursor: null });
  expect(bridge.getToken).toHaveBeenCalledTimes(1);
  expect(bridge.getToken).toHaveBeenCalledWith({ skipCache: false });
  expect(prepare).toHaveBeenCalledTimes(1);
});

it('reads a ledger page containing the server account-opening source alongside a voice expense', async () => {
  const opening = summary(linkedId, {
    kind: 'opening',
    source: 'account_opening',
    categoryId: null,
    amountMinor: 100000,
    currency: 'EGP'
  });
  const request = jest.fn(async (url: string) =>
    response(
      url.includes('?')
        ? {
            items: [
              opening,
              summary(transactionId, {
                source: 'voice',
                amountMinor: 1000,
                currency: 'EGP'
              })
            ],
            nextCursor: null,
            ledgerVersion: 4,
            requestId: 'opening-and-voice'
          }
        : detail(opening, [
            {
              id: '40000000-0000-4000-8000-000000000001',
              accountId,
              amountMinor: 100000,
              clearingState: 'confirmed',
              postingRole: 'opening',
              occurredAt
            }
          ])
    )
  );
  const service = createLiveLedgerService({
    baseUrl: 'https://inert.invalid',
    request: request as typeof fetch
  });
  await expect(
    service.listTransactions(emptyTransactionFilters)
  ).resolves.toMatchObject({
    items: [
      {
        id: linkedId,
        type: 'adjustment',
        source: 'adjustment',
        amountMinor: 100000,
        currencyCode: 'EGP'
      },
      {
        id: transactionId,
        type: 'expense',
        source: 'voice',
        amountMinor: 1000,
        currencyCode: 'EGP'
      }
    ]
  });
});

it.each([
  ['opening', 1000, false],
  ['opening', -1000, false],
  ['opening', 1000, true],
  ['opening', -1000, true],
  ['reversal', 1000, false],
  ['reversal', -1000, false],
  ['adjustment', 1000, false],
  ['adjustment', -1000, false]
] as const)(
  'reads the actual %s posting direction %i with selected account %s',
  async (kind, signedMinor, selected) => {
    const row = summary(linkedId, {
      kind,
      source: kind === 'opening' ? 'account_opening' : 'adjustment',
      categoryId: null
    });
    const request = jest.fn(async (url: string) =>
      response(
        url.includes('?')
          ? {
              items: [row],
              nextCursor: null,
              ledgerVersion: 2,
              requestId: 'signed-ledger-read'
            }
          : detail(row, [
              {
                id: '40000000-0000-4000-8000-000000000001',
                accountId,
                amountMinor: signedMinor,
                clearingState: 'confirmed',
                postingRole: kind,
                occurredAt
              }
            ])
      )
    );
    const service = createLiveLedgerService({
      baseUrl: 'https://inert.invalid',
      request: request as typeof fetch
    });
    await expect(
      service.listTransactions({
        ...emptyTransactionFilters,
        accountIds: selected ? [accountId] : []
      })
    ).resolves.toMatchObject({
      items: [
        {
          id: linkedId,
          amountMinor: 1000,
          accountId,
          adjustmentSign: signedMinor > 0 ? 1 : -1
        }
      ]
    });
  }
);

it('reads account-opening detail without rejecting its persisted source', async () => {
  const opening = summary(linkedId, {
    kind: 'opening',
    source: 'account_opening',
    categoryId: null
  });
  const request = jest.fn(async () =>
    response(
      detail(opening, [
        {
          id: '40000000-0000-4000-8000-000000000001',
          accountId,
          amountMinor: 1000,
          clearingState: 'confirmed',
          postingRole: 'opening',
          occurredAt
        }
      ])
    )
  );
  const service = createLiveLedgerService({
    baseUrl: 'https://inert.invalid',
    request
  });
  await expect(service.getTransaction(linkedId)).resolves.toMatchObject({
    id: linkedId,
    type: 'adjustment',
    source: 'adjustment',
    amountMinor: 1000
  });
  expect(request).toHaveBeenCalledTimes(1);
});

it('rejects the account-opening source on a non-opening transaction', async () => {
  const request = jest.fn(async () =>
    response({
      items: [summary(transactionId, { source: 'account_opening' })],
      nextCursor: null,
      ledgerVersion: 1,
      requestId: 'invalid-opening-source'
    })
  );
  const service = createLiveLedgerService({
    baseUrl: 'https://inert.invalid',
    request
  });
  await expect(
    service.listTransactions(emptyTransactionFilters)
  ).rejects.toMatchObject({ code: 'contract_mismatch' });
});

it('reads owner-local drafts without fetching an authentication token', async () => {
  bridge.getToken.mockClear();
  const open = jest.spyOn(database, 'openDatabase').mockResolvedValue({
    getFirstAsync: async () => null
  } as never);
  try {
    await expect(
      createLiveLedgerService().loadDraft('missing-draft')
    ).resolves.toBeNull();
    expect(bridge.getToken).not.toHaveBeenCalled();
  } finally {
    open.mockRestore();
  }
});

it('reads the complete owner-bound day across pages with no source filter and keeps only the newest version of a replayed row', async () => {
  const rows = Array.from({ length: 100 }, (_, index) =>
    summary(`30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, {
      source: ['manual', 'voice', 'automatic', 'platform_assisted'][index % 4],
      kind: index % 2 ? 'income' : 'expense'
    })
  );
  const request = jest.fn(async (url: string, init: RequestInit) => {
    expect(init.method).toBe('GET');
    const query = new URL(url).searchParams;
    expect(query.get('from')).toBe('2026-09-07T21:00:00.000Z');
    expect(query.get('to')).toBe('2026-09-08T20:59:59.999Z');
    expect(query.get('limit')).toBe('100');
    expect(query.has('source')).toBe(false);
    expect(query.has('kind')).toBe(false);
    return response({
      items: query.has('cursor')
        ? [
            { ...rows[0], version: 3, title: 'Latest committed version' },
            summary('30000000-0000-4000-8000-000000000101')
          ]
        : rows,
      nextCursor: query.has('cursor') ? null : 'next-page',
      ledgerVersion: 3,
      requestId: 'today-page'
    });
  });
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request: request as typeof fetch
  });
  const activity = await service.getHomeTodayActivity({
    ...emptyTransactionFilters,
    periodStart: Date.parse('2026-09-07T21:00:00Z'),
    periodEnd: Date.parse('2026-09-08T20:59:59.999Z')
  });
  expect(activity).toHaveLength(101);
  expect(
    activity.find(({ transaction }) => transaction.id === rows[0].id)
      ?.transaction.title
  ).toBe('Latest committed version');
  expect(request).toHaveBeenCalledTimes(2);
});

it.each(['failed-page', 'repeated-cursor'] as const)(
  'rejects %s instead of returning an incomplete daily list',
  async (failure) => {
    let page = 0;
    const request = jest.fn(async () => {
      if (page++ > 0 && failure === 'failed-page')
        return response({ error: { code: 'SERVICE_UNAVAILABLE' } }, 503);
      return response({
        items: [summary()],
        nextCursor: 'same-cursor',
        ledgerVersion: 2,
        requestId: 'today-page'
      });
    });
    const service = createLiveLedgerService({
      baseUrl: 'https://api.test',
      request
    });
    await expect(
      service.getHomeTodayActivity({
        ...emptyTransactionFilters,
        periodStart: Date.parse('2026-09-07T21:00:00Z'),
        periodEnd: Date.parse('2026-09-08T20:59:59.999Z')
      })
    ).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(2);
  }
);

it('uses committed reversal postings when the original income is from an earlier day', async () => {
  const original = summary(transactionId, {
    kind: 'income',
    status: 'reversed',
    occurredAt: '2026-09-06T12:00:00Z'
  });
  const reversal = summary(linkedId, {
    kind: 'reversal',
    originalTransactionId: original.id
  });
  const request = jest.fn(async (url: string) => {
    if (url.includes('?'))
      return response({
        items: [reversal],
        nextCursor: null,
        ledgerVersion: 2,
        requestId: 'today-page'
      });
    if (url.endsWith(linkedId))
      return response(
        detail(reversal, [
          {
            id: '40000000-0000-4000-8000-000000000002',
            accountId,
            amountMinor: -1000,
            clearingState: 'confirmed',
            postingRole: 'reversal',
            occurredAt
          }
        ])
      );
    return response(
      detail(original, [
        {
          id: '40000000-0000-4000-8000-000000000001',
          accountId,
          amountMinor: 1000,
          clearingState: 'confirmed',
          postingRole: 'destination',
          occurredAt: original.occurredAt
        }
      ])
    );
  });
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request: request as typeof fetch
  });
  await expect(
    service.getHomeTodayActivity({
      ...emptyTransactionFilters,
      periodStart: Date.parse('2026-09-07T21:00:00Z'),
      periodEnd: Date.parse('2026-09-08T20:59:59.999Z')
    })
  ).resolves.toEqual([
    expect.objectContaining({
      transaction: expect.objectContaining({ id: linkedId }),
      group: 'expense',
      sign: 'negative'
    })
  ]);
});

beforeEach(() => {
  jest.clearAllMocks();
  registerLiveClerkBridge(bridge);
  jest.spyOn(database, 'openDatabase').mockResolvedValue({
    getFirstAsync: async () => null,
    getAllAsync: async () => [],
    runAsync: async () => undefined,
    execAsync: async () => undefined
  } as never);
});

it('shares concurrent identical ledger reads but fetches again after completion', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const request = jest.fn(async () => {
    await gate;
    return response({
      items: [],
      nextCursor: null,
      ledgerVersion: 0,
      requestId: 'shared-read'
    });
  });
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request
  });
  const first = service.listTransactions(emptyTransactionFilters, null, 100);
  const second = service.listTransactions(
    { ...emptyTransactionFilters },
    null,
    100
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  release();
  expect(await Promise.all([first, second])).toEqual([
    { items: [], nextCursor: null },
    { items: [], nextCursor: null }
  ]);
  expect(request).toHaveBeenCalledTimes(1);
  await service.listTransactions(emptyTransactionFilters, null, 100);
  expect(request).toHaveBeenCalledTimes(2);
});

it('cancelling one ledger reader preserves the identical read of another screen', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const request = jest.fn(async () => {
    await gate;
    return response({
      items: [],
      nextCursor: null,
      ledgerVersion: 0,
      requestId: 'shared-cancel'
    });
  });
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request
  });
  const controller = new AbortController();
  const first = service
    .listTransactions(emptyTransactionFilters, null, 100, controller.signal)
    .catch((error) => error);
  const second = service.listTransactions(emptyTransactionFilters, null, 100);
  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.abort();
  release();
  expect(await first).toMatchObject({ code: 'provider_unavailable' });
  expect(await second).toEqual({ items: [], nextCursor: null });
  expect(request).toHaveBeenCalledTimes(1);
});

it('does not share a pending ledger read across authenticated owners', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const request = jest.fn(async () => {
    await gate;
    return response({
      items: [],
      nextCursor: null,
      ledgerVersion: 0,
      requestId: 'isolated-read'
    });
  });
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request
  });
  const first = service
    .listTransactions(emptyTransactionFilters)
    .catch((error) => error);
  await new Promise((resolve) => setTimeout(resolve, 0));
  registerLiveClerkBridge({
    ...bridge,
    getSession: async () => ({
      ...(await bridge.getSession())!,
      id: 'session-b',
      userId: 'user_owner-b'
    })
  });
  const second = service.listTransactions(emptyTransactionFilters);
  await new Promise((resolve) => setTimeout(resolve, 0));
  release();
  expect(await first).toMatchObject({ code: 'session_expired' });
  expect(await second).toEqual({ items: [], nextCursor: null });
  expect(request).toHaveBeenCalledTimes(2);
});

it.each(['expense', 'income'] as const)(
  'uses one fresh write identity for a Manual %s while retaining category preparation',
  async (kind) => {
    let prepared = false;
    const prepare = async () => {
      prepared = true;
    };
    const request = jest.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({
        Authorization: 'Bearer owner-token',
        'Idempotency-Key': '90000000-0000-4000-8000-000000000009'
      });
      expect(JSON.parse(String(init.body))).toMatchObject({ categoryId });
      return response(
        mutation(summary(transactionId, { kind }), [
          {
            id: '40000000-0000-4000-8000-000000000001',
            accountId,
            amountMinor: kind === 'income' ? 1000 : -1000,
            clearingState: 'confirmed',
            postingRole: kind === 'income' ? 'destination' : 'source',
            occurredAt
          }
        ]),
        201
      );
    });
    const service = createLiveLedgerService({
      baseUrl: 'https://inert.invalid',
      request: request as typeof fetch,
      categoryIds: {
        prepare,
        toServer: () => {
          if (!prepared) throw new Error('category mapping unavailable');
          return categoryId;
        },
        toLocal: () => 'local-category'
      }
    });
    await expect(
      service.createTransaction(
        {
          type: kind,
          amountMinor: 1000,
          currencyCode: 'SAR',
          accountId,
          categoryId: 'local-category',
          title: 'Isolated Manual fixture',
          occurredAt: Date.parse(occurredAt)
        },
        '90000000-0000-4000-8000-000000000009'
      )
    ).resolves.toMatchObject({
      value: { type: kind, categoryId: 'local-category' }
    });
    expect(bridge.getToken).toHaveBeenCalledTimes(1);
    expect(bridge.getToken).toHaveBeenCalledWith({ skipCache: true });
    expect(request).toHaveBeenCalledTimes(1);
  }
);

it('does not dispatch a Manual write when the owner changes during category preparation', async () => {
  const request = jest.fn();
  const service = createLiveLedgerService({
    baseUrl: 'https://inert.invalid',
    request,
    categoryIds: {
      prepare: async () => {
        registerLiveClerkBridge({
          ...bridge,
          getSession: async () => ({
            ...(await bridge.getSession()),
            id: 'other-session',
            userId: 'other-owner'
          })
        });
      },
      toServer: (id) => id,
      toLocal: (id) => id
    }
  });
  await expect(
    service.createTransaction(
      {
        type: 'expense',
        amountMinor: 1000,
        currencyCode: 'SAR',
        accountId,
        categoryId,
        title: 'Isolated fixture',
        occurredAt: Date.parse(occurredAt)
      },
      '90000000-0000-4000-8000-000000000009'
    )
  ).rejects.toMatchObject({ code: 'session_expired' });
  expect(request).not.toHaveBeenCalled();
});

it('uses a newly fresh actor on an ordinary-write retry with the same operation ID', async () => {
  const headers: Record<string, string>[] = [];
  const request = jest.fn(async (_url: string, init: RequestInit) => {
    headers.push(init.headers as Record<string, string>);
    if (headers.length === 1) throw new TypeError('isolated network failure');
    return response(mutation(), 201);
  });
  const service = createLiveLedgerService({
    baseUrl: 'https://inert.invalid',
    request: request as typeof fetch
  });
  const input = {
    type: 'expense' as const,
    amountMinor: 1000,
    currencyCode: 'SAR',
    accountId,
    categoryId,
    title: 'Isolated fixture',
    occurredAt: Date.parse(occurredAt)
  };
  bridge.getToken
    .mockResolvedValueOnce('attempt-a')
    .mockResolvedValueOnce('attempt-b');
  await expect(
    service.createTransaction(input, '90000000-0000-4000-8000-000000000009')
  ).rejects.toMatchObject({ code: 'provider_unavailable' });
  await expect(
    service.createTransaction(input, '90000000-0000-4000-8000-000000000009')
  ).resolves.toMatchObject({ value: { id: transactionId } });
  expect(headers.map((header) => header['Idempotency-Key'])).toEqual([
    '90000000-0000-4000-8000-000000000009',
    '90000000-0000-4000-8000-000000000009'
  ]);
  expect(headers.map((header) => header.Authorization)).toEqual([
    'Bearer attempt-a',
    'Bearer attempt-b'
  ]);
  expect(bridge.getToken.mock.calls).toEqual([
    [{ skipCache: true }],
    [{ skipCache: true }]
  ]);
});

it.each([5000, -5000])(
  'reads the account reversal sign from its %i minor-unit posting, without the original in the page',
  async (signedAmount) => {
    const reversal = summary(linkedId, {
      kind: 'reversal',
      amountMinor: 5000,
      originalTransactionId: transactionId
    });
    const request = jest.fn(async (url: string, init: RequestInit) => {
      expect(init.method).toBe('GET');
      if (url.includes('?'))
        return response({
          items: [reversal],
          nextCursor: null,
          ledgerVersion: 2,
          requestId: 'account-page'
        });
      if (!url.endsWith(linkedId))
        throw new Error('Unexpected original transaction lookup');
      return response(
        detail(reversal, [
          {
            id: '40000000-0000-4000-8000-000000000002',
            accountId,
            amountMinor: signedAmount,
            clearingState: 'confirmed',
            postingRole: 'reversal',
            occurredAt
          }
        ])
      );
    });
    const service = createLiveLedgerService({
      baseUrl: 'https://api.test',
      request: request as typeof fetch
    });
    const page = await service.listTransactions({
      ...emptyTransactionFilters,
      accountIds: [accountId]
    });
    expect(page.items).toEqual([
      expect.objectContaining({
        id: linkedId,
        type: 'reversal',
        amountMinor: 5000,
        adjustmentSign: signedAmount > 0 ? 1 : -1
      })
    ]);
  }
);

it('rejects a changed reversal detail instead of displaying a guessed account sign', async () => {
  const reversal = summary(linkedId, {
    kind: 'reversal',
    originalTransactionId: transactionId
  });
  const request = jest.fn(async (url: string) =>
    url.includes('?')
      ? response({
          items: [reversal],
          nextCursor: null,
          ledgerVersion: 2,
          requestId: 'account-page'
        })
      : response(
          detail({ ...reversal, version: 3 }, [
            {
              id: '40000000-0000-4000-8000-000000000002',
              accountId,
              amountMinor: -1000,
              clearingState: 'confirmed',
              postingRole: 'reversal',
              occurredAt
            }
          ])
        )
  );
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request: request as typeof fetch
  });
  await expect(
    service.listTransactions({
      ...emptyTransactionFilters,
      accountIds: [accountId]
    })
  ).rejects.toMatchObject({ code: 'conflict' });
});

it('coalesces simultaneous explicit operations while allowing identical independent submissions', async () => {
  let release!: (value: Response) => void;
  let started!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  const reply = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const request = jest.fn().mockImplementation(() => {
    started();
    return reply;
  });
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request
  });
  const input = {
    type: 'expense' as const,
    amountMinor: 1000,
    currencyCode: 'SAR',
    accountId,
    categoryId,
    title: 'Groceries',
    occurredAt: Date.parse(occurredAt)
  };
  const first = service.createTransaction(input, 'operation-a');
  const duplicate = service.createTransaction(input, 'operation-a');
  await requestStarted;
  release(response(mutation(), 201));
  await expect(first).resolves.toMatchObject({ value: { id: transactionId } });
  await expect(duplicate).resolves.toMatchObject({
    value: { id: transactionId }
  });
  expect(request).toHaveBeenCalledTimes(1);
  request.mockResolvedValue(response(mutation(summary(linkedId)), 201));
  await expect(
    service.createTransaction(input, 'operation-b')
  ).resolves.toMatchObject({ value: { id: linkedId } });
  expect(
    (request.mock.calls[1][1].headers as Record<string, string>)[
      'Idempotency-Key'
    ]
  ).toBe('operation-b');
});

it('sends the selected Shopping system key as its existing database UUID', async () => {
  const shoppingId = '04000000-0000-4000-8000-000000000006';
  let prepared = false;
  const request = jest.fn(
    async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(prepared).toBe(true);
      expect(JSON.parse(init?.body as string)).toMatchObject({
        categoryId: shoppingId
      });
      return response(
        mutation(summary(transactionId, { categoryId: shoppingId })),
        201
      );
    }
  );
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request,
    categoryIds: {
      prepare: async () => {
        prepared = true;
      },
      toServer: (id) => (id === 'shopping' ? shoppingId : id),
      toLocal: (id) => (id === shoppingId ? 'shopping' : id)
    }
  });
  await expect(
    service.createTransaction(
      {
        type: 'expense',
        amountMinor: 2000,
        currencyCode: 'SAR',
        accountId,
        categoryId: 'shopping',
        title: 'Shopping',
        occurredAt: Date.parse(occurredAt)
      },
      '90000000-0000-4000-8000-000000000099'
    )
  ).resolves.toMatchObject({
    value: { categoryId: 'shopping' }
  });
});

it.each(['income', 'expense'] as const)(
  'corrects a manual transaction to %s through one versioned PATCH',
  async (kind) => {
    const storage = useEditStorage();
    const priorKind = kind === 'income' ? 'expense' : 'income';
    const nextCategory = categoryId;
    const posting = (income: boolean) => [
      {
        id: '40000000-0000-4000-8000-000000000001',
        accountId,
        amountMinor: income ? 1000 : -1000,
        clearingState: 'confirmed',
        postingRole: income ? 'destination' : 'source',
        occurredAt
      }
    ];
    const request = jest.fn(async (_url, init) =>
      init?.method === 'PATCH'
        ? response(
            mutation(
              summary(transactionId, { kind, categoryId: nextCategory }),
              [
                ...posting(priorKind === 'income'),
                {
                  ...posting(kind === 'income')[0],
                  id: '40000000-0000-4000-8000-000000000002',
                  postingRole: 'adjustment',
                  amountMinor: kind === 'income' ? 2000 : -2000
                }
              ]
            )
          )
        : response(
            detail(
              summary(transactionId, { kind: priorKind }),
              posting(priorKind === 'income')
            )
          )
    );
    const service = createLiveLedgerService({
      baseUrl: 'https://api.test',
      request
    });
    const result = await service.updateTransaction(transactionId, {
      type: kind,
      amountMinor: 1000,
      currencyCode: 'SAR',
      accountId,
      categoryId: nextCategory,
      title: 'Groceries',
      occurredAt: Date.parse(occurredAt)
    });
    expect(result.value).toMatchObject({ id: transactionId, type: kind });
    const patches = request.mock.calls.filter(
      ([, init]) => init?.method === 'PATCH'
    );
    expect(patches).toHaveLength(1);
    expect(JSON.parse(patches[0][1].body)).toMatchObject({
      expectedVersion: 2,
      kind
    });
    expect(
      request.mock.calls.some(
        ([, init]) => init.method === 'POST' || init.method === 'DELETE'
      )
    ).toBe(false);
    storage.close();
  }
);

it('keeps multiline notes out of the single-line edit audit reason', async () => {
  const storage = useEditStorage();
  const request = jest
    .fn()
    .mockImplementation(async (_url, init) =>
      init?.method === 'PATCH'
        ? response(mutation(summary(transactionId, { note: 'first\nsecond' })))
        : response(detail())
    );
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request
  });
  await service.updateTransaction(transactionId, {
    type: 'expense',
    amountMinor: 1000,
    currencyCode: 'SAR',
    accountId,
    categoryId,
    title: 'Groceries',
    occurredAt: Date.parse(occurredAt),
    notes: 'first\nsecond'
  });
  const patch = request.mock.calls.find(
    ([, init]) => init?.method === 'PATCH'
  )!;
  expect(JSON.parse(patch[1].body)).toMatchObject({
    reason: 'Mobile edit',
    note: 'first\nsecond'
  });
  storage.close();
});

it('prepares a linked operation again after a failed read before any financial request', async () => {
  const original = summary(transactionId);
  const request = jest
    .fn()
    .mockRejectedValueOnce(new TypeError('fixture lost read'))
    .mockImplementation(async (_url, init) =>
      init.method === 'POST'
        ? response({
            ...mutation(summary(linkedId, { kind: 'refund' })),
            original
          })
        : response(detail(original))
    );
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request
  });
  const input = {
    type: 'refund' as const,
    amountMinor: 1000,
    currencyCode: 'SAR',
    accountId,
    categoryId,
    title: 'Refund',
    occurredAt: Date.parse(occurredAt),
    originalTransactionId: transactionId
  };
  await expect(
    service.createTransaction(input, 'refund-operation')
  ).rejects.toBeDefined();
  await expect(
    service.createTransaction(input, 'refund-operation')
  ).resolves.toBeDefined();
  const post = request.mock.calls.find(([, init]) => init.method === 'POST')!;
  expect(JSON.parse(post[1].body).expectedVersion).toBe(2);
});

const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });

function summary(id = transactionId, patch: Record<string, unknown> = {}) {
  return {
    id,
    kind: 'expense',
    status: 'confirmed',
    amountMinor: 1_000,
    currency: 'SAR',
    accountIds: [accountId],
    sourceAccountId: accountId,
    destinationAccountId: null,
    feeMinor: 0,
    categoryId,
    title: 'Groceries',
    merchant: null,
    paymentMethod: null,
    note: null,
    occurredAt,
    source: 'manual',
    originalTransactionId: null,
    version: 2,
    deletedAt: null,
    undoExpiresAt: null,
    ...patch
  };
}

function detail(
  transaction = summary(),
  postings: Record<string, unknown>[] = [
    {
      id: '40000000-0000-4000-8000-000000000001',
      accountId,
      amountMinor: -1_000,
      clearingState: 'confirmed',
      postingRole: 'source',
      occurredAt
    }
  ]
) {
  return {
    transaction,
    postings,
    revisions: [],
    ledgerVersion: 2,
    requestId: 'request-detail'
  };
}

it.each(['tracking-import', 'manual', 'voice'] as const)(
  'reads the existing %s ledger source without changing its amount or kind',
  async (source) => {
    const payload = detail(summary(transactionId, { source }));
    const service = createLiveLedgerService({
      baseUrl: 'https://api.test',
      request: jest.fn(async () => response(payload))
    });
    await expect(service.getTransaction(transactionId)).resolves.toMatchObject({
      id: transactionId,
      type: 'expense',
      amountMinor: 1000,
      source: source === 'tracking-import' ? 'automatic' : source
    });
    expect(payload.transaction.source).toBe(source);
  }
);
it('rejects an unknown ledger source while accepting the explicit Tracking read alias', async () => {
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request: jest.fn(async () =>
      response(detail(summary(transactionId, { source: 'future_source' })))
    )
  });
  await expect(service.getTransaction(transactionId)).rejects.toMatchObject({
    code: 'contract_mismatch'
  });
});

function mutation(
  transaction = summary(),
  postings?: Record<string, unknown>[]
) {
  return {
    transaction: detail(transaction, postings),
    balances: [
      {
        accountId,
        currency: 'SAR',
        confirmedMinor: 9_000,
        pendingMinor: 0,
        ledgerVersion: 2,
        reconciledAt: occurredAt
      }
    ],
    ledgerVersion: 2,
    requestId: 'request-mutation'
  };
}

it('accepts the destination posting on a saved income receipt and subsequent detail read', async () => {
  // Samsung Dev, 2026-10-07: a committed 57 SAR income was reported as uncertain.
  const income = summary(transactionId, {
    kind: 'income',
    amountMinor: 5700,
    title: 'Salary'
  });
  const postings = [
    {
      id: '40000000-0000-4000-8000-000000000001',
      accountId,
      amountMinor: 5700,
      clearingState: 'confirmed',
      postingRole: 'destination',
      occurredAt
    }
  ];
  const request = jest.fn(async (_url, init) =>
    init?.method === 'POST'
      ? response(mutation(income, postings), 201)
      : response(detail(income, postings))
  );
  const service = createLiveLedgerService({
    baseUrl: 'https://inert.invalid',
    request
  });
  const saved = await service.createTransaction(
    {
      type: 'income',
      amountMinor: 5700,
      currencyCode: 'SAR',
      accountId,
      categoryId,
      title: 'Salary',
      occurredAt: Date.parse(occurredAt)
    },
    'income-operation'
  );
  expect(saved.value).toMatchObject({
    id: transactionId,
    type: 'income',
    amountMinor: 5700,
    accountId
  });
  await expect(service.getTransaction(transactionId)).resolves.toMatchObject({
    id: transactionId,
    type: 'income',
    amountMinor: 5700,
    accountId
  });
});

it.each([
  ['wrong role', 'source', 5700],
  ['wrong amount', 'destination', 5600]
])(
  'rejects a saved income detail with %s',
  async (_case, postingRole, amountMinor) => {
    const request = jest.fn().mockResolvedValue(
      response(
        detail(summary(transactionId, { kind: 'income', amountMinor: 5700 }), [
          {
            id: '40000000-0000-4000-8000-000000000001',
            accountId,
            amountMinor,
            clearingState: 'confirmed',
            postingRole,
            occurredAt
          }
        ])
      )
    );
    const service = createLiveLedgerService({
      baseUrl: 'https://inert.invalid',
      request
    });
    await expect(service.getTransaction(transactionId)).rejects.toMatchObject({
      code: 'contract_mismatch'
    });
  }
);

it('maps filtered transaction pages and preserves the server cursor', async () => {
  const request = jest.fn().mockResolvedValue(
    response({
      items: [summary()],
      nextCursor: 'next-page',
      ledgerVersion: 2,
      requestId: 'request-list'
    })
  );
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request
  });
  const page = await service.listTransactions(
    {
      ...emptyTransactionFilters,
      search: 'Groceries',
      periodStart: Date.parse('2026-09-01T00:00:00.000Z'),
      periodEnd: Date.parse('2026-09-30T23:59:59.999Z'),
      accountIds: [accountId],
      categoryIds: [categoryId],
      types: ['expense'],
      sources: ['manual'],
      statuses: ['posted']
    },
    'current-page',
    40
  );
  expect(page).toMatchObject({
    nextCursor: 'next-page',
    items: [
      {
        id: transactionId,
        type: 'expense',
        status: 'posted',
        amountMinor: 1_000,
        accountId,
        categoryId,
        version: 2
      }
    ]
  });
  expect(page).not.toHaveProperty('total');
  const url = new URL(String(request.mock.calls[0]?.[0]));
  expect(Object.fromEntries(url.searchParams)).toMatchObject({
    cursor: 'current-page',
    limit: '40',
    accountId,
    categoryId,
    kind: 'expense',
    status: 'confirmed',
    source: 'manual',
    query: 'Groceries',
    from: '2026-09-01T00:00:00.000Z',
    to: '2026-09-30T23:59:59.999Z'
  });
});

it('overlaps an unfiltered ledger read with category preparation but waits for mapped results', async () => {
  let finishPreparation!: () => void;
  let prepared = false;
  const preparation = new Promise<void>((resolve) => {
    finishPreparation = () => {
      prepared = true;
      resolve();
    };
  });
  let requested!: () => void;
  const transportStarted = new Promise<void>((resolve) => {
    requested = resolve;
  });
  const request = jest.fn(async () => {
    requested();
    return response({
      items: [summary()],
      nextCursor: null,
      ledgerVersion: 2,
      requestId: 'overlap'
    });
  });
  const service = createLiveLedgerService({
    baseUrl: 'https://inert.invalid',
    request,
    categoryIds: {
      prepare: () => preparation,
      toServer: (id) => id,
      toLocal: (id) => {
        expect(prepared).toBe(true);
        return id === categoryId ? 'mapped-category' : id;
      }
    }
  });
  let completed = false;
  const page = service
    .listTransactions(emptyTransactionFilters)
    .then((value) => {
      completed = true;
      return value;
    });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      transportStarted,
      new Promise((resolve) => {
        timer = setTimeout(resolve, 1000);
      })
    ]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(completed).toBe(false);
  } finally {
    clearTimeout(timer);
    finishPreparation();
  }
  await expect(page).resolves.toMatchObject({
    items: [{ categoryId: 'mapped-category' }]
  });
});

it('uses explicit transfer roles when membership account IDs are UUID-sorted', async () => {
  const request = jest.fn().mockResolvedValue(
    response({
      items: [
        summary(transactionId, {
          kind: 'transfer',
          accountIds: [accountId, destinationId],
          sourceAccountId: destinationId,
          destinationAccountId: accountId,
          categoryId: null
        })
      ],
      nextCursor: null,
      ledgerVersion: 2,
      requestId: 'request-transfer-list'
    })
  );

  const page = await createLiveLedgerService({
    baseUrl: 'https://api.test',
    request
  }).listTransactions(emptyTransactionFilters);

  expect(page.items[0]).toMatchObject({
    accountId: destinationId,
    destinationAccountId: accountId
  });
});

it.each(['local-category', categoryId])(
  'keeps records when a category filter uses %s while requesting the server ID',
  async (filterId) => {
    let prepared = false;
    const request = jest.fn(async (url: string) => {
      expect(prepared).toBe(true);
      expect(new URL(url).searchParams.get('categoryId')).toBe(categoryId);
      return response({
        items: [summary()],
        nextCursor: null,
        ledgerVersion: 2,
        requestId: 'category-filter'
      });
    });
    const service = createLiveLedgerService({
      baseUrl: 'https://inert.invalid',
      request: request as typeof fetch,
      categoryIds: {
        prepare: async () => {
          prepared = true;
        },
        toServer: (id) => {
          expect(prepared).toBe(true);
          return id === 'local-category' ? categoryId : id;
        },
        toLocal: (id) => (id === categoryId ? 'local-category' : id)
      }
    });
    await expect(
      service.listTransactions({
        ...emptyTransactionFilters,
        accountIds: [accountId],
        categoryIds: [filterId]
      })
    ).resolves.toMatchObject({
      items: [{ id: transactionId, categoryId: 'local-category' }]
    });
  }
);

it('keeps client-only filter values out of the BE005 query', async () => {
  const request = jest.fn().mockResolvedValue(
    response({
      items: [],
      nextCursor: null,
      ledgerVersion: 2,
      requestId: 'request-list'
    })
  );
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request
  });

  await service.listTransactions({
    ...emptyTransactionFilters,
    types: ['obligation_payment'],
    statuses: ['failed']
  });

  const url = new URL(String(request.mock.calls[0]?.[0]));
  expect(url.searchParams.has('kind')).toBe(false);
  expect(url.searchParams.has('status')).toBe(false);
});

it('uses posting roles, signs, and declared account membership for transfers', async () => {
  const transfer = summary(transactionId, {
    kind: 'transfer',
    accountIds: [accountId, destinationId],
    categoryId: null,
    feeMinor: 25
  });
  const postings = [
    {
      id: '40000000-0000-4000-8000-000000000002',
      accountId: destinationId,
      amountMinor: 1_000,
      clearingState: 'confirmed',
      postingRole: 'destination',
      occurredAt
    },
    {
      id: '40000000-0000-4000-8000-000000000001',
      accountId,
      amountMinor: -1_000,
      clearingState: 'confirmed',
      postingRole: 'source',
      occurredAt
    },
    {
      id: '40000000-0000-4000-8000-000000000003',
      accountId,
      amountMinor: -25,
      clearingState: 'confirmed',
      postingRole: 'fee',
      occurredAt
    }
  ];
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request: jest.fn().mockResolvedValue(response(detail(transfer, postings)))
  });
  await expect(service.getTransaction(transactionId)).resolves.toMatchObject({
    accountId,
    destinationAccountId: destinationId,
    amountMinor: 1_000,
    feeMinor: 25
  });

  const invalid = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request: jest
      .fn()
      .mockResolvedValue(
        response(detail(transfer, [{ ...postings[1], accountId: categoryId }]))
      )
  });
  await expect(invalid.getTransaction(transactionId)).rejects.toMatchObject({
    code: 'contract_mismatch'
  });
});

it('routes refunds, transfers, card payoff, delete, and undo with exact versions', async () => {
  const refund = summary(linkedId, {
    kind: 'refund',
    originalTransactionId: transactionId,
    amountMinor: 250
  });
  const transfer = summary(linkedId, {
    kind: 'transfer',
    accountIds: [accountId, destinationId],
    categoryId: null
  });
  const transferPostings = [
    {
      id: '40000000-0000-4000-8000-000000000001',
      accountId,
      amountMinor: -1_000,
      clearingState: 'confirmed',
      postingRole: 'source',
      occurredAt
    },
    {
      id: '40000000-0000-4000-8000-000000000002',
      accountId: destinationId,
      amountMinor: 1_000,
      clearingState: 'confirmed',
      postingRole: 'destination',
      occurredAt
    }
  ];
  const request = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!init?.method || init.method === 'GET') return response(detail());
      if (url.endsWith('/refunds'))
        return response({ ...mutation(refund), original: summary() }, 201);
      if (url.endsWith('/restore')) return response(mutation(), 200);
      if (init.method === 'DELETE')
        return response({
          transactionId,
          deletedAt: occurredAt,
          undoExpiresAt: '2026-09-08T12:00:30.000Z',
          version: 3,
          balances: mutation().balances,
          ledgerVersion: 3,
          requestId: 'request-delete'
        });
      return response(mutation(transfer, transferPostings), 201);
    }
  );
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request
  });
  await expect(
    service.createTransaction(
      {
        type: 'refund',
        amountMinor: 250,
        currencyCode: 'SAR',
        accountId,
        categoryId,
        title: 'Refund',
        occurredAt: Date.parse(occurredAt),
        originalTransactionId: transactionId
      },
      'refund-operation'
    )
  ).resolves.toMatchObject({
    value: { type: 'refund', originalTransactionId: transactionId }
  });
  await service.createTransaction(
    {
      type: 'transfer',
      amountMinor: 1_000,
      currencyCode: 'SAR',
      accountId,
      destinationAccountId: destinationId,
      categoryId: null,
      title: 'Transfer',
      occurredAt: Date.parse(occurredAt)
    },
    'transfer-operation'
  );
  await expect(
    service.createCardPayoff(
      {
        fundingAccountId: accountId,
        cardAccountId: destinationId,
        amountMinor: 1_000,
        currencyCode: 'SAR',
        occurredAt: Date.parse(occurredAt),
        title: 'Card payoff'
      },
      'payoff-operation'
    )
  ).resolves.toMatchObject({ value: { transferPurpose: 'card_payoff' } });
  await expect(service.deleteTransaction(transactionId)).resolves.toMatchObject(
    {
      value: { status: 'deleted', version: 3 },
      undoExpiresAt: Date.parse('2026-09-08T12:00:30.000Z')
    }
  );
  await expect(service.undoDelete(transactionId)).resolves.toMatchObject({
    value: { status: 'posted' }
  });

  const writes = request.mock.calls.filter(
    ([, init]) => init?.method !== 'GET'
  );
  expect(writes.map(([url]) => String(url))).toEqual([
    `https://api.test/api/v1/transactions/${transactionId}/refunds`,
    'https://api.test/api/v1/transfers',
    'https://api.test/api/v1/transfers',
    `https://api.test/api/v1/transactions/${transactionId}`,
    `https://api.test/api/v1/transactions/${transactionId}/restore`
  ]);
  expect(JSON.parse(String(writes[0]?.[1]?.body))).toMatchObject({
    expectedVersion: 2,
    amountMinor: 250
  });
  expect(JSON.parse(String(writes[1]?.[1]?.body))).toMatchObject({
    sourceAccountId: accountId,
    destinationAccountId: destinationId,
    feeMinor: 0
  });
});

it('reuses a generated transfer operation ID after an uncertain response', async () => {
  const transfer = summary(linkedId, {
    kind: 'transfer',
    accountIds: [accountId, destinationId],
    categoryId: null
  });
  const postings = [
    {
      id: '40000000-0000-4000-8000-000000000001',
      accountId,
      amountMinor: -1_000,
      clearingState: 'confirmed',
      postingRole: 'source',
      occurredAt
    },
    {
      id: '40000000-0000-4000-8000-000000000002',
      accountId: destinationId,
      amountMinor: 1_000,
      clearingState: 'confirmed',
      postingRole: 'destination',
      occurredAt
    }
  ];
  const request = jest
    .fn()
    .mockRejectedValueOnce(new TypeError('connection lost'))
    .mockResolvedValueOnce(response(mutation(transfer, postings), 201));
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request
  });
  const input = {
    type: 'transfer' as const,
    amountMinor: 1_000,
    currencyCode: 'SAR',
    accountId,
    destinationAccountId: destinationId,
    categoryId: null,
    title: 'Transfer',
    occurredAt: Date.parse(occurredAt)
  };

  await expect(service.createTransaction(input)).rejects.toMatchObject({
    code: 'provider_unavailable'
  });
  await expect(service.createTransaction(input)).resolves.toBeDefined();
  const headers = request.mock.calls.map(
    ([, init]) => (init?.headers as Record<string, string>)['Idempotency-Key']
  );
  expect(headers).toEqual([
    '90000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000001'
  ]);
});

it.each([
  ['unsafe money', { amountMinor: Number.MAX_SAFE_INTEGER + 1 }],
  ['unsafe version', { version: Number.MAX_SAFE_INTEGER + 1 }],
  ['unknown status', { status: 'settled' }],
  ['unknown field', { privateOwnerId: 'user_owner-b' }]
])('rejects strict live ledger responses with %s', async (_case, patch) => {
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request: jest.fn().mockResolvedValue(
      response({
        items: [summary(transactionId, patch)],
        nextCursor: null,
        ledgerVersion: 2,
        requestId: 'request-list'
      })
    )
  });
  await expect(
    service.listTransactions(emptyTransactionFilters)
  ).rejects.toMatchObject({ code: 'contract_mismatch' });
});

it('bootstraps again after cursor key retirement without removing queued work', async () => {
  const repository = {
    hasPending: async () => false,
    recoverSending: jest.fn(),
    ready: jest.fn(async () => []),
    cursor: jest.fn(async () => `cursor.${'a'.repeat(43)}`),
    clearCursor: jest.fn()
  };
  const sync = {
    delta: jest.fn(async () => {
      throw new HttpError('validation_error', 400, 'SYNC_CURSOR_INVALID');
    }),
    bootstrap: jest.fn(async (domains: string[]) => ({
      data: {
        domains: [
          {
            domain: domains[0],
            cursor: `cursor.${'b'.repeat(43)}`,
            items: [],
            hasMore: false,
            nextPage: null
          }
        ]
      },
      meta: { requestId: 'bootstrap' }
    })),
    conflicts: jest.fn(async () => ({
      data: { items: [], nextCursor: null },
      meta: { requestId: 'conflicts' }
    }))
  };
  const adapter = { applyBootstrap: jest.fn() };
  const coordinator = createLiveCoreFinanceSync({
    repository: repository as never,
    sync: sync as never,
    adapter: adapter as never,
    identity: async () => ({
      userId: 'user_owner-a',
      token: 'token',
      assertCurrent: async () => undefined
    })
  });
  await expect(coordinator.synchronize()).resolves.toEqual({
    uploaded: 0,
    bootstrapped: 3,
    deltas: 0
  });
  expect(repository.clearCursor.mock.calls).toEqual([
    ['accounts'],
    ['categories'],
    ['transactions']
  ]);
});

it.each([['SYNC_CURSOR_INVALID', 400], ['SYNC_CURSOR_EXPIRED', 409]] as const)(
  'T04 transport cursor recovery reboots reads without submitting blocked work for %s',
  async (code, status) => {
    const repository = {
      hasPending: async (domain: string) => domain === 'transactions',
      recoverSending: jest.fn(),
      ready: jest.fn(async () => []),
      cursor: jest.fn(async () => `cursor.${'a'.repeat(43)}`),
      clearCursor: jest.fn()
    };
    const request = jest.fn(async (url: string | URL | Request) => {
      const path = String(url);
      if (path.includes('/me/devices')) return response({ items: [{ id: '80000000-0000-4000-8000-000000000001', current: true }], nextCursor: null });
      if (path.includes('/sync/delta')) return response({ error: { code } }, status);
      if (path.includes('/sync/bootstrap')) {
        const domain = new URL(path).searchParams.get('domains');
        return response({ data: { domains: [{ domain, cursor: `cursor.${'b'.repeat(43)}`, items: [], hasMore: false, nextPage: null }] }, meta: { requestId: 'bootstrap' } });
      }
      if (path.includes('/conflicts')) return response({ data: { items: [], nextCursor: null }, meta: { requestId: 'conflicts' } });
      throw new Error('UNEXPECTED_TEST_REQUEST');
    });
    const coordinator = createLiveCoreFinanceSync({
      baseUrl: 'https://inert.invalid', request,
      repository: repository as never,
      adapter: { applyBootstrap: jest.fn() } as never,
      identity: async () => ({ userId: 'user_owner-a', token: 'boundary-token', assertCurrent: async () => undefined })
    });
    await expect(coordinator.synchronize()).resolves.toEqual({ uploaded: 0, bootstrapped: 2, deltas: 0 });
    expect(repository.clearCursor.mock.calls).toEqual([['accounts'], ['categories']]);
    expect(request.mock.calls.some(([url]) => String(url).includes('/sync/mutations'))).toBe(false);
  }
);

it.each(['auth', 'unknown', 'network', 'untyped-lookalike'] as const)(
  'T04 cursor recovery preserves the original %s failure without resetting cursors',
  async (failure) => {
    const error = failure === 'network' ? new TypeError('network unavailable') : new Error('SYNC_CURSOR_INVALID');
    const repository = { hasPending: async () => false, recoverSending: jest.fn(), ready: async () => [], cursor: async () => `cursor.${'a'.repeat(43)}`, clearCursor: jest.fn() };
    const request = jest.fn(async (url: string | URL | Request) => {
      if (String(url).includes('/me/devices')) return response({ items: [{ id: '80000000-0000-4000-8000-000000000001', current: true }], nextCursor: null });
      if (failure === 'network' || failure === 'untyped-lookalike') throw error;
      return response({ error: { code: failure === 'auth' ? 'AUTH_TOKEN_INVALID' : 'UNKNOWN_CURSOR_FAILURE' } }, failure === 'auth' ? 401 : 400);
    });
    const sync = createLiveCoreFinanceSync({ baseUrl: 'https://inert.invalid', request, repository: repository as never, adapter: {} as never,
      identity: async () => ({ userId: 'user_owner-a', token: 'boundary-token', assertCurrent: async () => undefined }) });
    if (failure === 'network' || failure === 'untyped-lookalike') await expect(sync.synchronize()).rejects.toBe(error);
    else await expect(sync.synchronize()).rejects.toMatchObject({ code: failure === 'auth' ? 'AUTH_TOKEN_INVALID' : 'UNKNOWN_CURSOR_FAILURE', status: failure === 'auth' ? 401 : 400 });
    expect(repository.clearCursor).not.toHaveBeenCalled();
    expect(request.mock.calls.some(([url]) => String(url).includes('/sync/bootstrap'))).toBe(false);
  }
);

it('uploads ready mutations before bootstrapping and applying owner-scoped deltas', async () => {
  const cursor = `cursor.${'a'.repeat(43)}`;
  const repository = {
    hasPending: async () => false,
    recoverSending: jest.fn(async () => undefined),
    ready: jest
      .fn()
      .mockResolvedValueOnce([
        {
          operationId: '90000000-0000-4000-8000-000000000010',
          domain: 'transactions' as const,
          resourceType: 'transaction' as const,
          schemaVersion: 1 as const,
          dependsOn: [],
          operation: 'create',
          resourceId: 'local-one',
          baseVersion: null,
          payload: { kind: 'expense' },
          status: 'pending' as const,
          attemptCount: 0,
          nextAttemptAt: null,
          lastErrorCode: null
        }
      ])
      .mockResolvedValueOnce([]),
    markSending: jest.fn(async () => undefined),
    complete: jest.fn(async () => undefined),
    retry: jest.fn(async () => undefined),
    mapId: jest.fn(async () => undefined),
    cursor: jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(cursor)
      .mockResolvedValueOnce(cursor)
  };
  const sync = {
    mutations: jest.fn(async () => ({
      data: {
        receipts: [
          {
            operationId: '90000000-0000-4000-8000-000000000010',
            status: 'applied',
            result: mutation()
          }
        ]
      },
      meta: { requestId: 'mutation-request' }
    })),
    bootstrap: jest.fn(async () => ({
      data: {
        domains: [
          {
            domain: 'accounts',
            cursor,
            items: [],
            hasMore: false,
            nextPage: null
          }
        ]
      },
      meta: { requestId: 'bootstrap-request' }
    })),
    delta: jest.fn(async (domain: string) => ({
      data: {
        domain,
        changes:
          domain === 'transactions'
            ? [
                {
                  resourceId: accountId,
                  resourceType: 'account',
                  operation: 'delete',
                  version: 0,
                  deletedAt: occurredAt
                }
              ]
            : [],
        nextCursor: cursor,
        hasMore: false
      },
      meta: { requestId: 'delta-request' }
    })),
    acknowledge: jest.fn(async () => ({
      data: {},
      meta: { requestId: 'ack' }
    })),
    conflicts: jest.fn(async () => ({
      data: { items: [], nextCursor: null },
      meta: { requestId: 'conflicts' }
    }))
  };
  const adapter = {
    applyBootstrap: jest.fn(async () => undefined),
    applyDelta: jest.fn(async () => undefined),
    storeConflict: jest.fn(async () => undefined)
  };
  const coordinator = createLiveCoreFinanceSync({
    repository: repository as never,
    sync: sync as never,
    adapter: adapter as never,
    identity: async () => ({
      userId: 'user_owner-a',
      token: 'owner-token',
      assertCurrent: async () => undefined
    })
  });

  await expect(coordinator.synchronize()).resolves.toMatchObject({
    uploaded: 1,
    bootstrapped: 1,
    deltas: 2
  });
  expect(repository.recoverSending).toHaveBeenCalledTimes(1);
  expect(repository.markSending).toHaveBeenCalledWith([
    '90000000-0000-4000-8000-000000000010'
  ]);
  expect(repository.complete).toHaveBeenCalledWith(
    '90000000-0000-4000-8000-000000000010',
    'applied',
    null,
    { domain: 'transactions', localId: 'local-one', serverId: transactionId }
  );
  expect(sync.mutations.mock.invocationCallOrder[0]).toBeLessThan(
    sync.bootstrap.mock.invocationCallOrder[0]!
  );
  expect(adapter.applyBootstrap).toHaveBeenCalledWith(
    'accounts',
    [],
    cursor,
    false
  );
  expect(adapter.applyDelta).toHaveBeenCalledTimes(2);
  expect(adapter.applyDelta).toHaveBeenCalledWith(
    'transactions',
    [
      {
        resourceId: accountId,
        operation: 'delete',
        version: 0,
        deletedAt: occurredAt
      }
    ],
    cursor,
    null
  );
  expect(sync.acknowledge).toHaveBeenCalledTimes(2);
});

it.each([false, true])(
  'uses cached sync reads and fresh authentication only when a queued upload exists: %s',
  async (queued) => {
    const getToken = jest.fn(async ({ skipCache }: { skipCache: boolean }) =>
      skipCache ? 'write-token' : 'read-token'
    );
    registerLiveClerkBridge({ ...bridge, getToken });
    const operation = {
      operationId: '90000000-0000-4000-8000-000000000010',
      domain: 'transactions',
      resourceType: 'transaction',
      dependsOn: [],
      operation: 'create',
      resourceId: null,
      baseVersion: null,
      payload: { kind: 'expense' }
    };
    const repository = {
      hasPending: async () => false,
      recoverSending: async () => undefined,
      ready: async () => (queued ? [operation] : []),
      cursor: async () => null,
      markSending: async () => undefined
    };
    const calls: { method?: string; authorization?: string; url: string }[] =
      [];
    const request = jest.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({
          url: String(url),
          method: init?.method,
          authorization:
            (init?.headers as Record<string, string>).Authorization ??
            (init?.headers as Record<string, string>).authorization
        });
        if (String(url).includes('/me/devices'))
          return response({
            items: [
              { id: '80000000-0000-4000-8000-000000000001', current: true }
            ],
            nextCursor: null
          });
        return response({ error: { code: 'SERVICE_UNAVAILABLE' } }, 503);
      }
    );
    await expect(
      createLiveCoreFinanceSync({
        baseUrl: 'https://inert.invalid',
        request,
        repository: repository as never,
        adapter: {} as never
      }).synchronize()
    ).rejects.toThrow();
    const syncCall = calls.find((call) => call.url.includes('/sync/'));
    expect(syncCall).toMatchObject({
      method: queued ? 'POST' : 'GET',
      authorization: queued ? 'Bearer write-token' : 'Bearer read-token'
    });
    expect(getToken.mock.calls).toEqual(
      queued
        ? [[{ skipCache: false }], [{ skipCache: true }]]
        : [[{ skipCache: false }]]
    );
  }
);

it('resolves the device once per sync pass and refreshes it for the next owner', async () => {
  let ownerId = 'user_first';
  let deviceId = '80000000-0000-4000-8000-000000000001';
  let deviceReads = 0;
  const sent: { device: string; authorization: string }[] = [];
  const applied: string[] = [];
  const request = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === '/api/v1/me/devices') {
        deviceReads += 1;
        return response({
          items: [{ id: deviceId, current: true }],
          nextCursor: null
        });
      }
      const headers = init?.headers as Record<string, string>;
      sent.push({
        device: headers['X-Device-Id'],
        authorization: headers.Authorization
      });
      if (url.pathname === '/api/v1/sync/bootstrap')
        return response({
          data: {
            domains: [
              {
                domain: url.searchParams.get('domains'),
                cursor: `cursor.${'a'.repeat(43)}`,
                items: [],
                hasMore: false,
                nextPage: null
              }
            ]
          },
          meta: { requestId: 'bootstrap' }
        });
      if (url.pathname === '/api/v1/conflicts')
        return response({
          data: { items: [], nextCursor: null },
          meta: { requestId: 'conflicts' }
        });
      throw new Error(`Unexpected route ${url.pathname}`);
    }
  );
  const coordinator = createLiveCoreFinanceSync({
    baseUrl: 'https://inert.invalid',
    request,
    repository: {
      hasPending: async () => false,
      recoverSending: async () => undefined,
      ready: async () => [],
      cursor: async () => null
    } as never,
    adapter: {
      applyBootstrap: async (domain: string) => {
        applied.push(domain);
      }
    } as never,
    identity: async () => {
      const captured = ownerId;
      return {
        userId: captured,
        token: captured,
        assertCurrent: async () => {
          if (ownerId !== captured) throw new Error('owner changed');
        }
      };
    }
  });
  await expect(coordinator.synchronize()).resolves.toEqual({
    uploaded: 0,
    bootstrapped: 3,
    deltas: 0
  });
  expect(deviceReads).toBe(1);
  expect(applied).toEqual(['accounts', 'categories', 'transactions']);
  expect(sent).toEqual(
    Array(4).fill({
      device: '80000000-0000-4000-8000-000000000001',
      authorization: 'Bearer user_first'
    })
  );
  ownerId = 'user_second';
  deviceId = '80000000-0000-4000-8000-000000000002';
  await expect(coordinator.synchronize()).resolves.toEqual({
    uploaded: 0,
    bootstrapped: 3,
    deltas: 0
  });
  expect(deviceReads).toBe(2);
  expect(sent.slice(4)).toEqual(
    Array(4).fill({
      device: '80000000-0000-4000-8000-000000000002',
      authorization: 'Bearer user_second'
    })
  );
});

it('does not send sync data when the owner changes during device resolution', async () => {
  let switched = false;
  const request = jest.fn(async (input: RequestInfo | URL) => {
    if (!String(input).includes('/api/v1/me/devices'))
      throw new Error('Sync must not be sent');
    switched = true;
    return response({
      items: [{ id: '80000000-0000-4000-8000-000000000001', current: true }],
      nextCursor: null
    });
  });
  const coordinator = createLiveCoreFinanceSync({
    baseUrl: 'https://inert.invalid',
    request,
    repository: {
      hasPending: async () => false,
      recoverSending: async () => undefined,
      ready: async () => [],
      cursor: async () => null
    } as never,
    adapter: {} as never,
    identity: async () => ({
      userId: 'user_first',
      token: 'first-token',
      assertCurrent: async () => {
        if (switched) throw new Error('owner changed');
      }
    })
  });
  await expect(coordinator.synchronize()).rejects.toThrow('owner changed');
  expect(request).toHaveBeenCalledTimes(1);
});

it('does not send a queued upload if identity changes during fresh write authentication', async () => {
  let switched = false;
  registerLiveClerkBridge({
    ...bridge,
    getSession: async () => ({
      id: switched ? 'session-next' : 'session-initial',
      userId: switched ? 'user_next' : 'user_initial',
      method: 'google',
      issuedAt: 1,
      expiresAt: 9999999999999
    }),
    getToken: async ({ skipCache }) => {
      if (skipCache) switched = true;
      return 'token';
    }
  });
  const repository = {
    hasPending: async () => false,
    recoverSending: async () => undefined,
    ready: async () => [
      {
        operationId: '90000000-0000-4000-8000-000000000010',
        domain: 'transactions',
        resourceType: 'transaction',
        dependsOn: [],
        operation: 'create',
        resourceId: null,
        baseVersion: null,
        payload: {}
      }
    ],
    markSending: async () => undefined
  };
  const request = jest.fn();
  await expect(
    createLiveCoreFinanceSync({
      baseUrl: 'https://inert.invalid',
      request,
      repository: repository as never,
      adapter: {} as never
    }).synchronize()
  ).rejects.toMatchObject({ code: 'session_expired' });
  expect(request).not.toHaveBeenCalled();
});

it('replays a live voice batch from its durable operation receipt', async () => {
  let receipt: Transaction[] | null = null;
  const drafts = {
    bindOwner: jest.fn(),
    hydrate: jest.fn(async () => undefined),
    batchOperationResult: jest.fn(() => receipt),
    persistBatchOperationResult: jest.fn(
      async (_operationId: string, transactions: Transaction[]) => {
        receipt = transactions;
      }
    )
  };
  const request = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/api/v1/me/devices'))
        return response({
          items: [
            {
              id: '80000000-0000-4000-8000-000000000001',
              current: true
            }
          ],
          nextCursor: null
        });
      const body = JSON.parse(String(init?.body)) as {
        mutations: { operationId: string }[];
      };
      return response({
        data: {
          receipts: body.mutations.map((item, index) => ({
            operationId: item.operationId,
            status: 'applied',
            resourceId: index === 0 ? transactionId : linkedId,
            result: mutation(
              summary(index === 0 ? transactionId : linkedId, {
                title: index === 0 ? 'One' : 'Two',
                source: 'voice'
              })
            )
          }))
        },
        meta: { requestId: 'voice-batch' }
      });
    }
  );
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request,
    drafts: drafts as never
  });
  const inputs = ['One', 'Two'].map((title) => ({
    type: 'expense' as const,
    amountMinor: 1_000,
    currencyCode: 'SAR',
    accountId,
    categoryId,
    title,
    occurredAt: Date.parse(occurredAt)
  }));
  const operationId = '90000000-0000-4000-8000-000000000020';
  const first = await service.createTransactionsAtomically(
    inputs,
    operationId,
    'voice'
  );
  const replay = await service.createTransactionsAtomically(
    inputs,
    operationId,
    'voice'
  );

  expect(first.value.map((item) => item.id)).toEqual([transactionId, linkedId]);
  expect(replay.value).toEqual(first.value);
  expect(drafts.persistBatchOperationResult).toHaveBeenCalledWith(
    operationId,
    first.value
  );
  const mutationCall = request.mock.calls.find(([url]) =>
    String(url).endsWith('/api/v1/sync/mutations')
  );
  const operationIds = (
    JSON.parse(String(mutationCall?.[1]?.body)) as {
      mutations: { operationId: string }[];
    }
  ).mutations.map((item) => item.operationId);
  expect(operationIds[0]).toBe(operationId);
  expect(operationIds).toHaveLength(new Set(operationIds).size);
  expect(operationIds.every((id) => /^[0-9a-f-]{36}$/u.test(id))).toBe(true);
  expect(request).toHaveBeenCalledTimes(2);
});

it('maps and resolves BE006 conflicts without exposing keep-both', async () => {
  const conflictId = '70000000-0000-4000-8000-000000000001';
  const conflict = {
    id: conflictId,
    transactionId,
    clientMutationId: '70000000-0000-4000-8000-000000000002',
    serverVersion: 3,
    clientVersion: 2,
    conflictFields: ['title'],
    serverSnapshot: { title: 'Server title' },
    clientSnapshot: { title: 'Client title' },
    status: 'open',
    resolution: null,
    createdAt: occurredAt,
    resolvedAt: null
  };
  const request = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/v1/me/devices'))
        return response({
          items: [
            {
              id: '80000000-0000-4000-8000-000000000001',
              current: true
            }
          ],
          nextCursor: null
        });
      if (url.endsWith(`/conflicts/${conflictId}`))
        return response({
          data:
            init?.method === 'PATCH'
              ? { ...conflict, status: 'resolved', resolution: 'client' }
              : conflict,
          meta: { requestId: 'conflict-request' }
        });
      return response(detail(summary(transactionId, { version: 3 })));
    }
  );
  const drafts = {
    bindOwner: jest.fn(),
    hydrate: jest.fn(async () => undefined),
    saveConflict: jest.fn(),
    persistConflictRecord: jest.fn(async () => undefined),
    persistTransaction: jest.fn(async () => undefined)
  };
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request,
    drafts: drafts as never
  });

  await expect(service.getConflict(conflictId)).resolves.toMatchObject({
    id: conflictId,
    localSnapshot: { title: 'Client title', syncStatus: 'conflict' },
    laterSnapshot: { title: 'Server title', version: 3 },
    status: 'pending'
  });
  await expect(
    service.resolveConflict(conflictId, 'keep_local')
  ).resolves.toMatchObject({ value: { title: 'Client title' } });
  await expect(
    service.resolveConflict(conflictId, 'keep_both')
  ).rejects.toMatchObject({ code: 'validation' });
  const patchCall = request.mock.calls.find(
    ([url, init]) =>
      String(url).endsWith(`/conflicts/${conflictId}`) &&
      init?.method === 'PATCH'
  );
  expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
    resolution: 'client',
    payload: { title: 'Client title' }
  });
});

it('isolates durable drafts after an owner changes without restarting', async () => {
  const rows = new Map<string, Map<string, string>>();
  const opening = jest
    .spyOn(database, 'openDatabase')
    .mockImplementation(async (owner) => {
      if (!rows.has(owner!)) rows.set(owner!, new Map());
      const store = rows.get(owner!)!;
      return {
        getFirstAsync: async (_sql: string, id: string) =>
          store.has(id) ? { payload: store.get(id) } : null,
        runAsync: async (_sql: string, id: string, payload: string) => {
          store.set(id, payload);
          return { changes: 1 };
        }
      } as never;
    });
  const transaction = jest
    .spyOn(database, 'runExclusiveDatabaseTransaction')
    .mockImplementation(async (db, action) => action(db));
  const service = createLiveLedgerService();
  const draft = {
    id: 'manual',
    transactionType: 'expense' as const,
    amountText: '50',
    accountId,
    destinationAccountId: null,
    categoryId,
    merchant: 'A private draft',
    notes: null,
    occurredAt: Date.now(),
    status: 'editing' as const,
    updatedAt: Date.now()
  };
  try {
    await service.saveDraft(draft);
    expect(opening).toHaveBeenLastCalledWith('user_owner-a');
    registerLiveClerkBridge({
      ...bridge,
      getSession: async () => ({
        ...(await bridge.getSession()),
        id: 'session-b',
        userId: 'user_owner-b'
      })
    });
    expect(await service.loadDraft('manual')).toBeNull();
    await service.saveDraft({ ...draft, merchant: 'B private draft' });
    expect(opening).toHaveBeenLastCalledWith('user_owner-b');
    registerLiveClerkBridge(bridge);
    expect(await service.loadDraft('manual')).toMatchObject({
      merchant: 'A private draft'
    });
  } finally {
    transaction.mockRestore();
    opening.mockRestore();
  }
});

it('replays a linked refund with its frozen version after recreating the service', async () => {
  const request = jest
    .fn()
    .mockImplementation(async () =>
      response({ ...mutation(), original: summary(transactionId) }, 201)
    );
  const input = {
    type: 'refund' as const,
    amountMinor: 100,
    currencyCode: 'SAR',
    accountId,
    title: 'Refund',
    occurredAt: Date.parse(occurredAt),
    originalTransactionId: transactionId
  };
  await createLiveLedgerService({
    baseUrl: 'https://api.test',
    request
  }).createTransaction(input, 'refund-operation', undefined, 1);
  const first = request.mock.calls[0][1];
  await createLiveLedgerService({
    baseUrl: 'https://api.test',
    request
  }).createTransaction(input, 'refund-operation', undefined, 1);
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls[1][1].body).toEqual(first.body);
  expect(JSON.parse(first.body)).toMatchObject({ expectedVersion: 1 });
});

it('keeps post-acknowledgement session loss uncertain', async () => {
  const request = jest.fn().mockImplementation(async () => {
    registerLiveClerkBridge({
      ...bridge,
      getSession: async () => ({
        ...(await bridge.getSession()),
        id: 'renewed-session'
      })
    });
    return response(mutation(), 201);
  });
  await expect(
    createLiveLedgerService({
      baseUrl: 'https://api.test',
      request
    }).createTransaction(
      {
        type: 'expense',
        amountMinor: 100,
        currencyCode: 'SAR',
        accountId,
        categoryId,
        title: 'Food',
        occurredAt: Date.parse(occurredAt)
      },
      'uncertain-session'
    )
  ).rejects.toMatchObject({ code: 'provider_unavailable' });
});

it.each(['verified', 'cancelled', 'failed'] as const)(
  'T04 real HTTP recent-auth receipt preserves the SQLite operation through %s verification',
  async outcome => {
    const storage = useEditStorage();
    const queue = new SyncRepository(storage.db as never);
    const entry = {
      operationId: '90000000-0000-4000-8000-000000000098', domain: 'transactions' as const,
      resourceType: 'transaction' as const, schemaVersion: 1 as const, dependsOn: [], operation: 'update',
      resourceId: transactionId, baseVersion: 2, payload: { amountMinor: 900 }
    };
    await queue.enqueue(entry);
    for (const domain of ['accounts', 'categories', 'transactions'] as const)
      await queue.saveCursor(storage.db as never, domain, `cursor.${'a'.repeat(43)}`, null);
    const writes: RequestInit[] = [];
    const request = jest.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
      const path = String(url);
      if (path.includes('/me/devices')) return response({ items: [{ id: '80000000-0000-4000-8000-000000000001', current: true }], nextCursor: null });
      if (path.includes('/sync/mutations')) {
        writes.push(init);
        return response({ data: { receipts: [{ operationId: entry.operationId, status: writes.length === 1 ? 'rejected' : 'applied', ...(writes.length === 1 ? { error: { code: 'RECENT_AUTH_REQUIRED' } } : {}) }] }, meta: { requestId: 'reauth-receipt' } });
      }
      if (path.includes('/sync/delta')) return response({ data: { domain: new URL(path).searchParams.get('domain'), changes: [], nextCursor: `cursor.${'a'.repeat(43)}`, hasMore: false }, meta: { requestId: 'delta' } });
      if (path.includes('/conflicts')) return response({ data: { items: [], nextCursor: null }, meta: { requestId: 'conflicts' } });
      if (path.includes('/sync/ack')) return response({ data: {}, meta: { requestId: 'ack' } });
      throw new Error('UNEXPECTED_TEST_REQUEST');
    });
    const verify = jest.fn(async () => {
      if (outcome === 'failed') throw new HttpError('provider_unavailable', 503);
      return outcome === 'verified' ? 'verified-actor-token' : null;
    });
    configureRecentAuthHandler(verify);
    try {
      const coordinator = createLiveCoreFinanceSync({ baseUrl: 'https://inert.invalid', request, repository: queue,
        adapter: { applyDelta: jest.fn() } as never,
        identity: async () => ({ userId: 'user_owner-a', token: 'original-actor-token', assertCurrent: async () => undefined }) });
      if (outcome === 'verified') await coordinator.synchronize();
      else await expect(coordinator.synchronize()).rejects.toMatchObject({ code: outcome === 'cancelled' ? 'recent_auth_required' : 'provider_unavailable' });
      expect(verify).toHaveBeenCalledTimes(1);
      expect(writes).toHaveLength(outcome === 'verified' ? 2 : 1);
      const submitted = writes.map(init => JSON.parse(String(init.body)).mutations[0]);
      expect(submitted).toEqual(outcome === 'verified' ? [entry, entry] : [entry]);
      expect((writes[0].headers as Record<string, string>).Authorization).toBe('Bearer original-actor-token');
      if (outcome === 'verified') expect((writes[1].headers as Record<string, string>).Authorization).toBe('Bearer verified-actor-token');
      const stored = await storage.db.getFirstAsync('SELECT * FROM sync_mutation_queue WHERE operation_id=?', entry.operationId);
      expect(stored).toMatchObject({ status: outcome === 'verified' ? 'applied' : 'pending', resource_id: entry.resourceId, base_version: entry.baseVersion, payload: JSON.stringify(entry.payload) });
      expect(await storage.db.getAllAsync('SELECT operation_id FROM sync_mutation_queue')).toHaveLength(1);
    } finally { configureRecentAuthHandler(); storage.close(); }
  }
);

it.each([true, false])(
  'retains the operation identity across queued step-up (approved=%s)',
  async (approved) => {
    const entry = {
      operationId: '90000000-0000-4000-8000-000000000099',
      domain: 'transactions',
      resourceType: 'transaction',
      schemaVersion: 1,
      dependsOn: [],
      operation: 'update',
      resourceId: transactionId,
      baseVersion: 2,
      payload: { amountMinor: 900 }
    };
    const queue = {
      hasPending: async () => false,
      recoverSending: jest.fn(),
      ready: jest
        .fn()
        .mockResolvedValueOnce([entry])
        .mockResolvedValueOnce([entry])
        .mockResolvedValue([]),
      markSending: jest.fn(),
      retry: jest.fn(),
      complete: jest.fn(),
      mapId: jest.fn(),
      cursor: jest.fn(async () => `cursor.${'a'.repeat(43)}`)
    };
    const receipt = (status: string, error?: { code: string }) => ({
      data: {
        receipts: [
          {
            operationId: entry.operationId,
            status,
            ...(error ? { error } : {})
          }
        ]
      },
      meta: { requestId: 'request' }
    });
    const sync = {
      mutations: jest
        .fn()
        .mockResolvedValueOnce(
          receipt('rejected', { code: 'RECENT_AUTH_REQUIRED' })
        )
        .mockResolvedValueOnce(receipt('applied')),
      delta: jest.fn(async (domain: string) => ({
        data: {
          domain,
          changes: [],
          nextCursor: `cursor.${'a'.repeat(43)}`,
          hasMore: false
        },
        meta: { requestId: 'request' }
      })),
      acknowledge: jest.fn(),
      conflicts: jest.fn(async () => ({
        data: { items: [], nextCursor: null },
        meta: { requestId: 'request' }
      }))
    };
    const verify = jest.fn(async () => (approved ? 'fresh-token' : null));
    configureRecentAuthHandler(verify);
    try {
      const coordinator = createLiveCoreFinanceSync({
        repository: queue as never,
        sync: sync as never,
        adapter: { applyDelta: jest.fn() } as never,
        identity: async () => ({
          userId: 'user_owner-a',
          token: 'old-token',
          assertCurrent: async () => undefined
        })
      });
      if (approved) {
        await coordinator.synchronize();
        expect(sync.mutations).toHaveBeenCalledTimes(2);
        expect(sync.mutations.mock.calls[0][0]).toEqual(
          sync.mutations.mock.calls[1][0]
        );
        expect(queue.complete).toHaveBeenCalledWith(
          entry.operationId,
          'applied',
          null
        );
      } else {
        await expect(coordinator.synchronize()).rejects.toMatchObject({
          code: 'recent_auth_required'
        });
        expect(sync.mutations).toHaveBeenCalledTimes(1);
        expect(queue.complete).not.toHaveBeenCalled();
      }
      expect(verify).toHaveBeenCalledTimes(1);
      expect(queue.retry).toHaveBeenCalledWith(
        entry.operationId,
        expect.any(Number),
        'RECENT_AUTH_REQUIRED'
      );
    } finally {
      configureRecentAuthHandler();
    }
  }
);
jest.mock('@/services/platform/read-recovery-network', () => ({
  readRecoveryNetwork: { available: true, isOnline: jest.fn(async () => true) }
}));

it('replays the exact original edit PATCH after a lost response and reconstructed service', async () => {
  const storage = useEditStorage();
  const uuid = jest
    .spyOn(require('expo-crypto'), 'randomUUID')
    .mockReturnValueOnce('90000000-0000-4000-8000-000000000001')
    .mockReturnValueOnce('90000000-0000-4000-8000-000000000002');
  let applied = false;
  let loseResponse = true;
  const writes: RequestInit[] = [];
  const request = jest.fn(async (_url: unknown, init: RequestInit = {}) => {
    if (init?.method === 'PATCH') {
      writes.push(init);
      applied = true;
      if (loseResponse) throw new TypeError('accepted response lost');
      return response(
        mutation(summary(transactionId, { note: 'Frozen note', version: 3 }))
      );
    }
    return response(
      detail(
        summary(
          transactionId,
          applied ? { note: 'Frozen note', version: 3 } : {}
        )
      )
    );
  });
  const input = {
    type: 'expense' as const,
    amountMinor: 1000,
    currencyCode: 'SAR',
    accountId,
    categoryId,
    title: 'Groceries',
    occurredAt: Date.parse(occurredAt),
    notes: 'Frozen note'
  };
  const factory = () =>
    createLiveLedgerService({ baseUrl: 'https://api.test', request });
  const first = factory();
  try {
    await expect(
      first.updateTransaction(transactionId, input)
    ).rejects.toBeDefined();
    await expect(
      first.updateTransaction(transactionId, input)
    ).rejects.toBeDefined();
    loseResponse = false;
    await factory().updateTransaction(transactionId, input);
    expect(writes).toHaveLength(3);
    expect(writes.map((write) => write.body)).toEqual([
      writes[0].body,
      writes[0].body,
      writes[0].body
    ]);
    expect(
      writes.map(
        (write) => (write.headers as Record<string, string>)['Idempotency-Key']
      )
    ).toEqual([
      '90000000-0000-4000-8000-000000000001',
      '90000000-0000-4000-8000-000000000001',
      '90000000-0000-4000-8000-000000000001'
    ]);
    expect(JSON.parse(String(writes[0].body))).toMatchObject({
      expectedVersion: 2,
      note: 'Frozen note'
    });
  } finally {
    uuid.mockRestore();
    storage.close();
  }
});

it.each([false, true])('keeps a local-origin identity across online get/list/edit and a lost response (%s)', async (loseResponse) => {
  const storage = useEditStorage();
  const localId = '31000000-0000-4000-8000-000000000099';
  await storage.db.runAsync('INSERT INTO sync_id_mappings(domain,local_id,server_id,updated_at) VALUES(?,?,?,?)', 'transactions', localId, transactionId, 1);
  const paths: string[] = [];
  let lose = loseResponse;
  const request = jest.fn(async (url: unknown, init: RequestInit = {}) => {
    paths.push(String(url));
    if (init.method === 'PATCH') {
      if (lose) { lose = false; throw new TypeError('response lost'); }
      return response(mutation(summary(transactionId, { note: 'Mapped edit', version: 3 })));
    }
    return response(String(url).includes('?')
      ? { items: [summary()], nextCursor: null, ledgerVersion: 2, requestId: 'page' }
      : detail());
  });
  const service = () => createLiveLedgerService({ baseUrl: 'https://inert.invalid', request });
  try {
    expect((await service().getTransaction(localId)).id).toBe(localId);
    expect((await service().listTransactions(emptyTransactionFilters)).items[0]?.id).toBe(localId);
    const input = { ...frozenEditInput(), notes: 'Mapped edit' };
    if (loseResponse) await expect(service().updateTransaction(localId, input)).rejects.toMatchObject({ metadata: { uncertain: true } });
    expect((await service().updateTransaction(localId, input)).value).toMatchObject({ id: localId, notes: 'Mapped edit', version: 3 });
    expect(paths.every(path => !path.includes(localId))).toBe(true);
    const patches = request.mock.calls.filter(([, init]) => init?.method === 'PATCH').map(([, init]) => ({ body: init!.body, key: (init!.headers as Record<string, string>)['Idempotency-Key'] }));
    if (loseResponse) expect(patches[1]).toEqual(patches[0]);
  } finally { storage.close(); }
});

function useEditStorage() {
  const { DatabaseSync } = require('node:sqlite');
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(
    'CREATE TABLE finance_drafts (id TEXT PRIMARY KEY, payload TEXT NOT NULL, status TEXT, updated_at INTEGER)'
  );
  sqlite.exec(
    `CREATE TABLE finance_categories (id TEXT PRIMARY KEY, payload TEXT, parent_id TEXT, status TEXT, merged_into_id TEXT, updated_at INTEGER);
    CREATE TABLE finance_transactions (id TEXT PRIMARY KEY, payload TEXT, account_id TEXT, destination_account_id TEXT, category_id TEXT, occurred_at INTEGER, type TEXT, source TEXT, status TEXT, sync_status TEXT, review_status TEXT, normalized_title TEXT, amount_minor INTEGER, updated_at INTEGER);
    CREATE TABLE finance_accounts (id TEXT PRIMARY KEY, payload TEXT);
    CREATE TABLE finance_sync_conflicts (transaction_id TEXT, payload TEXT);
    CREATE TABLE finance_corrections (transaction_id TEXT, payload TEXT, status TEXT);
    CREATE TABLE finance_operations (operation_id TEXT, transaction_id TEXT, payload TEXT, status TEXT);
    CREATE TABLE sync_mutation_queue (operation_id TEXT PRIMARY KEY, domain TEXT, resource_type TEXT, schema_version INTEGER, depends_on TEXT, operation TEXT, resource_id TEXT, base_version INTEGER, payload TEXT, status TEXT, attempt_count INTEGER, next_attempt_at INTEGER, last_error_code TEXT, created_at INTEGER, updated_at INTEGER);
    CREATE TABLE sync_state (domain TEXT PRIMARY KEY, cursor TEXT, last_mutation_id TEXT, updated_at INTEGER);
    CREATE TABLE sync_id_mappings (domain TEXT, local_id TEXT, server_id TEXT, updated_at INTEGER, PRIMARY KEY(domain,local_id));`
  );
  const db = {
    execAsync: jest.fn(async (sql: string) => {
      sqlite.exec(sql);
    }),
    getFirstAsync: jest.fn(
      async (sql: string, ...args: unknown[]) =>
        sqlite.prepare(sql).get(...args) ?? null
    ),
    getAllAsync: jest.fn(async (sql: string, ...args: unknown[]) =>
      sqlite.prepare(sql).all(...args)
    ),
    runAsync: jest.fn(async (sql: string, ...args: unknown[]) =>
      sqlite.prepare(sql).run(...args)
    ),
    withExclusiveTransactionAsync: async (
      action: (db: unknown) => Promise<void>
    ) => {
      sqlite.exec('BEGIN');
      try {
        await action(db);
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    }
  };
  const open = jest
    .spyOn(database, 'openDatabase')
    .mockResolvedValue(db as never);
  const transaction = jest
    .spyOn(database, 'runExclusiveDatabaseTransaction')
    .mockImplementation(async (_db, action) =>
      db.withExclusiveTransactionAsync(action as never)
    );
  return {
    db,
    open,
    close: () => {
      open.mockRestore();
      transaction.mockRestore();
      sqlite.close();
    }
  };
}

const frozenEditInput = () => ({
  type: 'expense' as const,
  amountMinor: 1000,
  currencyCode: 'SAR',
  accountId,
  categoryId,
  title: 'Groceries',
  occurredAt: Date.parse(occurredAt),
  notes: 'Frozen note'
});
function editRequest(loseResponse = false) {
  return jest.fn(async (url: unknown, init: RequestInit = {}) => {
    if (String(url).includes('/categories?'))
      return response({ items: [], nextCursor: null });
    if (init?.method === 'PATCH') {
      if (loseResponse) throw new TypeError('accepted response lost');
      return response(
        mutation(summary(transactionId, { note: 'Frozen note', version: 3 }))
      );
    }
    return response(detail());
  });
}

it.each([
  ['same', 'warm'],
  ['changed', 'warm'],
  ['same', 'local'],
  ['changed', 'local']
] as const)(
  'blocks %s-input %s offline retry after an uncertain online edit and restart',
  async (variant, entry) => {
    const previousSession = useAppShellStore.getState().session;
    const previousLock = useAppShellStore.getState().privacyLock;
    const storage = useEditStorage();
    const request = editRequest(true);
    const factory = () =>
      createLiveCoreFinanceService({ baseUrl: 'https://api.test', request });
    try {
      await expect(
        factory().updateTransaction(transactionId, frozenEditInput())
      ).rejects.toMatchObject({ metadata: { uncertain: true } });
      const beforeOffline = request.mock.calls.length;
      jest.mocked(readRecoveryNetwork.isOnline).mockResolvedValue(false);
      if (entry === 'local')
        useAppShellStore.setState({
          session: {
            status: 'authenticated',
            userId: 'user_owner-a',
            method: 'google',
            issuedAt: 1,
            expiresAt: 9999999999999,
            restoration: 'local'
          },
          privacyLock: {
    enabled: true,
    autoLockDuration: 'immediate',
    appLockStatus: 'unlocked'
}
        });
      await expect(
        factory().updateTransaction(transactionId, {
          ...frozenEditInput(),
          notes: variant === 'same' ? 'Frozen note' : 'Another input'
        })
      ).rejects.toMatchObject({
        metadata: {
          domainCode: 'TRANSACTION_OUTCOME_UNCERTAIN',
          uncertain: true
        }
      });
      expect(request).toHaveBeenCalledTimes(beforeOffline);
      expect(
        storage.db.runAsync.mock.calls.some(([sql]) =>
          sql.includes('sync_mutation_queue')
        )
      ).toBe(false);
    } finally {
      useAppShellStore.setState({
        session: previousSession,
        privacyLock: previousLock
      });
      jest.mocked(readRecoveryNetwork.isOnline).mockResolvedValue(true);
      storage.close();
    }
  }
);

it.each(['read failure', 'malformed record', 'write failure'] as const)(
  'fails closed before PATCH on journal %s',
  async (failure) => {
    const storage = useEditStorage();
    const request = editRequest();
    try {
      if (failure === 'read failure')
        storage.db.getFirstAsync.mockRejectedValueOnce(
          new Error('disk unavailable')
        );
      if (failure === 'malformed record')
        await storage.db.runAsync(
          'INSERT INTO finance_drafts(id,payload) VALUES(?,?)',
          TRANSACTION_EDIT_JOURNAL_PREFIX + transactionId,
          '{"version":99}'
        );
      if (failure === 'write failure')
        storage.db.runAsync.mockRejectedValueOnce(new Error('disk full'));
      await expect(
        createLiveCoreFinanceService({
          baseUrl: 'https://api.test',
          request
        }).updateTransaction(transactionId, frozenEditInput())
      ).rejects.toMatchObject({
        metadata: { uncertain: failure !== 'write failure' }
      });
      expect(
        request.mock.calls.some(([, init]) => init?.method === 'PATCH')
      ).toBe(false);
    } finally {
      storage.close();
    }
  }
);

it('retains an earlier uncertain journal when a later online retry loses authentication', async () => {
  const storage = useEditStorage();
  const request = editRequest(true);
  const factory = () =>
    createLiveCoreFinanceService({ baseUrl: 'https://api.test', request });
  try {
    await expect(
      factory().updateTransaction(transactionId, frozenEditInput())
    ).rejects.toMatchObject({ metadata: { uncertain: true } });
    registerLiveClerkBridge({ ...bridge, getToken: async () => null });
    await expect(
      factory().updateTransaction(transactionId, frozenEditInput())
    ).rejects.toMatchObject({ metadata: { uncertain: true } });
    expect(
      await storage.db.getFirstAsync(
        'SELECT payload FROM finance_drafts WHERE id=?',
        TRANSACTION_EDIT_JOURNAL_PREFIX + transactionId
      )
    ).not.toBeNull();
  } finally {
    registerLiveClerkBridge(bridge);
    storage.close();
  }
});

it('reserves the transaction before an asynchronous network probe and fences an owner switch', async () => {
  const storage = useEditStorage();
  const request = editRequest();
  let release!: (online: boolean) => void;
  jest.mocked(readRecoveryNetwork.isOnline).mockReturnValueOnce(
    new Promise((resolve) => {
      release = resolve;
    })
  );
  const service = createLiveCoreFinanceService({
    baseUrl: 'https://api.test',
    request
  });
  const first = service.updateTransaction(transactionId, frozenEditInput());
  try {
    while (
      !jest.mocked(readRecoveryNetwork.isOnline).mock.results.length ||
      !release
    )
      await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(
      service.updateTransaction(transactionId, {
        ...frozenEditInput(),
        notes: 'Concurrent input'
      })
    ).rejects.toMatchObject({ metadata: { uncertain: true } });
    registerLiveClerkBridge({
      ...bridge,
      getSession: async () => ({
        ...(await bridge.getSession()),
        id: 'session-other',
        userId: 'user_other'
      })
    });
    release(true);
    await expect(first).rejects.toBeDefined();
    expect(request).not.toHaveBeenCalled();
    expect(storage.db.runAsync).not.toHaveBeenCalled();
    expect(
      storage.open.mock.calls.every(([owner]) => owner === 'user_owner-a')
    ).toBe(true);
  } finally {
    release(true);
    registerLiveClerkBridge(bridge);
    jest.mocked(readRecoveryNetwork.isOnline).mockResolvedValue(true);
    storage.close();
  }
});

it('replays the frozen update after acknowledgement cleanup fails', async () => {
  const storage = useEditStorage();
  const request = editRequest();
  const originalRun = storage.db.runAsync.getMockImplementation()!;
  let interrupt = true;
  storage.db.runAsync.mockImplementation(async (sql, ...args) => {
    if (sql.startsWith('DELETE FROM finance_drafts') && interrupt) {
      interrupt = false;
      throw new Error('cleanup interrupted');
    }
    return originalRun(sql, ...args);
  });
  const factory = () =>
    createLiveCoreFinanceService({ baseUrl: 'https://api.test', request });
  try {
    await expect(
      factory().updateTransaction(transactionId, frozenEditInput())
    ).rejects.toMatchObject({ metadata: { uncertain: true } });
    await expect(
      factory().updateTransaction(transactionId, frozenEditInput())
    ).resolves.toMatchObject({ value: { notes: 'Frozen note' } });
    const patches = request.mock.calls.filter(
      ([, init]) => init?.method === 'PATCH'
    );
    expect(patches).toHaveLength(2);
    expect(patches[1][1]!.body).toEqual(patches[0][1]!.body);
    expect(patches[1][1]!.headers).toEqual(patches[0][1]!.headers);
  } finally {
    storage.close();
  }
});
it('allows correction after the first PATCH is definitively rejected without forgetting an earlier unknown attempt', async () => {
  const storage = useEditStorage();
  let rejected = true;
  const request = jest.fn(async (_url: unknown, init: RequestInit = {}) =>
    init?.method === 'PATCH'
      ? rejected
        ? response({ code: 'VALIDATION_FAILED', requestId: 'rejected' }, 400)
        : response(mutation(summary(transactionId, { note: 'Corrected note' })))
      : response(detail())
  );
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test',
    request
  });
  try {
    await expect(
      service.updateTransaction(transactionId, frozenEditInput())
    ).rejects.toMatchObject({ code: 'validation_error' });
    rejected = false;
    await expect(
      service.updateTransaction(transactionId, {
        ...frozenEditInput(),
        notes: 'Corrected note'
      })
    ).resolves.toMatchObject({ value: { notes: 'Corrected note' } });
  } finally {
    storage.close();
  }
});
it('does not save old form input under a different owner returned by asynchronous authentication capture', async () => {
  const storage = useEditStorage();
  const previous = useAppShellStore.getState().session;
  useAppShellStore.setState({
    session: {
      status: 'authenticated',
      userId: 'user_owner-a',
      method: 'google',
      issuedAt: 1,
      expiresAt: 9999999999999,
      restoration: 'restored'
    }
  });
  registerLiveClerkBridge({
    ...bridge,
    getSession: async () => ({
      ...(await bridge.getSession()),
      id: 'session-b',
      userId: 'user_owner-b'
    })
  });
  const request = editRequest();
  try {
    await expect(
      createLiveCoreFinanceService({
        baseUrl: 'https://api.test',
        request
      }).updateTransaction(transactionId, frozenEditInput())
    ).rejects.toMatchObject({ metadata: { status: 401 } });
    expect(request).not.toHaveBeenCalled();
    expect(storage.open).not.toHaveBeenCalled();
  } finally {
    useAppShellStore.setState({ session: previous });
    registerLiveClerkBridge(bridge);
    storage.close();
  }
});

it.each([
  'applied',
  'prolonged and restarted',
  'slow persistent received',
  'owner change',
  'network loss',
  'background',
  'inactive',
  'background during network probe',
  'background before submission',
  'identity reset'
] as const)(
  'bounds asynchronous receipt follow-up during %s without replacing the operation',
  async (scenario) => {
    jest.useFakeTimers();
    const previousAppState = AppState.currentState;
    AppState.currentState = 'active';
    const lifecycleListeners = new Set<(state: AppStateStatus) => void>();
    const lifecycle = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        lifecycleListeners.add(listener);
        return {
          remove: () => {
            lifecycleListeners.delete(listener);
          }
        };
      });
    const lifecycleScenario =
      scenario.startsWith('background') || scenario === 'inactive';
    const background = () => {
      const state = scenario === 'inactive' ? 'inactive' : 'background';
      AppState.currentState = state;
      lifecycleListeners.forEach((listener) => listener(state));
    };
    const storage = useEditStorage();
    const queue = new SyncRepository(storage.db as never);
    const entry = {
      operationId: '74000000-0000-4000-8000-000000000004',
      domain: 'transactions' as const,
      resourceType: 'transaction' as const,
      schemaVersion: 1 as const,
      dependsOn: [],
      operation: 'update',
      resourceId: transactionId,
      baseVersion: 2,
      payload: { note: 'Queued note' }
    };
    await queue.enqueue(entry);
    if (scenario === 'background during network probe')
      jest
        .mocked(readRecoveryNetwork.isOnline)
        .mockImplementationOnce(async () => {
          background();
          return true;
        });
    const runSql = storage.db.runAsync.getMockImplementation()!;
    let sendingCount = 0;
    storage.db.runAsync.mockImplementation(async (sql, ...args) => {
      const result = await runSql(sql, ...args);
      if (
        scenario === 'slow persistent received' &&
        sql.includes('last_error_code=?')
      )
        await new Promise<void>((resolve) => setTimeout(resolve, 1100));
      if (sql.includes("SET status='sending'")) {
        sendingCount++;
        if (scenario === 'background before submission' && sendingCount === 2)
          background();
      }
      return result;
    });
    for (const domain of ['accounts', 'categories', 'transactions'] as const)
      await queue.saveCursor(
        storage.db as never,
        domain,
        `cursor.${'a'.repeat(43)}`,
        null
      );
    const statuses = ['received', 'processing', 'applied'];
    const writes: RequestInit[] = [];
    let currentOwner = true;
    let batchNumber = 0;
    const uuid = jest
      .spyOn(require('expo-crypto'), 'randomUUID')
      .mockImplementation(
        () =>
          `74000000-0000-4000-8000-${String(++batchNumber).padStart(12, '0')}`
      );
    const request = jest.fn(async (url: unknown, init: RequestInit = {}) => {
      if (String(url).includes('/me/devices'))
        return response({
          items: [
            { id: '74000000-0000-4000-8000-000000000005', current: true }
          ],
          nextCursor: null
        });
      if (String(url).includes('/sync/mutations')) {
        writes.push(init);
        if (scenario === 'owner change') currentOwner = false;
        if (scenario === 'network loss')
          jest.mocked(readRecoveryNetwork.isOnline).mockResolvedValue(false);
        if (scenario === 'identity reset')
          setTimeout(() => {
            void resetRuntimeIdentityData();
          }, 10);
        if (
          (scenario === 'background' || scenario === 'inactive') &&
          writes.length === 1
        )
          setTimeout(background, 100);
        const status =
          scenario === 'slow persistent received'
            ? 'received'
            : scenario === 'applied'
              ? (statuses.shift() ?? 'applied')
              : writes.length > (lifecycleScenario ? 1 : 4)
                ? 'applied'
                : 'received';
        return response({
          data: { receipts: [{ operationId: entry.operationId, status }] },
          meta: { requestId: 'receipt' }
        });
      }
      if (String(url).includes('/sync/delta'))
        return response({
          data: {
            domain: new URL(String(url)).searchParams.get('domain'),
            changes: [],
            nextCursor: `cursor.${'a'.repeat(43)}`,
            hasMore: false
          },
          meta: { requestId: 'delta' }
        });
      if (String(url).includes('/conflicts?'))
        return response({
          data: { items: [], nextCursor: null },
          meta: { requestId: 'conflicts' }
        });
      return response({ data: {}, meta: { requestId: 'ack' } });
    });
    const factory = () =>
      createLiveCoreFinanceSync({
        database: storage.db as never,
        repository: queue,
        baseUrl: 'https://api.test',
        request,
        identity: async () => ({
          userId: 'user_owner-a',
          token: 'fixture-token',
          assertCurrent: async () => {
            if (!currentOwner) throw new HttpError('session_expired', 401);
          }
        })
      });
    try {
      let settled = false;
      const pending = factory()
        .synchronize()
        .then(
          () => {
            settled = true;
            return null;
          },
          (error) => {
            settled = true;
            return error;
          }
        );
      await jest.advanceTimersByTimeAsync(
        scenario === 'slow persistent received' ? 25000 : 10000
      );
      if (scenario === 'slow persistent received') {
        expect(writes.length).toBe(4);
        expect(settled).toBe(true);
      }
      const failure = await pending;
      if (scenario === 'applied') {
        expect(failure).toBeNull();
        expect(writes).toHaveLength(3);
        expect(await queue.ready(Date.now() + 300000)).toHaveLength(0);
      } else if (scenario === 'prolonged and restarted') {
        expect(failure).toBeNull();
        expect(writes).toHaveLength(4);
        expect(await queue.ready(Date.now() + 300000)).toHaveLength(1);
        await factory().synchronize();
        expect(writes).toHaveLength(5);
        expect(await queue.ready(Date.now() + 300000)).toHaveLength(0);
      } else if (scenario === 'slow persistent received') {
        expect(failure).toBeNull();
        expect(jest.getTimerCount()).toBe(0);
        expect(lifecycleListeners.size).toBe(0);
        expect(await queue.ready()).toEqual([
          expect.objectContaining({ ...entry, lastErrorCode: 'SYNC_RECEIVED' })
        ]);
        const resumed = factory().synchronize();
        await jest.advanceTimersByTimeAsync(25000);
        await resumed;
        expect(writes).toHaveLength(8);
        expect(await queue.ready()).toEqual([
          expect.objectContaining({ ...entry, lastErrorCode: 'SYNC_RECEIVED' })
        ]);
      } else if (lifecycleScenario) {
        expect(failure).toMatchObject({
          code: 'provider_unavailable',
          domainCode: 'SYNC_RECEIPT_PAUSED'
        });
        expect(writes).toHaveLength(1);
        expect(await queue.ready(Date.now() + 300000)).toHaveLength(1);
        expect(jest.getTimerCount()).toBe(0);
        expect(lifecycleListeners.size).toBe(0);
        AppState.currentState = 'active';
        await factory().synchronize();
        expect(writes).toHaveLength(2);
        expect(await queue.ready(Date.now() + 300000)).toHaveLength(0);
      } else {
        expect(failure).toMatchObject({
          code:
            scenario === 'network loss'
              ? 'provider_unavailable'
              : 'session_expired'
        });
        expect(writes).toHaveLength(1);
        expect(await queue.ready(Date.now() + 300000)).toHaveLength(1);
      }
      expect(jest.getTimerCount()).toBe(0);
      expect(lifecycleListeners.size).toBe(0);
      expect(
        writes.every(
          (write) =>
            JSON.stringify(JSON.parse(String(write.body)).mutations) ===
            JSON.stringify([entry])
        )
      ).toBe(true);
      expect(
        new Set(
          writes.map(
            (write) =>
              (write.headers as Record<string, string>)['Idempotency-Key']
          )
        ).size
      ).toBe(writes.length);
    } finally {
      if (scenario === 'slow persistent received') {
        background();
        await jest.advanceTimersByTimeAsync(2000);
      }
      uuid.mockRestore();
      lifecycle.mockRestore();
      AppState.currentState = previousAppState;
      jest.mocked(readRecoveryNetwork.isOnline).mockResolvedValue(true);
      storage.close();
      jest.useRealTimers();
    }
  }
);

it.each(['existing', 'reconstructed'] as const)(
  'blocks a reconnected changed edit behind a received queue entry in the %s service',
  async (instance) => {
    const storage = useEditStorage();
    const request = editRequest();
    const factory = () =>
      createLiveCoreFinanceService({ baseUrl: 'https://api.test', request });
    let service = factory();
    const queue = new SyncRepository(storage.db as never);
    const queued = {
      operationId: '74000000-0000-4000-8000-000000000061',
      domain: 'transactions' as const,
      resourceType: 'transaction' as const,
      schemaVersion: 1 as const,
      dependsOn: [],
      operation: 'update',
      resourceId: transactionId,
      baseVersion: 2,
      payload: { note: 'Previously queued note' }
    };
    try {
      await queue.enqueue(queued);
      await queue.retry(queued.operationId, Date.now() + 1000, 'SYNC_RECEIVED');
      jest.mocked(readRecoveryNetwork.isOnline).mockResolvedValue(true);
      if (instance === 'reconstructed') service = factory();
      await expect(
        service.updateTransaction(transactionId, {
          ...frozenEditInput(),
          notes: 'Changed after reconnect'
        })
      ).rejects.toMatchObject({
        metadata: {
          domainCode: 'TRANSACTION_OUTCOME_UNCERTAIN',
          uncertain: true
        }
      });
      expect(
        request.mock.calls.filter(([, init]) => init?.method === 'PATCH')
      ).toHaveLength(0);
      expect(await queue.ready(Date.now() + 300000)).toEqual([
        expect.objectContaining({ ...queued, lastErrorCode: 'SYNC_RECEIVED' })
      ]);
    } finally {
      storage.close();
    }
  }
);

it.each(['network probe', 'server read', 'journal transaction'] as const)(
  'blocks PATCH when a queue entry appears during the %s',
  async (boundary) => {
    const storage = useEditStorage();
    const queue = new SyncRepository(storage.db as never);
    const queued = {
      operationId: '74000000-0000-4000-8000-000000000062',
      domain: 'transactions' as const,
      resourceType: 'transaction' as const,
      schemaVersion: 1 as const,
      dependsOn: [],
      operation: 'update',
      resourceId: transactionId,
      baseVersion: 2,
      payload: { note: 'Concurrent durable edit' }
    };
    const request = editRequest();
    const regularRequest = request.getMockImplementation()!;
    request.mockImplementation(async (url, init) => {
      if (
        boundary === 'server read' &&
        String(url).includes(`/transactions/${transactionId}`) &&
        init?.method !== 'PATCH'
      )
        await queue.enqueue(queued);
      return regularRequest(url, init);
    });
    if (boundary === 'network probe')
      jest
        .mocked(readRecoveryNetwork.isOnline)
        .mockImplementationOnce(async () => {
          await queue.enqueue(queued);
          return true;
        });
    const runTransaction = jest
      .mocked(database.runExclusiveDatabaseTransaction)
      .getMockImplementation()!;
    if (boundary === 'journal transaction')
      jest
        .mocked(database.runExclusiveDatabaseTransaction)
        .mockImplementationOnce(async (db, action) => {
          await queue.enqueue(queued);
          return runTransaction(db, action);
        });
    try {
      await expect(
        createLiveCoreFinanceService({
          baseUrl: 'https://api.test',
          request
        }).updateTransaction(transactionId, frozenEditInput())
      ).rejects.toMatchObject({ metadata: { uncertain: true } });
      expect(
        request.mock.calls.filter(([, init]) => init?.method === 'PATCH')
      ).toHaveLength(0);
      expect(await queue.ready()).toEqual([expect.objectContaining(queued)]);
      expect(
        await storage.db.getFirstAsync('SELECT id FROM finance_drafts')
      ).toBeNull();
    } finally {
      jest.mocked(readRecoveryNetwork.isOnline).mockResolvedValue(true);
      storage.close();
    }
  }
);

it.each(['other resource', 'applied', 'conflict', 'rejected'] as const)(
  'allows an online edit independently of a queue entry for %s',
  async (state) => {
    const storage = useEditStorage();
    const queue = new SyncRepository(storage.db as never);
    const operationId = '74000000-0000-4000-8000-000000000063';
    const request = editRequest();
    try {
      await queue.enqueue({
        operationId,
        domain: 'transactions',
        resourceType: 'transaction',
        schemaVersion: 1,
        dependsOn: [],
        operation: 'update',
        resourceId: state === 'other resource' ? linkedId : transactionId,
        baseVersion: 2,
        payload: { note: 'Earlier note' }
      });
      if (state !== 'other resource')
        await queue.complete(operationId, state, null);
      await expect(
        createLiveCoreFinanceService({
          baseUrl: 'https://api.test',
          request
        }).updateTransaction(transactionId, frozenEditInput())
      ).resolves.toMatchObject({ value: { notes: 'Frozen note' } });
      expect(
        request.mock.calls.filter(([, init]) => init?.method === 'PATCH')
      ).toHaveLength(1);
      expect(await queue.ready()).toHaveLength(
        state === 'other resource' ? 1 : 0
      );
    } finally {
      storage.close();
    }
  }
);

it('reads the exact acknowledged unrelated edit while another transaction remains pending across reconstruction', async () => {
  const storage = useEditStorage();
  const queue = new SyncRepository(storage.db as never);
  const request = editRequest();
  const factory = () =>
    createLiveCoreFinanceService({ baseUrl: 'https://api.test', request });
  const cached = {
    ...fixtureTransactions[0],
    id: transactionId,
    accountId,
    categoryId,
    notes: 'Old cached note',
    syncStatus: 'synced' as const,
    version: 2
  };
  try {
    await storage.db.runAsync(
      'INSERT INTO finance_transactions(id,payload,sync_status) VALUES(?,?,?)',
      transactionId,
      JSON.stringify(cached),
      'synced'
    );
    await storage.db.runAsync(
      'INSERT INTO finance_transactions(id,payload,sync_status) VALUES(?,?,?)',
      linkedId,
      JSON.stringify({
        ...cached,
        id: linkedId,
        notes: 'Pending different resource',
        syncStatus: 'pending'
      }),
      'pending'
    );
    await queue.enqueue({
      operationId: '74000000-0000-4000-8000-000000000064',
      domain: 'transactions',
      resourceType: 'transaction',
      schemaVersion: 1,
      dependsOn: [],
      operation: 'update',
      resourceId: linkedId,
      baseVersion: 2,
      payload: { note: 'Pending different resource' }
    });
    const service = factory();
    await expect(
      service.updateTransaction(transactionId, frozenEditInput())
    ).resolves.toMatchObject({
      value: { notes: 'Frozen note', version: 3, syncStatus: 'synced' }
    });
    await expect(service.getTransaction(transactionId)).resolves.toMatchObject({
      notes: 'Frozen note',
      version: 3,
      syncStatus: 'synced'
    });
    await expect(
      factory().getTransaction(transactionId)
    ).resolves.toMatchObject({
      notes: 'Frozen note',
      version: 3,
      syncStatus: 'synced'
    });
    const page = await factory().listTransactions(emptyTransactionFilters);
    expect(page.items.find((item) => item.id === transactionId)).toMatchObject({
      notes: 'Frozen note',
      version: 3,
      syncStatus: 'synced'
    });
    expect(page.items.find((item) => item.id === linkedId)).toMatchObject({
      notes: 'Pending different resource',
      syncStatus: 'pending'
    });
    expect(
      request.mock.calls.filter(([, init]) => init?.method === 'PATCH')
    ).toHaveLength(1);
    expect(await queue.ready()).toHaveLength(1);
  } finally {
    storage.close();
  }
});

it('keeps uncached online detail available while an unrelated cached transaction is pending', async () => {
  const storage = useEditStorage();
  const pending = {
    ...fixtureTransactions[0],
    id: linkedId,
    accountId,
    categoryId,
    notes: 'Pending A',
    syncStatus: 'pending'
  };
  let saved = false;
  const request = jest.fn(async (url: unknown, init: RequestInit = {}) => {
    if (String(url).includes('/categories?'))
      return response({ items: [], nextCursor: null });
    if (init.method === 'PATCH') {
      saved = true;
      return response(
        mutation(summary(transactionId, { note: 'Frozen note', version: 3 }))
      );
    }
    return response(
      detail(
        summary(transactionId, saved ? { note: 'Frozen note', version: 3 } : {})
      )
    );
  });
  const factory = () =>
    createLiveCoreFinanceService({ baseUrl: 'https://api.test', request });
  try {
    await storage.db.runAsync(
      'INSERT INTO finance_transactions(id,payload,sync_status) VALUES(?,?,?)',
      linkedId,
      JSON.stringify(pending),
      'pending'
    );
    await expect(
      factory().updateTransaction(transactionId, frozenEditInput())
    ).resolves.toMatchObject({ value: { notes: 'Frozen note', version: 3 } });
    await expect(
      factory().getTransaction(transactionId)
    ).resolves.toMatchObject({ notes: 'Frozen note', version: 3 });
    expect(
      await storage.db.getFirstAsync(
        'SELECT id FROM finance_transactions WHERE id=?',
        transactionId
      )
    ).toBeNull();
    expect(
      request.mock.calls.filter(([, init]) => init?.method === 'PATCH')
    ).toHaveLength(1);
  } finally {
    storage.close();
  }
});

it.each(['cache write failure', 'owner change'] as const)(
  'retains the frozen acknowledgement identity and old cache after %s, then replays safely',
  async (failure) => {
    const storage = useEditStorage();
    const cached = {
      ...fixtureTransactions[0],
      id: transactionId,
      accountId,
      categoryId,
      notes: 'Old cached note',
      version: 2,
      syncStatus: 'synced'
    };
    const request = editRequest();
    const factory = () =>
      createLiveCoreFinanceService({ baseUrl: 'https://api.test', request });
    const runSql = storage.db.runAsync.getMockImplementation()!;
    let interrupt = true;
    try {
      await storage.db.runAsync(
        'INSERT INTO finance_transactions(id,payload,sync_status) VALUES(?,?,?)',
        transactionId,
        JSON.stringify(cached),
        'synced'
      );
      storage.db.runAsync.mockImplementation(async (sql, ...args) => {
        if (sql.startsWith('INSERT INTO finance_transactions') && interrupt) {
          interrupt = false;
          if (failure === 'cache write failure')
            throw new Error('fixture disk write failure');
          const result = await runSql(sql, ...args);
          registerLiveClerkBridge({
            ...bridge,
            getSession: async () => ({
              ...(await bridge.getSession())!,
              userId: 'user_owner-b'
            })
          });
          return result;
        }
        return runSql(sql, ...args);
      });
      await expect(
        factory().updateTransaction(transactionId, frozenEditInput())
      ).rejects.toMatchObject({ metadata: { uncertain: true } });
      const row = (await storage.db.getFirstAsync(
        'SELECT payload FROM finance_transactions WHERE id=?',
        transactionId
      )) as { payload: string };
      expect(JSON.parse(row.payload)).toMatchObject({
        notes: 'Old cached note',
        version: 2
      });
      expect(
        await storage.db.getFirstAsync('SELECT id FROM finance_drafts')
      ).not.toBeNull();
      registerLiveClerkBridge(bridge);
      await expect(
        factory().updateTransaction(transactionId, frozenEditInput())
      ).resolves.toMatchObject({ value: { notes: 'Frozen note', version: 3 } });
      const updated = (await storage.db.getFirstAsync(
        'SELECT payload FROM finance_transactions WHERE id=?',
        transactionId
      )) as { payload: string };
      expect(JSON.parse(updated.payload)).toMatchObject({
        notes: 'Frozen note',
        version: 3,
        syncStatus: 'synced'
      });
      const patches = request.mock.calls.filter(
        ([, init]) => init?.method === 'PATCH'
      );
      expect(patches).toHaveLength(2);
      expect(patches[1][1]?.body).toEqual(patches[0][1]?.body);
      expect(patches[1][1]?.headers).toEqual(patches[0][1]?.headers);
      expect(
        await storage.db.getFirstAsync('SELECT id FROM finance_drafts')
      ).toBeNull();
    } finally {
      registerLiveClerkBridge(bridge);
      storage.close();
    }
  }
);

it('settles an older frozen acknowledgement without downgrading a newer cached server version', async () => {
  const storage = useEditStorage();
  const cached = {
    ...fixtureTransactions[0],
    id: transactionId,
    accountId,
    categoryId,
    notes: 'Old cached note',
    version: 2,
    syncStatus: 'synced'
  };
  let loseResponse = true;
  const ordinaryRequest = editRequest().getMockImplementation()!;
  const request = jest.fn(async (url: unknown, init: RequestInit = {}) => {
    if (init.method === 'PATCH' && loseResponse)
      throw new TypeError('accepted response lost');
    return ordinaryRequest(url, init);
  });
  const factory = () =>
    createLiveCoreFinanceService({ baseUrl: 'https://api.test', request });
  try {
    await storage.db.runAsync(
      'INSERT INTO finance_transactions(id,payload,sync_status) VALUES(?,?,?)',
      transactionId,
      JSON.stringify(cached),
      'synced'
    );
    await storage.db.runAsync(
      'INSERT INTO finance_transactions(id,payload,sync_status) VALUES(?,?,?)',
      linkedId,
      JSON.stringify({
        ...cached,
        id: linkedId,
        notes: 'Pending A',
        syncStatus: 'pending'
      }),
      'pending'
    );
    await expect(
      factory().updateTransaction(transactionId, frozenEditInput())
    ).rejects.toMatchObject({ metadata: { uncertain: true } });
    await storage.db.runAsync(
      'UPDATE finance_transactions SET payload=? WHERE id=?',
      JSON.stringify({
        ...cached,
        notes: 'Later authoritative note',
        version: 4
      }),
      transactionId
    );
    loseResponse = false;
    await expect(
      factory().updateTransaction(transactionId, frozenEditInput())
    ).resolves.toMatchObject({ value: { notes: 'Frozen note', version: 3 } });
    await expect(
      factory().getTransaction(transactionId)
    ).resolves.toMatchObject({
      notes: 'Later authoritative note',
      version: 4,
      syncStatus: 'synced'
    });
    const patches = request.mock.calls.filter(
      ([, init]) => init?.method === 'PATCH'
    );
    expect(patches).toHaveLength(2);
    expect(patches[1][1]?.body).toEqual(patches[0][1]?.body);
    expect(patches[1][1]?.headers).toEqual(patches[0][1]?.headers);
    expect(
      await storage.db.getFirstAsync('SELECT id FROM finance_drafts')
    ).toBeNull();
  } finally {
    storage.close();
  }
});

it('continues ordinary applied bulk uploads beyond the nonterminal receipt budget', async () => {
  const storage = useEditStorage();
  const queue = new SyncRepository(storage.db as never);
  const batches: number[] = [];
  const request = jest.fn(async (url: unknown, init: RequestInit = {}) => {
    const path = String(url);
    if (path.includes('/me/devices'))
      return response({
        items: [{ id: '74000000-0000-4000-8000-000000000005', current: true }],
        nextCursor: null
      });
    if (path.includes('/sync/mutations')) {
      const mutations = (
        JSON.parse(String(init.body)) as {
          mutations: { operationId: string }[];
        }
      ).mutations;
      batches.push(mutations.length);
      return response({
        data: {
          receipts: mutations.map(({ operationId }) => ({
            operationId,
            status: 'applied'
          }))
        },
        meta: { requestId: 'bulk-receipt' }
      });
    }
    if (path.includes('/sync/delta'))
      return response({
        data: {
          domain: new URL(path).searchParams.get('domain'),
          changes: [],
          nextCursor: `cursor.${'a'.repeat(43)}`,
          hasMore: false
        },
        meta: { requestId: 'delta' }
      });
    if (path.includes('/conflicts?'))
      return response({
        data: { items: [], nextCursor: null },
        meta: { requestId: 'conflicts' }
      });
    return response({ data: {}, meta: { requestId: 'ack' } });
  });
  try {
    for (let index = 1; index <= 401; index++)
      await queue.enqueue({
        operationId: `75000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        domain: 'transactions',
        resourceType: 'transaction',
        schemaVersion: 1,
        dependsOn: [],
        operation: 'update',
        resourceId: `76000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        baseVersion: 1,
        payload: { note: 'Bulk fixture' }
      });
    for (const domain of ['accounts', 'categories', 'transactions'] as const)
      await queue.saveCursor(
        storage.db as never,
        domain,
        `cursor.${'a'.repeat(43)}`,
        null
      );
    await expect(
      createLiveCoreFinanceSync({
        database: storage.db as never,
        repository: queue,
        baseUrl: 'https://api.test',
        request,
        identity: async () => ({
          userId: 'user_owner-a',
          token: 'fixture-token',
          assertCurrent: async () => undefined
        })
      }).synchronize()
    ).resolves.toMatchObject({ uploaded: 401 });
    expect(batches).toEqual([100, 100, 100, 100, 1]);
    expect(await queue.ready()).toHaveLength(0);
  } finally {
    storage.close();
  }
});
