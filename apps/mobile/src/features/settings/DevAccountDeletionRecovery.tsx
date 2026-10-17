import React, { useEffect, useSyncExternalStore } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { isDevPrivacyDeletionEnabled } from '@/config/client-runtime';
import { StyledText } from '@/components/StyledText';
import {
  getDevDeletionSnapshots,
  hasPendingDevAccountDeletions,
  reconcileDevAccountDeletions,
  subscribeDevAccountDeletion
} from '@/services/dev-account-deletion';
import { deletionRecoveryNetwork } from '@/services/platform/deletion-network';
import { useAppShellStore } from '@/state/app-shell';
import { DevAccountDeletionPanel } from './DevAccountDeletionPanel';

export function DevAccountDeletionRecovery() {
  const enabled = isDevPrivacyDeletionEnabled();
  const snapshots = useSyncExternalStore(
    subscribeDevAccountDeletion,
    getDevDeletionSnapshots
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
        if (!(await hasPendingDevAccountDeletions())) return;
        let online = true;
        if (networkAvailable) {
          online = await deletionRecoveryNetwork.isOnline();
          force ||= online && lastOnline === false;
          lastOnline = online;
        }
        await reconcileDevAccountDeletions({ force, online });
        if (!stopped) setStorageError(false);
        const pending = getDevDeletionSnapshots().filter(
          (entry) =>
            ![
              'completed',
              'local_retry',
              'verification_required',
              'failed'
            ].includes(entry.phase)
        );
        const deadlines = pending
          .filter((entry) => entry.automaticRetries)
          .map((entry) => entry.nextAttemptAt);
        if (!online && pending.length) schedule(15_000);
        else if (deadlines.length)
          schedule(Math.max(1_000, Math.min(...deadlines) - Date.now()));
        else if (
          networkAvailable &&
          (pending.length ||
            getDevDeletionSnapshots().some(
              (entry) => entry.phase === 'local_retry'
            ))
        )
          schedule(15_000);
      } catch {
        if (!stopped) setStorageError(true);
      } finally {
        running = false;
      }
    };
    const unsubscribe = subscribeDevAccountDeletion(() => {
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

  if (!enabled || ownerId) return null;
  const recoverable = snapshots.filter(
    (entry) => !['deleting', 'completed'].includes(entry.phase)
  );
  if (!recoverable.length && !storageError) return null;
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
