import { createIosShortcutLedgerSubmit } from './ios-shortcut-ledger-http.ios';
import type { TransactionInput } from '@/domain/core-finance';
import type { IosShortcutScope } from '../ios-shortcut-import';

let mockPrepare = async () => {};
let mockActor = {
  userId: 'qa',
  sessionId: 'sdk-qa',
  assertCurrent: async () => {}
};
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, value: string) =>
    jest
      .requireActual('node:crypto')
      .createHash('sha256')
      .update(value)
      .digest('hex')
}));
const mockSources: string[] = [];
jest.mock('../live/category-lifecycle-service', () => ({
  createLiveCategoryLifecycleService: (options: {
    assertActor(actor: typeof mockActor): Promise<void>;
  }) => ({
    prepareCategoryIds: async () => {
      await mockPrepare();
      await options.assertActor(mockActor);
    },
    serverCategoryId: (id: string) => id,
    localCategoryId: (id: string) => id
  })
}));
jest.mock('../live/core-finance-service', () => ({
  createLiveLedgerService: (options: {
    request: typeof fetch;
    assertActor(actor: typeof mockActor): Promise<void>;
    categoryIds: { prepare(): Promise<void> };
  }) => ({
    createTransaction: async (
      input: TransactionInput,
      operationId: string,
      source: string
    ) => {
      await options.categoryIds.prepare();
      await options.assertActor(mockActor);
      mockSources.push(source);
      await options.request('https://api.test/api/v1/transactions', {
        method: 'POST',
        headers: { 'Idempotency-Key': operationId },
        body: JSON.stringify({ ...input, source })
      });
      return {
        value: {
          ...input,
          id: operationId,
          syncStatus: 'synced',
          status: 'posted',
          source
        },
        affectedScopes: ['transactions.list']
      };
    }
  })
}));
const input: TransactionInput = {
  type: 'expense',
  amountMinor: 1234,
  currencyCode: 'SAR',
  accountId: 'account-qa',
  categoryId: 'category-qa',
  title: 'Message transaction',
  occurredAt: 1
};
beforeEach(() => {
  mockPrepare = async () => {};
  mockSources.length = 0;
  mockActor = {
    userId: 'qa',
    sessionId: 'sdk-qa',
    assertCurrent: async () => {}
  };
});
function scope(trace: string[], label = 'qa') {
  let enabled = true,
    current = true;
  return {
    value: {
      ownerId: label,
      enrollmentId: label,
      sessionBinding: jest
        .requireActual('node:crypto')
        .createHash('sha256')
        .update(`sdk-${label}`)
        .digest('hex') as string,
      assertCurrent: async () => {
        trace.push(`owner-${label}`);
        if (!current) throw Error('owner_changed');
      },
      captureEnabled: async () => {
        trace.push(`consent-${label}`);
        return enabled;
      }
    } satisfies IosShortcutScope,
    disable: () => {
      enabled = false;
    },
    changeOwner: () => {
      current = false;
    }
  };
}
it('checks capture permission after ordinary provider preparation immediately before transport', async () => {
  const trace: string[] = [];
  const x = scope(trace);
  const transport = jest.fn(async () => {
    trace.push('transport');
    return { ok: true, status: 201 } as Response;
  });
  mockPrepare = async () => {
    trace.push('provider-prepared');
  };
  const result = await createIosShortcutLedgerSubmit(transport)(
    input,
    'operation-qa',
    x.value
  );
  const sentAt = trace.indexOf('transport');
  expect(trace[sentAt - 1]).toBe('consent-qa');
  expect(trace.indexOf('provider-prepared')).toBeLessThan(sentAt);
  expect(result.value.syncStatus).toBe('synced');
  expect(mockSources).toEqual(['platform_assisted']);
});
it('does not send if consent is revoked during awaited provider preparation', async () => {
  const x = scope([]);
  const transport = jest.fn();
  mockPrepare = async () => {
    x.disable();
  };
  await expect(
    createIosShortcutLedgerSubmit(transport)(input, 'operation-qa', x.value)
  ).rejects.toThrow('disabled');
  expect(transport).not.toHaveBeenCalled();
});
it('does not send to a changed owner after provider preparation', async () => {
  const x = scope([]);
  const transport = jest.fn();
  mockPrepare = async () => {
    x.changeOwner();
  };
  await expect(
    createIosShortcutLedgerSubmit(transport)(input, 'operation-qa', x.value)
  ).rejects.toThrow('owner_changed');
  expect(transport).not.toHaveBeenCalled();
});
it('retains a dispatched server receipt when new capture is disabled afterward', async () => {
  const x = scope([]);
  const transport = jest.fn(async () => {
    x.disable();
    return { ok: true, status: 201 } as Response;
  });
  await expect(
    createIosShortcutLedgerSubmit(transport)(input, 'operation-qa', x.value)
  ).resolves.toMatchObject({ value: { syncStatus: 'synced' } });
});
it('serializes concurrent scopes without borrowing another confirmation permission', async () => {
  const trace: string[] = [];
  const a = scope(trace, 'a'),
    b = scope(trace, 'b');
  const sent: string[][] = [];
  let release!: () => void, reached!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    reached = resolve;
  });
  let first = true;
  mockPrepare = async () => {
    mockActor = {
      userId: first ? 'a' : 'b',
      sessionId: first ? 'sdk-a' : 'sdk-b',
      assertCurrent: async () => {}
    };
    if (first) {
      first = false;
      reached();
      await hold;
    }
  };
  const transport = jest.fn(
    async (_url: RequestInfo | URL, init?: RequestInit) => {
      sent.push([
        String((init?.headers as Record<string, string>)['Idempotency-Key']),
        trace.at(-1)!
      ]);
      return { ok: true, status: 201 } as Response;
    }
  );
  const submit = createIosShortcutLedgerSubmit(transport);
  const savingA = submit(input, 'operation-a', a.value);
  await entered;
  const savingB = submit(input, 'operation-b', b.value);
  release();
  await Promise.all([savingA, savingB]);
  expect(sent).toEqual([
    ['operation-a', 'consent-a'],
    ['operation-b', 'consent-b']
  ]);
});
it.each([
  ['other-owner', 'sdk-qa'],
  ['qa', 'other-session']
])(
  'rejects captured bearer actor %s / %s even when current scope is valid',
  async (userId, sessionId) => {
    const x = scope([]);
    const transport = jest.fn();
    mockActor = { userId, sessionId, assertCurrent: async () => {} };
    await expect(
      createIosShortcutLedgerSubmit(transport)(input, 'operation-qa', x.value)
    ).rejects.toMatchObject({ code: 'session_expired' });
    expect(transport).not.toHaveBeenCalled();
  }
);
