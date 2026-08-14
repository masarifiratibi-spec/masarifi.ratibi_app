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
import { reportsServiceCapability } from '@/services/contracts/reports-service';
import type { CapabilityProviderHandle } from '@/services/contracts/capability-contract';
import { ReportsRepository } from '@/storage/reports-repository';
import {
  fixtureCategories,
  fixtureRates,
  fixtureTransactions
} from '@/test-utils/core-finance-fixtures';
import { financialPlanningService } from './financial-planning-service';
import { createReportOutputAttempt } from './report-delivery-adapter';

type OutputFailure = ReportOutputAttempt['failureCategory'];

export function createMockReportsService(
  repository = new ReportsRepository(),
  options: {
    outputFailures?: Readonly<Record<string, OutputFailure>>;
    outputDelayMs?: number;
  } = {}
): CapabilityProviderHandle<ReportsService> {
  const previews = new Map<string, ReportPreview>();
  const verifiedRecipients = new Map<
    string,
    ReturnType<typeof verifyRecipient>
  >();

  async function report(
    input: Parameters<ReportsService['getReport']>[0]
  ): Promise<FinancialReport> {
    const period = resolveReportPeriod({
      ...input,
      now: Date.UTC(2026, 7, 9, 12)
    });
    const planning =
      await financialPlanningService.getReportingSnapshot(period);
    return buildFinancialReport({
      period,
      transactions: fixtureTransactions,
      categories: fixtureCategories,
      planning,
      exchangeRates: fixtureRates,
      currencyCode: input.currencyCode,
      generatedAt: Date.UTC(2026, 7, 9, 12)
    });
  }

  return {
    metadata: {
      id: 'mock-reports',
      capability: reportsServiceCapability.capability,
      majorVersion: reportsServiceCapability.majorVersion,
      kind: 'mock',
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
      const value = await report(input);
      const preview: ReportPreview = {
        previewId: `report-preview-${value.key}:${input.detailLevel}`,
        snapshot: buildSnapshot({
          report: value,
          detailLevel: input.detailLevel,
          language: input.language,
          transactions: fixtureTransactions,
          categoryLabel: (id) =>
            fixtureCategories.find((category) => category.id === id)?.labelEn ??
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

export const reportsService = createMockReportsService(
  new ReportsRepository(process.env.NODE_ENV !== 'test')
);
