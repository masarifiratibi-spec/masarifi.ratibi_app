import AsyncStorage from '@react-native-async-storage/async-storage';
import { installBenchmarkEnvironment } from '@/test-utils/benchmark-runtime';
import * as database from '@/storage/database';
import { useAppShellStore } from '@/state/app-shell';
import { createLiveCoreFinanceService } from '@/services/core-finance-runtime';
import { createLiveLedgerService } from './core-finance-service';
import { createLiveAccountService } from './account-service';
import { createLiveCategoryLifecycleService } from './category-lifecycle-service';
import { createLiveFinancialPlanningService } from './financial-planning-service';
import { createLiveAssistantApiService } from './assistant-api-service';
import { registerLiveClerkBridge } from './auth-service';
import { CoreFinanceRepository } from '@/storage/core-finance-repository';
import { FinancialPlanningRepository } from '@/storage/financial-planning-repository';
import { AssistantOperationJournal } from '@/storage/assistant-operation-journal';
import {
  fixtureTransactions,
  fixtureAccounts,
  makeConflict
} from '@/test-utils/core-finance-fixtures';
import type {
  PlanningDraft,
  PlanningConflict
} from '@/domain/financial-planning';
import {
  draftInputSchema,
  transactionInputSchema
} from '@/domain/core-finance';
jest.mock('expo', () =>
  jest.requireActual('@/test-utils/benchmark-runtime').benchmarkExpoMock()
);

const owner = 'user_benchmark_boundary';
const id = '11111111-1111-4111-8111-111111111111';
const transaction = transactionInputSchema.parse({
  type: 'expense',
  amountMinor: 100,
  currencyCode: 'SAR',
  accountId: id,
  categoryId: id,
  title: 'Inert expense',
  occurredAt: 1
});
const transactionDraft = draftInputSchema.parse({
  id: 'existing-draft',
  transactionType: 'expense',
  amountText: '1',
  accountId: id,
  destinationAccountId: null,
  categoryId: null,
  merchant: null,
  notes: null,
  occurredAt: 1,
  status: 'editing',
  updatedAt: 1
});
const planningDraft: PlanningDraft = {
  id: 'existing-planning-draft',
  kind: 'budget',
  entityId: null,
  payload: { amount: 1 },
  status: 'editing',
  updatedAt: 1
};
const planningConflict: PlanningConflict = {
  id: 'planning-conflict',
  entityKind: 'budget',
  entityId: id,
  localSnapshot: { amount: 1 },
  laterSnapshot: { amount: 2 },
  resolution: null,
  status: 'pending',
  createdAt: 1,
  resolvedAt: null
};

function fixture() {
  const getToken = jest.fn(async () => 'inert-token');
  registerLiveClerkBridge({
    getSession: async () => ({
      id: 'session-benchmark',
      userId: owner,
      method: 'google',
      issuedAt: 1,
      expiresAt: Date.now() + 60000
    }),
    getToken,
    startPhone: jest.fn(),
    verifyPhone: jest.fn(),
    resendPhone: jest.fn(),
    signInWithGoogle: jest.fn(),
    reverifyConflict: jest.fn(),
    signOut: jest.fn()
  });
  const request = jest.fn(async () => {
    throw new Error('unexpected network');
  });
  const options = { baseUrl: 'https://inert.invalid', request };
  const drafts = new CoreFinanceRepository({
    transactions: [fixtureTransactions[0]],
    conflicts: [makeConflict()]
  });
  drafts.saveDraft(transactionDraft);
  const planningRepository = new FinancialPlanningRepository({
    drafts: [planningDraft],
    conflicts: [planningConflict]
  });
  const storage = {
    read: jest.fn(async () => null),
    write: jest.fn(async () => undefined)
  };
  const journal = new AssistantOperationJournal(storage);
  const reserve = jest.spyOn(journal, 'reserve');
  const update = jest.spyOn(journal, 'update');
  const assistantIdentity = jest.fn(async () => ({
    userId: owner,
    token: 'inert-token',
    assertCurrent: async () => undefined
  }));
  const offlineUpdate = jest.fn(async () => null);
  return {
    getToken,
    request,
    drafts,
    seededTransactionDraft: drafts.loadDraft(transactionDraft.id),
    planningRepository,
    storage,
    reserve,
    update,
    assistantIdentity,
    offlineUpdate,
    facade: createLiveCoreFinanceService(options),
    ledger: createLiveLedgerService({ ...options, drafts, offlineUpdate }),
    account: createLiveAccountService(options),
    category: createLiveCategoryLifecycleService(options),
    planning: createLiveFinancialPlanningService({
      ...options,
      repository: planningRepository,
      persistent: false
    }),
    assistant: createLiveAssistantApiService({
      ...options,
      identity: assistantIdentity,
      journal
    })
  };
}
type Fixture = ReturnType<typeof fixture>;
const categoryInput = {
  kind: 'custom' as const,
  financialType: 'expense' as const,
  labelAr: 'اختبار',
  labelEn: 'Inert',
  iconKey: null,
  colorKey: null,
  parentId: id,
  isFavorite: false
};
const cases = [
  [
    'offline facade create',
    (f: Fixture) => f.facade.createTransaction(transaction)
  ],
  [
    'offline facade update',
    (f: Fixture) => f.facade.updateTransaction(id, transaction)
  ],
  [
    'offline facade draft save',
    (f: Fixture) => f.facade.saveDraft(transactionDraft)
  ],
  [
    'offline facade draft discard',
    (f: Fixture) => f.facade.discardDraft(transactionDraft.id)
  ],
  [
    'offline facade conflict resolution',
    (f: Fixture) =>
      f.facade.resolveConflict(
        'conflict-' + fixtureTransactions[0].id,
        'keep_local'
      )
  ],
  [
    'ledger create',
    (f: Fixture) => f.ledger.createTransaction(transaction, id)
  ],
  [
    'ledger update',
    (f: Fixture) => f.ledger.updateTransaction(id, transaction)
  ],
  [
    'ledger batch',
    (f: Fixture) =>
      f.ledger.createTransactionsAtomically([transaction], id, 'voice')
  ],
  ['ledger delete', (f: Fixture) => f.ledger.deleteTransaction(id)],
  ['ledger undo', (f: Fixture) => f.ledger.undoDelete(id)],
  ['ledger draft save', (f: Fixture) => f.ledger.saveDraft(transactionDraft)],
  [
    'ledger draft discard',
    (f: Fixture) => f.ledger.discardDraft(transactionDraft.id)
  ],
  [
    'account create',
    (f: Fixture) => f.account.createAccount(fixtureAccounts[0], id)
  ],
  [
    'account update',
    (f: Fixture) => f.account.updateAccount(id, fixtureAccounts[0], 1, id)
  ],
  [
    'account payoff POST',
    (f: Fixture) =>
      f.account.calculateCreditCardPayoff({
        balanceMinor: 1000,
        monthlyInterestRateBasisPoints: 100,
        paymentMinor: 100
      })
  ],
  [
    'category create with parent preparation',
    (f: Fixture) => f.category.createCategory(categoryInput, id)
  ],
  [
    'category update with parent preparation',
    (f: Fixture) => f.category.updateCategory(id, categoryInput, 1, id)
  ],
  [
    'budget save',
    (f: Fixture) =>
      f.planning.saveBudget(
        {
          periodKey: '2026-11',
          name: 'Inert',
          currencyCode: 'SAR',
          incomeTargetMinor: 100,
          configuredExpenseLimitMinor: 100,
          savingsTargetMinor: 0,
          rolloverEnabled: false
        },
        id
      )
  ],
  [
    'budget confirm',
    (f: Fixture) => f.planning.confirmBudgetMove('preview', id)
  ],
  [
    'planning conflict resolution',
    (f: Fixture) =>
      f.planning.resolveConflict(planningConflict.id, 'keep_local')
  ],
  [
    'planning draft save',
    (f: Fixture) =>
      f.planning.saveDraft({ ...planningDraft, payload: { amount: 999 } })
  ],
  [
    'planning draft discard',
    (f: Fixture) => f.planning.discardDraft(planningDraft.id)
  ],
  ['assistant confirm', (f: Fixture) => f.assistant.confirmAction(id, 1, id)],
  ['assistant cancel', (f: Fixture) => f.assistant.cancelAction(id, 1, id)],
  ['assistant retry', (f: Fixture) => f.assistant.retryQuestionOperation!()],
  ['assistant resume', (f: Fixture) => f.assistant.resumeQuestion!()]
] as const;

