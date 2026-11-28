import { AppState } from 'react-native';
import { useAppShellStore } from '@/state/app-shell';
import {
  enrollIosShortcut,
  disableIosShortcut,
  receiveIosShortcut,
  readIosShortcutState,
  submitIosShortcut
} from './ios-shortcut-runtime.ios';
import { resetRuntimeIdentityData } from '@/storage/runtime-user-data-reset';
import { admitTrackingOwner } from '@/state/tracking-admission';
import { SmsImportQueue } from '@/storage/sms-import-queue';
import { StatefulSqlite } from '@/test-utils/stateful-sqlite';
import type { TransactionInput, Transaction } from '@/domain/core-finance';
import type { IosShortcutScope } from '../ios-shortcut-import';
import { resetFinancialProjections } from '@/storage/runtime-user-data-reset';
import {
  purgeIosShortcutOwner,
  resetIosShortcutReceipt
} from '@/storage/ios-shortcut-storage';

let mockDatabase: StatefulSqlite;
let mockAfterDispatch = async () => {};
let mockCompleteReceipt = false;
let mockBeforeReceiptWrite: (() => Promise<void>) | null = null;
let mockResetBoundary = async () => ({
  cutoff: 0,
  changed: false,
  generation: 0
});
jest.mock('@/storage/database', () => ({
  openDatabase: async () => mockDatabase,
  runExclusiveDatabaseTransaction: async (
    db: StatefulSqlite,
    op: (tx: StatefulSqlite) => Promise<void>
  ) => db.withExclusiveTransactionAsync(op)
}));

let mockAnchor = 'session-qa';
const mockSecure = new Map<string, string>();
let mockUuidCounter = 0;
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => {
    return mockSecure.get(key) ?? null;
  },
  setItemAsync: async (key: string, value: string) => {
    if (key.endsWith('receipt.v1') && mockBeforeReceiptWrite) {
      const beforeWrite = mockBeforeReceiptWrite;
      mockBeforeReceiptWrite = null;
      await beforeWrite();
    }
    mockSecure.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockSecure.delete(key);
  }
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, text: string) =>
    jest
      .requireActual('node:crypto')
      .createHash('sha256')
      .update(text)
      .digest('hex'),
  randomUUID: () =>
    `aaaaaaaa-1111-4111-8111-${String(++mockUuidCounter).padStart(12, '0')}`
}));
jest.mock('@/config/client-runtime', () => ({
  ...jest.requireActual('@/config/client-runtime'),
  resolveClientMode: () => 'live',
  isBenchmarkReadOnly: () => false
}));
jest.mock('../live/auth-service', () => ({
  readLogoutSessionAnchor: async () => mockAnchor
}));
jest.mock('../automatic-tracking-service', () => ({
  automaticTrackingService: {
    prepareImportSubmission:
      async (_owner: string, beforeDispatch: () => Promise<void>) =>
      async () => {
        await beforeDispatch();
        await mockAfterDispatch();
        return {
          id: '22222222-2222-4222-8222-222222222222',
          status: mockCompleteReceipt ? 'complete' : 'received',
          acceptedCount: mockCompleteReceipt ? 1 : 0,
          rejectedCount: 0,
          itemCount: 1,
          updatedAt: 1,
          completedAt: null
        };
      },
    listImportOutcomes: async () => {
      return [
        {
          itemId: 'accepted',
          status: 'accepted',
          transactionId: '33333333-3333-4333-8333-333333333333'
        }
      ];
    }
  }
}));
jest.mock('../mocks/core-finance-service', () => ({
  coreFinanceService: {
    listCategories: async () => [
      {
        id: '44444444-4444-4444-8444-444444444444',
        status: 'active',
        financialType: 'expense'
      }
    ],
    listAccounts: async () => [
      {
        id: '11111111-1111-4111-8111-111111111111',
        type: 'bank',
        currencyCode: 'SAR',
        status: 'active',
        automaticTrackingEnabled: true
      }
    ]
  }
}));
jest.mock('./ios-shortcut-ledger-http.ios', () => ({
  submitIosShortcutLedger: async (
    value: TransactionInput,
    _operationId: string,
    scope: IosShortcutScope
  ) => {
    await scope.assertCurrent();
    if (!(await scope.captureEnabled())) throw Error('disabled');
    await mockAfterDispatch();
    if (!mockCompleteReceipt) throw Error('ambiguous');
    return {
      value: {
        ...value,
        id: '33333333-3333-4333-8333-333333333333',
        source: 'platform_assisted',
        status: 'posted',
        syncStatus: 'synced',
        version: 1
      } as Transaction,
      affectedScopes: ['transactions.list']
    };
  }
}));
jest.mock('../financial-generation', () => ({
  reconcileFinancialReset: () => mockResetBoundary()
}));
const now = Date.parse('2026-11-16T12:00:00Z');
const input = (
  token: string,
  body = 'Purchase SAR 12.34 at QA SHOP card XX4242',
  receivedAt = now
) =>
  `masarifi://capture-ios?payload=${encodeURIComponent(JSON.stringify({ token, messageId: 'qa-001', sender: 'QA BANK', receivedAt: new Date(receivedAt).toISOString(), body }))}`;
