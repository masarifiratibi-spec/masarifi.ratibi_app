import React, { useSyncExternalStore } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { FormField } from '@/design-system/components/forms/FormField';
import { translateDynamic as t } from '@/localization/i18n';
import {
  getDevDeletionSnapshots,
  reconcileDevAccountDeletions,
  submitDevAccountDeletion,
  subscribeDevAccountDeletion
} from '@/services/dev-account-deletion';
import { startAccountDeletionVerification } from './account-deletion-auth';

export function DevAccountDeletionPanel({
  ownerId,
  recovery = false
}: {
  ownerId: string;
  recovery?: boolean;
}) {
  const snapshots = useSyncExternalStore(
    subscribeDevAccountDeletion,
    getDevDeletionSnapshots
  );
  const snapshot = snapshots.find((entry) => entry.ownerId === ownerId);
  const [busy, setBusy] = React.useState(false);
  const [restored, setRestored] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [verification, setVerification] = React.useState<Awaited<
    ReturnType<typeof startAccountDeletionVerification>
  > | null>(null);
  const [code, setCode] = React.useState('');
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
  const message =
    phase === 'completed'
      ? 'settings.deletion.dev.completed'
      : phase === 'local_retry'
        ? 'settings.deletion.dev.localRetry'
        : phase === 'verification_required'
          ? 'settings.deletion.recentAuth'
          : phase === 'failed'
            ? 'settings.deletion.status.failed'
            : phase === 'unavailable'
              ? (snapshot?.error ?? 'settings.deletion.error')
              : phase
                ? 'settings.deletion.dev.deleting'
                : null;
  return (
    <View style={styles.stack}>
      {!recovery ? (
        <StyledText>settings.deletion.dev.description</StyledText>
      ) : null}
      {deleting || message ? (
        <StyledText accessibilityLiveRegion="polite">
          {deleting ? 'settings.deletion.dev.deleting' : message!}
        </StyledText>
      ) : null}
      {error ? (
        <StyledText accessibilityRole="alert">{error}</StyledText>
      ) : null}
      {!phase && !recovery ? (
        <ActionButton
          label="appShell.security.deleteAccount"
          variant="destructive"
          disabled={!restored}
          loading={busy}
          onPress={confirm}
        />
      ) : null}
      {phase &&
      !['deleting', 'completed', 'verification_required'].includes(phase) ? (
        <ActionButton
          label="settings.deletion.refresh"
          variant="secondary"
          loading={busy}
          onPress={() =>
            void run(() => reconcileDevAccountDeletions({ force: true }))
          }
        />
      ) : null}
      {phase === 'verification_required' && !verification ? (
        <ActionButton
          label="settings.deletion.reverify"
          loading={busy}
          onPress={() =>
            void run(async () => {
              setVerification(await startAccountDeletionVerification(ownerId));
            })
          }
        />
      ) : null}
      {verification ? (
        <>
          <StyledText>
            {t('settings.deletion.codeSent', {
              destination: verification.safeIdentifier
            })}
          </StyledText>
          <FormField
            label="settings.deletion.code"
            variant="otp"
            value={code}
            onChangeText={setCode}
            autoComplete="one-time-code"
          />
          <ActionButton
            label="settings.deletion.verify"
            disabled={!code.trim()}
            loading={busy}
            onPress={() =>
              void run(async () => {
                await verification.verify(code.trim());
                setVerification(null);
                setCode('');
                await submitDevAccountDeletion(ownerId);
              })
            }
          />
        </>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({ stack: { gap: 12 } });
