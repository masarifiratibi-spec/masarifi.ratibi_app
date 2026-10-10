import React from 'react';
import { Alert } from 'react-native';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within
} from '@testing-library/react-native';
import { router } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';

import { elevation, lightThemeColors } from '@/design-system/tokens';
import {
  completeCategorySelection,
  getCategorySelectionSession
} from '@/features/categories/category-selection-session';
import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { changeLocale, translate } from '@/localization/i18n';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions
} from '@/test-utils/core-finance-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import { MANUAL_TRANSACTION_DRAFT_ID } from './manual-transaction-draft';
import { TransactionForm } from './TransactionForm';
import { CoreFinanceError } from '@/services/contracts/core-finance-service';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import { transactionInputSchema } from '@/domain/core-finance';
import {
  clearManualDiagnostics,
  readManualDiagnostics
} from '@/services/platform/manual-diagnostics';

let mockFocusEffectCallback: (() => void) | undefined;
jest.mock('expo-crypto', () => ({
  randomUUID: () => '90000000-0000-4000-8000-000000000099'
}));

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    push: jest.fn(),
    replace: jest.fn()
  },
  useFocusEffect: (callback: () => void) => {
    mockFocusEffectCallback = callback;
    return require('react').useEffect(callback, [callback]);
  }
}));
jest.mock('@/services/mocks/core-finance-service', () => ({
  coreFinanceService: {
    listAccounts: jest.fn(),
    listCategories: jest.fn(),
    getTransaction: jest.fn(),
    loadDraft: jest.fn(async () => null),
    getRemainingRefundableMinor: jest.fn(async () => Number.MAX_SAFE_INTEGER),
    saveDraft: jest.fn(async (draft: unknown) => draft),
    discardDraft: jest.fn(async () => undefined),
    createTransaction: jest.fn(),
    updateTransaction: jest.fn(),
    deleteTransaction: jest.fn(),
    undoDelete: jest.fn()
  }
}));

beforeEach(() => {
  jest.useRealTimers();
  changeLocale('en');
  jest.clearAllMocks();
  mockFocusEffectCallback = undefined;
  jest.mocked(coreFinanceService.loadDraft).mockResolvedValue(null);
  jest
    .mocked(coreFinanceService.listAccounts)
    .mockResolvedValue(fixtureAccounts);
  jest
    .mocked(coreFinanceService.listCategories)
    .mockResolvedValue(fixtureCategories);
  jest
    .mocked(coreFinanceService.getRemainingRefundableMinor)
    .mockResolvedValue(Number.MAX_SAFE_INTEGER);
  jest.mocked(router.canGoBack).mockReturnValue(true);
});

afterEach(() => {
  jest.useRealTimers();
});

it('retains the actual Manual failure stage and HTTP correlation after showing the generic banner', async () => {
  const oldFlag = process.env.EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED;
  const oldUrl = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED = 'true';
  process.env.EXPO_PUBLIC_API_URL = 'https://api.staging.masarifiratibi.com';
  const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  jest
    .mocked(coreFinanceService.loadDraft)
    .mockResolvedValue(requiredDraft('50', 'Food'));
  jest.mocked(coreFinanceService.createTransaction).mockRejectedValue(
    new CoreFinanceError('unknown', {
      domainCode: 'FORBIDDEN',
      status: 403,
      requestId: '22222222-2222-4222-8222-222222222222',
      uncertain: false
    })
  );
  try {
    renderWithQueryData(<TransactionForm />, [
      [coreFinanceKeys.accounts(false), fixtureAccounts],
      [coreFinanceKeys.categories(false), fixtureCategories]
    ]);
    // Cold React Native hydration took 3.3s in the complete serial suite.
    await screen.findByDisplayValue('50', {}, { timeout: 5000 });
    fireEvent.press(screen.getByLabelText('Save transaction'));
    await screen.findByText(translate('coreFinance.validation.invalid'));
    expect(readManualDiagnostics()).toContainEqual(
      expect.objectContaining({
        stage: 'request',
        failed: true,
        status: 403,
        domainCode: 'FORBIDDEN',
        uncertain: false,
        requestId: '22222222-2222-4222-8222-222222222222',
        operationHash: expect.stringMatching(/^[a-f0-9]{16}$/)
      })
    );
  } finally {
    clearManualDiagnostics();
    log.mockRestore();
    process.env.EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED = oldFlag;
    process.env.EXPO_PUBLIC_API_URL = oldUrl;
  }
  // The first React Native render includes cold module hydration (7.9s observed).
  // Keep the bounded UI waits and assertions; allow the complete test to finish.
}, 15000);

it.each([
  [
    'account_reference',
    { accountId: 'missing-account' },
    'coreFinance.validation.required'
  ],
  ['amount', { amountText: '0' }, 'coreFinance.validation.amount'],
  ['date', { occurredAt: Date.UTC(2100, 0, 1) }, 'coreFinance.manual.date']
] as const)(
  'traces rejected Manual input %s before allocating or dispatching a financial operation',
  async (rule, patch, message) => {
    const previous = { ...process.env };
    process.env.EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED = 'true';
    process.env.EXPO_PUBLIC_API_URL = 'https://api.staging.masarifiratibi.com';
    const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    clearManualDiagnostics();
    jest.mocked(coreFinanceService.loadDraft).mockResolvedValue({
      ...requiredDraft('50', 'Food'),
      ...patch
    });
    try {
      renderWithQueryData(<TransactionForm />, [
        [coreFinanceKeys.accounts(false), fixtureAccounts],
        [coreFinanceKeys.categories(false), fixtureCategories]
      ]);
      await screen.findByDisplayValue(
        'amountText' in patch ? patch.amountText : '50'
      );
      fireEvent.press(screen.getByLabelText('Save transaction'));
      await screen.findByText(translate(message));
      expect(coreFinanceService.createTransaction).not.toHaveBeenCalled();
      expect(readManualDiagnostics()).toContainEqual(
        expect.objectContaining({
          stage: 'input',
          failed: true,
          validationRules: expect.stringContaining(rule)
        })
      );
      for (const entry of readManualDiagnostics()) {
        expect(entry.operationHash).toBeUndefined();
        expect(entry.requestId).toBeUndefined();
        expect(entry.status).toBeUndefined();
      }
      expect(JSON.stringify(readManualDiagnostics())).not.toMatch(
        /Food|missing-account/
      );
    } finally {
      clearManualDiagnostics();
      log.mockRestore();
      process.env = previous;
    }
  }
);

it('blocks editing after a draft read fails and retries the original unknown operation', async () => {
  const firstAttemptAt = Date.now();
  const repository = new CoreFinanceRepository();
  const operationId = '90000000-0000-4000-8000-000000000098';
  const input = transactionInputSchema.parse({
    type: 'expense',
    amountMinor: 5000,
    currencyCode: 'SAR',
    accountId: fixtureAccounts[0].id,
    categoryId: 'food',
    title: 'Frozen Food',
    occurredAt: Date.now()
  });
  repository.saveDraft({
    ...requiredDraft('50', 'Food'),
    submission: {
      version: 1,
      operationId,
      input,
      firstAttemptAt,
      phase: 'unknown'
    }
  });
  jest
    .mocked(coreFinanceService.loadDraft)
    .mockRejectedValueOnce(new CoreFinanceError('offline'))
    .mockImplementation(async (id) => repository.loadDraft(id));
  jest
    .mocked(coreFinanceService.saveDraft)
    .mockImplementation(async (draft) => repository.saveDraft(draft));
  jest.mocked(coreFinanceService.createTransaction).mockResolvedValue({
    value: fixtureTransactions[0],
    affectedScopes: []
  });
  try {
    renderWithQueryData(<TransactionForm />, [
      [coreFinanceKeys.accounts(false), fixtureAccounts],
      [coreFinanceKeys.categories(false), fixtureCategories]
    ]);
    await screen.findByText(translate('coreFinance.state.error'));
    expect(screen.queryByLabelText('Amount')).toBeNull();
    expect(screen.queryByLabelText('Save transaction')).toBeNull();
    expect(coreFinanceService.saveDraft).not.toHaveBeenCalled();
    expect(coreFinanceService.discardDraft).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText(translate('coreFinance.action.retry')));
    await screen.findByText(translate('coreFinance.manual.uncertain'));
    expect(screen.getByLabelText('Amount')).toHaveProp('editable', false);
    fireEvent.press(screen.getByLabelText('Save transaction'));
    await waitFor(() =>
      expect(coreFinanceService.createTransaction).toHaveBeenCalledWith(
        input,
        operationId
      )
    );
  } finally {
    jest
      .mocked(coreFinanceService.saveDraft)
      .mockReset()
      .mockImplementation(async (draft) => draft);
  }
});

function requiredDraft(amountText = '50', merchant: string | null = null) {
  return {
    id: MANUAL_TRANSACTION_DRAFT_ID,
    transactionType: 'expense' as const,
    amountText,
    accountId: fixtureAccounts[0].id,
    destinationAccountId: null,
    categoryId: 'food',
    merchant,
    notes: null,
    occurredAt: Date.now(),
    status: 'editing' as const,
    updatedAt: Date.now()
  };
}