beforeEach(async () => {
  mockDatabase = new StatefulSqlite(['sms_import_queue']);
  mockAfterDispatch = async () => {};
  mockCompleteReceipt = false;
  mockBeforeReceiptWrite = null;
  mockResetBoundary = async () => ({
    cutoff: 0,
    changed: false,
    generation: 0
  });
  jest.spyOn(Date, 'now').mockReturnValue(now);
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
    writable: true
  });
  mockSecure.clear();
  mockAnchor = 'session-qa';
  mockUuidCounter = 0;
  useAppShellStore.setState({
    session: { status: 'authenticated', userId: 'owner-qa' } as never,
    privacyLock: null
  });
  admitTrackingOwner('owner-qa');
  await resetRuntimeIdentityData({ kind: 'signed-out-preserve' });
});
afterEach(() => jest.restoreAllMocks());
test('legacy enrollment rotates and fences old identities even without retained queue fingerprints', async () => {
  const oldToken = await enrollIosShortcut();
  const slot = 'masarifi.iosShortcut.enrollment.v1';
  const legacy = JSON.parse(mockSecure.get(slot)!);
  delete legacy.ledgerProtocol;
  delete legacy.ledgerCutoverAt;
  mockSecure.set(slot, JSON.stringify(legacy));
  expect((await readIosShortcutState()).enabled).toBe(false);
  const token = await enrollIosShortcut();
  expect(token).not.toBe(oldToken);
  const boundary = JSON.parse(mockSecure.get(slot)!).ledgerCutoverAt;
  await disableIosShortcut();
  const reenabledToken = await enrollIosShortcut();
  expect(JSON.parse(mockSecure.get(slot)!).ledgerCutoverAt).toBe(boundary);
  jest.spyOn(Date, 'now').mockReturnValue(now + 70000);
  // The old decoder admitted timestamps up to one minute in the future.
  await receiveIosShortcut(input(reenabledToken, undefined, now + 50000));
  expect((await readIosShortcutState()).candidates).toHaveLength(0);
  await receiveIosShortcut(input(reenabledToken, undefined, now + 70000));
  expect((await readIosShortcutState()).candidates).toHaveLength(1);
  await receiveIosShortcut(input(oldToken, undefined, now + 70000));
  expect((await readIosShortcutState()).outcome).toBe('rejected');
});
test('concurrent receipt persistence and disable retain the receipt with consent revoked', async () => {
  const token = await enrollIosShortcut();
  await receiveIosShortcut(input(token));
  const capture = (await readIosShortcutState()).candidates[0];
  mockCompleteReceipt = true;
  let release!: () => void, reached!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    reached = resolve;
  });
  mockBeforeReceiptWrite = async () => {
    reached();
    await hold;
  };
  const saving = submitIosShortcut(
    capture.sourceItemKey,
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444444'
  );
  await entered;
  const disabling = disableIosShortcut();
  release();
  await saving;
  await disabling;
  expect(await readIosShortcutState()).toMatchObject({
    enabled: false,
    lastSuccessAt: now,
    lastTransactionId: '33333333-3333-4333-8333-333333333333'
  });
});
test('explicit owner cleanup removes enrollment and receipt, while financial reset preserves consent', async () => {
  const token = await enrollIosShortcut();
  await receiveIosShortcut(input(token));
  const capture = (await readIosShortcutState()).candidates[0];
  mockCompleteReceipt = true;
  await submitIosShortcut(
    capture.sourceItemKey,
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444444'
  );
  expect((await readIosShortcutState()).lastSuccessAt).toBe(now);
  await resetIosShortcutReceipt('owner-qa', () => {});
  expect(await readIosShortcutState()).toMatchObject({
    enabled: true,
    lastSuccessAt: null,
    lastTransactionId: null
  });
  await purgeIosShortcutOwner('owner-qa', () => {});
  expect(mockSecure.has('masarifi.iosShortcut.enrollment.v1')).toBe(false);
  expect(mockSecure.has('masarifi.iosShortcut.receipt.v1')).toBe(false);
  await expect(readIosShortcutState()).rejects.toThrow(
    'ios_shortcut_setup_required'
  );
  await receiveIosShortcut(input(token));
  const renewed = await enrollIosShortcut();
  expect(renewed).not.toBe(token);
  expect((await readIosShortcutState()).candidates).toHaveLength(0);
});
test('backgrounding after dispatch preserves the owned service receipt in the real queue', async () => {
  const token = await enrollIosShortcut();
  await receiveIosShortcut(input(token));
  const capture = (await readIosShortcutState()).candidates[0];
  mockCompleteReceipt = true;
  mockAfterDispatch = async () => {
    Object.defineProperty(AppState, 'currentState', {
      value: 'background',
      configurable: true,
      writable: true
    });
  };
  await expect(
    submitIosShortcut(
      capture.sourceItemKey,
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444444'
    )
  ).resolves.toMatchObject({ status: 'saved' });
  const queue = await new SmsImportQueue().load('owner-qa');
  expect(queue.pending).toHaveLength(0);
  expect(mockSecure.get('masarifi.iosShortcut.receipt.v1')).toContain(
    '33333333-3333-4333-8333-333333333333'
  );
});

