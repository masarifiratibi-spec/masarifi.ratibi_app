import React, { useState } from 'react';
import { View } from 'react-native';
import {
  act,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react-native';
import { QueryClient } from '@tanstack/react-query';
import type { HomeSummary, Transaction, TransactionFilterSet as MockTransactionFilterSet } from '@/domain/core-finance';
import { FoundationProviders } from '@/state/FoundationProviders';
import { useCoreFinanceViewState } from '@/state/core-finance-view-state';
import { usePreferenceStore } from '@/state/preferences';
import { changeLocale, translate } from '@/localization/i18n';
import { HomeScreen } from '@/features/home/HomeScreen';
import { TransactionListScreen } from '@/features/transactions/TransactionListScreen';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { voiceAnalyzerService } from '@/services/voice-analyzer-service';
import {
  VoiceBatchLocalTerminalError,
  type VoiceBatchResult
} from '@/services/live/voice-batch-api-service';
import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { emptyTransactionFilters } from '@/domain/core-finance';
import {
  fixtureAccounts,
  fixtureCategories,
  makeTransaction
} from '@/test-utils/core-finance-fixtures';
import { useVoiceBatches } from './useVoiceBatches';
import { useAppShellStore } from '@/state/app-shell';

// Only external receipts/reads and unused recording controls are replaced.
// The batch hook, query invalidation, queries and both rendered screens are real.
jest.mock('@/services/voice-analyzer-service', () => ({
  voiceAnalyzerService: {}
}));
jest.mock('@/services/mocks/core-finance-service', () => ({
  coreFinanceService: {
    getHomeSummary: jest.fn(),
    getHomeTodayActivity: (...args: unknown[]) => {
      const { readHomeTodayActivity } = jest.requireActual<typeof import('@/services/home-today-activity')>('@/services/home-today-activity');
      const { coreFinanceService } = jest.requireMock('@/services/mocks/core-finance-service');
      return readHomeTodayActivity({
        filters: args[0] as MockTransactionFilterSet,
        signal: args[1] as AbortSignal | undefined,
        listTransactions: coreFinanceService.listTransactions,
        readSignedEffect: async () => null
      });
    },
    listTransactions: jest.fn(),
    listAccounts: jest.fn(),
    listCategories: jest.fn()
  }
}));
jest.mock('@/features/voice/useVoiceCapture', () => ({
  useVoiceCapture: () => ({
    session: { state: 'ready', durationMs: 0, errorCode: null },
    automatic: false,
    batches: { uncertain: false, processing: false }
  })
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(callback, [callback]);
  }
}));
jest.mock('@/services/live/clerk-provider', () => ({
  getLiveClerkDisplayName: () => null
}));
jest.mock('@/features/settings/settings-queries', () => ({
  useSettingsProfile: () => ({ data: { name: 'Diagnostic', email: null } })
}));

const capture = '11111111-1111-4111-8111-111111111111';
const transactionId = '33333333-3333-4333-8333-333333333333';
const completed: VoiceBatchResult = {
  sessionId: '22222222-2222-4222-8222-222222222222',
  batchId: '44444444-4444-4444-8444-444444444444',
  status: 'completed',
  transactionIds: [transactionId],
  addedCount: 1,
  ledgerVersion: 1
};
const transaction = (): Transaction =>
  makeTransaction(2, {
    id: transactionId,
    title: 'Diagnostic voice breakfast',
    type: 'expense',
    source: 'voice',
    occurredAt: Date.now(),
    amountMinor: 2500,
    accountId: fixtureAccounts[0]!.id,
    status: 'posted'
  });