it('does not clear a concurrent unresolved operation when preparation conflicts', async () => {
  const repository = new CoreFinanceRepository();
  const firstAttemptAt = Date.now();
  const original = {
    ...requiredDraft('50', 'Food'),
    submission: {
      version: 1 as const,
      operationId: '90000000-0000-4000-8000-000000000098',
      input: transactionInputSchema.parse({
        type: 'expense',
        amountMinor: 5000,
        currencyCode: 'SAR',
        accountId: fixtureAccounts[0].id,
        categoryId: 'food',
        title: 'Frozen Food',
        occurredAt: Date.now()
      }),
      firstAttemptAt,
      phase: 'unknown' as const
    }
  };
  repository.saveDraft(original);
  jest
    .mocked(coreFinanceService.loadDraft)
    .mockResolvedValue(requiredDraft('50', 'Food'));
  jest
    .mocked(coreFinanceService.saveDraft)
    .mockReset()
    .mockImplementation(async (draft) => repository.saveDraft(draft));
  try {
    renderWithQueryData(<TransactionForm />, [
      [coreFinanceKeys.accounts(false), fixtureAccounts],
      [coreFinanceKeys.categories(false), fixtureCategories]
    ]);
    await screen.findByLabelText('Amount', {}, { timeout: 5000 });
    fireEvent.press(screen.getByLabelText('Save transaction'));
    await waitFor(() =>
      expect(
        screen.getByLabelText('Save transaction')
      ).toHaveAccessibilityState({ busy: false })
    );
    expect(
      repository.loadDraft(MANUAL_TRANSACTION_DRAFT_ID)?.submission
    ).toEqual(original.submission);
    expect(coreFinanceService.createTransaction).not.toHaveBeenCalled();
    await screen.findByText(translate('coreFinance.manual.reconcile'));
  } finally {
    jest
      .mocked(coreFinanceService.saveDraft)
      .mockReset()
      .mockImplementation(async (draft) => draft);
  }
});

it('allows local preparation retry after storage failures without claiming a financial outcome', async () => {
  jest
    .mocked(coreFinanceService.loadDraft)
    .mockResolvedValue(requiredDraft('50', 'Food'));
  jest
    .mocked(coreFinanceService.saveDraft)
    .mockReset()
    .mockRejectedValueOnce(new Error('local preparation failed'))
    .mockRejectedValueOnce(new Error('local cleanup also failed'))
    .mockImplementation(async (draft) => draft);
  jest.mocked(coreFinanceService.createTransaction).mockResolvedValue({
    value: fixtureTransactions[0],
    affectedScopes: []
  });
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);
  await screen.findByLabelText('Amount', {}, { timeout: 5000 });
  expect(screen.getByLabelText('Amount')).toHaveProp('value', '50');
  fireEvent.press(screen.getByLabelText('Save transaction'));
  await waitFor(() =>
    expect(screen.getByLabelText('Save transaction')).toHaveAccessibilityState({
      busy: false
    })
  );
  expect(screen.getByLabelText('Amount')).toHaveProp('editable', true);
  await screen.findByText(translate('coreFinance.manual.localSave'));
  expect(
    screen.queryByText(translate('coreFinance.manual.uncertain'))
  ).toBeNull();
  expect(coreFinanceService.createTransaction).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Amount'), '75');
  fireEvent.changeText(screen.getByLabelText('Description'), 'Changed Food');
  fireEvent.press(screen.getByLabelText('Save transaction'));
  await waitFor(() =>
    expect(coreFinanceService.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amountMinor: 7500, title: 'Changed Food' }),
      '90000000-0000-4000-8000-000000000099'
    )
  );
});

it('retains an already unknown operation when local preparation for retry fails', async () => {
  const operationId = '90000000-0000-4000-8000-000000000098';
  const input = transactionInputSchema.parse({
    type: 'expense',
    amountMinor: 5000,
    currencyCode: 'SAR',
    accountId: fixtureAccounts[0].id,
    categoryId: 'food',
    title: 'Frozen Food',
    occurredAt: Date.now()
  });
  const firstAttemptAt = Date.now();
  jest.mocked(coreFinanceService.loadDraft).mockResolvedValue({
    ...requiredDraft('50', 'Food'),
    submission: {
      version: 1,
      operationId,
      input,
      firstAttemptAt,
      phase: 'unknown'
    }
  });
  jest
    .mocked(coreFinanceService.saveDraft)
    .mockReset()
    .mockRejectedValueOnce(new Error('retry preparation failed'))
    .mockImplementation(async (draft) => draft);
  jest.mocked(coreFinanceService.createTransaction).mockResolvedValue({
    value: fixtureTransactions[0],
    affectedScopes: []
  });
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);
  await screen.findByText(translate('coreFinance.manual.uncertain'));
  fireEvent.press(screen.getByLabelText('Save transaction'));
  await waitFor(() =>
    expect(coreFinanceService.saveDraft).toHaveBeenCalledTimes(2)
  );
  expect(screen.getByLabelText('Amount')).toHaveProp('editable', false);
  expect(
    screen.queryByText(translate('coreFinance.manual.localSave'))
  ).toBeNull();
  expect(coreFinanceService.createTransaction).not.toHaveBeenCalled();
  expect(
    jest.mocked(coreFinanceService.saveDraft).mock.calls.at(-1)![0].submission
      ?.operationId
  ).toBe(operationId);
  fireEvent.press(screen.getByLabelText('Save transaction'));
  await waitFor(() =>
    expect(coreFinanceService.createTransaction).toHaveBeenCalledWith(
      input,
      operationId
    )
  );
});

it('holds a synchronous double tap to one persisted operation and retains known success after cleanup failure', async () => {
  jest
    .mocked(coreFinanceService.loadDraft)
    .mockResolvedValue(requiredDraft('50', 'food'));
  jest
    .mocked(coreFinanceService.createTransaction)
    .mockResolvedValue({ value: fixtureTransactions[0], affectedScopes: [] });
  jest
    .mocked(coreFinanceService.discardDraft)
    .mockRejectedValueOnce(new Error('fixture cleanup failure'));
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);
  await screen.findByText('Food');
  act(() => {
    fireEvent.press(screen.getByLabelText('Save transaction'));
    fireEvent.press(screen.getByLabelText('Save transaction'));
  });
  await waitFor(() =>
    expect(coreFinanceService.discardDraft).toHaveBeenCalled()
  );
  expect(coreFinanceService.createTransaction).toHaveBeenCalledTimes(1);
  expect(
    jest
      .mocked(coreFinanceService.saveDraft)
      .mock.calls.some(
        ([draft]) =>
          draft.submission?.phase === 'saved' &&
          draft.submission.transactionId === fixtureTransactions[0].id
      )
  ).toBe(true);
  fireEvent.press(screen.getByLabelText('Save transaction'));
  await waitFor(() => expect(router.replace).toHaveBeenCalled());
  expect(coreFinanceService.createTransaction).toHaveBeenCalledTimes(1);
});

it('keeps the uncertain operation and frozen payload for explicit retry', async () => {
  jest
    .mocked(coreFinanceService.loadDraft)
    .mockResolvedValue(requiredDraft('50', 'food'));
  jest
    .mocked(coreFinanceService.createTransaction)
    .mockRejectedValueOnce(new CoreFinanceError('offline'))
    .mockResolvedValueOnce({
      value: fixtureTransactions[0],
      affectedScopes: []
    });
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);
  await screen.findByText('Food');
  fireEvent.press(screen.getByLabelText('Save transaction'));
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(
    jest
      .mocked(coreFinanceService.saveDraft)
      .mock.calls.some(([draft]) => draft.submission?.phase === 'unknown')
  ).toBe(true);
  fireEvent.press(screen.getByLabelText('Save transaction'));
  await waitFor(() =>
    expect(coreFinanceService.createTransaction).toHaveBeenCalledTimes(2)
  );
  expect(
    jest.mocked(coreFinanceService.createTransaction).mock.calls[1]
  ).toEqual(jest.mocked(coreFinanceService.createTransaction).mock.calls[0]);
});

it.each([401, 429])(
  'retains prior uncertainty after a later %s rejection',
  async (status) => {
    jest
      .mocked(coreFinanceService.loadDraft)
      .mockResolvedValue(requiredDraft('50', 'food'));
    jest
      .mocked(coreFinanceService.createTransaction)
      .mockRejectedValueOnce(new CoreFinanceError('offline'))
      .mockRejectedValueOnce(
        new CoreFinanceError('validation', { status, uncertain: false })
      );
    renderWithQueryData(<TransactionForm />, [
      [coreFinanceKeys.accounts(false), fixtureAccounts],
      [coreFinanceKeys.categories(false), fixtureCategories]
    ]);
    await screen.findByText('Food');
    fireEvent.press(screen.getByLabelText('Save transaction'));
    await screen.findByText(translate('coreFinance.manual.uncertain'));
    fireEvent.press(screen.getByLabelText('Save transaction'));
    await waitFor(() =>
      expect(coreFinanceService.createTransaction).toHaveBeenCalledTimes(2)
    );
    await waitFor(() =>
      expect(
        jest.mocked(coreFinanceService.saveDraft).mock.calls.at(-1)![0]
          .submission?.phase
      ).toBe('unknown')
    );
    expect(screen.getByLabelText('Amount')).toHaveProp('editable', false);
  }
);

