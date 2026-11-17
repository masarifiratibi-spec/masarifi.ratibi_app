import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';
import { router } from 'expo-router';
import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { AppBar } from '@/design-system/components/navigation/AppNavigation';
import { layoutDirectionStyle } from '@/design-system/direction';
import { IconBadge } from '@/design-system/icons';
import type { NotificationPermissionState } from '@/domain/notifications';
import { phoneNotificationService } from '@/services/platform/phone-notification-service';
import { radius } from '@/design-system/tokens';
import {
  translate,
  translateDynamic,
  type MessageKey
} from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import {
  disableBankSms,
  enableBankSms,
  readBankSmsSetup
} from '@/services/platform/bank-sms-setup.ios';

const steps = [
  {
    icon: 'security',
    title: 'tracking.bankSms.permissionTitle',
    description: 'tracking.bankSms.permissionBody',
    instructions: []
  },
  {
    icon: 'feedback',
    title: 'tracking.bankSms.triggerTitle',
    description: 'tracking.bankSms.triggerBody',
    instructions: [
      'tracking.bankSms.messageTrigger',
      'tracking.bankSms.bankFilter',
      'tracking.bankSms.runImmediately'
    ]
  },
  {
    icon: 'bolt',
    title: 'tracking.bankSms.actionTitle',
    description: 'tracking.bankSms.actionBody',
    instructions: [
      'tracking.bankSms.actionName',
      'tracking.bankSms.actionInput',
      'tracking.bankSms.actionDestination',
      'tracking.bankSms.actionFinish'
    ]
  }
] as const;

const modernSteps = [
  steps[0],
  {
    ...steps[1],
    description: 'tracking.bankSms.triggerBodyModern',
    instructions: [
      'tracking.bankSms.messageTrigger',
      'tracking.bankSms.bankFilter',
      'tracking.bankSms.appAlertTrigger',
      'tracking.bankSms.runImmediatelyModern'
    ]
  },
  {
    ...steps[2],
    description: 'tracking.bankSms.actionBodyModern',
    instructions: [
      'tracking.bankSms.actionName',
      'tracking.bankSms.actionInput',
      'tracking.bankSms.appAlertInput',
      'tracking.bankSms.actionDestination',
      'tracking.bankSms.actionFinish'
    ]
  }
] as const;

type Status = Awaited<ReturnType<typeof readBankSmsSetup>>;
type SetupState = Status | 'loading' | 'unavailable';

export default function IosShortcutScreen() {
  const owner = useAppShellStore((state) => state.session?.userId);
  return <ShortcutSetup key={owner} />;
}

