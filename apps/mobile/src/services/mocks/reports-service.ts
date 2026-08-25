import { Platform } from 'react-native';
import {
  emptyTransactionFilters,
  matchesFilters,
  type Category,
  type ExchangeRateEstimate,
  type Transaction
} from '@/domain/core-finance';
import {
  buildFinancialReport,
  buildSchedule,
  buildSnapshot,
  resolveReportPeriod,
  verifyRecipient
} from '@/domain/reports';
import type {
  FinancialReport,
  ReportOutputAttempt,
  ReportPreview,
  ReportSnapshot,
  ReportScheduleDraft
} from '@/domain/reports';
import type {
  AttemptPage,
  ReportsService
} from '@/services/contracts/reports-service';
import type { CoreFinanceService } from '@/services/contracts/core-finance-service';
import { reportsServiceCapability } from '@/services/contracts/reports-service';
import type { CapabilityProviderHandle } from '@/services/contracts/capability-contract';
import type { CapabilityProviderKind } from '@/services/contracts/capability-contract';
import { ReportsRepository } from '@/storage/reports-repository';
import { registerRuntimeUserDataReset } from '@/storage/runtime-user-data-reset';
import {
  fixtureCategories,
  fixtureRates,
  fixtureTransactions
} from '@/test-utils/core-finance-fixtures';
import { financialPlanningService } from './financial-planning-service';
import { coreFinanceService } from './core-finance-service';
import { createReportOutputAttempt } from './report-delivery-adapter';

type OutputFailure = ReportOutputAttempt['failureCategory'];
type ReportLedgerFinance = Pick<
  CoreFinanceService,
  'listCategories' | 'listTransactions'
>;

interface ReportLedgerSnapshot {
  categories: Category[];
  exchangeRates: ExchangeRateEstimate[];
  transactions: Transaction[];
}

