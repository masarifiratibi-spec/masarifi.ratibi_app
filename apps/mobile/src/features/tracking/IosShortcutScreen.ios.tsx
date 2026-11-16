import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import {
  currentLocale,
  translate,
  translateDynamic
} from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import {
  disableBankSms,
  enableBankSms,
  readBankSmsSetup
} from '@/services/platform/bank-sms-setup.ios';

export default function IosShortcutScreen() {
  usePreferenceStore((state) => state.locale);
  const owner = useAppShellStore((state) => state.session?.userId);
  const theme = useTheme();
  const [status, setStatus] = useState<Awaited<
    ReturnType<typeof readBankSmsSetup>
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const value = await readBankSmsSetup();
      if (useAppShellStore.getState().session?.userId === owner)
        setStatus(value);
    } catch {
      if (useAppShellStore.getState().session?.userId === owner)
        setStatus(null);
    }
  }, [owner]);

  useEffect(() => {
    setStatus(null);
    setFailed(false);
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setFailed(false);
    try {
      await action();
      await refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={{ backgroundColor: theme.colors.surfaces.page }}
    >
      <StyledText variant="title">
        {translate('tracking.shortcut.title')}
      </StyledText>
      <SurfaceCard style={styles.card}>
        <StyledText>{translate('tracking.bankSms.setupTrigger')}</StyledText>
        <StyledText>{translate('tracking.bankSms.setupAction')}</StyledText>
        <StyledText>{translate('tracking.bankSms.multiple')}</StyledText>
        <ActionButton
          label={translate('tracking.shortcut.open')}
          onPress={() => run(() => Linking.openURL('shortcuts://'))}
          disabled={busy || !status?.enabled}
        />
      </SurfaceCard>
      <SurfaceCard style={styles.card}>
        <StyledText>
          {translate(
            status?.enabled
              ? 'tracking.bankSms.allowed'
              : 'tracking.bankSms.disabled'
          )}
        </StyledText>
        {failed ? (
          <StyledText>{translate('tracking.bankSms.setupFailed')}</StyledText>
        ) : null}
        {status?.lastSaved ? (
          <StyledText>
            {translateDynamic('tracking.shortcut.lastSuccess', {
              time: new Date(status.lastSaved).toLocaleString(currentLocale())
            })}
          </StyledText>
        ) : null}
        {status?.outcome ? (
          <StyledText>
            {translateDynamic(`tracking.bankSms.outcome.${status.outcome}`)}
          </StyledText>
        ) : null}
        {status?.pending ? (
          <StyledText>{translate('tracking.bankSms.pending')}</StyledText>
        ) : null}
        <ActionButton
          label={translate(
            status?.enabled
              ? 'tracking.bankSms.refreshChoices'
              : 'tracking.bankSms.enable'
          )}
          onPress={() => run(enableBankSms)}
          disabled={busy}
        />
        {status?.enabled ? (
          <ActionButton
            label={translate('tracking.shortcut.disable')}
            onPress={() => run(disableBankSms)}
            disabled={busy}
            variant="secondary"
          />
        ) : null}
      </SurfaceCard>
      <ActionButton
        label={translate('tracking.shortcut.transactions')}
        variant="secondary"
        onPress={() => router.push('/(tabs)/transactions')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  card: { gap: 12 }
});