it('recovers the same unknown operation after reopening without automatically writing', async () => {
  const firstAttemptAt = Date.now();
  const input = {
    type: 'expense' as const,
    amountMinor: 5000,
    currencyCode: 'SAR',
    accountId: fixtureAccounts[0].id,
    categoryId: 'food',
    title: 'Frozen Food',
    occurredAt: Date.now(),
    destinationAccountId: null,
    transferPurpose: null,
    feeMinor: 0,
    merchant: null,
    notes: null,
    originalTransactionId: null,
    obligationId: null
  };
  const operationId = '90000000-0000-4000-8000-000000000098';
  jest.mocked(coreFinanceService.loadDraft).mockResolvedValue({
    ...requiredDraft('50', 'food'),
    submission: {
      version: 1,
      operationId,
      input,
      firstAttemptAt,
      phase: 'submitting'
    }
  });
  jest
    .mocked(coreFinanceService.createTransaction)
    .mockResolvedValue({ value: fixtureTransactions[0], affectedScopes: [] });
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);
  await screen.findByText(translate('coreFinance.manual.uncertain'));
  expect(coreFinanceService.createTransaction).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Amount')).toHaveProp('editable', false);
  fireEvent.press(screen.getByLabelText('Save transaction'));
  await waitFor(() =>
    expect(coreFinanceService.createTransaction).toHaveBeenCalledWith(
      input,
      operationId
    )
  );
});

it('correlates a restored unresolved draft without sending or exposing its frozen contents', async () => {
  const priorFlag = process.env.EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED;
  const priorUrl = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED = 'true';
  process.env.EXPO_PUBLIC_API_URL = 'https://api.staging.masarifiratibi.com';
  const sink = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  const firstAttemptAt = Date.now();
  const draft = requiredDraft('57', 'salary');
  jest.mocked(coreFinanceService.loadDraft).mockResolvedValue({
    ...draft,
    submission: {
      version: 1,
      operationId: '90000000-0000-4000-8000-000000000098',
      firstAttemptAt,
      phase: 'unknown',
      input: transactionInputSchema.parse({
        type: 'income', amountMinor: 5700, currencyCode: 'SAR',
        accountId: fixtureAccounts[0].id, categoryId: 'salary',
        title: 'Private salary title', occurredAt: firstAttemptAt
      })
    }
  });
  clearManualDiagnostics();
  try {
    renderWithQueryData(<TransactionForm />, [
      [coreFinanceKeys.accounts(false), fixtureAccounts],
      [coreFinanceKeys.categories(false), fixtureCategories]
    ]);
    await screen.findByText(translate('coreFinance.manual.uncertain'));
    expect(readManualDiagnostics()).toContainEqual({
      stage: 'restore', at: expect.any(Number),
      operationHash: expect.stringMatching(/^[a-f0-9]{16}$/),
      phase: 'unknown', firstAttemptAt
    });
    expect(JSON.stringify(readManualDiagnostics())).not.toMatch(/5700|Private salary|90000000/);
    expect(coreFinanceService.createTransaction).not.toHaveBeenCalled();
    expect(coreFinanceService.saveDraft).not.toHaveBeenCalled();
  } finally {
    sink.mockRestore();
    clearManualDiagnostics();
    process.env.EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED = priorFlag;
    process.env.EXPO_PUBLIC_API_URL = priorUrl;
  }
});

it('requires reconciliation for an unknown operation older than 24 hours', async () => {
  const input = {
    type: 'expense' as const,
    amountMinor: 5000,
    currencyCode: 'SAR',
    accountId: fixtureAccounts[0].id,
    categoryId: 'food',
    title: 'Food',
    occurredAt: Date.now(),
    destinationAccountId: null,
    transferPurpose: null,
    feeMinor: 0,
    merchant: null,
    notes: null,
    originalTransactionId: null,
    obligationId: null
  };
  jest.mocked(coreFinanceService.loadDraft).mockResolvedValue({
    ...requiredDraft('50', 'food'),
    submission: {
      version: 1,
      operationId: '90000000-0000-4000-8000-000000000098',
      input,
      firstAttemptAt: Date.now() - 86400001,
      phase: 'unknown'
    }
  });
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);
  await screen.findByText(translate('coreFinance.manual.reconcile'));
  fireEvent.press(screen.getByLabelText('Save transaction'));
  expect(coreFinanceService.createTransaction).not.toHaveBeenCalled();
});

it('retains known success when authoritative finance refresh fails', async () => {
  jest
    .mocked(coreFinanceService.loadDraft)
    .mockResolvedValue(requiredDraft('50', 'food'));
  jest.mocked(coreFinanceService.createTransaction).mockResolvedValue({
    value: fixtureTransactions[0],
    affectedScopes: ['accounts.list']
  });
  jest
    .mocked(coreFinanceService.listAccounts)
    .mockRejectedValue(new Error('fixture read unavailable'));
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);
  await screen.findByText('Food');
  fireEvent.press(screen.getByLabelText('Save transaction'));
  await screen.findByText(translate('coreFinance.manual.savedRefresh'));
  expect(coreFinanceService.discardDraft).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
  expect(
    jest.mocked(coreFinanceService.saveDraft).mock.calls.at(-1)![0].submission
  ).toMatchObject({ phase: 'saved', transactionId: fixtureTransactions[0].id });
});

it('restores a linked refund with the same frozen command after reopening', async () => {
  const original = {
    ...fixtureTransactions[0],
    type: 'expense' as const,
    amountMinor: 10000,
    currencyCode: 'SAR',
    accountId: 'account-bank',
    categoryId: 'food',
    status: 'posted' as const,
    reviewStatus: 'none' as const,
    syncStatus: 'synced' as const,
    version: 7
  };
  jest
    .mocked(coreFinanceService.createTransaction)
    .mockRejectedValue(new CoreFinanceError('offline'));
  const seeds = [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories],
    [coreFinanceKeys.transaction(original.id), original]
  ] as const;
  const first = renderWithQueryData(
    <TransactionForm
      initialType="refund"
      originalTransactionId={original.id}
    />,
    seeds
  );
  fireEvent.changeText(await screen.findByLabelText('Amount'), '25');
  fireEvent.changeText(screen.getByLabelText('Description'), 'Refund');
  fireEvent.press(screen.getByLabelText('Save transaction'));
  await screen.findByText(translate('coreFinance.manual.uncertain'));
  const persisted = jest
    .mocked(coreFinanceService.saveDraft)
    .mock.calls.at(-1)![0];
  expect(persisted.id).toBe(
    `${MANUAL_TRANSACTION_DRAFT_ID}:refund:${original.id}`
  );
  expect(persisted.submission?.expectedVersion).toBe(7);
  const frozen = jest.mocked(coreFinanceService.createTransaction).mock
    .calls[0];
  first.unmount();
  jest.mocked(coreFinanceService.loadDraft).mockResolvedValue(persisted);
  renderWithQueryData(
    <TransactionForm
      initialType="refund"
      originalTransactionId={original.id}
    />,
    seeds
  );
  await screen.findByText(translate('coreFinance.manual.uncertain'));
  expect(coreFinanceService.createTransaction).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByLabelText('Save transaction'));
  await waitFor(() =>
    expect(coreFinanceService.createTransaction).toHaveBeenCalledTimes(2)
  );
  expect(
    jest.mocked(coreFinanceService.createTransaction).mock.calls[1]
  ).toEqual(frozen);
});

it('identifies a missing transfer destination before freezing or sending an operation', async () => {
  jest.mocked(coreFinanceService.loadDraft).mockResolvedValue({
    ...requiredDraft(),
    transactionType: 'transfer',
    categoryId: null
  });
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);
  await screen.findByDisplayValue('50');
  fireEvent.press(screen.getByLabelText('Save transaction'));
  await screen.findByText(translate('coreFinance.validation.required'));
  expect(coreFinanceService.createTransaction).not.toHaveBeenCalled();
  expect(
    jest
      .mocked(coreFinanceService.saveDraft)
      .mock.calls.every(([draft]) => !draft.submission)
  ).toBe(true);
});

it('keeps local validation feedback next to Save and focuses the invalid amount', async () => {
  jest
    .mocked(coreFinanceService.loadDraft)
    .mockResolvedValue(requiredDraft('25,50', 'food'));
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);
  await screen.findByText('Food');
  fireEvent.press(screen.getByLabelText('Save transaction'));
  expect(
    within(screen.getByTestId('manual-save-feedback')).getByRole('alert')
  ).toHaveTextContent(translate('coreFinance.validation.amount'));
  expect(coreFinanceService.createTransaction).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Amount'), '25.50');
  expect(screen.queryByRole('alert')).toBeNull();
});

it.each(['50', '٢٥٫٥٠', '۲۵.۵۰'])(
  'saves required-only input %s with a category title',
  async (amountText) => {
    jest
      .mocked(coreFinanceService.loadDraft)
      .mockResolvedValue(requiredDraft(amountText));
    jest
      .mocked(coreFinanceService.createTransaction)
      .mockResolvedValue({ value: fixtureTransactions[0], affectedScopes: [] });
    renderWithQueryData(<TransactionForm />, [
      [coreFinanceKeys.accounts(false), fixtureAccounts],
      [coreFinanceKeys.categories(false), fixtureCategories]
    ]);
    await screen.findByText('Food');
    fireEvent.press(screen.getByLabelText('Save transaction'));
    await waitFor(() =>
      expect(coreFinanceService.createTransaction).toHaveBeenCalled()
    );
    expect(
      jest.mocked(coreFinanceService.createTransaction).mock.calls[0][0]
    ).toMatchObject({
      title: 'Food',
      notes: null,
      amountMinor: amountText === '50' ? 5000 : 2550
    });
  }
);