function ShortcutSetup() {
  const locale = usePreferenceStore((state) => state.locale);
  const direction = usePreferenceStore((state) => state.direction);
  const { colors } = useTheme();
  const scroll = useRef<ScrollView>(null);
  const statusRequests = useRef({ revision: 0 }).current;
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<SetupState>('loading');
  const [busy, setBusy] = useState(false);
  const [noticePermission, setNoticePermission] =
    useState<NotificationPermissionState>('unavailable');
  const [requestingNotice, setRequestingNotice] = useState(false);
  const [error, setError] = useState<MessageKey>();
  const setup = typeof status === 'object' ? status : undefined;
  const enabled = setup?.enabled === true;
  const lastSaved = setup?.lastSaved;
  const uiSteps =
    Number.parseInt(String(Platform.Version), 10) >= 27 ? modernSteps : steps;
  const current = uiSteps[step];
  const lastStep = steps.length - 1;
  const mute = { color: colors.textSecondary };
  const permissionLabel =
    status === 'loading'
      ? 'tracking.bankSms.checking'
      : status === 'unavailable'
        ? 'tracking.bankSms.unavailable'
        : enabled
          ? 'tracking.bankSms.allowed'
          : 'tracking.bankSms.disabled';
  const trackingLabel = !enabled
    ? permissionLabel
    : lastSaved
      ? 'tracking.bankSms.confirmed'
      : 'tracking.bankSms.waiting';
  const stepNumbers = new Intl.NumberFormat(
    locale === 'ar' ? 'ar-u-nu-arab' : locale
  );
  const stepLabel = translateDynamic('tracking.bankSms.step', {
    current: stepNumbers.format(step + 1),
    total: stepNumbers.format(steps.length)
  });

  const refresh = useCallback(
    async (initial = false) => {
      const request = ++statusRequests.revision;
      try {
        const [value, permission] = await Promise.all([
          readBankSmsSetup(),
          phoneNotificationService.getPermission()
        ]);
        if (statusRequests.revision !== request) return;
        setNoticePermission(permission);
        setStatus(value);
        if (initial && value.enabled && value.lastSaved)
          setStep(steps.length - 1);
      } catch {
        if (statusRequests.revision === request) setStatus('unavailable');
      }
    },
    [statusRequests]
  );

  useEffect(() => {
    void refresh(true);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      statusRequests.revision++;
      subscription.remove();
    };
  }, [refresh, statusRequests]);

  function goTo(next: number) {
    setStep(next);
    setError(undefined);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  async function changePermission(action: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      if (action === disableBankSms) goTo(0);
      await refresh();
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

  async function enableSaveNotices() {
    setRequestingNotice(true);
    setError(undefined);
    try {
      if (noticePermission === 'permanently_denied') {
        await Linking.openSettings();
      } else {
        setNoticePermission(await phoneNotificationService.requestPermission());
      }
    } catch {
      setError('tracking.bankSms.savedAlertSettingsFailed');
    } finally {
      setRequestingNotice(false);
    }
  }

  async function checkStatus() {
    setBusy(true);
    setError(undefined);
    await refresh();
    setBusy(false);
  }

  return (
    <ScrollView
      ref={scroll}
      testID="shortcut-setup"
      contentContainerStyle={styles.content}
      style={{ backgroundColor: colors.surfaces.page }}
    >
      <View style={[styles.layout, layoutDirectionStyle(direction)]}>
        <AppBar
          title={translate('tracking.bankSms.title')}
          direction={direction}
          onBack={() =>
            router.canGoBack() ? router.back() : router.replace('/(tabs)/more')
          }
        />
        <View style={styles.heading}>
          <StyledText variant="caption" style={mute}>
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

        <SurfaceCard style={styles.card}>
          <IconBadge icon={current.icon} label="" decorative size="lg" />
          <View style={styles.heading}>
            <StyledText variant="subtitle" accessibilityRole="header">
              {translate(current.title)}
            </StyledText>
            <StyledText style={mute}>
              {translate(current.description)}
            </StyledText>
          </View>

          {step === 0 ? (
            <View
              style={[
                styles.permission,
                { backgroundColor: colors.surfaces.inset }
              ]}
            >
              <IconBadge
                icon={enabled ? 'check' : 'lock'}
                tone={enabled ? 'success' : 'primary'}
                label=""
                size="sm"
                decorative
              />
              <StyledText variant="caption" accessibilityLiveRegion="polite">
                {translate(permissionLabel)}
              </StyledText>
            </View>
          ) : (
            <View
              style={[
                styles.instructions,
                { backgroundColor: colors.surfaces.inset }
              ]}
            >
              {current.instructions.map((instruction, index) => (
                <View
                  key={instruction}
                  style={[
                    styles.instruction,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.borders.default
                    }
                  ]}
                >
                  <StyledText>{translate(instruction)}</StyledText>
                </View>
              ))}
            </View>
          )}

          {step === 0 && !enabled ? (
            <ActionButton
              label={translate('tracking.bankSms.enable')}
              onPress={() => void changePermission(enableBankSms)}
              loading={busy}
              disabled={!setup}
            />
          ) : null}

          {step > 0 ? (
            <>
              {step === lastStep ? (
                <StyledText variant="caption" style={mute}>
                  {translate('tracking.bankSms.multiple')}
                </StyledText>
              ) : null}
              <ActionButton
                label={translate('tracking.shortcut.open')}
                onPress={() => void openShortcuts()}
                variant="secondary"
                disabled={!enabled || busy}
              />
            </>
          ) : null}
        </SurfaceCard>

        {step === lastStep ? (
          <SurfaceCard style={styles.card}>
            <View style={styles.heading}>
              <StyledText variant="subtitle" accessibilityRole="header">
                {translate('tracking.bankSms.statusTitle')}
              </StyledText>
              <StyledText accessibilityLiveRegion="polite">
                {translate(trackingLabel)}
              </StyledText>
              {lastSaved ? (
                <StyledText variant="caption" style={mute}>
                  {translateDynamic('tracking.shortcut.lastSuccess', {
                    time: new Date(lastSaved).toLocaleString(locale)
                  })}
                </StyledText>
              ) : null}
              {setup?.outcome &&
              !['enabled', 'saved'].includes(setup.outcome) ? (
                <StyledText variant="caption" style={mute}>
                  {translateDynamic(
                    `tracking.bankSms.outcome.${setup.outcome}`
                  )}
                </StyledText>
              ) : null}
              {setup?.pending && setup.outcome !== 'queued' ? (
                <StyledText variant="caption" style={mute}>
                  {translate('tracking.bankSms.pending')}
                </StyledText>
              ) : null}
            </View>
            <ActionButton
              label={translate('tracking.shortcut.transactions')}
              variant="secondary"
              onPress={() => router.push('/(tabs)/transactions')}
            />
            {enabled ? (
              <View style={styles.heading}>
                {noticePermission !== 'unavailable' ? (
                  <StyledText variant="caption" style={mute}>
                    {translate(
                      noticePermission === 'granted'
                        ? 'tracking.bankSms.savedAlertEnabled'
                        : 'tracking.bankSms.savedAlertExplanation'
                    )}
                  </StyledText>
                ) : null}
                {noticePermission !== 'granted' &&
                noticePermission !== 'unavailable' ? (
                  <ActionButton
                    label={translate(
                      noticePermission === 'permanently_denied'
                        ? 'tracking.bankSms.savedAlertSettings'
                        : 'tracking.bankSms.allowSavedAlerts'
                    )}
                    variant="secondary"
                    loading={requestingNotice}
                    disabled={busy}
                    onPress={() => void enableSaveNotices()}
                  />
                ) : null}
                <ActionButton
                  label={translate('tracking.bankSms.refreshChoices')}
                  variant="quiet"
                  onPress={() => void changePermission(enableBankSms)}
                  disabled={busy}
                />
                <ActionButton
                  label={translate('tracking.shortcut.disable')}
                  variant="quiet"
                  onPress={() => void changePermission(disableBankSms)}
                  disabled={busy}
                />
              </View>
            ) : null}
          </SurfaceCard>
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
              label={translate('tracking.bankSms.back')}
              variant="secondary"
              onPress={() => goTo(step - 1)}
              style={styles.navButton}
              disabled={busy}
            />
          ) : null}
          {step === lastStep || status === 'unavailable' ? (
            <ActionButton
              label={translate('tracking.bankSms.checkStatus')}
              onPress={() => void checkStatus()}
              style={styles.navButton}
              loading={busy}
            />
          ) : (
            <ActionButton
              label={translate('tracking.bankSms.next')}
              onPress={() => goTo(step + 1)}
              style={styles.navButton}
              disabled={!enabled || busy}
            />
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 16, paddingBottom: 24 },
  layout: { flexGrow: 1, gap: 20 },
  heading: { gap: 6 },
  card: { gap: 14 },
  progress: { flexDirection: 'row', gap: 6, marginTop: 4 },
  segment: { flex: 1, height: 4, borderRadius: radius.pill },
  permission: {
    alignItems: 'center',
    borderRadius: radius.status,
    flexDirection: 'row',
    gap: 10,
    padding: 12
  },
  instructions: { borderRadius: radius.group, paddingHorizontal: 12 },
  instruction: { paddingVertical: 10 },
  navigation: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 'auto'
  },
  navButton: { flexGrow: 1 }
});