export function createMockReportsService(
  repository = new ReportsRepository(),
  options: {
    now?: () => number;
    outputFailures?: Readonly<Record<string, OutputFailure>>;
    outputDelayMs?: number;
    registerForReset?: boolean;
    providerKind?: CapabilityProviderKind;
  } = {},
  finance?: ReportLedgerFinance
): CapabilityProviderHandle<ReportsService> {
  const previews = new Map<string, ReportPreview>();
  const verifiedRecipients = new Map<
    string,
    ReturnType<typeof verifyRecipient>
  >();
  if (options.registerForReset)
    registerRuntimeUserDataReset(() => {
      repository.reset();
      previews.clear();
      verifiedRecipients.clear();
    });

  async function report(
    input: Parameters<ReportsService['getReport']>[0],
    suppliedLedger?: ReportLedgerSnapshot
  ): Promise<FinancialReport> {
    const ledger = suppliedLedger ?? (await reportLedger(finance));
    const transactions = input.accountIds?.length
      ? ledger.transactions.filter((transaction) =>
          matchesFilters(transaction, {
            ...emptyTransactionFilters,
            accountIds: input.accountIds ?? []
          })
        )
      : ledger.transactions;
    const now = options.now?.() ?? Date.UTC(2026, 7, 9, 12);
    const period = resolveReportPeriod({ ...input, now });
    const planning =
      await financialPlanningService.getReportingSnapshot(period);
    return buildFinancialReport({
      period,
      transactions,
      categories: ledger.categories,
      planning,
      exchangeRates: ledger.exchangeRates,
      currencyCode: input.currencyCode,
      generatedAt: now
    });
  }

  return {
    metadata: {
      id: options.providerKind === 'live' ? 'local-reports' : 'mock-reports',
      capability: reportsServiceCapability.capability,
      majorVersion: reportsServiceCapability.majorVersion,
      kind: options.providerKind ?? 'mock',
      availability: 'available'
    },
    async getReport(input) {
      return report(input);
    },
    async getBreakdown(input) {
      const value = await report(input);
      return (
        value.breakdowns.find((item) => item.dimension === input.dimension) ??
        value.breakdowns[0]
      );
    },
    async getSchedule() {
      return repository.getSchedule();
    },
    async verifyRecipient(email, operationId) {
      const verification = verifyRecipient(email);
      if (verification.status === 'verified') {
        verifiedRecipients.set(verification.normalizedEmail, verification);
      }
      return {
        value: verification,
        affectedScopes: [`reports.recipient.${operationId}`, 'reports.schedule']
      };
    },
    async saveSchedule(input, expectedVersion, operationId) {
      const normalizedEmail = input.recipientEmail
        .trim()
        .toLocaleLowerCase('en');
      const existingRecipient = (await repository.getSchedule())?.recipient;
      const verification =
        verifiedRecipients.get(normalizedEmail) ??
        (existingRecipient?.status === 'verified' &&
        existingRecipient.normalizedEmail === normalizedEmail
          ? existingRecipient
          : undefined);
      const value = await repository.saveSchedule(
        buildSchedule(input, expectedVersion, Date.now(), verification),
        expectedVersion
      );
      await repository.discardDraft();
      return {
        value,
        affectedScopes: ['reports.schedule', `reports.operation.${operationId}`]
      };
    },
    async setScheduleStatus(status, expectedVersion, operationId) {
      const value = await repository.setScheduleStatus(status, expectedVersion);
      return {
        value,
        affectedScopes: ['reports.schedule', `reports.operation.${operationId}`]
      };
    },
    async saveScheduleDraft(input: ReportScheduleDraft) {
      return repository.saveDraft(input);
    },
    async loadScheduleDraft() {
      return repository.loadDraft();
    },
    async discardScheduleDraft() {
      await repository.discardDraft();
    },
    async previewOutput(input) {
      const ledger = await reportLedger(finance);
      const value = await report(input, ledger);
      const preview: ReportPreview = {
        previewId: `report-preview-${value.key}:${input.detailLevel}`,
        snapshot: buildSnapshot({
          report: value,
          detailLevel: input.detailLevel,
          language: input.language,
          transactions: ledger.transactions,
          categoryLabel: (id) =>
            ledger.categories.find((category) => category.id === id)?.labelEn ??
            'Uncategorized'
        }),
        recipientEmail: input.recipientEmail ?? null
      };
      previews.set(preview.previewId, preview);
      return preview;
    },
    async requestOutput(input, operationId) {
      let snapshot: ReportSnapshot | undefined = [...previews.values()][0]
        ?.snapshot;
      let retryOfAttemptId: string | null = null;
      const kind = input.kind;
      if (input.kind !== 'scheduled' && input.kind !== 'retry') {
        snapshot = previews.get(input.previewId)?.snapshot;
      }
      if (input.kind === 'retry') {
        const previous = await repository.requireAttempt(
          input.previousAttemptId
        );
        snapshot = previous.snapshot;
        retryOfAttemptId = previous.id;
      }
      if (!snapshot) throw new Error('stale_preview');
      if (options.outputDelayMs) {
        await new Promise((resolve) =>
          setTimeout(resolve, options.outputDelayMs)
        );
      }
      const frozenSnapshot = snapshot;
      const scheduleStatusAtCompletion =
        input.kind === 'scheduled'
          ? ((await repository.getSchedule())?.status ?? null)
          : null;
      const value: ReportOutputAttempt = await repository.saveAttempt(
        createReportOutputAttempt({
          kind,
          operationId,
          snapshot: frozenSnapshot,
          scheduleId: input.kind === 'scheduled' ? input.scheduleId : null,
          retryOfAttemptId,
          forceFailure: options.outputFailures?.[operationId],
          scheduleStatusAtCompletion
        })
      );
      return {
        value,
        affectedScopes: ['reports.attempts', `reports.attempt.${value.id}`]
      };
    },
    async listAttempts(input): Promise<AttemptPage> {
      const items = await repository.listAttempts(input);
      return { items, nextCursor: null, total: items.length };
    },
    async getAttempt(id) {
      return repository.requireAttempt(id);
    }
  };
}

const usesLiveLedger = process.env.NODE_ENV !== 'test';

export const reportsService = createMockReportsService(
  new ReportsRepository(Platform.OS !== 'web' && usesLiveLedger),
  usesLiveLedger
    ? { now: Date.now, registerForReset: true, providerKind: 'live' }
    : {},
  usesLiveLedger ? coreFinanceService : undefined
);

async function reportLedger(
  finance?: ReportLedgerFinance
): Promise<ReportLedgerSnapshot> {
  if (!finance) {
    return {
      categories: fixtureCategories,
      exchangeRates: fixtureRates,
      transactions: fixtureTransactions
    };
  }
  const [categories, transactions] = await Promise.all([
    finance.listCategories(),
    allTransactions(finance)
  ]);
  return { categories, exchangeRates: [], transactions };
}

async function allTransactions(finance: ReportLedgerFinance) {
  const transactions: Transaction[] = [];
  let cursor: string | null = null;
  do {
    const page = await finance.listTransactions(
      emptyTransactionFilters,
      cursor,
      500
    );
    transactions.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return transactions;
}