it.each(['25,50', '1,2,3'])(
  'rejects ambiguous or malformed grouping %s without a write',
  async (amountText) => {
    jest
      .mocked(coreFinanceService.loadDraft)
      .mockResolvedValue(requiredDraft(amountText, 'food'));
    renderWithQueryData(<TransactionForm />, [
      [coreFinanceKeys.accounts(false), fixtureAccounts],
      [coreFinanceKeys.categories(false), fixtureCategories]
    ]);
    await screen.findByText('Food');
    fireEvent.press(screen.getByLabelText('Save transaction'));
    expect(coreFinanceService.createTransaction).not.toHaveBeenCalled();
  }
);

it('rejects a title exceeding the API limit before a write', async () => {
  jest
    .mocked(coreFinanceService.loadDraft)
    .mockResolvedValue(requiredDraft('50', 'x'.repeat(161)));
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);
  await screen.findByText('Food');
  fireEvent.press(screen.getByLabelText('Save transaction'));
  expect(coreFinanceService.createTransaction).not.toHaveBeenCalled();
});

it('clears Expense Food on switching to Income and requests an Income-only picker', async () => {
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);
  fireEvent.changeText(await screen.findByLabelText('Amount'), '50');
  fireEvent.changeText(screen.getByLabelText('Description'), 'food');
  fireEvent.press(screen.getByLabelText('Category, Choose category'));
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  const request = jest.mocked(router.push).mock.calls.at(-1)![0] as unknown as {
    params: { requestId: string };
  };
  act(() => {
    completeCategorySelection(request.params.requestId, 'food');
  });
  expect(screen.getByText('Food')).toBeTruthy();
  fireEvent.press(screen.getByTestId('transaction-edit-type-income'));
  expect(screen.queryByText('Food')).toBeNull();
  fireEvent.press(screen.getByLabelText('Category, Choose category'));
  await waitFor(() => expect(router.push).toHaveBeenCalledTimes(2));
  const incomeRequest = jest
    .mocked(router.push)
    .mock.calls.at(-1)![0] as unknown as { params: { requestId: string } };
  expect(
    getCategorySelectionSession(incomeRequest.params.requestId)?.financialType
  ).toBe('income');
  fireEvent.press(screen.getByLabelText('Save transaction'));
  expect(coreFinanceService.createTransaction).not.toHaveBeenCalled();
});

it('keeps amount-first entry values and shows localized validation before save', async () => {
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);
  await waitFor(() =>
    expect(coreFinanceService.loadDraft).toHaveBeenCalledWith(
      MANUAL_TRANSACTION_DRAFT_ID
    )
  );
  expect(
    screen.getByLabelText(translate('coreFinance.form.amount'))
  ).toBeTruthy();
  fireEvent.changeText(
    screen.getByLabelText(translate('coreFinance.form.title')),
    'Lunch'
  );
  fireEvent.press(screen.getByLabelText(translate('coreFinance.form.save')));
  expect(screen.getByRole('alert')).toHaveTextContent(
    translate('coreFinance.validation.required')
  );
  expect(screen.getByDisplayValue('Lunch')).toBeTruthy();
});

it('uses compact controlled pickers without defaulting the category', async () => {
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);
  await waitFor(() =>
    expect(
      screen.getByLabelText(translate('coreFinance.form.amount'))
    ).toBeTruthy()
  );

  expect(screen.getAllByText(fixtureAccounts[0].name)).toHaveLength(1);
  expect(screen.queryByText(fixtureAccounts[1].name)).toBeNull();
  expect(screen.getByText('Choose category')).toBeTruthy();
  expect(screen.queryByText(fixtureCategories[0].labelEn)).toBeNull();
  expect(screen.queryByText(fixtureCategories[7].labelEn)).toBeNull();
});

it('uses compact picker hierarchy and card-colored text fields', async () => {
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);

  const categoryPicker = await screen.findByLabelText(
    'Category, Choose category'
  );
  expect(categoryPicker).toHaveStyle({
    minHeight: 60,
    shadowOpacity: elevation.card.shadowOpacity
  });
  expect(screen.getByText('Choose category')).toHaveStyle({
    fontSize: 16,
    fontWeight: '600'
  });
  expect(screen.getByLabelText('Description')).toHaveStyle({
    backgroundColor: lightThemeColors.surfaces.card
  });
  expect(screen.getByLabelText('Note')).toHaveStyle({
    backgroundColor: lightThemeColors.surfaces.card,
    minHeight: 64
  });
});

it('requires an explicit category before saving a new expense', async () => {
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);

  fireEvent.changeText(
    await screen.findByLabelText(translate('coreFinance.form.amount')),
    '200'
  );
  fireEvent.changeText(
    screen.getByLabelText(translate('coreFinance.form.title')),
    'Rent'
  );
  fireEvent.press(screen.getByLabelText(translate('coreFinance.form.save')));

  expect(screen.getByRole('alert')).toHaveTextContent(
    translate('coreFinance.validation.required')
  );
  expect(coreFinanceService.createTransaction).not.toHaveBeenCalled();
});

it('passes the source currency to the destination picker for a new transfer', async () => {
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.accountBalances(true), []],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);

  fireEvent.press(await screen.findByTestId('transaction-edit-type-transfer'));
  const destination = translate('coreFinance.form.destination');
  fireEvent.press(screen.getByLabelText(`${destination}, ${destination}`));

  await waitFor(() =>
    expect(router.push).toHaveBeenCalledWith(
      '/modals/account-picker?draft=manual&field=destinationAccountId&currencyCode=SAR'
    )
  );
});

it('keeps an existing cross-currency destination available while editing', async () => {
  const transaction = {
    ...fixtureTransactions[0],
    type: 'transfer' as const,
    accountId: 'account-bank',
    destinationAccountId: 'account-usd',
    currencyCode: 'SAR',
    categoryId: null
  };
  renderWithQueryData(<TransactionForm transaction={transaction} />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.accountBalances(true), []],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);

  const destination = translate('coreFinance.form.destination');
  fireEvent.press(await screen.findByLabelText(`${destination}, Travel`));

  expect(screen.getAllByText('Travel')).toHaveLength(2);
  expect(screen.getAllByText('Wallet')).toHaveLength(2);
});

it('clears an incompatible destination when the source account changes', async () => {
  const transaction = {
    ...fixtureTransactions[0],
    type: 'transfer' as const,
    accountId: 'account-bank',
    destinationAccountId: 'account-wallet',
    currencyCode: 'SAR',
    categoryId: null
  };
  renderWithQueryData(<TransactionForm transaction={transaction} />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.accountBalances(true), []],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);

  fireEvent.press(await screen.findByLabelText('Account, Daily account'));
  fireEvent.press(screen.getByLabelText(/Travel/));

  const destination = translate('coreFinance.form.destination');
  expect(screen.getByLabelText(`${destination}, ${destination}`)).toBeTruthy();
});

it('uses the canonical category screen while preserving edit values', async () => {
  const transaction = {
    ...fixtureTransactions[1],
    notes: 'Keep this note',
    title: 'Keep this title'
  };
  renderWithQueryData(<TransactionForm transaction={transaction} />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);

  fireEvent.press(await screen.findByLabelText('Category, Food'));
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  const route = jest.mocked(router.push).mock.calls.at(-1)?.[0] as unknown as {
    params: { requestId: string };
  };
  expect(getCategorySelectionSession(route.params.requestId)).toBeTruthy();
  act(() => completeCategorySelection(route.params.requestId, 'shopping'));

  expect(screen.getByText('Shopping')).toBeTruthy();
  expect(screen.getByDisplayValue('Keep this title')).toBeTruthy();
  expect(screen.getByDisplayValue('Keep this note')).toBeTruthy();
});

it('keeps the selected category when the add form regains focus', async () => {
  jest.mocked(coreFinanceService.loadDraft).mockResolvedValueOnce({
    id: MANUAL_TRANSACTION_DRAFT_ID,
    transactionType: 'expense',
    amountText: '25',
    accountId: 'account-bank',
    destinationAccountId: null,
    categoryId: 'food',
    merchant: 'Keep this title',
    notes: 'Keep this note',
    occurredAt: 1_723_939_200_000,
    status: 'editing',
    updatedAt: 1_723_939_200_000
  });
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);

  fireEvent.press(await screen.findByLabelText('Category, Food'));
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  const route = jest.mocked(router.push).mock.calls.at(-1)?.[0] as unknown as {
    params: { requestId: string };
  };
  act(() => completeCategorySelection(route.params.requestId, 'shopping'));
  act(() => mockFocusEffectCallback?.());

  expect(screen.getByText('Shopping')).toBeTruthy();
  expect(screen.getByDisplayValue('Keep this title')).toBeTruthy();
  expect(screen.getByDisplayValue('Keep this note')).toBeTruthy();
});

