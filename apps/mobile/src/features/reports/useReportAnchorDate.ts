import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  buildFinancialPeriod,
  localDateInTimeZone
} from '@/domain/financial-period';
import { useReportsViewState } from '@/state/reports-view-state';
import { usePreferenceStore } from '@/state/preferences';

export function useReportAnchorDate() {
  const { anchorDate, followToday } = useReportsViewState();
  const timeZone = usePreferenceStore((state) => state.timeZone);
  const [now, setNow] = useState(Date.now);
  const today = localDateInTimeZone(now, timeZone);
  useEffect(() => {
    if (!followToday) return;
    const refresh = () => setNow(Date.now());
    refresh();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const end = buildFinancialPeriod({
      anchorDate: today,
      preset: 'today',
      timeZone,
      monthStartDay: 1
    }).endInstant;
    const timer = setTimeout(refresh, Math.max(1, end + 1 - Date.now()));
    return () => {
      clearTimeout(timer);
      listener.remove();
    };
  }, [followToday, today, timeZone]);
  return followToday ? today : anchorDate;
}
