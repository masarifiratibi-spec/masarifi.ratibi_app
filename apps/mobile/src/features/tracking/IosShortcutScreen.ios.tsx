import React, { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { useAccounts } from '@/features/core-finance/core-finance-queries';
import { accountAllowsAutomaticTracking } from '@/domain/core-finance';
import {
  translate,
  currentLocale,
  translateDynamic
} from '@/localization/i18n';
import { formatMinorAmount } from '@/utils/format-financial-value';
import { useTheme } from '@/state/theme-context';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import {
  readIosShortcutState,
  enrollIosShortcut,
  disableIosShortcut,
  submitIosShortcut,
  subscribeIosShortcut
} from '@/services/platform/ios-shortcut-runtime.ios';
import type { IosShortcutResult } from '@/services/ios-shortcut-import';

type CaptureState = Awaited<ReturnType<typeof readIosShortcutState>>;
export default function IosShortcutScreen() {
  usePreferenceStore((state) => state.locale);
  const owner = useAppShellStore((state) => state.session?.userId);
  const theme = useTheme();
  const accounts = useAccounts();
  const client = useQueryClient();
  const [capture, setCapture] = useState<CaptureState | null>(null);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<
    IosShortcutResult['status'] | 'error' | null
  >(null);
  const reload = useCallback(async () => {
    const expectedOwner = useAppShellStore.getState().session?.userId;
    try {
      const restored = await readIosShortcutState();
      if (useAppShellStore.getState().session?.userId === expectedOwner)
        setCapture(restored);
    } catch {
      if (useAppShellStore.getState().session?.userId === expectedOwner)
        setCapture(null);
    }
  }, []);
  useEffect(() => {
    setCapture(null);
    setStatus(null);
    setSelected('');
    let active = true;
    const refresh = () => {
      if (active) void reload();
    };
    refresh();
    const stop = subscribeIosShortcut(refresh);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      active = false;
      stop();
      appState.remove();
    };
  }, [owner, reload]);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setStatus(null);
    try {
      await action();
      await reload();
    } catch {
      setStatus('error');
    } finally {
      setBusy(false);
    }
  };
  const candidate = capture?.candidates[0];
  const eligible = (accounts.data ?? []).filter(
    (account) =>
      accountAllowsAutomaticTracking(account) &&
      (!candidate || account.currencyCode === candidate.currency)
  );
  const submit = async (confirm: boolean) => {
    const result = await submitIosShortcut(
      confirm ? candidate?.sourceItemKey : undefined,
      confirm ? selected : undefined
    );
    setStatus(result.status);
    if (result.status === 'review') {
      await client.invalidateQueries({
        queryKey: ['automatic-tracking', 'review']
      });
      await client.invalidateQueries({
        queryKey: ['automatic-tracking', 'duplicates']
      });
    }
    if (result.status === 'saved')
      await client.invalidateQueries({ queryKey: ['core-finance'] });
  };
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={{ backgroundColor: theme.colors.surfaces.page }}
    >
      <StyledText variant="title">
        {translate('tracking.shortcut.title')}
      </StyledText>
      <StyledText>{translate('tracking.shortcut.limits')}</StyledText>
      <SurfaceCard style={styles.card}>
        <StyledText>
          {translate(
            capture?.enabled
              ? 'tracking.shortcut.ready'
              : 'tracking.shortcut.disabled'
          )}
        </StyledText>
        <StyledText>{translate('tracking.shortcut.notVerified')}</StyledText>
        {capture?.lastSuccessAt ? (
          <StyledText>
            {translateDynamic('tracking.shortcut.lastSuccess', {
              time: new Date(capture.lastSuccessAt).toLocaleString(
                currentLocale()
              )
            })}
          </StyledText>
        ) : null}
        {capture?.enabled ? (
          <>
            <StyledText>{translate('tracking.shortcut.setup')}</StyledText>
            <Text
              selectable
              style={{
                color: theme.colors.content.primary,
                writingDirection: 'ltr',
                textAlign: 'left'
              }}
            >
              {capture.token}
            </Text>
            <StyledText>{translate('tracking.shortcut.recipe')}</StyledText>
            <Text
              selectable
              style={{
                color: theme.colors.content.primary,
                writingDirection: 'ltr',
                textAlign: 'left'
              }}
            >
              {'masarifi://capture-ios?payload=[URL Encoded Dictionary]'}
            </Text>
            <ActionButton
              label={translate('tracking.shortcut.open')}
              onPress={() => run(() => Linking.openURL('shortcuts://'))}
              disabled={busy}
              variant="secondary"
            />
            <ActionButton
              label={translate('tracking.shortcut.disable')}
              onPress={() => run(disableIosShortcut)}
              disabled={busy}
              variant="secondary"
            />
          </>
        ) : (
          <ActionButton
            label={translate('tracking.shortcut.enable')}
            onPress={() => run(enrollIosShortcut)}
            disabled={busy}
          />
        )}
      </SurfaceCard>
      {capture?.outcome === 'rejected' ? (
        <StyledText>{translate('tracking.shortcut.rejected')}</StyledText>
      ) : null}
      {candidate ? (
        <SurfaceCard style={styles.card}>
          <StyledText>{translate('tracking.shortcut.confirmBody')}</StyledText>
          <StyledText>
            {translate(
              candidate.kind === 'income'
                ? 'tracking.shortcut.income'
                : 'tracking.shortcut.expense'
            )}{' '}
            ·{' '}
            {formatMinorAmount(
              candidate.amountMinor,
              candidate.currency,
              currentLocale()
            )}
          </StyledText>
          <StyledText>
            {translateDynamic('tracking.shortcut.receivedAt', {
              time: new Date(candidate.receivedAt).toLocaleString(
                currentLocale()
              )
            })}
          </StyledText>
          {eligible.map((account) => (
            <ActionButton
              key={account.id}
              accessibilityState={{ selected: selected === account.id }}
              label={`${selected === account.id ? '✓ ' : ''}${account.name}`}
              variant="secondary"
              disabled={busy}
              onPress={() => setSelected(account.id)}
            />
          ))}
          {!eligible.length ? (
            <StyledText>
              {translate('tracking.shortcut.accountRequired')}
            </StyledText>
          ) : null}
          <ActionButton
            label={translate('tracking.shortcut.confirm')}
            onPress={() => run(() => submit(true))}
            disabled={
              busy || !eligible.some((account) => account.id === selected)
            }
          />
        </SurfaceCard>
      ) : null}
      {status ? (
        <StyledText accessibilityLiveRegion="polite">
          {translateDynamic(`tracking.shortcut.status.${status}`)}
        </StyledText>
      ) : null}
      <ActionButton
        label={translate('tracking.shortcut.retry')}
        onPress={() => run(() => submit(false))}
        disabled={busy || !capture}
        variant="secondary"
      />
      <View style={styles.card}>
        <ActionButton
          label={translate('tracking.review.title')}
          onPress={() => router.push('/capture/review')}
          variant="secondary"
        />
        <ActionButton
          label={translate('tracking.shortcut.transactions')}
          onPress={() => router.push('/(tabs)/transactions')}
          variant="secondary"
        />
        <ActionButton
          label={translate('capture.ios.alternatives')}
          onPress={() => router.push('/(tabs)/add')}
          variant="secondary"
        />
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  card: { gap: 12 }
});