const summary = (items: Transaction[]): HomeSummary => ({
  totalBalanceMinor: items.length ? -2500 : 0,
  currencyCode: 'SAR',
  isEstimated: false,
  components: [],
  excludedAccountIds: [],
  periodIncomeMinor: 0,
  periodExpenseMinor: items.length ? 2500 : 0,
  activeAccountCount: 1,
  recentTransactions: items,
  reviewCount: 0,
  pendingSyncCount: 0,
  dataState: 'ready'
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function mount(transactionsVisible = true) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        gcTime: Infinity
      }
    }
  });
  let batches!: ReturnType<typeof useVoiceBatches>;
  let showTransactions!: () => void;
  function Harness() {
    const [visible, setVisible] = useState(transactionsVisible);
    showTransactions = () => setVisible(true);
    batches = useVoiceBatches('diagnostic-owner');
    return (
      <>
        <HomeScreen />
        {visible ? (
          <View testID="diagnostic-transactions">
            <TransactionListScreen />
          </View>
        ) : null}
      </>
    );
  }
  const view = render(
    <FoundationProviders client={client}>
      <Harness />
    </FoundationProviders>
  );
  return {
    client,
    get batches() {
      return batches;
    },
    showTransactions: () => showTransactions(),
    close() {
      view.unmount();
      client.clear();
    }
  };
}
beforeEach(() => {
  jest.clearAllMocks();
  changeLocale('en');
  usePreferenceStore.setState({
    locale: 'en',
    direction: 'ltr',
    hydrated: true,
    baseCurrencyCode: 'SAR',
    timeZone: 'Asia/Riyadh',
    hideBalances: false
  });
  useCoreFinanceViewState.getState().clearFilters();
  useCoreFinanceViewState.getState().selectAccount(null);
  jest
    .mocked(coreFinanceService.listAccounts)
    .mockResolvedValue(fixtureAccounts);
  jest
    .mocked(coreFinanceService.listCategories)
    .mockResolvedValue(fixtureCategories);
  Object.assign(voiceAnalyzerService, {
    recoverBatches: async () => ({
      results: [],
      pendingIds: [],
      uncertain: false,
      localFailure: false
    }),
    runBatch: async () => completed,
    pauseBatches: () => undefined
  });
});

it('retries failed finance reads when recovering the same committed receipt', async () => {
  useAppShellStore.setState({
    session: {
      status: 'authenticated',
      userId: 'diagnostic-owner',
      method: 'phone',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
      restoration: 'restored'
    }
  });
  let saved = false;
  let unavailable = false;
  jest
    .mocked(coreFinanceService.getHomeSummary)
    .mockImplementation(async () => {
      if (unavailable) throw new Error('offline read');
      return summary(saved ? [transaction()] : []);
    });
  jest
    .mocked(coreFinanceService.listTransactions)
    .mockImplementation(async () => {
      if (unavailable) throw new Error('offline read');
      return { items: saved ? [transaction()] : [], nextCursor: null };
    });
  const view = mount();
  try {
    await waitFor(() =>
      expect(screen.getByTestId('home-horizon')).toBeTruthy()
    );
    saved = true;
    unavailable = true;
    await act(async () => view.batches.submit(capture));
    await waitFor(() =>
      expect(view.batches.results[0]?.transactionIds).toEqual([transactionId])
    );
    await waitFor(() =>
      expect(
        view.client
          .getQueryCache()
          .findAll({ queryKey: ['core-finance', 'home'] })
          .some((query) => query.state.status === 'error')
      ).toBe(true)
    );
    unavailable = false;
    Object.assign(voiceAnalyzerService, {
      recoverBatches: async () => ({
        results: [completed],
        pendingIds: [],
        uncertain: false,
        localFailure: false
      })
    });
    await act(async () => view.batches.recover());
    await waitFor(() =>
      expect(
        screen.getByTestId(`home-transaction-row-${transactionId}`)
      ).toBeTruthy()
    );
    expect(
      within(screen.getByTestId('diagnostic-transactions')).getAllByText(
        'Diagnostic voice breakfast'
      )
    ).toHaveLength(1);
  } finally {
    view.close();
  }
});

it.each(['en', 'ar'] as const)(
  'shows a real nonposting receipt on both screens in %s without inventing a saved row',
  async (locale) => {
    changeLocale(locale);
    usePreferenceStore.setState({
      locale,
      direction: locale === 'ar' ? 'rtl' : 'ltr'
    });
    useAppShellStore.setState({
      session: {
        status: 'authenticated',
        userId: 'diagnostic-owner',
        method: 'phone',
        issuedAt: Date.now(),
        expiresAt: Date.now() + 600000,
        restoration: 'restored'
      }
    });
    jest
      .mocked(coreFinanceService.getHomeSummary)
      .mockResolvedValue(summary([]));
    jest
      .mocked(coreFinanceService.listTransactions)
      .mockResolvedValue({ items: [], nextCursor: null });
    Object.assign(voiceAnalyzerService, {
      runBatch: async () => ({
        ...completed,
        transactionIds: [],
        addedCount: 0,
        ledgerVersion: 0,
        analysis: {
          mode: 'analysis_only',
          persisted: false,
          expiresAt: new Date(Date.now() + 900000).toISOString(),
          events: [
            {
              ordinal: 0,
              kind: 'expense',
              amountMinor: 2500,
              currency: 'SAR',
              accountId: fixtureAccounts[0]!.id,
              categoryId: null,
              title: 'Unsaved voice breakfast',
              merchant: null,
              occurredAt: new Date().toISOString()
            }
          ]
        }
      })
    });
    const view = mount();
    try {
      await waitFor(() =>
        expect(screen.getByTestId('home-horizon')).toBeTruthy()
      );
      await act(async () => view.batches.submit(capture));
      await waitFor(() =>
        expect(screen.getAllByText('Unsaved voice breakfast')).toHaveLength(2)
      );
      expect(
        within(screen.getByTestId('diagnostic-transactions')).getByText(
          'Unsaved voice breakfast'
        )
      ).toBeTruthy();
      expect(
        screen.queryByTestId(`home-transaction-row-${transactionId}`)
      ).toBeNull();
      expect(
        screen.getAllByText(
          locale === 'en' ? 'Analyzed — not saved' : 'تم التحليل — لم يتم الحفظ'
        )
      ).toHaveLength(2);
    } finally {
      view.close();
      useAppShellStore.setState({ session: null });
    }
  }
);

