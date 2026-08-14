import type {
  ReportOutputAttempt,
  ReportOutputKind,
  ReportSnapshot
} from '@/domain/reports';

export function createReportOutputAttempt(input: {
  kind: ReportOutputKind;
  operationId: string;
  snapshot: ReportSnapshot;
  scheduleId?: string | null;
  retryOfAttemptId?: string | null;
  forceFailure?: 'temporary' | 'recipient' | 'configuration' | 'unknown' | null;
  scheduleStatusAtCompletion?: ReportOutputAttempt['scheduleStatusAtCompletion'];
  now?: number;
}): ReportOutputAttempt {
  const now = input.now ?? Date.now();
  const simulated = input.kind === 'download' || input.kind === 'share';
  const failed = input.forceFailure ?? null;
  return {
    id: `report-attempt-${input.operationId}`,
    operationId: input.operationId,
    scheduleId: input.scheduleId ?? null,
    kind: input.kind,
    status: failed ? 'failed' : simulated ? 'simulated' : 'sent',
    snapshot: input.snapshot,
    retryOfAttemptId: input.retryOfAttemptId ?? null,
    failureCategory: failed,
    requestedAt: now,
    completedAt: now + 250,
    scheduleStatusAtCompletion: input.scheduleStatusAtCompletion ?? null
  };
}
