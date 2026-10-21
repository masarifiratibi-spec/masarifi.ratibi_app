import {
  emptyTransactionFilters,
  draftInputSchema,
  type Transaction
} from '@/domain/core-finance';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import * as database from '@/storage/database';
import { registerLiveClerkBridge, type LiveClerkBridge } from './auth-service';
import {
  createLiveCoreFinanceSync,
  createLiveLedgerService
} from './core-finance-service';

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
  const request = jest.fn(async () => response({ items: [], nextCursor: null, ledgerVersion: 0, requestId: 'one-capture' }));
  const service = createLiveLedgerService({ baseUrl: 'https://api.test', request, categoryIds: { prepare, toServer: (id) => id, toLocal: (id) => id } });
  await expect(service.listTransactions(emptyTransactionFilters)).resolves.toEqual({ items: [], nextCursor: null });
  expect(bridge.getToken).toHaveBeenCalledTimes(1);
  expect(bridge.getToken).toHaveBeenCalledWith({ skipCache: false });
  expect(prepare).toHaveBeenCalledTimes(1);
});

it('reads a ledger page containing the server account-opening source alongside a voice expense', async () => {
  const request = jest.fn(async () => response({
    items: [
      summary(linkedId, { kind: 'opening', source: 'account_opening', categoryId: null, amountMinor: 100000, currency: 'EGP' }),
      summary(transactionId, { source: 'voice', amountMinor: 1000, currency: 'EGP' })
    ],
    nextCursor: null, ledgerVersion: 4, requestId: 'opening-and-voice'
  }));
  const service = createLiveLedgerService({ baseUrl: 'https://inert.invalid', request });
  await expect(service.listTransactions(emptyTransactionFilters)).resolves.toMatchObject({
    items: [
      { id: linkedId, type: 'adjustment', source: 'adjustment', amountMinor: 100000, currencyCode: 'EGP' },
      { id: transactionId, type: 'expense', source: 'voice', amountMinor: 1000, currencyCode: 'EGP' }
    ]
  });
  expect(request).toHaveBeenCalledTimes(1);
});

it('reads account-opening detail without rejecting its persisted source', async () => {
  const opening = summary(linkedId, { kind: 'opening', source: 'account_opening', categoryId: null });
  const request = jest.fn(async () => response(detail(opening, [{
    id: '40000000-0000-4000-8000-000000000001', accountId, amountMinor: 1000,
    clearingState: 'confirmed', postingRole: 'opening', occurredAt
  }])));
  const service = createLiveLedgerService({ baseUrl: 'https://inert.invalid', request });
  await expect(service.getTransaction(linkedId)).resolves.toMatchObject({
    id: linkedId, type: 'adjustment', source: 'adjustment', amountMinor: 1000
  });
  expect(request).toHaveBeenCalledTimes(1);
});

it('rejects the account-opening source on a non-opening transaction', async () => {
  const request = jest.fn(async () => response({
    items: [summary(transactionId, { source: 'account_opening' })],
    nextCursor: null, ledgerVersion: 1, requestId: 'invalid-opening-source'
  }));
  const service = createLiveLedgerService({ baseUrl: 'https://inert.invalid', request });
  await expect(service.listTransactions(emptyTransactionFilters)).rejects.toMatchObject({ code: 'contract_mismatch' });
});

it('reads owner-local drafts without fetching an authentication token', async () => {
  bridge.getToken.mockClear();
  const open = jest.spyOn(database, 'openDatabase').mockResolvedValue({
    getFirstAsync: async () => null
  } as never);
  try {
    await expect(createLiveLedgerService().loadDraft('missing-draft')).resolves.toBeNull();
    expect(bridge.getToken).not.toHaveBeenCalled();
  } finally { open.mockRestore(); }
});