it('renders a financial receipt only through normal saved components without refresh or duplicate representation', async () => {
  let items: Transaction[] = [];
  jest
    .mocked(coreFinanceService.getHomeSummary)
    .mockImplementation(async () => summary(items));
  jest
    .mocked(coreFinanceService.listTransactions)
    .mockImplementation(async () => ({ items, nextCursor: null }));
  const view = mount();
  try {
    await waitFor(() =>
      expect(screen.getByTestId('home-horizon')).toBeTruthy()
    );
    await waitFor(() =>
      expect(coreFinanceService.listTransactions).toHaveBeenCalled()
    );
    expect(
      screen.queryByTestId(`home-transaction-row-${transactionId}`)
    ).toBeNull();
    expect(completed.analysis).toBeUndefined();
    items = [transaction()];
    await act(async () => view.batches.submit(capture));
    await waitFor(() =>
      expect(
        screen.getByTestId(`home-transaction-row-${transactionId}`)
      ).toBeTruthy()
    );
    await waitFor(() =>
      expect(
        within(screen.getByTestId('diagnostic-transactions')).queryByText(
          'Diagnostic voice breakfast'
        )
      ).toBeTruthy()
    );
    const reads = jest.mocked(coreFinanceService.listTransactions).mock.calls
      .length;
    await act(async () => view.batches.recover());
    Object.assign(voiceAnalyzerService, {
      recoverBatches: async () => ({
        results: [completed],
        pendingIds: [],
        uncertain: false,
        localFailure: false
      })
    });
    await act(async () => view.batches.recover());
    expect(coreFinanceService.listTransactions).toHaveBeenCalledTimes(reads);
    expect(
      screen.getAllByTestId(`home-transaction-row-${transactionId}`)
    ).toHaveLength(1);
    expect(
      within(screen.getByTestId('diagnostic-transactions')).getAllByText(
        'Diagnostic voice breakfast'
      )
    ).toHaveLength(1);
    expect(screen.queryByText('Analyzed — not saved')).toBeNull();
    expect(screen.queryByText('Review')).toBeNull();
    expect(screen.queryByText('Confirm')).toBeNull();
    const refreshed = view.client.getQueriesData<HomeSummary>({
      queryKey: ['core-finance', 'home']
    });
    expect(
      refreshed.some(
        ([, data]) =>
          data?.totalBalanceMinor === -2500 && data?.periodExpenseMinor === 2500
      )
    ).toBe(true);
  } finally {
    view.close();
  }
});

it('refetches after an accepted receipt races initial pre-commit Home and Transactions reads', async () => {
  const oldHome = deferred<HomeSummary>();
  const oldPage = deferred<{ items: Transaction[]; nextCursor: null }>();
  jest
    .mocked(coreFinanceService.getHomeSummary)
    .mockImplementation(async () => summary([transaction()]))
    .mockImplementationOnce(() => oldHome.promise);
  jest
    .mocked(coreFinanceService.listTransactions)
    .mockResolvedValue({ items: [transaction()], nextCursor: null })
    .mockImplementationOnce(() => oldPage.promise);
  const view = mount();
  try {
    await waitFor(() =>
      expect(coreFinanceService.listTransactions).toHaveBeenCalled()
    );
    await act(async () => view.batches.submit(capture));
    expect(view.batches.latest?.transactionIds).toEqual([transactionId]);
    await act(async () => {
      oldHome.resolve(summary([]));
      oldPage.resolve({ items: [], nextCursor: null });
    });
    await waitFor(() =>
      expect(
        screen.queryByTestId(`home-transaction-row-${transactionId}`)
      ).toBeTruthy()
    );
    await waitFor(() =>
      expect(
        within(screen.getByTestId('diagnostic-transactions')).queryByText(
          'Diagnostic voice breakfast'
        )
      ).toBeTruthy()
    );
  } finally {
    view.close();
  }
});

