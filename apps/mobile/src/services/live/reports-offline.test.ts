import { createLiveReportsService } from './reports-service';
import { registerLiveClerkBridge } from './auth-service';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import { createLocalCoreFinanceService } from '@/services/core-finance-runtime';
import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions
} from '@/test-utils/core-finance-fixtures';
import { readRecoveryNetwork } from '@/services/platform/read-recovery-network';
import type { Transaction } from '@/domain/core-finance';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined)
}));

const account = { ...fixtureAccounts[0], id: 'account-A', currencyCode: 'SAR' };
const other = { ...fixtureAccounts[0], id: 'account-B', currencyCode: 'USD' };
const input = {
  kind: 'monthly' as const,
  anchorDate: '2026-10-29' as const,
  currencyCode: 'SAR',
  timeZone: 'Asia/Riyadh',
  monthStartDay: 25,
  accountIds: [account.id]
};
let activeOwner = 'owner-A';
const tx = (
  id: string,
  amountMinor: number,
  changes: Partial<Transaction> = {}
): Transaction => ({
  ...fixtureTransactions[0],
  id,
  version: 1,
  type: 'expense',
  accountId: account.id,
  destinationAccountId: null,
  currencyCode: 'SAR',
  amountMinor,
  feeMinor: 0,
  occurredAt: Date.parse('2026-10-26T12:00:00+03:00'),
  updatedAt: 20,
  status: 'posted',
  reviewStatus: 'none',
  syncStatus: 'synced',
  originalTransactionId: null,
  ...changes
});
beforeEach(() => {
  activeOwner = 'owner-A';
  registerLiveClerkBridge({
    getSession: async () => ({
      id: 'session',
      userId: activeOwner,
      method: 'google',
      issuedAt: 1,
      expiresAt: 9999999999999
    }),
    getToken: jest.fn(),
    startPhone: jest.fn(),
    verifyPhone: jest.fn(),
    resendPhone: jest.fn(),
    signInWithGoogle: jest.fn(),
    reverifyConflict: jest.fn(),
    signOut: jest.fn()
  });
  jest.replaceProperty(readRecoveryNetwork, 'available', true);
  jest.spyOn(readRecoveryNetwork, 'isOnline').mockResolvedValue(false);
});
afterEach(() => {
  jest.restoreAllMocks();
});
function create(transactions: Transaction[]) {
  const finance = createLocalCoreFinanceService(
    new CoreFinanceRepository({
      accounts: [account, other],
      categories: fixtureCategories,
      transactions
    })
  );
  const request = jest.fn<Promise<Response>, Parameters<typeof fetch>>(
    async () => {
      throw Error('Network must not be needed offline');
    }
  );
  const reports = createLiveReportsService({
    baseUrl: 'https://inert.invalid',
    token: async () => 'inert',
    request,
    finance
  });
  return { finance, request, reports };
}

it('calculates offline reports from eligible owner-local records, respecting cycle, account, currency and pending state', async () => {
  const { reports, request, finance } = create([
    tx('posted', 1000),
    tx('local-posted', 1500, { syncStatus: 'pending' }),
    tx('outside', 2000, {
      occurredAt: Date.parse('2026-10-24T23:59:59+03:00')
    }),
    tx('other-account', 9900, { accountId: other.id, currencyCode: 'USD' }),
    tx('conflict', 700, { syncStatus: 'conflict' })
  ]);
  const write = jest.spyOn(finance, 'createTransaction');
  const report = await reports.getReport(input);
  expect(report.period).toMatchObject({
    startDate: '2026-10-25',
    endDate: '2026-11-24',
    timeZone: 'Asia/Riyadh'
  });
  expect(report.summary.expense.value?.minorUnits).toBe(2500);
  expect(report.dataState).toBe('offline');
  expect(report.localData).toMatchObject({
    pendingSyncCount: 1,
    excludedCount: 1,
    empty: false
  });
  expect(
    report.insights.some((insight) => insight.kind === 'budget_performance')
  ).toBe(false);
  expect(request).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
});
it('does not turn unavailable foreign-currency totals into zeroes or remove an unknown account filter', async () => {
  const { reports, request } = create([
    tx('foreign', 5000, { accountId: other.id, currencyCode: 'USD' })
  ]);
  const report = await reports.getReport({ ...input, accountIds: [] });
  expect(report.summary.expense.value).toBeNull();
  expect(report.completenessReasons).toContain('missing_rate');
  await expect(
    reports.getReport({ ...input, accountIds: ['unknown-account'] })
  ).rejects.toMatchObject({ code: 'report_account_scope_unavailable' });
  expect(request).not.toHaveBeenCalled();
});
it('deduplicates canonical local transaction identities and never adds local totals to the recovered server total', async () => {
  const { reports, request, finance } = create([]);
  jest
    .spyOn(finance, 'listTransactions')
    .mockResolvedValueOnce({ items: [tx('same', 1000)], nextCursor: 'next' })
    .mockResolvedValueOnce({
      items: [tx('same', 1500, { version: 2, updatedAt: 30 })],
      nextCursor: null
    });
  expect(
    (await reports.getReport(input)).summary.expense.value?.minorUnits
  ).toBe(1500);
  jest.mocked(readRecoveryNetwork.isOnline).mockResolvedValue(true);
  request.mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          metadata: {
            schemaVersion: 1,
            generatedAt: '2026-10-29T12:00:00Z',
            ledgerVersion: 7,
            reportType: 'financial_summary',
            period: 'monthly',
            range: {
              startDate: '2026-10-25',
              endDate: '2026-11-24',
              timezone: 'Asia/Riyadh'
            },
            dataState: 'complete',
            evidence: []
          },
          summaries: [
            {
              income: { amountMinor: 0, currency: 'SAR' },
              expense: { amountMinor: 3000, currency: 'SAR' },
              netCashFlow: { amountMinor: -3000, currency: 'SAR' },
              savingsRateBasisPoints: 0,
              transactionCount: 3
            }
          ],
          breakdowns: []
        })
      )
  );
  expect(
    (await reports.getReport(input)).summary.expense.value?.minorUnits
  ).toBe(3000);
  expect(request).toHaveBeenCalledTimes(1);
});
it('rejects an owner change during an offline read and labels a valid empty local ledger honestly', async () => {
  const { reports, finance } = create([]);
  const empty = await reports.getReport(input);
  expect(empty.localData?.empty).toBe(true);
  expect(empty.summary.expense.value?.minorUnits).toBe(0);
  jest.spyOn(finance, 'listTransactions').mockImplementationOnce(async () => {
    activeOwner = 'owner-B';
    return { items: [tx('foreign-owner', 9000)], nextCursor: null };
  });
  await expect(reports.getReport(input)).rejects.toMatchObject({
    code: 'session_expired'
  });
});
