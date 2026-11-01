import React, { useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  View
} from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme-context';
import { usePreferenceStore } from '@/state/preferences';
import { translateDynamic as t } from '@/localization/i18n';
import {
  getDevDeletionSnapshots,
  reconcileDevAccountDeletions,
  submitDevAccountDeletion,
  subscribeDevAccountDeletion
} from '@/services/dev-account-deletion';

export function DevAccountDeletionPanel({
  ownerId,
  recovery = false,
  presentation = 'default'
}: {
  ownerId: string;
  recovery?: boolean;
  presentation?: 'default' | 'link';
}) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const reducedMotion = usePreferenceStore((state) => state.reducedMotion);
  const snapshots = useSyncExternalStore(
    subscribeDevAccountDeletion,
    getDevDeletionSnapshots
  );
  const snapshot = snapshots.find((entry) => entry.ownerId === ownerId);
  const [busy, setBusy] = React.useState(false);
  const [restored, setRestored] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let mounted = true;
    void reconcileDevAccountDeletions()
      .catch(() => {
        if (mounted) setError('settings.deletion.error');
      })
      .finally(() => {
        if (mounted) setRestored(true);
      });
    return () => {
      mounted = false;
    };
  }, [ownerId]);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError('settings.deletion.error');
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    Alert.alert(
      t('appShell.security.deleteAccount'),
      t('settings.deletion.dev.confirmation'),
      [
        { text: t('coreFinance.cancel'), style: 'cancel' },
        {
          text: t('settings.privacy.confirmRequest'),
          style: 'destructive',
          onPress: () => void run(() => submitDevAccountDeletion(ownerId))
        }
      ]
    );
  }

  const deleting = busy || snapshot?.phase === 'deleting';
  const phase = snapshot?.phase;
  const loading = deleting || phase === 'pending';
  if (phase === 'completed') return null;
  const message =
    phase === 'rejected'
      ? 'settings.deletion.dev.notAllowed'
      : phase === 'local_retry'
        ? 'settings.deletion.dev.localRetry'
        : phase === 'verification_required'
          ? 'settings.deletion.dev.sessionRetry'
          : phase === 'failed'
            ? 'settings.deletion.status.failed'
            : phase === 'unavailable'
              ? (snapshot?.error ?? 'settings.deletion.error')
              : phase
                ? 'settings.deletion.dev.deleting'
                : null;
  return (
    <View style={styles.stack}>
      <Modal
        visible={loading}
        transparent={false}
        animationType={reducedMotion ? 'none' : 'fade'}
        onRequestClose={() => undefined}
      >
        <View
          style={[
            styles.backdrop,
            { backgroundColor: theme.colors.surfaces.page }
          ]}
        >
          <View
            accessible
            accessibilityViewIsModal
            accessibilityRole="progressbar"
            accessibilityState={{ busy: true }}
            accessibilityLiveRegion="polite"
            accessibilityLabel={t('settings.deletion.dev.loadingTitle')}
            style={[styles.loadingContent, { direction }]}
          >
            <ActivityIndicator
              size="large"
              color={theme.colors.primary}
              accessible={false}
            />
            <StyledText style={styles.centered}>
              settings.deletion.dev.loadingTitle
            </StyledText>
          </View>
        </View>
      </Modal>
      {!loading ? (
        <>
          {!recovery && presentation === 'default' ? (
            <StyledText>settings.deletion.dev.description</StyledText>
          ) : null}
          {message ? (
            <StyledText accessibilityLiveRegion="polite">
              {message}
            </StyledText>
          ) : null}
          {error ? (
            <StyledText accessibilityRole="alert">{error}</StyledText>
          ) : null}
          {!phase && !recovery ? (
            <ActionButton
              label="appShell.security.deleteAccount"
              variant={presentation === 'link' ? 'quiet' : 'destructive'}
              labelStyle={
                presentation === 'link'
                  ? { color: theme.colors.status.danger, fontWeight: '400' }
                  : undefined
              }
              disabled={!restored}
              loading={busy}
              onPress={confirm}
            />
          ) : null}
          {phase &&
          ![
            'deleting',
            'completed',
            'verification_required',
            'rejected'
          ].includes(phase) ? (
            <ActionButton
              label="settings.deletion.refresh"
              variant="secondary"
              loading={busy}
              onPress={() =>
                void run(() => reconcileDevAccountDeletions({ force: true }))
              }
            />
          ) : null}
          {phase === 'verification_required' || phase === 'rejected' ? (
            <ActionButton
              label="settings.deletion.retry"
              loading={busy}
              onPress={() => void run(() => submitDevAccountDeletion(ownerId))}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl
  },
  loadingContent: {
    alignItems: 'center',
    gap: spacing.md
  },
  centered: { textAlign: 'center' }
});
