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
import { isDevPrivacyDeletionEnabled } from '@/config/client-runtime';
import { spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme-context';
import { usePreferenceStore } from '@/state/preferences';
import { translateDynamic as t } from '@/localization/i18n';
import {
  getAccountDeletionSnapshots,
  reconcileAccountDeletions,
  submitAccountDeletion,
  subscribeAccountDeletion
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
  const production = !isDevPrivacyDeletionEnabled();
  const direction = usePreferenceStore((state) => state.direction);
  const reducedMotion = usePreferenceStore((state) => state.reducedMotion);
  const snapshots = useSyncExternalStore(
    subscribeAccountDeletion,
    getAccountDeletionSnapshots
  );
  const snapshot = snapshots.find((entry) => entry.ownerId === ownerId);
  const [busy, setBusy] = React.useState(false);
  const [restored, setRestored] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dismissedProblem, setDismissedProblem] = React.useState<string | null>(
    null
  );
  React.useEffect(() => {
    let mounted = true;
    void reconcileAccountDeletions()
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
      t(
        production
          ? 'appShell.security.deleteAccount.confirmation'
          : 'settings.deletion.dev.confirmation'
      ),
      [
        { text: t('coreFinance.cancel'), style: 'cancel' },
        {
          text: t('settings.privacy.confirmRequest'),
          style: 'destructive',
          onPress: () => void run(() => submitAccountDeletion(ownerId))
        }
      ]
    );
  }

  const deleting = busy || snapshot?.phase === 'deleting';
  const phase = snapshot?.phase;
  const loading =
    deleting ||
    phase === 'pending' ||
    (production && phase === 'local_retry' && snapshot?.automaticRetries);
  const problem =
    !loading &&
    (error ||
      (phase &&
        [
          'verification_required',
          'rejected',
          'local_retry',
          'failed',
          'unavailable'
        ].includes(phase)));
  const problemKey = `${phase ?? ''}:${snapshot?.nextAttemptAt ?? 0}:${error ?? ''}`;
  const dismissProblem = () => setDismissedProblem(problemKey);
  const retryLabel =
    phase === 'verification_required'
      ? 'settings.deletion.continue'
      : 'settings.deletion.retry';
  const retry = () =>
    void run(() =>
      !phase || phase === 'verification_required' || phase === 'rejected'
        ? submitAccountDeletion(ownerId)
        : reconcileAccountDeletions({ force: true })
    );
  if (phase === 'completed') return null;
  const message =
    phase === 'rejected'
      ? production
        ? 'settings.deletion.error'
        : 'settings.deletion.dev.notAllowed'
      : phase === 'local_retry'
        ? 'settings.deletion.dev.localRetry'
        : phase === 'verification_required'
          ? production
            ? 'settings.deletion.continueConfirmed'
            : 'settings.deletion.dev.sessionRetry'
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
        visible={
          production && Boolean(problem) && dismissedProblem !== problemKey
        }
        transparent
        animationType={reducedMotion ? 'none' : 'fade'}
        onRequestClose={dismissProblem}
      >
        <View style={styles.problemBackdrop}>
          <View
            testID="account-deletion-error-dialog"
            accessibilityViewIsModal
            style={[
              styles.problemCard,
              { backgroundColor: theme.colors.surface, direction }
            ]}
          >
            <StyledText variant="title" style={styles.centered}>
              settings.deletion.popup.title
            </StyledText>
            <StyledText style={styles.centered}>
              settings.deletion.popup.body
            </StyledText>
            <ActionButton label={retryLabel} onPress={retry} />
            <ActionButton
              label="common.close"
              variant="quiet"
              onPress={dismissProblem}
            />
          </View>
        </View>
      </Modal>
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
            {!production ? (
              <StyledText style={styles.centered}>
                settings.deletion.dev.loadingTitle
              </StyledText>
            ) : null}
          </View>
        </View>
      </Modal>
      {!loading ? (
        <>
          {!production && !recovery && presentation === 'default' ? (
            <StyledText>settings.deletion.dev.description</StyledText>
          ) : null}
          {!production && message ? (
            <StyledText accessibilityLiveRegion="polite">{message}</StyledText>
          ) : null}
          {!production && error ? (
            <StyledText accessibilityRole="alert">{error}</StyledText>
          ) : null}
          {production && phase && problem && dismissedProblem === problemKey ? (
            <ActionButton label={retryLabel} onPress={retry} loading={busy} />
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
          {!production &&
          phase &&
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
                void run(() => reconcileAccountDeletions({ force: true }))
              }
            />
          ) : null}
          {!production &&
          (phase === 'verification_required' || phase === 'rejected') ? (
            <ActionButton
              label="settings.deletion.retry"
              loading={busy}
              onPress={() => void run(() => submitAccountDeletion(ownerId))}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  problemBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.4)'
  },
  problemCard: {
    width: '100%',
    maxWidth: 420,
    padding: spacing.xl,
    borderRadius: 24,
    gap: spacing.md
  },
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