it('presents existing transaction data in the complete edit workspace', async () => {
  const transaction = {
    ...fixtureTransactions[11],
    amountMinor: 343_000,
    notes: 'Existing context',
    title: 'InstaPay'
  };
  renderWithQueryData(<TransactionForm transaction={transaction} />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);

  expect(await screen.findByText('Edit Income')).toBeTruthy();
  expect(screen.getByDisplayValue('InstaPay')).toBeTruthy();
  expect(screen.getByDisplayValue('Existing context')).toBeTruthy();
  expect(screen.getByText('Daily account')).toBeTruthy();
  expect(screen.getAllByText('SAR').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Salary').length).toBeGreaterThan(0);
  expect(screen.getByLabelText('Date')).toBeTruthy();
  expect(screen.getByText('Manual')).toBeTruthy();
  expect(screen.getByText('Synced')).toBeTruthy();
  expect(screen.getByDisplayValue('3430')).toBeTruthy();
});

it('preserves a three-decimal transaction amount in the edit input', async () => {
  const transaction = {
    ...fixtureTransactions[1],
    amountMinor: 343_123,
    currencyCode: 'OMR'
  };
  const accounts = [{ ...fixtureAccounts[0], currencyCode: 'OMR' }];
  renderWithQueryData(<TransactionForm transaction={transaction} />, [
    [coreFinanceKeys.accounts(false), accounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);

  expect(await screen.findByDisplayValue('343.123')).toBeTruthy();
});

it.each([
  ['SAR', '90071992547409.91'],
  ['OMR', '9007199254740.991']
])(
  'initializes the largest safe %s transaction without losing a minor unit',
  async (currencyCode, expectedAmount) => {
    const transaction = {
      ...fixtureTransactions[1],
      amountMinor: Number.MAX_SAFE_INTEGER,
      currencyCode
    };
    const accounts = [
      {
        ...fixtureAccounts[0],
        id: transaction.accountId,
        currencyCode
      }
    ];
    renderWithQueryData(<TransactionForm transaction={transaction} />, [
      [coreFinanceKeys.accounts(false), accounts],
      [coreFinanceKeys.categories(false), fixtureCategories]
    ]);

    expect(await screen.findByDisplayValue(expectedAmount)).toBeTruthy();
  }
);

it('submits a linked refund when the eligible original has no category', async () => {
  const original = {
    ...fixtureTransactions[0],
    id: 'categoryless-refund-original',
    type: 'expense' as const,
    amountMinor: 10_000,
    currencyCode: 'SAR',
    accountId: 'account-bank',
    categoryId: null,
    status: 'posted' as const,
    reviewStatus: 'none' as const,
    syncStatus: 'synced' as const
  };
  jest.mocked(coreFinanceService.createTransaction).mockResolvedValue({
    value: {
      ...fixtureTransactions[0],
      type: 'refund',
      categoryId: null,
      originalTransactionId: original.id
    },
    affectedScopes: []
  });

  renderWithQueryData(
    <TransactionForm
      initialType="refund"
      originalTransactionId={original.id}
    />,
    [
      [coreFinanceKeys.accounts(false), fixtureAccounts],
      [coreFinanceKeys.categories(false), fixtureCategories],
      [coreFinanceKeys.transaction(original.id), original]
    ]
  );

  fireEvent.changeText(await screen.findByLabelText('Amount'), '25');
  fireEvent.changeText(screen.getByLabelText('Description'), 'Refund');
  fireEvent.press(screen.getByLabelText('Save transaction'));

  await waitFor(() =>
    expect(coreFinanceService.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'refund',
        categoryId: null,
        originalTransactionId: original.id
      }),
      expect.stringMatching(/^[0-9a-f-]{36}$/),
      undefined,
      original.version
    )
  );
});

it('waits for an uncached original before rendering an existing refund', async () => {
  const original = {
    ...fixtureTransactions[0],
    id: 'uncached-refund-original',
    type: 'expense' as const
  };
  const refund = {
    ...fixtureTransactions[0],
    id: 'uncached-refund',
    type: 'refund' as const,
    originalTransactionId: original.id
  };
  let resolveOriginal: (value: typeof original) => void = () => undefined;
  jest.mocked(coreFinanceService.getTransaction).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOriginal = resolve;
      })
  );

  renderWithQueryData(<TransactionForm transaction={refund} />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);

  expect(
    await screen.findByText(translate('coreFinance.state.loading'))
  ).toBeTruthy();
  await act(async () => resolveOriginal(original));
  expect(await screen.findByLabelText('Amount')).toBeTruthy();
});

it('retries a failed original lookup while editing a refund', async () => {
  const original = {
    ...fixtureTransactions[0],
    id: 'retry-refund-original',
    type: 'expense' as const
  };
  const refund = {
    ...fixtureTransactions[0],
    id: 'retry-refund',
    type: 'refund' as const,
    originalTransactionId: original.id
  };
  jest
    .mocked(coreFinanceService.getTransaction)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(original);

  renderWithQueryData(<TransactionForm transaction={refund} />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);

  fireEvent.press(
    await screen.findByText(translate('coreFinance.action.retry'))
  );

  expect(await screen.findByLabelText('Amount')).toBeTruthy();
  expect(coreFinanceService.getTransaction).toHaveBeenCalledTimes(2);
});

it('retries a failed refundable-capacity lookup', async () => {
  const original = {
    ...fixtureTransactions[0],
    id: 'retry-capacity-original',
    type: 'expense' as const
  };
  const refund = {
    ...fixtureTransactions[0],
    id: 'retry-capacity-refund',
    type: 'refund' as const,
    originalTransactionId: original.id
  };
  jest.mocked(coreFinanceService.getTransaction).mockResolvedValue(original);
  jest
    .mocked(coreFinanceService.getRemainingRefundableMinor)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(10_000);

  renderWithQueryData(<TransactionForm transaction={refund} />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories],
    [coreFinanceKeys.transaction(original.id), original]
  ]);

  fireEvent.press(
    await screen.findByText(translate('coreFinance.action.retry'))
  );

  expect(await screen.findByLabelText('Amount')).toBeTruthy();
  expect(coreFinanceService.getRemainingRefundableMinor).toHaveBeenCalledTimes(
    2
  );
});

it('preserves the transaction currency when its account is absent from the active query', async () => {
  const transaction = {
    ...fixtureTransactions[1],
    accountId: 'archived-omr-account',
    amountMinor: 12_345,
    currencyCode: 'OMR'
  };
  jest.mocked(coreFinanceService.updateTransaction).mockResolvedValue({
    value: transaction,
    affectedScopes: []
  });
  renderWithQueryData(<TransactionForm transaction={transaction} />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);

  fireEvent.press(await screen.findByLabelText('Save transaction'));

  await waitFor(() =>
    expect(coreFinanceService.updateTransaction).toHaveBeenCalledWith(
      transaction.id,
      expect.objectContaining({
        accountId: 'archived-omr-account',
        amountMinor: 12_345,
        currencyCode: 'OMR'
      })
    )
  );
});

it('groups the edit types and hero amount with the selected Masarifi treatment', async () => {
  renderWithQueryData(
    <TransactionForm
      transaction={{ ...fixtureTransactions[11], amountMinor: 343_000 }}
    />,
    [
      [coreFinanceKeys.accounts(false), fixtureAccounts],
      [coreFinanceKeys.categories(false), fixtureCategories]
    ]
  );

  expect(await screen.findByTestId('transaction-edit-hero')).toBeTruthy();
  expect(screen.getByTestId('transaction-edit-type-selector')).toHaveStyle({
    flexDirection: 'row',
    flexWrap: 'nowrap'
  });
  expect(screen.getByLabelText('Income selected')).toHaveStyle({
    backgroundColor: lightThemeColors.interactions.primary,
    flex: 1,
    minWidth: 0
  });
  expect(screen.getByTestId('transaction-edit-amount-unit')).toHaveStyle({
    alignSelf: 'center',
    flexDirection: 'row',
    maxWidth: '100%'
  });
  expect(screen.getByDisplayValue('3430')).toHaveStyle({
    flexShrink: 1,
    fontSize: 46,
    lineHeight: 58
  });
});

it('shows a zero amount placeholder without a browser focus box', async () => {
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);

  const amountInput = await screen.findByLabelText(
    translate('coreFinance.form.amount')
  );
  const amountUnit = screen.getByTestId('transaction-edit-amount-unit');

  expect(amountInput.props.placeholder).toBe('0');
  expect(amountInput.props.autoFocus).toBeUndefined();
  expect(amountInput).toHaveStyle({ outlineWidth: 0 });
  expect(within(amountUnit).getByText('SAR')).toBeTruthy();
});

it('keeps the complete money unit centered for small and large amounts', async () => {
  const small = renderWithQueryData(
    <TransactionForm
      transaction={{ ...fixtureTransactions[11], amountMinor: 500 }}
    />,
    [
      [coreFinanceKeys.accounts(false), fixtureAccounts],
      [coreFinanceKeys.categories(false), fixtureCategories]
    ]
  );

  const smallUnit = await screen.findByTestId('transaction-edit-amount-unit');
  expect(within(smallUnit).getByDisplayValue('5')).toHaveStyle({ width: 40 });
  expect(within(smallUnit).getByText('SAR')).toBeTruthy();
  expect(smallUnit).toHaveStyle({ alignSelf: 'center', maxWidth: '100%' });
  small.unmount();

  renderWithQueryData(
    <TransactionForm
      transaction={{ ...fixtureTransactions[11], amountMinor: 99_999_999_999 }}
    />,
    [
      [coreFinanceKeys.accounts(false), fixtureAccounts],
      [coreFinanceKeys.categories(false), fixtureCategories]
    ]
  );

  const largeUnit = await screen.findByTestId('transaction-edit-amount-unit');
  expect(within(largeUnit).getByDisplayValue('999999999.99')).toHaveStyle({
    width: 300
  });
  expect(within(largeUnit).getByText('SAR')).toBeTruthy();
  expect(largeUnit).toHaveStyle({ alignSelf: 'center', maxWidth: '100%' });
});

