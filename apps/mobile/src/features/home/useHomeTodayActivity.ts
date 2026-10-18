import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { emptyTransactionFilters } from '@/domain/core-finance';
import { todayPeriod } from '@/features/filters/date-period';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { usePreferenceStore } from '@/state/preferences';

export function useHomeTodayActivity(accountId: string | null) {
  const timeZone = usePreferenceStore((state) => state.timeZone);
  const [now, setNow] = useState(Date.now);
  const period = useMemo(
    () => todayPeriod(now, { timeZone, monthStartDay: 1 }),
    [now, timeZone]
  );
  const filters = useMemo(
    () => ({
      ...emptyTransactionFilters,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      accountIds: accountId ? [accountId] : []
    }),
    [period.periodStart, period.periodEnd, accountId]
  );
  const query = useQuery({
    queryKey: ['core-finance', 'transactions', 'home-today', timeZone, filters],
    queryFn: ({ signal }) =>
      coreFinanceService.getHomeTodayActivity(filters, signal),
    staleTime: 0,
    refetchOnMount: 'always'
  });
  const { refetch } = query;
  const mountedFocus = useRef(false);
  const currentPeriod = useRef(period);
  currentPeriod.current = period;
  const reconcileDay = useCallback(() => {
    const nextNow = Date.now();
    const nextPeriod = todayPeriod(nextNow, { timeZone, monthStartDay: 1 });
    if (nextPeriod.periodStart === currentPeriod.current.periodStart)
      return false;
    setNow(nextNow);
    return true;
  }, [timeZone]);
  const refresh = useCallback(() => {
    // A new day changes the key and fetches itself; never restart yesterday.
    // Within the same day, refreshing needs no extra date-state render.
    if (!reconcileDay()) void refetch({ cancelRefetch: false });
  }, [refetch, reconcileDay]);
  useFocusEffect(
    useCallback(() => {
      // refetchOnMount already owns the initial visit.
      if (!mountedFocus.current) {
        mountedFocus.current = true;
        reconcileDay();
        return;
      }
      refresh();
    }, [refresh, reconcileDay])
  );
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => listener.remove();
  }, [refresh]);
  useEffect(() => {
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(1, period.periodEnd + 1 - Date.now())
    );
    return () => clearTimeout(timer);
  }, [period.periodEnd]);
  return query;
}
