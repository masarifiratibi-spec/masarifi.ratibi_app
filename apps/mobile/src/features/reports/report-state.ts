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
