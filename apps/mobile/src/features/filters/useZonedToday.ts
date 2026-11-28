import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import {
  buildFinancialPeriod,
  localDateInTimeZone
} from '@/domain/financial-period';
export function useZonedToday(timeZone: string, followToday = true) {
  const [now, setNow] = useState(Date.now);
  const today = useMemo(
    () => localDateInTimeZone(now, timeZone),
    [now, timeZone]
  );
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
  return today;
}