it('saves notes and current metadata then returns to the originating screen', async () => {
  const transaction = {
    ...fixtureTransactions[1],
    notes: 'Old note'
  };
  jest.mocked(coreFinanceService.updateTransaction).mockResolvedValue({
    value: transaction,
    affectedScopes: []
  });
  renderWithQueryData(<TransactionForm transaction={transaction} />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);

  fireEvent.changeText(await screen.findByLabelText('Description'), 'Dinner');
  fireEvent.changeText(screen.getByLabelText('Note'), 'Business dinner');
  fireEvent.press(screen.getByLabelText('Save transaction'));

  await waitFor(() =>
    expect(coreFinanceService.updateTransaction).toHaveBeenCalledWith(
      transaction.id,
      expect.objectContaining({
        feeMinor: transaction.feeMinor,
        merchant: transaction.merchant,
        notes: 'Business dinner',
        occurredAt: transaction.occurredAt,
        title: 'Dinner'
      })
    )
  );
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(router.replace).not.toHaveBeenCalled();
});

it('closes immediately when the edit is unchanged', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  const transaction = fixtureTransactions[1];
  const preventRemove: {
    current?: ReturnType<
      typeof jest.mocked<typeof usePreventRemove>
    >['mock']['calls'][number][1];
  } = {};
  jest.mocked(router.back).mockImplementation(() => {
    preventRemove.current?.({ data: { action: { type: 'GO_BACK' } } });
  });
  renderWithQueryData(<TransactionForm transaction={transaction} />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);
  preventRemove.current = jest.mocked(usePreventRemove).mock.calls.at(-1)?.[1];

  fireEvent.press(await screen.findByLabelText('Close'));
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(alert).not.toHaveBeenCalled();
  expect(coreFinanceService.discardDraft).not.toHaveBeenCalled();
});

it('confirms before discarding changed edit values without touching the add draft', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  const transaction = fixtureTransactions[1];
  renderWithQueryData(<TransactionForm transaction={transaction} />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);
  fireEvent.changeText(await screen.findByLabelText('Description'), 'Changed');
  fireEvent.press(screen.getByLabelText('Close'));
  expect(alert).toHaveBeenCalledWith(
    'Discard changes?',
    expect.any(String),
    expect.any(Array)
  );
  expect(router.back).not.toHaveBeenCalled();
  expect(coreFinanceService.discardDraft).not.toHaveBeenCalled();
});

it('falls back to transactions after save when edit was opened directly', async () => {
  const transaction = fixtureTransactions[1];
  jest.mocked(router.canGoBack).mockReturnValue(false);
  jest.mocked(coreFinanceService.updateTransaction).mockResolvedValue({
    value: transaction,
    affectedScopes: []
  });
  renderWithQueryData(<TransactionForm transaction={transaction} />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);

  fireEvent.press(await screen.findByLabelText('Save transaction'));
  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/transactions')
  );
  expect(router.back).not.toHaveBeenCalled();
});

it('uses the approved manual workspace with exactly three transaction types', async () => {
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);

  expect(await screen.findByTestId('transaction-edit-hero')).toBeTruthy();
  for (const type of ['expense', 'income', 'transfer'] as const) {
    expect(screen.getByTestId(`transaction-edit-type-${type}`)).toHaveStyle({
      flex: 1,
      minWidth: 0
    });
  }
  expect(screen.queryByText('Refund')).toBeNull();
  expect(screen.queryByText('Obligation payment')).toBeNull();
  expect(screen.getByLabelText('Note')).toBeTruthy();
  expect(screen.getByLabelText('Date')).toBeTruthy();
  expect(screen.getByText('Account')).toBeTruthy();
  expect(screen.getByText('Category')).toBeTruthy();
});

it('restores and saves the manual note and occurred-at date', async () => {
  const occurredAt = 1_723_939_200_000;
  jest.mocked(coreFinanceService.loadDraft).mockResolvedValueOnce({
    id: 'manual-entry',
    transactionType: 'expense',
    amountText: '25.50',
    accountId: fixtureAccounts[0].id,
    destinationAccountId: null,
    categoryId: fixtureCategories[0].id,
    merchant: 'Lunch',
    notes: 'Team lunch',
    occurredAt,
    status: 'editing',
    updatedAt: occurredAt
  });
  jest.mocked(coreFinanceService.createTransaction).mockResolvedValue({
    value: fixtureTransactions[0],
    affectedScopes: []
  });

  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);

  expect(await screen.findByDisplayValue('Team lunch')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Save transaction'));

  await waitFor(() =>
    expect(coreFinanceService.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: 'Team lunch',
        occurredAt
      }),
      expect.stringMatching(/^[0-9a-f-]{36}$/)
    )
  );
});

it('bypasses the draft guard after creating a transaction', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  jest.mocked(router.replace).mockImplementation(() => {
    jest
      .mocked(usePreventRemove)
      .mock.calls.at(-1)?.[1]({
        data: { action: { type: 'REPLACE' } }
      });
  });
  jest.mocked(coreFinanceService.loadDraft).mockResolvedValueOnce({
    id: MANUAL_TRANSACTION_DRAFT_ID,
    transactionType: 'expense',
    amountText: '25',
    accountId: fixtureAccounts[0].id,
    destinationAccountId: null,
    categoryId: fixtureCategories[0].id,
    merchant: 'Lunch',
    notes: null,
    occurredAt: 1_723_939_200_000,
    status: 'editing',
    updatedAt: 1_723_939_200_000
  });
  jest.mocked(coreFinanceService.createTransaction).mockResolvedValue({
    value: fixtureTransactions[0],
    affectedScopes: []
  });
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);

  fireEvent.press(await screen.findByLabelText('Save transaction'));

  await waitFor(() => expect(router.replace).toHaveBeenCalled());
  expect(coreFinanceService.createTransaction).toHaveBeenCalledTimes(1);
  expect(alert).not.toHaveBeenCalled();
});

it('clears saved add values and blocks stale draft saves while submitting', async () => {
  jest.useFakeTimers();
  jest.mocked(coreFinanceService.loadDraft).mockResolvedValueOnce({
    id: MANUAL_TRANSACTION_DRAFT_ID,
    transactionType: 'expense',
    amountText: '',
    accountId: null,
    destinationAccountId: null,
    categoryId: fixtureCategories[0].id,
    merchant: null,
    notes: null,
    occurredAt: 1_723_939_200_000,
    status: 'editing',
    updatedAt: 1_723_939_200_000
  });
  let resolveCreate: (value: {
    value: (typeof fixtureTransactions)[number];
    affectedScopes: string[];
  }) => void = () => undefined;
  jest.mocked(coreFinanceService.createTransaction).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
  );
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);

  fireEvent.changeText(await screen.findByLabelText('Amount'), '200');
  fireEvent.changeText(screen.getByLabelText('Description'), 'Rent');
  fireEvent.press(screen.getByLabelText('Save transaction'));
  await waitFor(() =>
    expect(coreFinanceService.createTransaction).toHaveBeenCalledTimes(1)
  );

  act(() => jest.advanceTimersByTime(300));
  expect(jest.mocked(coreFinanceService.saveDraft).mock.calls).toHaveLength(1);
  expect(
    jest.mocked(coreFinanceService.saveDraft).mock.calls[0][0].submission?.phase
  ).toBe('submitting');

  await act(async () =>
    resolveCreate({ value: fixtureTransactions[0], affectedScopes: [] })
  );
  await waitFor(() => expect(router.replace).toHaveBeenCalled());
  await act(async () => {
    mockFocusEffectCallback?.();
  });

  expect(screen.queryByDisplayValue('200')).toBeNull();
  expect(screen.queryByDisplayValue('Rent')).toBeNull();
});

it('shows only three equal transaction types in edit mode', async () => {
  renderWithQueryData(
    <TransactionForm transaction={fixtureTransactions[1]} />,
    [
      [coreFinanceKeys.accounts(false), fixtureAccounts],
      [coreFinanceKeys.categories(false), fixtureCategories]
    ]
  );

  for (const type of ['expense', 'income', 'transfer'] as const) {
    expect(
      await screen.findByTestId(`transaction-edit-type-${type}`)
    ).toHaveStyle({
      flex: 1,
      minWidth: 0
    });
  }
  expect(screen.queryByText('Refund')).toBeNull();
  expect(screen.queryByText('Obligation payment')).toBeNull();
});

it('mirrors the three edit types naturally in Arabic', async () => {
  changeLocale('ar');
  renderWithQueryData(
    <TransactionForm transaction={fixtureTransactions[1]} />,
    [
      [coreFinanceKeys.accounts(false), fixtureAccounts],
      [coreFinanceKeys.categories(false), fixtureCategories]
    ]
  );

  expect(
    await screen.findByTestId('transaction-edit-type-selector')
  ).toHaveStyle({
    flexDirection: 'row-reverse'
  });
  expect(screen.getByTestId('transaction-edit-type-expense')).toBeTruthy();
  expect(screen.getByTestId('transaction-edit-type-income')).toBeTruthy();
  expect(screen.getByTestId('transaction-edit-type-transfer')).toBeTruthy();
});

