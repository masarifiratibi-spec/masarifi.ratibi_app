import React, { useEffect, useSyncExternalStore } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { isAccountDeletionCompletionEnabled } from '@/config/client-runtime';
import { StyledText } from '@/components/StyledText';
import {
  getAccountDeletionSnapshots,
  hasPendingAccountDeletions,
  reconcileAccountDeletions,
  subscribeAccountDeletion
} from '@/services/dev-account-deletion';
import { deletionRecoveryNetwork } from '@/services/platform/deletion-network';
import { useStartupReady } from '@/design-system/components/feedback/StartupLoadingBoundary';
import { useAppShellStore } from '@/state/app-shell';
import { DevAccountDeletionPanel } from './DevAccountDeletionPanel';

export function DevAccountDeletionRecovery() {
  const enabled = isAccountDeletionCompletionEnabled();
  const snapshots = useSyncExternalStore(
    subscribeAccountDeletion,
    getAccountDeletionSnapshots
  );
  const ownerId = useAppShellStore((state) => state.session?.userId);
  const [storageError, setStorageError] = React.useState(false);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let running = false;
    let lastOnline: boolean | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const networkAvailable = deletionRecoveryNetwork.available;
    const schedule = (delay: number) => {
      clearTimeout(timer);
      if (!stopped) timer = setTimeout(() => void recover(), delay);
    };
    const recover = async (force = false) => {
      if (
        stopped ||
        running ||
        AppState.currentState === 'background' ||
        AppState.currentState === 'inactive'
      )
        return;
      running = true;
      try {
        if (!(await hasPendingAccountDeletions())) return;
        let online = true;
        if (networkAvailable) {
          online = await deletionRecoveryNetwork.isOnline();
          force ||= online && lastOnline === false;
          lastOnline = online;
        }
        await reconcileAccountDeletions({ force, online });
        if (!stopped) setStorageError(false);
        const pending = getAccountDeletionSnapshots().filter(
          (entry) =>
            ![
              'completed',
              'verification_required',
              'failed'
            ].includes(entry.phase) &&
            (entry.phase !== 'local_retry' || entry.automaticRetries)
        );
        const deadlines = pending
          .filter(
            (entry) =>
              entry.automaticRetries && (online || entry.phase === 'local_retry')
          )
          .map((entry) => entry.nextAttemptAt);
        if (deadlines.length)
          schedule(Math.max(1_000, Math.min(...deadlines) - Date.now()));
        else if (!online && pending.length) schedule(15_000);
        else if (networkAvailable && pending.length)
          schedule(15_000);
      } catch {
        if (!stopped) setStorageError(true);
      } finally {
        running = false;
      }
    };
    const unsubscribe = subscribeAccountDeletion(() => {
      if (!running) {
        clearTimeout(timer);
        void recover();
      }
    });
    const appState = AppState.addEventListener('change', (state) => {
      clearTimeout(timer);
      if (state === 'active') void recover(true);
    });
    void recover(true);
    return () => {
      stopped = true;
      clearTimeout(timer);
      unsubscribe();
      appState.remove();
    };
  }, [enabled]);

  const recoverable = snapshots.filter(
    (entry) => entry.phase !== 'completed'
  );
  const showRecovery =
    enabled && !ownerId && (recoverable.length > 0 || storageError);
  // A fenced owner cannot enter Home. Its recovery UI is the startup destination.
  useStartupReady(showRecovery);
  if (!showRecovery) return null;
  return (
    <View style={styles.recovery}>
      {storageError ? (
        <StyledText accessibilityRole="alert">
          settings.deletion.error
        </StyledText>
      ) : null}
      {recoverable.map((entry) => (
        <DevAccountDeletionPanel
          key={entry.ownerId}
          ownerId={entry.ownerId}
          recovery
        />
      ))}
    </View>
  );
}
const styles = StyleSheet.create({ recovery: { padding: 16, gap: 12 } });
