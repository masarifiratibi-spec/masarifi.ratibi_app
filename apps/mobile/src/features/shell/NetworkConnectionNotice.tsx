import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { translate } from '@/localization/i18n';
import { useLiveIdentityStatus } from '@/services/live/clerk-context';
import {
  synchronizeLiveCoreFinance,
  hasPendingLiveCoreFinanceMutations
} from '@/services/live/core-finance-service';
import { readRecoveryNetwork } from '@/services/platform/read-recovery-network';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';

/** Kept outside the startup cover so an offline cold launch can explain itself. */
export function NetworkConnectionNotice() {
  const theme = useTheme();
  const locale = usePreferenceStore((state) => state.locale);
  const client = useQueryClient();
  const identity = useLiveIdentityStatus();
  const latestIdentity = useRef(identity);
  latestIdentity.current = identity;
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const checkNow = useRef<() => void>(() => {});

  useEffect(() => {
    if (!readRecoveryNetwork.available) return;
    let disposed = false;
    let active = AppState.currentState === 'active';
    let revision = 0;
    let inFlight = false;
    let receiptInFlight = false;
    let online: boolean | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      if (!disposed && active && !inFlight) timer = setTimeout(check, 3000);
    };
    const synchronizeReceipts = (
      admission = {
        revision,
        ownerId: useAppShellStore.getState().session?.userId
      }
    ) => {
      if (
        disposed ||
        !active ||
        admission.revision !== revision ||
        admission.ownerId !== useAppShellStore.getState().session?.userId ||
        receiptInFlight ||
        latestIdentity.current.status !== 'ready'
      )
        return;
      const ownerId = admission.ownerId;
      receiptInFlight = true;
      void synchronizeLiveCoreFinance()
        .then(async () => {
          if (
            disposed ||
            !active ||
            ownerId !== useAppShellStore.getState().session?.userId
          )
            return;
          await Promise.all(
            [
              ['core-finance'],
              ['reports'],
              ['planning'],
              ['assistant', 'context', 'current']
            ].map((queryKey) => client.invalidateQueries({ queryKey }))
          );
        })
        .catch(() => undefined)
        .finally(() => {
          receiptInFlight = false;
        });
    };
    const recoverReads = () => {
      const currentIdentity = latestIdentity.current;
      if (['unavailable', 'loading'].includes(currentIdentity.status))
        currentIdentity.retry();
      if (currentIdentity.status === 'ready') synchronizeReceipts();
      const shell = useAppShellStore.getState();
      if (shell.profileSetupStatus === 'unavailable') shell.retryBootstrap();
      // Never resume paused mutations: a lost response does not imply a failed write.
      void client
        .refetchQueries(
          {
            type: 'active',
            predicate: (query) =>
              query.state.status === 'error' &&
              query.state.fetchStatus === 'idle'
          },
          { cancelRefetch: false }
        )
        .catch(() => undefined);
    };
    const check = async () => {
      if (disposed || !active || inFlight) return;
      clearTimeout(timer);
      inFlight = true;
      const startedAt = revision;
      setChecking(true);
      try {
        const connected = await readRecoveryNetwork.isOnline();
        if (disposed || !active || startedAt !== revision) return;
        if (!connected && online !== false) setVisible(true);
        if (connected) {
          setVisible(false);
          if (online === false) recoverReads();
          else if (
            !receiptInFlight &&
            latestIdentity.current.status === 'ready'
          ) {
            const ownerId = useAppShellStore.getState().session?.userId;
            const pending = await hasPendingLiveCoreFinanceMutations();
            if (
              disposed ||
              !active ||
              startedAt !== revision ||
              ownerId !== useAppShellStore.getState().session?.userId
            )
              return;
            if (pending && (await readRecoveryNetwork.isOnline()))
              synchronizeReceipts({ revision: startedAt, ownerId });
          }
        }
        online = connected;
      } catch {
        // An unavailable probe is unknown connectivity, not proof of an outage.
      } finally {
        inFlight = false;
        if (!disposed) {
          setChecking(false);
          if (active && startedAt !== revision) void check();
          else schedule();
        }
      }
    };
    checkNow.current = () => {
      void check();
    };
    if (active) void check();
    const listener = AppState.addEventListener('change', (state) => {
      active = state === 'active';
      revision += 1;
      clearTimeout(timer);
      if (active) void check();
    });
    return () => {
      disposed = true;
      clearTimeout(timer);
      listener.remove();
      checkNow.current = () => {};
    };
  }, [client]);

  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);
  const title = t('appShell.networkNotice.title');
  if (!visible) return null;
  return (
    <View
      testID="offline-connection-notice"
      pointerEvents="box-none"
      style={[
        styles.notice,
        {
          backgroundColor: theme.colors.surfaces.card,
          borderColor: theme.colors.border,
          direction: locale === 'ar' ? 'rtl' : 'ltr'
        }
      ]}
    >
      <View
        accessibilityRole="alert"
        accessible
        accessibilityLiveRegion="polite"
        style={styles.copy}
      >
        <StyledText variant="subtitle">{title}</StyledText>
        <StyledText variant="caption">
          {t('appShell.networkNotice.message')}
        </StyledText>
        <StyledText variant="caption">
          {t('appShell.networkNotice.stale')}
        </StyledText>
      </View>
      <View style={styles.actions}>
        <ActionButton
          label={t('appShell.networkNotice.retry')}
          variant="quiet"
          loading={checking}
          onPress={() => checkNow.current()}
        />
        <ActionButton
          label={t('appShell.networkNotice.dismiss')}
          variant="quiet"
          onPress={() => setVisible(false)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1 },
  copy: { gap: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }
});