describe.each(['local', 'restored'] as const)('%s owner', (restoration) => {
  test.each(cases)(
    '%s rejects before credentials, storage, offline routing or journals',
    async (_name, execute) => {
      const restoreEnvironment = installBenchmarkEnvironment();
      const open = jest
        .spyOn(database, 'openDatabase')
        .mockRejectedValue(new Error('unexpected database'));
      useAppShellStore.setState({
        session: {
          status: 'authenticated',
          userId: owner,
          method: 'google',
          issuedAt: 1,
          expiresAt: Date.now() + 60000,
          restoration
        },
        privacyLock: {
          enabled: true,
          autoLockDuration: 'immediate',
          appLockStatus: 'unlocked'
        }
      });
      const before = await AsyncStorage.multiGet(
        await AsyncStorage.getAllKeys()
      );
      const f = fixture();
      try {
        await expect(execute(f)).rejects.toThrow('benchmark_read_only');
        expect(f.getToken).not.toHaveBeenCalled();
        expect(f.assistantIdentity).not.toHaveBeenCalled();
        expect(f.reserve).not.toHaveBeenCalled();
        expect(f.update).not.toHaveBeenCalled();
        expect(f.storage.write).not.toHaveBeenCalled();
        expect(f.offlineUpdate).not.toHaveBeenCalled();
        expect(open).not.toHaveBeenCalled();
        expect(f.request).not.toHaveBeenCalled();
        expect(f.drafts.loadDraft(transactionDraft.id)).toEqual(
          f.seededTransactionDraft
        );
        expect(f.planningRepository.loadDraft(planningDraft.id)).toEqual(
          planningDraft
        );
        expect(
          f.planningRepository.requireConflict(planningConflict.id)
        ).toEqual(planningConflict);
        expect(
          await AsyncStorage.multiGet(await AsyncStorage.getAllKeys())
        ).toEqual(before);
      } finally {
        restoreEnvironment();
        open.mockRestore();
        useAppShellStore.setState({ session: null });
      }
    }
  );
});

test('benchmark planning reads retain legitimate local draft/conflict hydration', async () => {
  const restoreEnvironment = installBenchmarkEnvironment();
  try {
    const repository = new FinancialPlanningRepository({
      drafts: [planningDraft],
      conflicts: [planningConflict]
    });
    const service = createLiveFinancialPlanningService({
      repository,
      persistent: false
    });
    await expect(service.loadDraft(planningDraft.id)).resolves.toEqual(
      planningDraft
    );
    await expect(service.getConflict(planningConflict.id)).resolves.toEqual(
      planningConflict
    );
  } finally {
    restoreEnvironment();
  }
});
