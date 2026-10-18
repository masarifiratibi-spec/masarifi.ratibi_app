import type {
  FinancialReport,
  RecipientVerification,
  ReportBreakdown,
  ReportOutputAttempt,
  ReportOutputKind,
  ReportPeriodKind,
  ReportPreview,
  ReportSchedule,
  ReportScheduleDraft,
  ReportScheduleInput
} from '@/domain/reports';
import type { LocalDate } from '@/domain/financial-planning';
import type { MutationResult } from './core-finance-service';
import type { CapabilityContractMetadata } from './capability-contract';
import type { ReadContext } from './read-context';

export const reportsServiceCapability: CapabilityContractMetadata = {
  capability: 'reports.outputs',
  majorVersion: 1,
  owner: 'reports',
  providerKinds: ['mock', 'live'],
  unavailableOutcome: 'reports.state.unavailable'
};

export interface ReportQuery {
  kind: ReportPeriodKind;
  anchorDate: LocalDate;
  currencyCode: string;
  timeZone: string;
  accountIds?: string[];
}

export interface ReportBreakdownQuery extends ReportQuery {
  dimension: ReportBreakdown['dimension'];
}

export interface ReportOutputPreviewInput extends ReportQuery {
  language: 'ar' | 'en';
  detailLevel: 'summary' | 'detailed';
  recipientEmail?: string | null;
}

export interface AttemptQuery {
  scheduleId?: string;
  status?: ReportOutputAttempt['status'];
}

export interface AttemptPage {
  items: ReportOutputAttempt[];
  nextCursor: string | null;
  total: number;
}

export interface ReportsService {
  getReport(
    input: ReportQuery,
    context?: ReadContext
  ): Promise<FinancialReport>;
  getBreakdown(
    input: ReportBreakdownQuery,
    context?: ReadContext
  ): Promise<ReportBreakdown>;
  getSchedule(context?: ReadContext): Promise<ReportSchedule | null>;
  verifyRecipient(
    email: string,
    operationId: string
  ): Promise<MutationResult<RecipientVerification>>;
  saveSchedule(
    input: ReportScheduleInput,
    expectedVersion: number | null,
    operationId: string
  ): Promise<MutationResult<ReportSchedule>>;
  setScheduleStatus(
    status: 'active' | 'paused' | 'disabled',
    expectedVersion: number,
    operationId: string
  ): Promise<MutationResult<ReportSchedule>>;
  saveScheduleDraft(input: ReportScheduleDraft): Promise<ReportScheduleDraft>;
  loadScheduleDraft(): Promise<ReportScheduleDraft | null>;
  discardScheduleDraft(): Promise<void>;
  previewOutput(
    input: ReportOutputPreviewInput,
    context?: ReadContext
  ): Promise<ReportPreview>;
  requestOutput(
    input:
      | {
          kind: Exclude<ReportOutputKind, 'scheduled' | 'retry'>;
          previewId: string;
        }
      | { kind: 'scheduled'; scheduleId: string; scheduledFor: number }
      | { kind: 'retry'; previousAttemptId: string },
    operationId: string
  ): Promise<MutationResult<ReportOutputAttempt>>;
  listAttempts(
    input?: AttemptQuery,
    context?: ReadContext
  ): Promise<AttemptPage>;
  getAttempt(id: string, context?: ReadContext): Promise<ReportOutputAttempt>;
}