it('reads the complete owner-bound day across pages with no source filter and keeps only the newest version of a replayed row', async () => {
  const rows = Array.from({ length: 100 }, (_, index) => summary(`30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, {
    source: ['manual', 'voice', 'automatic', 'platform_assisted'][index % 4],
    kind: index % 2 ? 'income' : 'expense'
  }));
  const request = jest.fn(async (url: string, init: RequestInit) => {
    expect(init.method).toBe('GET');
    const query = new URL(url).searchParams;
    expect(query.get('from')).toBe('2026-09-07T21:00:00.000Z');
    expect(query.get('to')).toBe('2026-09-08T20:59:59.999Z');
    expect(query.get('limit')).toBe('100');
    expect(query.has('source')).toBe(false);
    expect(query.has('kind')).toBe(false);
    return response({ items: query.has('cursor') ? [
      { ...rows[0], version: 3, title: 'Latest committed version' },
      summary('30000000-0000-4000-8000-000000000101')
    ] : rows, nextCursor: query.has('cursor') ? null : 'next-page', ledgerVersion: 3, requestId: 'today-page' });
  });
  const service = createLiveLedgerService({ baseUrl: 'https://api.test', request: request as typeof fetch });
  const activity = await service.getHomeTodayActivity({ ...emptyTransactionFilters, periodStart: Date.parse('2026-09-07T21:00:00Z'), periodEnd: Date.parse('2026-09-08T20:59:59.999Z') });
  expect(activity).toHaveLength(101);
  expect(activity.find(({ transaction }) => transaction.id === rows[0].id)?.transaction.title).toBe('Latest committed version');
  expect(request).toHaveBeenCalledTimes(2);
});

it.each(['failed-page', 'repeated-cursor'] as const)('rejects %s instead of returning an incomplete daily list', async (failure) => {
  let page = 0;
  const request = jest.fn(async () => {
    if (page++ > 0 && failure === 'failed-page') return response({ error: { code: 'SERVICE_UNAVAILABLE' } }, 503);
    return response({ items: [summary()], nextCursor: 'same-cursor', ledgerVersion: 2, requestId: 'today-page' });
  });
  const service = createLiveLedgerService({ baseUrl: 'https://api.test', request });
  await expect(service.getHomeTodayActivity({ ...emptyTransactionFilters, periodStart: Date.parse('2026-09-07T21:00:00Z'), periodEnd: Date.parse('2026-09-08T20:59:59.999Z') })).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(2);
});

it('uses committed reversal postings when the original income is from an earlier day', async () => {
  const original = summary(transactionId, { kind: 'income', status: 'reversed', occurredAt: '2026-09-06T12:00:00Z' });
  const reversal = summary(linkedId, { kind: 'reversal', originalTransactionId: original.id });
  const request = jest.fn(async (url: string) => {
    if (url.includes('?')) return response({ items: [reversal], nextCursor: null, ledgerVersion: 2, requestId: 'today-page' });
    if (url.endsWith(linkedId)) return response(detail(reversal, [{ id: '40000000-0000-4000-8000-000000000002', accountId, amountMinor: -1000, clearingState: 'confirmed', postingRole: 'reversal', occurredAt }]));
    return response(detail(original, [{ id: '40000000-0000-4000-8000-000000000001', accountId, amountMinor: 1000, clearingState: 'confirmed', postingRole: 'destination', occurredAt: original.occurredAt }]));
  });
  const service = createLiveLedgerService({ baseUrl: 'https://api.test', request: request as typeof fetch });
  await expect(service.getHomeTodayActivity({ ...emptyTransactionFilters, periodStart: Date.parse('2026-09-07T21:00:00Z'), periodEnd: Date.parse('2026-09-08T20:59:59.999Z') })).resolves.toEqual([
    expect.objectContaining({ transaction: expect.objectContaining({ id: linkedId }), group: 'expense', sign: 'negative' })
  ]);
});

beforeEach(() => {
  jest.clearAllMocks();
  registerLiveClerkBridge(bridge);
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
    const prepare = async () => { prepared = true; };
    const request = jest.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({
        Authorization: 'Bearer owner-token',
        'Idempotency-Key': '90000000-0000-4000-8000-000000000009'
      });
      expect(JSON.parse(String(init.body))).toMatchObject({ categoryId });
      return response(mutation(summary(transactionId, { kind }), [{
        id: '40000000-0000-4000-8000-000000000001', accountId,
        amountMinor: kind === 'income' ? 1000 : -1000,
        clearingState: 'confirmed', postingRole: kind === 'income' ? 'destination' : 'source', occurredAt
      }]), 201);
    });
    const service = createLiveLedgerService({
      baseUrl: 'https://inert.invalid', request: request as typeof fetch,
      categoryIds: { prepare, toServer: () => { if (!prepared) throw new Error('category mapping unavailable'); return categoryId; }, toLocal: () => 'local-category' }
    });
    await expect(service.createTransaction({
      type: kind, amountMinor: 1000, currencyCode: 'SAR', accountId,
      categoryId: 'local-category', title: 'Isolated Manual fixture', occurredAt: Date.parse(occurredAt)
    }, '90000000-0000-4000-8000-000000000009')).resolves.toMatchObject({ value: { type: kind, categoryId: 'local-category' } });
    expect(bridge.getToken).toHaveBeenCalledTimes(1);
    expect(bridge.getToken).toHaveBeenCalledWith({ skipCache: true });
    expect(request).toHaveBeenCalledTimes(1);
  }
);

it('does not dispatch a Manual write when the owner changes during category preparation', async () => {
  const request = jest.fn();
  const service = createLiveLedgerService({ baseUrl: 'https://inert.invalid', request,
    categoryIds: { prepare: async () => { registerLiveClerkBridge({ ...bridge, getSession: async () => ({ ...(await bridge.getSession()), id: 'other-session', userId: 'other-owner' }) }); }, toServer: id => id, toLocal: id => id }
  });
  await expect(service.createTransaction({ type: 'expense', amountMinor: 1000,
    currencyCode: 'SAR', accountId, categoryId, title: 'Isolated fixture', occurredAt: Date.parse(occurredAt)
  }, '90000000-0000-4000-8000-000000000009')).rejects.toMatchObject({ code: 'session_expired' });
  expect(request).not.toHaveBeenCalled();
});

it('uses a newly fresh actor on an ordinary-write retry with the same operation ID', async () => {
  const headers: Record<string, string>[] = [];
  const request = jest.fn(async (_url: string, init: RequestInit) => {
    headers.push(init.headers as Record<string, string>);
    if (headers.length === 1) throw new TypeError('isolated network failure');
    return response(mutation(), 201);
  });
  const service = createLiveLedgerService({ baseUrl: 'https://inert.invalid', request: request as typeof fetch });
  const input = { type: 'expense' as const, amountMinor: 1000, currencyCode: 'SAR', accountId,
    categoryId, title: 'Isolated fixture', occurredAt: Date.parse(occurredAt) };
  bridge.getToken.mockResolvedValueOnce('attempt-a').mockResolvedValueOnce('attempt-b');
  await expect(service.createTransaction(input, '90000000-0000-4000-8000-000000000009')).rejects.toMatchObject({ code: 'provider_unavailable' });
  await expect(service.createTransaction(input, '90000000-0000-4000-8000-000000000009')).resolves.toMatchObject({ value: { id: transactionId } });
  expect(headers.map(header => header['Idempotency-Key'])).toEqual(['90000000-0000-4000-8000-000000000009', '90000000-0000-4000-8000-000000000009']);
  expect(headers.map(header => header.Authorization)).toEqual(['Bearer attempt-a', 'Bearer attempt-b']);
  expect(bridge.getToken.mock.calls).toEqual([[{ skipCache: true }], [{ skipCache: true }]]);
});

it.each([5000, -5000])('reads the account reversal sign from its %i minor-unit posting, without the original in the page', async (signedAmount) => {
  const reversal = summary(linkedId, { kind: 'reversal', amountMinor: 5000, originalTransactionId: transactionId });
  const request = jest.fn(async (url: string, init: RequestInit) => {
    expect(init.method).toBe('GET');
    if (url.includes('?')) return response({ items: [reversal], nextCursor: null, ledgerVersion: 2, requestId: 'account-page' });
    if (!url.endsWith(linkedId)) throw new Error('Unexpected original transaction lookup');
    return response(detail(reversal, [{ id: '40000000-0000-4000-8000-000000000002', accountId, amountMinor: signedAmount, clearingState: 'confirmed', postingRole: 'reversal', occurredAt }]));
  });
  const service = createLiveLedgerService({ baseUrl: 'https://api.test', request: request as typeof fetch });
  const page = await service.listTransactions({ ...emptyTransactionFilters, accountIds: [accountId] });
  expect(page.items).toEqual([expect.objectContaining({ id: linkedId, type: 'reversal', amountMinor: 5000, adjustmentSign: signedAmount > 0 ? 1 : -1 })]);
});

it('rejects a changed reversal detail instead of displaying a guessed account sign', async () => {
  const reversal = summary(linkedId, { kind: 'reversal', originalTransactionId: transactionId });
  const request = jest.fn(async (url: string) => url.includes('?')
    ? response({ items: [reversal], nextCursor: null, ledgerVersion: 2, requestId: 'account-page' })
    : response(detail({ ...reversal, version: 3 }, [{ id: '40000000-0000-4000-8000-000000000002', accountId, amountMinor: -1000, clearingState: 'confirmed', postingRole: 'reversal', occurredAt }])));
  const service = createLiveLedgerService({ baseUrl: 'https://api.test', request: request as typeof fetch });
  await expect(service.listTransactions({ ...emptyTransactionFilters, accountIds: [accountId] })).rejects.toMatchObject({ code: 'conflict' });
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
  const request = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    expect(prepared).toBe(true);
    expect(JSON.parse(init?.body as string)).toMatchObject({ categoryId: shoppingId });
    return response(mutation(summary(transactionId, { categoryId: shoppingId })), 201);
  });
  const service = createLiveLedgerService({
    baseUrl: 'https://api.test', request,
    categoryIds: {
      prepare: async () => { prepared = true; },
      toServer: (id) => id === 'shopping' ? shoppingId : id,
      toLocal: (id) => id === shoppingId ? 'shopping' : id
    }
  });
  await expect(service.createTransaction({
    type: 'expense', amountMinor: 2000, currencyCode: 'SAR', accountId,
    categoryId: 'shopping', title: 'Shopping', occurredAt: Date.parse(occurredAt)
  }, '90000000-0000-4000-8000-000000000099')).resolves.toMatchObject({
    value: { categoryId: 'shopping' }
  });
});

it.each(['income', 'expense'] as const)(
  'corrects a manual transaction to %s through one versioned PATCH',
  async (kind) => {
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
      init.method === 'PATCH'
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
      ([, init]) => init.method === 'PATCH'
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
  }
);

it('keeps multiline notes out of the single-line edit audit reason', async () => {
  const request = jest
    .fn()
    .mockImplementation(async (_url, init) =>
      init.method === 'PATCH'
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
  const patch = request.mock.calls.find(([, init]) => init.method === 'PATCH')!;
  expect(JSON.parse(patch[1].body)).toMatchObject({
    reason: 'Mobile edit',
    note: 'first\nsecond'
  });
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
    const request = jest
      .fn()
      .mockResolvedValue(
        response(
          detail(
            summary(transactionId, { kind: 'income', amountMinor: 5700 }),
            [
              {
                id: '40000000-0000-4000-8000-000000000001',
                accountId,
                amountMinor,
                clearingState: 'confirmed',
                postingRole,
                occurredAt
              }
            ]
          )
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
  const preparation = new Promise<void>((resolve) => { finishPreparation = () => { prepared = true; resolve(); }; });
  let requested!: () => void;
  const transportStarted = new Promise<void>((resolve) => { requested = resolve; });
  const request = jest.fn(async () => {
    requested();
    return response({ items: [summary()], nextCursor: null, ledgerVersion: 2, requestId: 'overlap' });
  });
  const service = createLiveLedgerService({
    baseUrl: 'https://inert.invalid', request,
    categoryIds: { prepare: () => preparation, toServer: id => id, toLocal: id => { expect(prepared).toBe(true); return id === categoryId ? 'mapped-category' : id; } }
  });
  let completed = false;
  const page = service.listTransactions(emptyTransactionFilters).then(value => { completed = true; return value; });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([transportStarted, new Promise(resolve => { timer = setTimeout(resolve, 1000); })]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(completed).toBe(false);
  } finally { clearTimeout(timer); finishPreparation(); }
  await expect(page).resolves.toMatchObject({ items: [{ categoryId: 'mapped-category' }] });
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

it('prepares category filters before transport and maps the response back to local IDs', async () => {
  let prepared = false;
  const request = jest.fn(async (url: string) => {
    expect(prepared).toBe(true);
    expect(new URL(url).searchParams.get('categoryId')).toBe(categoryId);
    return response({ items: [summary()], nextCursor: null, ledgerVersion: 2, requestId: 'category-filter' });
  });
  const service = createLiveLedgerService({ baseUrl: 'https://inert.invalid', request: request as typeof fetch, categoryIds: {
    prepare: async () => { prepared = true; },
    toServer: id => { expect(prepared).toBe(true); return id === 'local-category' ? categoryId : id; },
    toLocal: id => id === categoryId ? 'local-category' : id
  } });
  await expect(service.listTransactions({ ...emptyTransactionFilters, categoryIds: ['local-category'] })).resolves.toMatchObject({ items: [{ categoryId: 'local-category' }] });
});

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

it('uploads ready mutations before bootstrapping and applying owner-scoped deltas', async () => {
  const cursor = `cursor.${'a'.repeat(43)}`;
  const repository = {
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
            resourceId: transactionId
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
    null
  );
  expect(repository.mapId).toHaveBeenCalledWith(
    'transactions',
    'local-one',
    transactionId
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

it.each([false, true])('uses cached sync reads and fresh authentication only when a queued upload exists: %s', async (queued) => {
  const getToken = jest.fn(async ({ skipCache }: { skipCache: boolean }) => skipCache ? 'write-token' : 'read-token');
  registerLiveClerkBridge({ ...bridge, getToken });
  const operation = { operationId: '90000000-0000-4000-8000-000000000010', domain: 'transactions', resourceType: 'transaction', dependsOn: [], operation: 'create', resourceId: null, baseVersion: null, payload: { kind: 'expense' } };
  const repository = { recoverSending: async () => undefined, ready: async () => queued ? [operation] : [], cursor: async () => null, markSending: async () => undefined };
  const calls: { method?: string; authorization?: string; url: string }[] = [];
  const request = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method, authorization: (init?.headers as Record<string, string>).Authorization ?? (init?.headers as Record<string, string>).authorization });
    if (String(url).includes('/me/devices')) return response({ items: [{ id: '80000000-0000-4000-8000-000000000001', current: true }], nextCursor: null });
    return response({ error: { code: 'SERVICE_UNAVAILABLE' } }, 503);
  });
  await expect(createLiveCoreFinanceSync({ baseUrl: 'https://inert.invalid', request, repository: repository as never, adapter: {} as never }).synchronize()).rejects.toThrow();
  const syncCall = calls.find(call => call.url.includes('/sync/'));
  expect(syncCall).toMatchObject({ method: queued ? 'POST' : 'GET', authorization: queued ? 'Bearer write-token' : 'Bearer read-token' });
  expect(getToken.mock.calls).toEqual(queued ? [[{ skipCache: false }], [{ skipCache: true }]] : [[{ skipCache: false }]]);
});

it('resolves the device once per sync pass and refreshes it for the next owner', async () => {
  let ownerId = 'user_first';
  let deviceId = '80000000-0000-4000-8000-000000000001';
  let deviceReads = 0;
  const sent: { device: string; authorization: string }[] = [];
  const applied: string[] = [];
  const request = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/v1/me/devices') {
      deviceReads += 1;
      return response({ items: [{ id: deviceId, current: true }], nextCursor: null });
    }
    const headers = init?.headers as Record<string, string>;
    sent.push({ device: headers['X-Device-Id'], authorization: headers.Authorization });
    if (url.pathname === '/api/v1/sync/bootstrap') return response({
      data: { domains: [{ domain: url.searchParams.get('domains'), cursor: `cursor.${'a'.repeat(43)}`, items: [], hasMore: false, nextPage: null }] },
      meta: { requestId: 'bootstrap' }
    });
    if (url.pathname === '/api/v1/conflicts') return response({ data: { items: [], nextCursor: null }, meta: { requestId: 'conflicts' } });
    throw new Error(`Unexpected route ${url.pathname}`);
  });
  const coordinator = createLiveCoreFinanceSync({
    baseUrl: 'https://inert.invalid', request,
    repository: { recoverSending: async () => undefined, ready: async () => [], cursor: async () => null } as never,
    adapter: { applyBootstrap: async (domain: string) => { applied.push(domain); } } as never,
    identity: async () => {
      const captured = ownerId;
      return { userId: captured, token: captured, assertCurrent: async () => {
        if (ownerId !== captured) throw new Error('owner changed');
      } };
    }
  });
  await expect(coordinator.synchronize()).resolves.toEqual({ uploaded: 0, bootstrapped: 3, deltas: 0 });
  expect(deviceReads).toBe(1);
  expect(applied).toEqual(['accounts', 'categories', 'transactions']);
  expect(sent).toEqual(Array(4).fill({ device: '80000000-0000-4000-8000-000000000001', authorization: 'Bearer user_first' }));
  ownerId = 'user_second';
  deviceId = '80000000-0000-4000-8000-000000000002';
  await expect(coordinator.synchronize()).resolves.toEqual({ uploaded: 0, bootstrapped: 3, deltas: 0 });
  expect(deviceReads).toBe(2);
  expect(sent.slice(4)).toEqual(Array(4).fill({ device: '80000000-0000-4000-8000-000000000002', authorization: 'Bearer user_second' }));
});

it('does not send sync data when the owner changes during device resolution', async () => {
  let switched = false;
  const request = jest.fn(async (input: RequestInfo | URL) => {
    if (!String(input).includes('/api/v1/me/devices')) throw new Error('Sync must not be sent');
    switched = true;
    return response({ items: [{ id: '80000000-0000-4000-8000-000000000001', current: true }], nextCursor: null });
  });
  const coordinator = createLiveCoreFinanceSync({
    baseUrl: 'https://inert.invalid', request,
    repository: { recoverSending: async () => undefined, ready: async () => [], cursor: async () => null } as never,
    adapter: {} as never,
    identity: async () => ({ userId: 'user_first', token: 'first-token', assertCurrent: async () => {
      if (switched) throw new Error('owner changed');
    } })
  });
  await expect(coordinator.synchronize()).rejects.toThrow('owner changed');
  expect(request).toHaveBeenCalledTimes(1);
});

it('does not send a queued upload if identity changes during fresh write authentication', async () => {
  let switched = false;
  registerLiveClerkBridge({ ...bridge,
    getSession: async () => ({ id: switched ? 'session-next' : 'session-initial', userId: switched ? 'user_next' : 'user_initial', method: 'google', issuedAt: 1, expiresAt: 9999999999999 }),
    getToken: async ({ skipCache }) => { if (skipCache) switched = true; return 'token'; }
  });
  const repository = { recoverSending: async () => undefined, ready: async () => [{ operationId: '90000000-0000-4000-8000-000000000010', domain: 'transactions', resourceType: 'transaction', dependsOn: [], operation: 'create', resourceId: null, baseVersion: null, payload: {} }], markSending: async () => undefined };
  const request = jest.fn();
  await expect(createLiveCoreFinanceSync({ baseUrl: 'https://inert.invalid', request, repository: repository as never, adapter: {} as never }).synchronize()).rejects.toMatchObject({ code: 'session_expired' });
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
  const opening = jest.spyOn(database, 'openDatabase').mockImplementation(async owner => {
    if (!rows.has(owner!)) rows.set(owner!, new Map());
    const store = rows.get(owner!)!;
    return { getFirstAsync: async (_sql: string, id: string) => store.has(id) ? { payload: store.get(id) } : null,
      runAsync: async (_sql: string, id: string, payload: string) => { store.set(id, payload); return { changes: 1 }; }
    } as never;
  });
  const transaction = jest.spyOn(database, 'runExclusiveDatabaseTransaction').mockImplementation(async (db, action) => action(db));
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