it('opens existing relationships and exposes eligible secondary actions', async () => {
  const transaction = {
    ...fixtureTransactions[1],
    source: 'automatic' as const,
    originalTransactionId: 'tx-original',
    obligationId: 'obligation-1'
  };
  renderWithQueryData(<TransactionForm transaction={transaction} />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);

  fireEvent.press(await screen.findByText('tx-original'));
  expect(router.push).toHaveBeenCalledWith('/transactions/tx-original');
  fireEvent.press(screen.getByText('obligation-1'));
  expect(router.push).toHaveBeenCalledWith('/obligations/obligation-1');
  expect(
    screen.getByText(translate('support.report.transaction'))
  ).toBeTruthy();
  expect(
    screen.getByText(translate('tracking.action.reportWrong'))
  ).toBeTruthy();
  expect(
    screen.getByText(translate('coreFinance.transaction.delete'))
  ).toBeTruthy();
});

it.each([
  ['partial', '25', 2_500],
  ['full', '100', 10_000]
] as const)(
  'submits a linked %s refund with the original relationship and fixed financial fields',
  async (kind, amount, expectedMinor) => {
    const original = {
      ...fixtureTransactions[0],
      id: `refund-original-${kind}`,
      type: 'expense' as const,
      amountMinor: 10_000,
      title: `Original ${kind} purchase`,
      currencyCode: 'SAR',
      accountId: 'account-bank',
      categoryId: 'food',
      status: 'posted' as const,
      reviewStatus: 'none' as const,
      syncStatus: 'synced' as const
    };
    jest.mocked(coreFinanceService.createTransaction).mockResolvedValue({
      value: {
        ...fixtureTransactions[0],
        type: 'refund',
        originalTransactionId: original.id
      },
      affectedScopes: []
    });

    renderWithQueryData(
      <TransactionForm
        initialType="refund"
        originalTransactionId={original.id}
      />,
      [
        [coreFinanceKeys.accounts(false), fixtureAccounts],
        [coreFinanceKeys.categories(false), fixtureCategories],
        [coreFinanceKeys.transaction(original.id), original]
      ]
    );

    expect(
      await screen.findByText(translate('coreFinance.type.refund'))
    ).toBeTruthy();
    expect(await screen.findByText('Food')).toBeTruthy();
    expect(screen.getByText('Daily account')).toBeTruthy();
    expect(screen.getByText(original.title)).toBeTruthy();
    expect(screen.getByText(/100\.00/)).toBeTruthy();
    expect(screen.getByLabelText('Category, Food')).toHaveAccessibilityState({
      disabled: true
    });
    expect(
      screen.getByLabelText('Account, Daily account')
    ).toHaveAccessibilityState({ disabled: true });
    fireEvent.press(screen.getByText(original.title));
    expect(router.push).toHaveBeenCalledWith(`/transactions/${original.id}`);
    expect(screen.queryByTestId('transaction-edit-type-selector')).toBeNull();
    expect(screen.queryByTestId('transaction-edit-type-expense')).toBeNull();
    expect(screen.queryByTestId('transaction-edit-type-income')).toBeNull();
    expect(screen.queryByTestId('transaction-edit-type-transfer')).toBeNull();

    fireEvent.changeText(screen.getByLabelText('Amount'), amount);
    fireEvent.changeText(
      screen.getByLabelText('Description'),
      `${kind} refund`
    );
    fireEvent.press(screen.getByLabelText('Save transaction'));

    await waitFor(() =>
      expect(coreFinanceService.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'refund',
          amountMinor: expectedMinor,
          currencyCode: original.currencyCode,
          accountId: original.accountId,
          categoryId: original.categoryId,
          originalTransactionId: original.id,
          title: `${kind} refund`
        }),
        expect.stringMatching(/^[0-9a-f-]{36}$/),
        undefined,
        original.version
      )
    );
  }
);

it.each([
  ['excessive', {}, '101', 10_000],
  ['ineligible', { reviewStatus: 'required' as const }, '25', 10_000]
] as const)(
  'rejects an %s linked refund with a corrective message and no mutation',
  async (_case, originalPatch, amount, remainingMinor) => {
    const original = {
      ...fixtureTransactions[0],
      id: `refund-invalid-${_case}`,
      type: 'expense' as const,
      amountMinor: 10_000,
      currencyCode: 'SAR',
      accountId: 'account-bank',
      categoryId: 'food',
      status: 'posted' as const,
      reviewStatus: 'none' as const,
      syncStatus: 'synced' as const,
      ...originalPatch
    };
    jest
      .mocked(coreFinanceService.getRemainingRefundableMinor)
      .mockResolvedValue(remainingMinor);

    renderWithQueryData(
      <TransactionForm
        initialType="refund"
        originalTransactionId={original.id}
      />,
      [
        [coreFinanceKeys.accounts(false), fixtureAccounts],
        [coreFinanceKeys.categories(false), fixtureCategories],
        [coreFinanceKeys.transaction(original.id), original]
      ]
    );

    fireEvent.changeText(await screen.findByLabelText('Amount'), amount);
    fireEvent.changeText(screen.getByLabelText('Description'), 'Refund');
    fireEvent.press(screen.getByLabelText('Save transaction'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      translate('coreFinance.validation.refund')
    );
    expect(coreFinanceService.createTransaction).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  }
);

it.each([
  ['text edit', '50', 'Updated refund', 5_000],
  ['allowed increase', '60', 'Refund', 6_000]
] as const)(
  'allows a linked refund %s within capacity that excludes itself',
  async (_case, amount, title, expectedMinor) => {
    const original = {
      ...fixtureTransactions[0],
      id: 'editable-refund-original',
      type: 'expense' as const,
      amountMinor: 10_000,
      accountId: 'account-bank',
      currencyCode: 'SAR',
      categoryId: 'food',
      status: 'posted' as const,
      reviewStatus: 'none' as const,
      syncStatus: 'synced' as const
    };
    const refund = {
      ...fixtureTransactions[0],
      id: `editable-refund-${_case}`,
      type: 'refund' as const,
      amountMinor: 5_000,
      accountId: original.accountId,
      currencyCode: original.currencyCode,
      categoryId: original.categoryId,
      title: 'Refund',
      originalTransactionId: original.id
    };
    jest
      .mocked(coreFinanceService.getRemainingRefundableMinor)
      .mockResolvedValue(10_000);
    jest.mocked(coreFinanceService.updateTransaction).mockResolvedValue({
      value: { ...refund, amountMinor: expectedMinor, title },
      affectedScopes: []
    });

    renderWithQueryData(<TransactionForm transaction={refund} />, [
      [coreFinanceKeys.accounts(false), fixtureAccounts],
      [coreFinanceKeys.categories(false), fixtureCategories],
      [coreFinanceKeys.transaction(original.id), original]
    ]);

    fireEvent.changeText(await screen.findByLabelText('Amount'), amount);
    fireEvent.changeText(screen.getByLabelText('Description'), title);
    fireEvent.press(screen.getByLabelText('Save transaction'));

    await waitFor(() =>
      expect(coreFinanceService.updateTransaction).toHaveBeenCalledWith(
        refund.id,
        expect.objectContaining({ amountMinor: expectedMinor, title })
      )
    );
    expect(coreFinanceService.getRemainingRefundableMinor).toHaveBeenCalledWith(
      original.id,
      refund.id
    );
  }
);

it('rejects an edited linked refund above capacity without mutation', async () => {
  const original = {
    ...fixtureTransactions[0],
    id: 'edit-refund-limit-original',
    type: 'expense' as const,
    amountMinor: 10_000,
    accountId: 'account-bank',
    currencyCode: 'SAR',
    categoryId: 'food'
  };
  const refund = {
    ...fixtureTransactions[0],
    id: 'edit-refund-limit',
    type: 'refund' as const,
    amountMinor: 5_000,
    accountId: original.accountId,
    currencyCode: original.currencyCode,
    categoryId: original.categoryId,
    originalTransactionId: original.id
  };
  jest
    .mocked(coreFinanceService.getRemainingRefundableMinor)
    .mockResolvedValue(10_000);

  renderWithQueryData(<TransactionForm transaction={refund} />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories],
    [coreFinanceKeys.transaction(original.id), original]
  ]);

  fireEvent.changeText(await screen.findByLabelText('Amount'), '101');
  fireEvent.press(screen.getByLabelText('Save transaction'));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    translate('coreFinance.validation.refund')
  );
  expect(coreFinanceService.updateTransaction).not.toHaveBeenCalled();
});

it('identifies and locks the linked refund flow accessibly in Arabic', async () => {
  changeLocale('ar');
  const original = {
    ...fixtureTransactions[0],
    id: 'refund-original-ar',
    type: 'expense' as const,
    title: 'مشتريات أصلية',
    currencyCode: 'SAR',
    accountId: 'account-bank',
    categoryId: 'food'
  };

  renderWithQueryData(
    <TransactionForm
      initialType="refund"
      originalTransactionId={original.id}
    />,
    [
      [coreFinanceKeys.accounts(false), fixtureAccounts],
      [coreFinanceKeys.categories(false), fixtureCategories],
      [coreFinanceKeys.transaction(original.id), original]
    ]
  );

  expect(await screen.findByText('استرداد')).toBeTruthy();
  expect(screen.getByText(original.title)).toBeTruthy();
  expect(screen.getByLabelText('الفئة, الطعام')).toHaveAccessibilityState({
    disabled: true
  });
  expect(
    screen.getByLabelText('الحساب, Daily account')
  ).toHaveAccessibilityState({
    disabled: true
  });
});