test('a replay exposes the original immutable confirmation instead of inviting changed account/category choices', async () => {
  const token = await enrollIosShortcut();
  await receiveIosShortcut(input(token));
  const candidate = (await readIosShortcutState()).candidates[0];
  await expect(
    submitIosShortcut(
      candidate.sourceItemKey,
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444444'
    )
  ).resolves.toMatchObject({ status: 'queued' });
  await receiveIosShortcut(input(token));
  await expect(readIosShortcutState()).resolves.toMatchObject({
    confirmation: {
      sourceItemKey: candidate.sourceItemKey,
      accountId: '11111111-1111-4111-8111-111111111111',
      categoryId: '44444444-4444-4444-8444-444444444444',
      amountMinor: 1234,
      kind: 'expense'
    }
  });
});
test('a financial projection reset invalidates an already captured confirmation scope', async () => {
  const token = await enrollIosShortcut();
  await receiveIosShortcut(input(token));
  const capture = (await readIosShortcutState()).candidates[0];
  mockResetBoundary = async () => {
    resetFinancialProjections('owner-qa');
    return { cutoff: now - 10000, changed: true, generation: 1 };
  };
  await expect(
    submitIosShortcut(
      capture.sourceItemKey,
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444444'
    )
  ).rejects.toThrow();
  expect((await new SmsImportQueue().load('owner-qa')).pending).toHaveLength(0);
});
test('a registered local iOS input becomes a minimized candidate but does not claim activation or save', async () => {
  const token = await enrollIosShortcut();
  await receiveIosShortcut(input(token));
  const state = await readIosShortcutState();
  expect(state.candidates).toHaveLength(1);
  expect(state.candidates[0]).toMatchObject({
    amountMinor: 1234,
    kind: 'expense',
    currency: 'SAR'
  });
  expect(state.lastSuccessAt).toBeNull();
  expect(JSON.stringify(state.candidates)).not.toContain('4242');
  expect(JSON.stringify([...mockSecure.values()])).not.toContain('Purchase');
});
test('rejects wrong enrollment tokens and OTP before source storage or financial submission', async () => {
  const token = await enrollIosShortcut();
  await receiveIosShortcut(input('bbbbbbbb-1111-4111-8111-111111111111'));
  await receiveIosShortcut(input(token, 'OTP 123456 for purchase SAR12.34'));
  expect((await readIosShortcutState()).candidates).toHaveLength(0);
});
test('cold-start candidate survives restoring the same owner and is rejected for another owner', async () => {
  const token = await enrollIosShortcut();
  await receiveIosShortcut(input(token));
  await resetRuntimeIdentityData({ restoringOwnerId: 'owner-qa' });
  expect((await readIosShortcutState()).candidates).toHaveLength(1);
  useAppShellStore.setState({
    session: { status: 'authenticated', userId: 'owner-other' } as never
  });
  await expect(readIosShortcutState()).rejects.toThrow();
});
test('old shortcut cannot bind a new sign-in session even for the same owner', async () => {
  const token = await enrollIosShortcut();
  await receiveIosShortcut(input(token));
  mockAnchor = 'new-session';
  await expect(readIosShortcutState()).rejects.toThrow();
  await enrollIosShortcut();
  expect((await readIosShortcutState()).candidates).toHaveLength(0);
  await receiveIosShortcut(input(token));
  expect((await readIosShortcutState()).candidates).toHaveLength(0);
});
test('disabling revokes new input; expired staged input cannot be silently confirmed', async () => {
  const token = await enrollIosShortcut();
  await receiveIosShortcut(input(token));
  jest.spyOn(Date, 'now').mockReturnValue(now + 16 * 60000);
  expect((await readIosShortcutState()).candidates).toHaveLength(0);
  await disableIosShortcut();
  await receiveIosShortcut(input(token));
  expect(await readIosShortcutState()).toMatchObject({
    enabled: false,
    candidates: []
  });
});
test.each(['background', 'locked'])(
  'requires active unlocked review for %s state',
  async (state) => {
    await enrollIosShortcut();
    if (state === 'background')
      Object.defineProperty(AppState, 'currentState', {
        value: 'background',
        configurable: true,
        writable: true
      });
    else
      useAppShellStore.setState({
        privacyLock: { enabled: true, appLockStatus: 'locked' } as never
      });
    await expect(readIosShortcutState()).rejects.toThrow();
  }
);
