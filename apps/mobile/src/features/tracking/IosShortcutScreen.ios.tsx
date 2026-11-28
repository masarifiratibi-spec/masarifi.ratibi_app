import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';
import { router } from 'expo-router';
import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { AppSheet } from '@/design-system/components/overlays/AppSheet';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { DesignIcon } from '@/design-system/icons';
import { SwitchRow } from '@/design-system/components/forms/SelectionControls';
import { AppBar } from '@/design-system/components/navigation/AppNavigation';
import { layoutDirectionStyle } from '@/design-system/direction';
import { radius, spacing } from '@/design-system/tokens';
import type { NotificationPermissionState } from '@/domain/notifications';
import {
  translate,
  translateDynamic,
  type MessageKey
} from '@/localization/i18n';
import { phoneNotificationService } from '@/services/platform/phone-notification-service';
import {
  completeBankSmsSetup,
  disableBankSms,
  enableBankSms,
  readBankSmsSetup
} from '@/services/platform/bank-sms-setup.ios';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import type { BankSmsConfiguration } from '@/services/platform/bank-sms-bridge.ios';
import { BankSmsSetupFields } from './BankSmsSetupFields.ios';

const steps = [
  {
    title: 'tracking.bankSms.permissionTitle',
    description: 'tracking.bankSms.permissionBody',
    instructions: []
  },
  {
    title: 'tracking.bankSms.triggerTitle',
    description: 'tracking.bankSms.triggerIntro',
    instructions: [
      'tracking.bankSms.triggerBody',
      'tracking.bankSms.messageTrigger',
      'tracking.bankSms.bankFilter'
    ]
  },
  {
    title: 'tracking.bankSms.actionTitle',
    description: 'tracking.bankSms.actionBody',
    instructions: [
      'tracking.bankSms.actionName',
      'tracking.bankSms.actionInput',
      'tracking.bankSms.actionDestination'
    ]
  },
  {
    title: 'tracking.bankSms.finishTitle',
    description: 'tracking.bankSms.finishBody',
    instructions: [
      'tracking.bankSms.runImmediately',
      'tracking.bankSms.actionFinish',
      'tracking.bankSms.testMessage'
    ]
  }
] as const;

type SetupState =
  Awaited<ReturnType<typeof readBankSmsSetup>> | 'loading' | 'unavailable';

export default function IosShortcutScreen() {
  const owner = useAppShellStore((state) => state.session?.userId);
  return <ShortcutSetup key={owner} />;
}