it('disables editing after deletion and restores it after undo', async () => {
  const transaction = fixtureTransactions[1];
  const undoExpiresAt = Date.now() + 30_000;
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  jest.mocked(coreFinanceService.deleteTransaction).mockResolvedValue({
    value: { ...transaction, status: 'deleted', undoExpiresAt },
    undoExpiresAt,
    affectedScopes: []
  });
  jest.mocked(coreFinanceService.undoDelete).mockResolvedValue({
    value: transaction,
    affectedScopes: []
  });
  renderWithQueryData(<TransactionForm transaction={transaction} />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);

  fireEvent.press(await screen.findByText('Delete transaction'));
  const confirmDelete = alert.mock.calls[0]?.[2]?.find(
    (button) => button.style === 'destructive'
  );
  await act(async () => confirmDelete?.onPress?.());
  await waitFor(() =>
    expect(
      screen.getByLabelText('Save transaction').props.accessibilityState
        .disabled
    ).toBe(true)
  );

  fireEvent.press(screen.getByLabelText('Undo'));
  await waitFor(() =>
    expect(
      screen.getByLabelText('Save transaction').props.accessibilityState
        .disabled
    ).toBe(false)
  );
});

it.each([0, 1])('recovers a frozen Manual submission only when firstAttemptAt respects updatedAt (offset %s)', async (offset) => {
  const fixtureTime = Date.now() - 1000;
  const input = transactionInputSchema.parse({
    type: 'expense', amountMinor: 5000, currencyCode: 'SAR',
    accountId: fixtureAccounts[0].id, categoryId: 'food',
    title: 'Frozen Food', occurredAt: fixtureTime
  });
  const operationId = '90000000-0000-4000-8000-000000000098';
  jest.mocked(coreFinanceService.loadDraft).mockResolvedValue({
    ...requiredDraft('50', 'Food'), updatedAt: fixtureTime,
    submission: { version: 1, operationId, input, firstAttemptAt: fixtureTime + offset, phase: 'submitting' }
  });
  jest.mocked(coreFinanceService.createTransaction).mockResolvedValue({ value: fixtureTransactions[0], affectedScopes: [] });
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);
  await screen.findByText(translate(offset === 0 ? 'coreFinance.manual.uncertain' : 'coreFinance.manual.reconcile'));
  expect(coreFinanceService.createTransaction).not.toHaveBeenCalled();
  if (offset === 1) return;
  expect(screen.getByLabelText('Amount')).toHaveProp('editable', false);
  fireEvent.press(screen.getByLabelText('Save transaction'));
  await waitFor(() => expect(coreFinanceService.createTransaction).toHaveBeenCalledWith(input, operationId));
});

it.each([
  ['validation400', 'validation', { status: 400, domainCode: 'VALIDATION_FAILED' }, 'coreFinance.validation.invalid'],
  ['forbidden403', 'unknown', { status: 403, domainCode: 'FORBIDDEN' }, 'coreFinance.validation.invalid'],
  ['profile403', 'unknown', { status: 403, domainCode: 'PROFILE_INACTIVE' }, 'coreFinance.validation.invalid'],
  ['notfound404', 'not_found', { status: 404, domainCode: 'NOT_FOUND' }, 'coreFinance.validation.invalid'],
  ['conflict409', 'conflict', { status: 409, domainCode: 'IDEMPOTENCY_KEY_REUSED' }, 'coreFinance.validation.invalid'],
  ['currency409', 'conflict', { status: 409, domainCode: 'CURRENCY_MISMATCH' }, 'coreFinance.validation.invalid'],
  ['localSchema', 'validation', undefined, 'coreFinance.validation.invalid'],
  ['auth401', 'offline', { status: 401, domainCode: 'AUTH_TOKEN_INVALID' }, 'coreFinance.manual.auth'],
  ['rate429', 'offline', { status: 429, domainCode: 'RATE_LIMITED' }, 'coreFinance.manual.rateLimit'],
  ['category409', 'conflict', { status: 409, domainCode: 'CATEGORY_INVALID' }, 'coreFinance.manual.category'],
  ['account409', 'conflict', { status: 409, domainCode: 'ACCOUNT_CLOSED' }, 'coreFinance.manual.account'],
  ['timeout503', 'offline', { status: 503, uncertain: true }, 'coreFinance.manual.uncertain'],
  ['receiptMismatch', 'unknown', { status: 502, uncertain: true }, 'coreFinance.manual.uncertain']
] as const)('shows the Arabic Manual %s banner without exposing the request ID', async (_name, code, metadata, message) => {
  changeLocale('ar');
  const requestId = '10000000-0000-4000-8000-000000000077';
  jest.mocked(coreFinanceService.loadDraft).mockResolvedValue(requiredDraft('50', 'Food'));
  jest.mocked(coreFinanceService.createTransaction).mockRejectedValue(new CoreFinanceError(code, metadata ? { ...metadata, requestId } : undefined));
  renderWithQueryData(<TransactionForm />, [
    [coreFinanceKeys.accounts(false), fixtureAccounts],
    [coreFinanceKeys.categories(false), fixtureCategories]
  ]);
  await screen.findByDisplayValue('50');
  fireEvent.press(screen.getByLabelText(translate('coreFinance.form.save')));
  await screen.findByText(translate(message));
  expect(coreFinanceService.createTransaction).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(requestId)).toBeNull();
});

it.each([
  [400, 'VALIDATION_FAILED', 'coreFinance.validation.invalid'],
  [403, 'FORBIDDEN', 'coreFinance.validation.invalid'],
  [403, 'PROFILE_INACTIVE', 'coreFinance.validation.invalid'],
  [401, 'AUTH_TOKEN_INVALID', 'coreFinance.manual.auth'],
  [429, 'RATE_LIMITED', 'coreFinance.manual.rateLimit'],
  [503, 'LEDGER_UNAVAILABLE', 'coreFinance.manual.uncertain'],
  [400, 'AMOUNT_OUT_OF_RANGE', 'coreFinance.validation.invalid']
] as const)('preserves HTTP %s %s metadata through the live adapter and Arabic Manual banner', async (status, domainCode, message) => {
  const { registerLiveClerkBridge } = jest.requireActual<typeof import('@/services/live/auth-service')>('@/services/live/auth-service');
  const { createLiveCoreFinanceService } = jest.requireActual<typeof import('@/services/mocks/core-finance-service')>('@/services/mocks/core-finance-service');
  const unavailable = async (): Promise<never> => { throw new Error('INERT_IDENTITY_OPERATION_DISABLED'); };
  registerLiveClerkBridge({
    getSession: async () => ({ id: 'session-inert', userId: 'user_inert', method: 'google', issuedAt: 1, expiresAt: 9999999999999 }),
    getToken: async () => 'inert-token', startPhone: unavailable, verifyPhone: unavailable,
    resendPhone: unavailable, signInWithGoogle: unavailable, reverifyConflict: unavailable, signOut: unavailable
  });
  const requestId = '10000000-0000-4000-8000-000000000077';
  const request = jest.fn(async () => new Response(JSON.stringify({ code: domainCode, requestId }), { status }));
  const categoryModule = jest.requireActual<typeof import('@/services/live/category-lifecycle-service')>('@/services/live/category-lifecycle-service');
  const createCategories = categoryModule.createLiveCategoryLifecycleService;
  const categorySetup = jest.spyOn(categoryModule, 'createLiveCategoryLifecycleService').mockImplementation(options => ({
    ...createCategories(options),
    // This fixture supplies prepared IDs; HTTP, ledger and error mapping remain real.
    prepareCategoryIds: async () => undefined,
    serverCategoryId: id => id === 'food' ? '10000000-0000-4000-8000-000000000001' : id
  }));
  try {
    const live = createLiveCoreFinanceService({ baseUrl: 'https://api.example.invalid', request });
    changeLocale('ar');
    jest.mocked(coreFinanceService.loadDraft).mockResolvedValue(requiredDraft('50', 'Food'));
    const caught: unknown[] = [];
    jest.mocked(coreFinanceService.createTransaction).mockImplementation(async (...args) => {
      try { return await live.createTransaction(...args); }
      catch (error) { caught.push(error); throw error; }
    });
    renderWithQueryData(<TransactionForm />, [
      [coreFinanceKeys.accounts(false), fixtureAccounts],
      [coreFinanceKeys.categories(false), fixtureCategories]
    ]);
    await screen.findByDisplayValue('50');
    fireEvent.press(screen.getByLabelText(translate('coreFinance.form.save')));
    await waitFor(() => expect(caught).toHaveLength(1));
    expect(request).toHaveBeenCalledTimes(1);
    const error = caught[0];
    expect(error).toBeInstanceOf(CoreFinanceError);
    if (!(error instanceof CoreFinanceError)) throw new Error('Expected a mapped CoreFinanceError');
    expect(error.metadata).toMatchObject({ status, domainCode, requestId });
    await screen.findByText(translate(message));
    expect(screen.queryByText(requestId)).toBeNull();
  } finally {
    categorySetup.mockRestore();
  }
});
