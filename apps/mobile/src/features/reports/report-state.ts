import type { ReportDataState, ReportOutputAttempt, ReportSchedule } from '@/domain/reports';
import { translate, type MessageKey } from '@/localization/i18n';

export function reportStateTitle(state: ReportDataState): string {
  const keys: Record<ReportDataState, MessageKey> = {
    complete: 'reports.state.complete',
    empty: 'reports.state.empty',
    insufficient_data: 'reports.state.insufficient_data',
    partial: 'reports.state.partial',
    estimated: 'reports.state.estimated',
    stale: 'reports.state.stale',
    offline: 'reports.state.offline'
  };
  return translate(keys[state]);
}

export function scheduleStateTitle(status: ReportSchedule['status']): string {
  return translate(`reports.schedule.status.${status}` as MessageKey);
}

export function outputStateTitle(status: ReportOutputAttempt['status']): string {
  return translate(`reports.output.status.${status}` as MessageKey);
}

export function pdfFailureMessage(error: unknown): MessageKey {
  const code =
    (error as { code?: string; message?: string })?.code ??
    (error as Error)?.message;
  if (code === 'REPORT_RECIPIENT_UNVERIFIED' || code === 'report_recipient_unverified')
    return 'reports.pdf.emailMissing';
  if (code === 'REPORT_EMAIL_UNAVAILABLE' || code === 'report_email_unavailable')
    return 'reports.pdf.emailUnavailable';
  if (code === 'report_account_scope_unavailable' || code === 'not_found')
    return 'reports.pdf.accountUnsupported';
  if (
    code === 'recent_auth_required' ||
    code === 'permission_required' ||
    code === 'session_expired'
  )
    return 'reports.pdf.authentication';
  if (
    code === 'report_range_mismatch' ||
    code === 'report_timezone_unavailable'
  )
    return 'reports.pdf.periodUnsupported';
  if (code === 'REPORT_PDF_REQUIRES_INTERNET' || code === 'offline')
    return 'reports.pdf.internet';
  if (code === 'report_pdf_policy_pending') return 'reports.pdf.policyPending';
  if (code === 'REPORT_SAVE_CANCELLED') return 'reports.pdf.cancelled';
  if (code === 'REPORT_FILE_NATIVE_UPDATE_REQUIRED')
    return 'reports.pdf.nativeUpdate';
  if (code === 'REPORT_STILL_PROCESSING') return 'reports.pdf.processing';
  return 'reports.pdf.failure';
}