it.each(['admission-rejected', 'completed-with-no-postings'] as const)(
  'does not invent a transaction for %s',
  async (outcome) => {
    jest
      .mocked(coreFinanceService.getHomeSummary)
      .mockResolvedValue(summary([]));
    jest
      .mocked(coreFinanceService.listTransactions)
      .mockResolvedValue({ items: [], nextCursor: null });
    Object.assign(voiceAnalyzerService, {
      runBatch: async () => {
        if (outcome === 'admission-rejected')
          throw new VoiceBatchLocalTerminalError('failed');
        return {
          ...completed,
          transactionIds: [],
          addedCount: 0,
          ledgerVersion: 0
        };
      }
    });
    const view = mount();
    try {
      await waitFor(() =>
        expect(screen.getByTestId('home-horizon')).toBeTruthy()
      );
      await waitFor(() =>
        expect(coreFinanceService.listTransactions).toHaveBeenCalledTimes(2)
      );
      const homeReads = jest.mocked(coreFinanceService.getHomeSummary).mock
        .calls.length;
      await act(async () => view.batches.submit(capture));
      expect(
        screen.queryByTestId(`home-transaction-row-${transactionId}`)
      ).toBeNull();
      expect(
        within(screen.getByTestId('diagnostic-transactions')).queryByText(
          'Diagnostic voice breakfast'
        )
      ).toBeNull();
      expect(coreFinanceService.listTransactions).toHaveBeenCalledTimes(2);
      expect(coreFinanceService.getHomeSummary).toHaveBeenCalledTimes(
        homeReads
      );
      expect(screen.queryByText('Analyzed — not saved')).toBeNull();
      expect(
        view.client
          .getQueriesData({ queryKey: ['core-finance', 'transactions'] })
          .every(([, data]) => !JSON.stringify(data).includes(transactionId))
      ).toBe(true);
      expect(
        outcome === 'admission-rejected'
          ? view.batches.localFailure
          : view.batches.latest?.addedCount === 0
      ).toBe(true);
    } finally {
      view.close();
    }
  }
);

it('marks an inactive Transactions cache stale so navigation shows the receipt without refresh', async () => {
  let items: Transaction[] = [];
  jest
    .mocked(coreFinanceService.getHomeSummary)
    .mockImplementation(async () => summary(items));
  jest
    .mocked(coreFinanceService.listTransactions)
    .mockImplementation(async () => ({ items, nextCursor: null }));
  const view = mount(false);
  try {
    await waitFor(() =>
      expect(screen.getByTestId('home-horizon')).toBeTruthy()
    );
    view.client.setQueryData(
      coreFinanceKeys.transactionPages(emptyTransactionFilters),
      { pages: [{ items: [], nextCursor: null }], pageParams: [null] }
    );
    items = [transaction()];
    await act(async () => view.batches.submit(capture));
    await waitFor(() =>
      expect(
        screen.queryByTestId(`home-transaction-row-${transactionId}`)
      ).toBeTruthy()
    );
    await act(async () => view.showTransactions());
    await waitFor(() =>
      expect(
        within(screen.getByTestId('diagnostic-transactions')).queryByText(
          'Diagnostic voice breakfast'
        )
      ).toBeTruthy()
    );
  } finally {
    view.close();
  }
});

it('shows authoritative read failures instead of inventing cards or hiding them with retries', async () => {
  jest
    .mocked(coreFinanceService.getHomeSummary)
    .mockRejectedValue(new Error('diagnostic read unavailable'))
    .mockResolvedValueOnce(summary([]));
  jest
    .mocked(coreFinanceService.listTransactions)
    .mockRejectedValue(new Error('diagnostic read unavailable'))
    .mockResolvedValueOnce({ items: [], nextCursor: null });
  const view = mount();
  try {
    await waitFor(() =>
      expect(screen.getByTestId('home-horizon')).toBeTruthy()
    );
    await waitFor(() =>
      expect(coreFinanceService.listTransactions).toHaveBeenCalledTimes(2)
    );
    await act(async () => view.batches.submit(capture));
    await waitFor(() =>
      expect(
        screen.queryAllByText(translate('coreFinance.state.error')).length
      ).toBeGreaterThanOrEqual(2)
    );
    expect(view.batches.latest?.transactionIds).toEqual([transactionId]);
    expect(
      screen.queryByTestId(`home-transaction-row-${transactionId}`)
    ).toBeNull();
    expect(
      within(screen.getByTestId('diagnostic-transactions')).queryByText(
        'Diagnostic voice breakfast'
      )
    ).toBeNull();
  } finally {
    view.close();
  }
});