function ShortcutSetup() {
  const locale = usePreferenceStore((state) => state.locale);
  const direction = usePreferenceStore((state) => state.direction);
  const reducedMotion = usePreferenceStore((state) => state.reducedMotion);
  const [helpOpen, setHelpOpen] = useState(false);
  const { colors } = useTheme();
  const scroll = useRef<ScrollView>(null);
  const requests = useRef({
    revision: 0,
    noticeRevision: 0,
    asking: false
  }).current;
  const [step, setStep] = useState(0);
  const [configuration, setConfiguration] = useState<BankSmsConfiguration>();
  const [status, setStatus] = useState<SetupState>('loading');
  const [busy, setBusy] = useState(false);
  const [noticePermission, setNoticePermission] =
    useState<NotificationPermissionState>();
  const [requestingNotice, setRequestingNotice] = useState(false);
  const [error, setError] = useState<MessageKey>();
  const enabled = typeof status === 'object' && status.enabled;
  const incompleteEnding = Object.values(configuration?.links ?? {}).some(
    ({ accountEnding }) => Boolean(accountEnding && accountEnding.length !== 4)
  );
  const lastStep = steps.length - 1;
  const current = steps[step];
  const modern = Number.parseInt(String(Platform.Version), 10) >= 27;
  const instructions: readonly MessageKey[] =
    step === 1 && modern
      ? [
          'tracking.bankSms.triggerBodyModern',
          'tracking.bankSms.messageTrigger',
          'tracking.bankSms.bankFilter'
        ]
      : step === lastStep && modern
        ? [
            'tracking.bankSms.runImmediatelyModern',
            'tracking.bankSms.actionFinish',
            'tracking.bankSms.testMessage'
          ]
        : current.instructions;
  const numbers = new Intl.NumberFormat(
    locale === 'ar' ? 'ar-u-nu-arab' : locale
  );
  const stepLabel = translateDynamic('tracking.bankSms.step', {
    current: numbers.format(step + 1),
    total: numbers.format(steps.length)
  });
  const muted = { color: colors.textSecondary };
  const noticeSettings = [
    'granted',
    'permanently_denied',
    'unavailable'
  ].includes(noticePermission ?? '');

  const refresh = useCallback(async () => {
    const request = ++requests.revision;
    const setup = await readBankSmsSetup().catch(() => null);
    if (request !== requests.revision) return null;
    setStatus(setup ?? 'unavailable');
    return setup;
  }, [requests]);

  const refreshNotice = useCallback(async () => {
    if (requests.asking) return;
    const revision = ++requests.noticeRevision;
    const permission = await phoneNotificationService
      .getPermission()
      .catch(() => 'unavailable' as const);
    if (revision === requests.noticeRevision) setNoticePermission(permission);
  }, [requests]);

  useEffect(() => {
    const reload = () => {
      void refresh();
      void refreshNotice();
    };
    reload();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload();
    });
    return () => {
      requests.revision++;
      requests.noticeRevision++;
      subscription.remove();
    };
  }, [refresh, refreshNotice, requests]);

  function goTo(next: number) {
    setStep(next);
    setError(undefined);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  async function setConsent(allowed: boolean) {
    setBusy(true);
    setError(undefined);
    try {
      await (allowed ? enableBankSms() : disableBankSms());
      if (!allowed) setConfiguration(undefined);
      await refresh();
    } catch {
      setError('tracking.bankSms.setupFailed');
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (!enabled || busy) return;
    if (step === lastStep) {
      setBusy(true);
      setError(undefined);
      try {
        await completeBankSmsSetup();
        router.replace('/(tabs)/home');
      } catch {
        setError('tracking.bankSms.setupFailed');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (step > 0) {
      goTo(step + 1);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      // Publish account links together with the existing classification preferences.
      await enableBankSms(configuration);
      setConfiguration(undefined);
      const setup = await refresh();
      if (setup?.enabled) goTo(1);
    } catch {
      setError('tracking.bankSms.setupFailed');
    } finally {
      setBusy(false);
    }
  }

  async function openShortcuts() {
    setError(undefined);
    try {
      await Linking.openURL('shortcuts://');
    } catch {
      setError('tracking.bankSms.openFailed');
    }
  }

  async function retrySetup() {
    setBusy(true);
    setError(undefined);
    try {
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function enableSaveNotices() {
    if (requests.asking || !noticePermission) return;
    requests.asking = true;
    const revision = ++requests.noticeRevision;
    setRequestingNotice(true);
    setError(undefined);
    try {
      if (noticeSettings) await Linking.openSettings();
      const permission = noticeSettings
        ? await phoneNotificationService.getPermission()
        : await phoneNotificationService.requestPermission();
      if (revision === requests.noticeRevision) {
        setNoticePermission(permission);
        if (permission === 'unavailable')
          setError('tracking.bankSms.savedAlertSettingsFailed');
      }
    } catch {
      if (revision === requests.noticeRevision)
        setError('tracking.bankSms.savedAlertSettingsFailed');
    } finally {
      requests.asking = false;
      if (revision === requests.noticeRevision) setRequestingNotice(false);
    }
  }

  return (
    <View
      testID="shortcut-setup"
      style={[styles.screen, { backgroundColor: colors.surfaces.page }]}
    >
      <View style={styles.bar}>
        <AppBar
          title={translate('tracking.bankSms.title')}
          direction={direction}
          onBack={() => {
            if (step > 0) goTo(step - 1);
            else if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/more');
          }}
        />
      </View>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View style={[styles.layout, layoutDirectionStyle(direction)]}>
          {step > 0 && (
            <View style={styles.heading}>
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={stepLabel}
                accessibilityValue={{
                  min: 1,
                  max: steps.length,
                  now: step + 1
                }}
                style={styles.heading}
              >
                <StyledText variant="caption" style={muted} accessible={false}>
                  {stepLabel}
                </StyledText>
                <View style={styles.progress} accessible={false}>
                  {steps.map(({ title }, index) => (
                    <View
                      key={title}
                      style={[
                        styles.segment,
                        {
                          backgroundColor:
                            index <= step
                              ? colors.interactions.primary
                              : colors.borders.strong
                        }
                      ]}
                    />
                  ))}
                </View>
              </View>
              <StyledText variant="title" accessibilityRole="header">
                {translate(current.title)}
              </StyledText>
              <StyledText style={muted}>
                {translate(current.description)}
              </StyledText>
            </View>
          )}

          {step === 0 ? (
            <View style={styles.preparation}>
              <SurfaceCard style={styles.recordingCard}>
                <SwitchRow
                  label="tracking.bankSms.recordingPermission"
                  value={enabled}
                  disabled={busy || typeof status !== 'object'}
                  onValueChange={(value) => void setConsent(value)}
                />
                <StyledText style={muted}>
                  tracking.bankSms.recordingScope
                </StyledText>
                <ActionButton
                  variant="secondary"
                  label={
                    !noticePermission
                      ? 'tracking.bankSms.checkingNotices'
                      : noticePermission === 'granted'
                        ? 'tracking.bankSms.savedAlertEnabled'
                        : noticeSettings
                          ? 'tracking.bankSms.savedAlertSettings'
                          : 'tracking.bankSms.allowSavedAlerts'
                  }
                  accessibilityHint={
                    noticeSettings
                      ? translate('tracking.bankSms.openSettingsHint')
                      : undefined
                  }
                  icon={
                    <DesignIcon
                      name="notifications"
                      size="sm"
                      decorative
                      color={colors.content.link}
                    />
                  }
                  disabled={!noticePermission}
                  loading={requestingNotice}
                  onPress={() => void enableSaveNotices()}
                />
                {noticePermission === 'denied' ||
                noticePermission === 'permanently_denied' ||
                noticePermission === 'unavailable' ? (
                  <StyledText
                    variant="caption"
                    accessibilityLiveRegion="polite"
                    style={muted}
                  >
                    {translate(
                      noticePermission === 'unavailable'
                        ? 'tracking.bankSms.noticesUnavailable'
                        : 'tracking.bankSms.noticesOff'
                    )}
                  </StyledText>
                ) : null}
              </SurfaceCard>
              {typeof status === 'object' && status.enabled ? (
                <BankSmsSetupFields
                  setup={status}
                  value={configuration}
                  disabled={busy}
                  onChange={setConfiguration}
                />
              ) : null}
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={translate('tracking.bankSms.how')}
                onPress={() => setHelpOpen(true)}
                style={styles.link}
              >
                <StyledText
                  variant="subtitle"
                  style={{ color: colors.content.link }}
                >
                  tracking.bankSms.how
                </StyledText>
              </Pressable>
              {helpOpen && (
                <AppSheet
                  visible
                  appearance="menu"
                  animationType={reducedMotion ? 'none' : 'slide'}
                  title={translate('tracking.bankSms.how')}
                  onDismiss={() => setHelpOpen(false)}
                >
                  <ScrollView
                    style={styles.helpScroll}
                    contentContainerStyle={styles.helpText}
                  >
                    <StyledText>tracking.bankSms.helpLink</StyledText>
                    <StyledText>tracking.bankSms.helpAutomation</StyledText>
                    <StyledText>tracking.bankSms.helpMatch</StyledText>
                    <StyledText style={muted}>
                      tracking.bankSms.helpSync
                    </StyledText>
                  </ScrollView>
                  <ActionButton
                    label="tracking.bankSms.understood"
                    onPress={() => setHelpOpen(false)}
                  />
                </AppSheet>
              )}
              {status === 'loading' ? (
                <StyledText variant="caption" style={muted}>
                  {translate('tracking.bankSms.checking')}
                </StyledText>
              ) : null}
            </View>
          ) : (
            <View style={styles.instructions}>
              {instructions.map((instruction, index) => (
                <View key={instruction} style={styles.instruction}>
                  <View
                    style={[
                      styles.number,
                      { backgroundColor: colors.surfaces.inset }
                    ]}
                    accessible={false}
                  >
                    <StyledText variant="caption" accessible={false}>
                      {numbers.format(index + 1)}
                    </StyledText>
                  </View>
                  <StyledText style={styles.instructionText}>
                    {translate(instruction)}
                  </StyledText>
                </View>
              ))}
              {step === 2 ? (
                <StyledText variant="caption" style={muted}>
                  {translate('tracking.bankSms.multiple')}
                </StyledText>
              ) : null}
            </View>
          )}

          {status === 'unavailable' ? (
            <StyledText accessibilityRole="alert" style={muted}>
              {translate('tracking.bankSms.unavailable')}
            </StyledText>
          ) : null}
          {step > 0 && typeof status === 'object' && !enabled ? (
            <StyledText accessibilityRole="alert" style={muted}>
              {translate('tracking.bankSms.disabled')}
            </StyledText>
          ) : null}
          {error ? (
            <StyledText
              accessibilityRole="alert"
              style={{ color: colors.status.danger }}
            >
              {translate(error)}
            </StyledText>
          ) : null}

          <View style={styles.navigation}>
            {step > 0 ? (
              <ActionButton
                label={translate('tracking.shortcut.open')}
                variant="secondary"
                onPress={() => void openShortcuts()}
                disabled={!enabled || busy}
              />
            ) : null}
            <ActionButton
              label={translate(
                status === 'unavailable'
                  ? 'tracking.bankSms.retry'
                  : step === lastStep
                    ? 'tracking.bankSms.done'
                    : 'tracking.bankSms.next'
              )}
              onPress={() => {
                if (status === 'unavailable') void retrySetup();
                else void next();
              }}
              loading={busy}
              disabled={
                status !== 'unavailable' &&
                (!enabled || (step === 0 && incompleteEnding))
              }
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { paddingHorizontal: spacing.lg },
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xl },
  layout: { flexGrow: 1, gap: spacing.xl },
  heading: { gap: spacing.md },
  progress: { flexDirection: 'row', gap: spacing.sm },
  segment: { flex: 1, height: 4, borderRadius: radius.pill },
  preparation: { gap: spacing.lg },
  recordingCard: { gap: spacing.md },
  helpScroll: { flexGrow: 0 },
  helpText: { gap: spacing.md, paddingVertical: spacing.lg },
  link: { minHeight: 44, justifyContent: 'center' },
  instructions: { gap: spacing.xl },
  instruction: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md
  },
  instructionText: { flex: 1 },
  number: {
    minWidth: 28,
    minHeight: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center'
  },
  navigation: { gap: spacing.md, marginTop: 'auto', paddingTop: spacing.md }
});
