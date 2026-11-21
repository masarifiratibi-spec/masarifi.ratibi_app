import { useZonedToday } from '@/features/filters/useZonedToday';
import { useReportsViewState } from '@/state/reports-view-state';
import { usePreferenceStore } from '@/state/preferences';

export function useReportAnchorDate() {
  const { anchorDate, followToday } = useReportsViewState();
  const timeZone = usePreferenceStore((state) => state.timeZone);
  const today = useZonedToday(timeZone, followToday);
  return followToday ? today : anchorDate;
}
