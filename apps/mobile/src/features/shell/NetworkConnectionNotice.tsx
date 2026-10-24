import React, { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import Svg, { Path } from 'react-native-svg';
import { ActionButton } from '@/design-system/components/ActionButton';
import { translate } from '@/localization/i18n';
import { useLiveIdentityStatus } from '@/services/live/clerk-context';
import { readRecoveryNetwork } from '@/services/platform/read-recovery-network';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';

/** Kept outside the startup cover so an offline cold launch can explain itself. */
export function NetworkConnectionNotice() {
  const theme = useTheme();
  const locale = usePreferenceStore((state) => state.locale);
  const reducedMotion = usePreferenceStore((state) => state.reducedMotion);
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
    let online: boolean | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      if (!disposed && active && !inFlight) timer = setTimeout(check, 3000);
    };
    const recoverReads = () => {
      const currentIdentity = latestIdentity.current;
      if (['unavailable', 'loading'].includes(currentIdentity.status))
        currentIdentity.retry();
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
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={() => setVisible(false)}
      statusBarTranslucent
    >
      <View
        style={[
          styles.backdrop,
          { backgroundColor: theme.colors.horizon.scrim }
        ]}
      >
        <ScrollView contentContainerStyle={styles.viewport} bounces={false}>
          <View
            accessibilityViewIsModal
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surfaces.card,
                direction: locale === 'ar' ? 'rtl' : 'ltr'
              }
            ]}
          >
            <View
              accessible={false}
              style={[
                styles.icon,
                { backgroundColor: theme.colors.surfaceMuted }
              ]}
            >
              <Svg
                width={32}
                height={32}
                viewBox="0 0 24 24"
                fill="none"
                stroke={theme.colors.primary}
                strokeWidth={1.8}
                strokeLinecap="round"
              >
                <Path d="M3 3l18 18M2 8a16 16 0 0 1 3-2m4-1a16 16 0 0 1 13 3M5 12a11 11 0 0 1 4-2m5 0a11 11 0 0 1 5 2M8 16a6 6 0 0 1 7-1m-3 5h.01" />
              </Svg>
            </View>
            <View
              accessible
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={styles.copy}
            >
              <Text
                style={[styles.title, { color: theme.colors.content.primary }]}
              >
                {title}
              </Text>
              <Text
                style={[
                  styles.message,
                  { color: theme.colors.content.secondary }
                ]}
              >
                {t('appShell.networkNotice.message')}
              </Text>
              <Text
                style={[
                  styles.detail,
                  { color: theme.colors.content.secondary }
                ]}
              >
                {t('appShell.networkNotice.stale')}
              </Text>
            </View>
            <ActionButton
              label={t('appShell.networkNotice.retry')}
              loading={checking}
              onPress={() => checkNow.current()}
            />
            <ActionButton
              label={t('appShell.networkNotice.dismiss')}
              variant="quiet"
              onPress={() => setVisible(false)}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  viewport: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    gap: 12
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 8
  },
  copy: { gap: 12, marginBottom: 12 },
  title: { fontSize: 23, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 16, lineHeight: 26, textAlign: 'center' },
  detail: { fontSize: 14, lineHeight: 23, textAlign: 'center' }
});
