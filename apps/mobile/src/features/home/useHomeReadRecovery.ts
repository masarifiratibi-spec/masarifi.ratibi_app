import { useCallback } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CoreFinanceError } from '@/services/contracts/core-finance-service';
import { readRecoveryNetwork } from '@/services/platform/read-recovery-network';

type HomeRead = {
  isError: boolean;
  error: unknown;
  refetch: (options: { cancelRefetch: boolean }) => Promise<unknown>;
};

function canRecover(query: HomeRead) {
  return (
    query.isError &&
    query.error instanceof CoreFinanceError &&
    query.error.code === 'offline' &&
    (query.error.metadata?.status ?? 0) >= 500
  );
}

export function useHomeReadRecovery(balance: HomeRead, activity: HomeRead) {
  const recoverBalance = canRecover(balance);
  const recoverActivity = canRecover(activity);
  const balanceRefetch = balance.refetch;
  const activityRefetch = activity.refetch;
  useFocusEffect(
    useCallback(() => {
      if (!recoverBalance && !recoverActivity) return;
      let disposed = false;
      let active = AppState.currentState === 'active';
      let checking = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const schedule = () => {
        clearTimeout(timer);
        if (!disposed && active && !checking) timer = setTimeout(check, 10_000);
      };
      const check = async () => {
        checking = true;
        try {
          const online =
            !readRecoveryNetwork.available ||
            (await readRecoveryNetwork.isOnline());
          if (disposed || !active || !online) return;
          await Promise.all([
            recoverBalance && balanceRefetch({ cancelRefetch: false }),
            recoverActivity && activityRefetch({ cancelRefetch: false })
          ]);
        } catch {
          // Keep the last snapshot and the query's error until a read succeeds.
        } finally {
          checking = false;
          schedule();
        }
      };
      schedule();
      const listener = AppState.addEventListener('change', (state) => {
        active = state === 'active';
        clearTimeout(timer);
        if (active) schedule();
      });
      return () => {
        disposed = true;
        clearTimeout(timer);
        listener.remove();
      };
    }, [recoverBalance, recoverActivity, balanceRefetch, activityRefetch])
  );
}
