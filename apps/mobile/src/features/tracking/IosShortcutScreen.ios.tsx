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
  const { colors } = useTheme();
  const scroll = useRef<ScrollView>(null);
  const requests = useRef({ revision: 0 }).current;
  const [step, setStep] = useState(0);
  const [configuration, setConfiguration] = useState<BankSmsConfiguration>();
  const [status, setStatus] = useState<SetupState>('loading');
  const [busy, setBusy] = useState(false);
  const [noticePermission, setNoticePermission] =
    useState<NotificationPermissionState>('unavailable');
  const [requestingNotice, setRequestingNotice] = useState(false);
  const [error, setError] = useState<MessageKey>();
  const enabled = typeof status === 'object' && status.enabled;
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
  ].includes(noticePermission);

  const refresh = useCallback(async () => {
    const request = ++requests.revision;
    const [setup, permission] = await Promise.all([
      readBankSmsSetup().catch(() => null),
      phoneNotificationService
        .getPermission()
        .catch(() => 'unavailable' as const)
    ]);
    if (request !== requests.revision) return null;
    setStatus(setup ?? 'unavailable');
    setNoticePermission(permission);
    return setup;
  }, [requests]);

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      requests.revision++;
      subscription.remove();
    };
  }, [refresh, requests]);

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
      // Publish current account/category choices as part of the explicit setup step.
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
    setRequestingNotice(true);
    setError(undefined);
    try {
      if (noticeSettings) await Linking.openSettings();
      else {
        const permission = await phoneNotificationService.requestPermission();
        setNoticePermission(permission);
        if (permission === 'unavailable')
          setError('tracking.bankSms.savedAlertSettingsFailed');
      }
    } catch {
      setError('tracking.bankSms.savedAlertSettingsFailed');
    } finally {
      setRequestingNotice(false);
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
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        <View style={[styles.layout, layoutDirectionStyle(direction)]}>
          <View style={styles.heading}>
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={stepLabel}
              accessibilityValue={{ min: 1, max: steps.length, now: step + 1 }}
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

          {step === 0 ? (
            <View style={styles.preparation}>
              <View style={styles.notifications}>
                <StyledText variant="subtitle">
                  {translate('tracking.bankSms.notificationsTitle')}
                </StyledText>
                <StyledText style={muted}>
                  {translate('tracking.bankSms.notificationsBody')}
                </StyledText>
                {noticePermission === 'granted' ? (
                  <StyledText
                    variant="caption"
                    accessibilityLiveRegion="polite"
                    style={muted}
                  >
                    {translate('tracking.bankSms.savedAlertEnabled')}
                  </StyledText>
                ) : null}
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={translate(
                    noticeSettings
                      ? 'tracking.bankSms.savedAlertSettings'
                      : 'tracking.bankSms.allowSavedAlerts'
                  )}
                  accessibilityState={{
                    disabled: requestingNotice || busy,
                    busy: requestingNotice
                  }}
                  disabled={requestingNotice || busy}
                  onPress={() => void enableSaveNotices()}
                  style={styles.link}
                >
                  <StyledText
                    style={{
                      color: colors.interactions.primary,
                      textDecorationLine: 'underline'
                    }}
                  >
                    {translate(
                      noticeSettings
                        ? 'tracking.bankSms.savedAlertSettings'
                        : 'tracking.bankSms.allowSavedAlerts'
                    )}
                  </StyledText>
                </Pressable>
              </View>
              <View
                style={[
                  styles.consent,
                  { borderTopColor: colors.borders.default }
                ]}
              >
                <SwitchRow
                  label="tracking.bankSms.recordingPermission"
                  subtext="tracking.bankSms.recordingScope"
                  value={enabled}
                  disabled={busy || typeof status !== 'object'}
                  onValueChange={(value) => void setConsent(value)}
                />
              </View>
              {typeof status === 'object' && status.enabled && status.accounts ? (
                <BankSmsSetupFields setup={status} value={configuration}
                  disabled={busy} onChange={setConfiguration} />
              ) : null}
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
              disabled={status !== 'unavailable' && !enabled}
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
  notifications: { gap: spacing.sm },
  link: { minHeight: 44, justifyContent: 'center' },
  consent: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md },
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
