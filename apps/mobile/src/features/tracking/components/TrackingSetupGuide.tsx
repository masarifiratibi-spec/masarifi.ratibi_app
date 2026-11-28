import React, { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { readTrackingAlertEnabled } from '@/services/platform/tracking-alert-status';
import { leadingTextStyle } from '@/design-system/direction';
import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { AppSheet } from '@/design-system/components/overlays/AppSheet';
import { DesignIcon } from '@/design-system/icons';
import { radius, spacing } from '@/design-system/tokens';
import { translate, type MessageKey } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import type { TrackingAutostartDestination } from '@/services/platform/tracking-autostart-settings';

type GuideTopic = 'sms' | 'notification' | 'alerts' | 'autostart';
// Autostart is an installation setting. This records only the user's acknowledgement.
const autostartConfirmationKey = 'masarifi.tracking.autostart-confirmed.v1';
const topics: readonly GuideTopic[] = [
  'sms',
  'notification',
  'alerts',
  'autostart'
];

export function TrackingSetupGuide({
  actionsDisabled = false,
  smsAvailable,
  notificationAvailable,
  smsEnabled,
  notificationEnabled,
  onEnableSmsTracking,
  onEnableNotificationTracking,
  onOpenAlertSettings,
  onOpenAutostartSettings
}: {
  actionsDisabled?: boolean;
  smsAvailable: boolean;
  notificationAvailable: boolean;
  smsEnabled: boolean;
  notificationEnabled: boolean;
  onEnableSmsTracking: () => Promise<void>;
  onEnableNotificationTracking: () => Promise<void>;
  onOpenAlertSettings: () => Promise<boolean>;
  onOpenAutostartSettings: () => Promise<TrackingAutostartDestination>;
}) {
  const { colors } = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const reducedMotion = usePreferenceStore((state) => state.reducedMotion);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<GuideTopic | null>(null);
  const [restrictedHelp, setRestrictedHelp] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [autostartFallback, setAutostartFallback] = useState(false);
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [reviewedAutostart, setReviewedAutostart] = useState(false);
  const acknowledgementVersion = useRef(0);
  useEffect(() => {
    if (!expanded || actionsDisabled || Platform.OS !== 'android') return;
    let active = true;
    let request = 0;
    const revision = acknowledgementVersion.current;
    void AsyncStorage.getItem(autostartConfirmationKey)
      .then((value) => {
        if (active && revision === acknowledgementVersion.current)
          setConfirmed(value === 'yes');
      })
      .catch(() => {});
    const refresh = async () => {
      const current = ++request;
      const enabled = await readTrackingAlertEnabled();
      if (active && current === request) setAlertEnabled(enabled);
    };
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [expanded, actionsDisabled]);
  const actionVersion = useRef(0);
  useEffect(
    () => () => {
      actionVersion.current += 1;
    },
    []
  );
  const row = {
    direction: 'ltr' as const,
    flexDirection:
      direction === 'rtl' ? ('row-reverse' as const) : ('row' as const)
  };
  const text = {
    textAlign: direction === 'rtl' ? ('right' as const) : ('left' as const),
    writingDirection: direction
  };
  const titleStyle = [styles.title, text, { color: colors.content.primary }];
  const bodyStyle = [styles.body, text, { color: colors.content.secondary }];
  const complete = {
    sms: smsEnabled && smsAvailable,
    notification: notificationEnabled && notificationAvailable,
    alerts: alertEnabled,
    autostart: confirmed
  };
  const selectedEnabled = selected !== null && complete[selected];
  const success = colors.iconBadges.success;
  const successLabel = (topic: GuideTopic) =>
    topic === 'autostart'
      ? translate('tracking.setup.autostart.confirmedLabel')
      : translate('tracking.setup.enabled');
  const canReview = selected === 'alerts' || selected === 'autostart';
  const unavailableMessage: MessageKey | null =
    selected === 'autostart' && Platform.OS !== 'android'
      ? 'tracking.setup.autostart.androidOnly'
      : Platform.OS === 'web'
        ? 'tracking.setup.webUnavailable'
        : selected !== 'alerts' && Platform.OS !== 'android'
          ? 'tracking.setup.androidOnly'
          : (selected === 'sms' && !smsAvailable) ||
              (selected === 'notification' && !notificationAvailable)
            ? 'tracking.setup.sourceUnavailable'
            : null;

  function dismiss() {
    actionVersion.current += 1;
    setSelected(null);
    setReviewedAutostart(false);
    setRestrictedHelp(false);
    setError(null);
    setAutostartFallback(false);
    setOpening(false);
  }

  async function acknowledgeAutostart(value: boolean) {
    if (opening || actionsDisabled) return;
    const version = ++actionVersion.current;
    ++acknowledgementVersion.current;
    setOpening(true);
    setError(null);
    try {
      await AsyncStorage.setItem(
        autostartConfirmationKey,
        value ? 'yes' : 'no'
      );
      // The write survives dismissal, as should the status on the underlying row.
      setConfirmed(value);
      if (actionVersion.current === version) setReviewedAutostart(false);
    } catch {
      if (actionVersion.current === version)
        setError('tracking.setup.autostart.saveFailed');
    } finally {
      if (actionVersion.current === version) setOpening(false);
    }
  }

  async function runSetupAction(topic: GuideTopic) {
    if (opening || actionsDisabled) return;
    if (
      (topic === 'sms' && smsEnabled) ||
      (topic === 'notification' && notificationEnabled)
    )
      return;
    const version = ++actionVersion.current;
    setOpening(true);
    setError(null);
    setAutostartFallback(false);
    try {
      const opened =
        topic === 'sms'
          ? await onEnableSmsTracking()
          : topic === 'notification'
            ? await onEnableNotificationTracking()
            : topic === 'autostart'
              ? await onOpenAutostartSettings()
              : await onOpenAlertSettings();
      if (version !== actionVersion.current) return;
      if (topic === 'autostart') {
        setReviewedAutostart(
          opened === 'autostart' || opened === 'app_settings'
        );
        setAutostartFallback(opened === 'app_settings');
        if (opened === 'unavailable') setError('tracking.setup.openFailed');
      }
      if (version === actionVersion.current && opened === false) {
        setError('tracking.setup.webUnavailable');
      }
    } catch {
      if (version === actionVersion.current)
        setError(
          topic === 'alerts' || topic === 'autostart'
            ? 'tracking.setup.openFailed'
            : 'tracking.setup.enableFailed'
        );
    } finally {
      if (version === actionVersion.current) setOpening(false);
    }
  }

  const errorMessage = error ? (
    <StyledText
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.body, text, { color: colors.status.danger }]}
    >
      {translate(error)}
    </StyledText>
  ) : null;

  return (
    <>
      <SurfaceCard style={styles.shortcutCard}>
        <Pressable
          testID="tracking-alert-settings"
          accessibilityRole="button"
          accessibilityLabel={translate('tracking.setup.alertSettings')}
          accessibilityHint={translate(
            'tracking.setup.alertSettingsDescription'
          )}
          accessibilityState={{
            disabled: opening || actionsDisabled,
            busy: opening
          }}
          disabled={opening || actionsDisabled}
          onPress={() => void runSetupAction('alerts')}
          style={({ pressed }) => [
            styles.header,
            row,
            pressed && styles.pressed
          ]}
        >
          <DesignIcon
            name="notifications"
            decorative
            color={colors.content.link}
            size="sm"
          />
          <View style={styles.copy}>
            <StyledText style={titleStyle}>
              {translate('tracking.setup.alertSettings')}
            </StyledText>
            <StyledText style={bodyStyle}>
              {translate('tracking.setup.alertSettingsDescription')}
            </StyledText>
          </View>
          <DesignIcon
            name="chevronEnd"
            direction={direction}
            decorative
            color={colors.content.secondary}
            size="sm"
          />
        </Pressable>
        {!selected ? errorMessage : null}
      </SurfaceCard>

      <SurfaceCard
        testID="tracking-setup-guide"
        style={[styles.guide, { backgroundColor: colors.surfaces.brandSubtle }]}
      >
        <Pressable
          testID="tracking-setup-toggle"
          accessibilityRole="button"
          accessibilityLabel={translate('tracking.setup.title')}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
          style={({ pressed }) => [
            styles.header,
            row,
            pressed && styles.pressed
          ]}
        >
          <View
            style={[
              styles.helpIcon,
              {
                backgroundColor: colors.surfaces.card,
                borderColor: colors.borders.default
              }
            ]}
          >
            <StyledText
              accessible={false}
              style={{ color: colors.content.link }}
            >
              {direction === 'rtl' ? '؟' : '?'}
            </StyledText>
          </View>
          <View style={styles.copy}>
            <StyledText style={titleStyle}>
              {translate('tracking.setup.title')}
            </StyledText>
            <StyledText style={bodyStyle}>
              {translate('tracking.setup.description')}
            </StyledText>
          </View>
          <View style={expanded ? styles.flipped : undefined}>
            <DesignIcon
              name="chevronDown"
              decorative
              color={colors.content.link}
              size="sm"
            />
          </View>
        </Pressable>
        {expanded ? (
          <View style={styles.guideContent}>
            {topics.map((topic, index) => (
              <Pressable
                key={topic}
                testID={`tracking-guide-${topic}`}
                accessibilityRole="button"
                accessibilityLabel={`${translate(`tracking.setup.${topic}.title`)}، ${complete[topic] ? successLabel(topic) : translate('tracking.setup.viewSteps')}`}
                onPress={() => {
                  actionVersion.current += 1;
                  setOpening(false);
                  setError(null);
                  setRestrictedHelp(false);
                  setAutostartFallback(false);
                  setReviewedAutostart(false);
                  setSelected(topic);
                }}
                style={({ pressed }) => [
                  styles.guideRow,
                  row,
                  { borderTopColor: colors.borders.default },
                  complete[topic] && [
                    styles.completedRow,
                    {
                      backgroundColor: success.background,
                      borderTopColor: success.border
                    }
                  ],
                  pressed && styles.pressed
                ]}
              >
                <View
                  style={[
                    styles.number,
                    {
                      backgroundColor: colors.surfaces.card,
                      borderColor: colors.borders.default
                    }
                  ]}
                >
                  {complete[topic] ? (
                    <DesignIcon
                      name="check"
                      decorative
                      color={success.foreground}
                      size="sm"
                    />
                  ) : (
                    <StyledText
                      accessible={false}
                      style={[styles.body, { color: colors.content.link }]}
                    >
                      {index + 1}
                    </StyledText>
                  )}
                </View>
                <View style={styles.copy}>
                  <StyledText style={titleStyle}>
                    {translate(`tracking.setup.${topic}.title`)}
                  </StyledText>
                  <StyledText
                    style={
                      complete[topic]
                        ? [styles.title, text, { color: success.foreground }]
                        : bodyStyle
                    }
                  >
                    {complete[topic]
                      ? successLabel(topic)
                      : translate(`tracking.setup.${topic}.description`)}
                  </StyledText>
                </View>
                <StyledText
                  style={[
                    styles.stepsLink,
                    styles.guideLink,
                    text,
                    { color: colors.content.link }
                  ]}
                >
                  {translate(
                    complete[topic]
                      ? 'tracking.setup.details'
                      : 'tracking.setup.viewSteps'
                  )}
                </StyledText>
              </Pressable>
            ))}
            <StyledText style={[bodyStyle, leadingTextStyle(direction)]}>
              {translate('tracking.setup.footer')}
            </StyledText>
          </View>
        ) : null}
      </SurfaceCard>
      {selected ? (
        <AppSheet
          title={translate(`tracking.setup.${selected}.sheetTitle`)}
          titleStyle={leadingTextStyle(direction)}
          visible
          animationType={reducedMotion ? 'none' : 'slide'}
          onDismiss={dismiss}
        >
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetContent}
          >
            {unavailableMessage ? (
              <StyledText style={bodyStyle}>
                {translate(unavailableMessage)}
              </StyledText>
            ) : (
              <>
                {selectedEnabled && !reviewedAutostart ? (
                  <View accessibilityLiveRegion="polite">
                    <ActionButton
                      label={
                        selected === 'autostart'
                          ? 'tracking.setup.autostart.confirmedLabel'
                          : 'tracking.setup.enabled'
                      }
                      disabled
                      icon={
                        <DesignIcon
                          name="check"
                          decorative
                          color={success.foreground}
                          size="sm"
                        />
                      }
                      style={{
                        opacity: 1,
                        backgroundColor: success.background,
                        borderColor: success.border
                      }}
                      labelStyle={{ color: success.foreground }}
                    />
                  </View>
                ) : reviewedAutostart ? (
                  <View style={styles.copy}>
                    <StyledText style={titleStyle}>
                      {translate('tracking.setup.autostart.reviewTitle')}
                    </StyledText>
                    <StyledText style={bodyStyle}>
                      {translate('tracking.setup.autostart.reviewBody')}
                    </StyledText>
                  </View>
                ) : (
                  <>
                    {selected === 'autostart' ? (
                      <StyledText style={bodyStyle}>
                        {translate('tracking.setup.autostart.intro')}
                      </StyledText>
                    ) : null}
                    {[1, 2, 3].map((step) => {
                      const key =
                        selected === 'alerts' &&
                        Platform.OS === 'ios' &&
                        step > 1
                          ? `tracking.setup.alerts.iosStep${step}`
                          : `tracking.setup.${selected}.step${step}`;
                      return (
                        <View key={step} style={[styles.sheetStep, row]}>
                          <View
                            style={[
                              styles.number,
                              {
                                backgroundColor: colors.surfaces.brandSubtle,
                                borderColor: colors.borders.default
                              }
                            ]}
                          >
                            <StyledText
                              accessible={false}
                              style={[
                                styles.body,
                                { color: colors.content.link }
                              ]}
                            >
                              {step}
                            </StyledText>
                          </View>
                          <StyledText
                            style={[
                              styles.copy,
                              styles.stepText,
                              text,
                              { color: colors.content.primary }
                            ]}
                          >
                            {translate(key as MessageKey)}
                          </StyledText>
                        </View>
                      );
                    })}
                    {selected !== 'autostart' ? (
                      <StyledText style={bodyStyle}>
                        {translate(`tracking.setup.${selected}.note`)}
                      </StyledText>
                    ) : null}
                    {selected === 'autostart' ? (
                      <View
                        style={[
                          styles.restricted,
                          styles.restartNote,
                          { backgroundColor: colors.surfaces.brandSubtle }
                        ]}
                      >
                        <StyledText
                          style={[
                            styles.body,
                            text,
                            { color: colors.content.primary }
                          ]}
                        >
                          {translate('tracking.setup.autostart.restartNote')}
                        </StyledText>
                      </View>
                    ) : null}
                    {selected === 'autostart' ? (
                      <StyledText style={bodyStyle}>
                        {translate('tracking.setup.autostart.note')}
                      </StyledText>
                    ) : null}
                    {selected === 'sms' ? (
                      <View
                        style={[
                          styles.restricted,
                          { backgroundColor: colors.surfaces.brandSubtle }
                        ]}
                      >
                        <Pressable
                          testID="tracking-restricted-help"
                          accessibilityRole="button"
                          accessibilityState={{ expanded: restrictedHelp }}
                          onPress={() => setRestrictedHelp((value) => !value)}
                          style={styles.helpToggle}
                        >
                          <StyledText
                            style={[
                              styles.stepsLink,
                              text,
                              { color: colors.content.link }
                            ]}
                          >
                            {translate('tracking.setup.restricted.title')}
                          </StyledText>
                        </Pressable>
                        {restrictedHelp ? (
                          <StyledText style={bodyStyle}>
                            {translate('tracking.setup.restricted.body')}
                          </StyledText>
                        ) : null}
                      </View>
                    ) : null}
                  </>
                )}
                {selected === 'autostart' && autostartFallback ? (
                  <StyledText
                    accessibilityLiveRegion="polite"
                    style={bodyStyle}
                  >
                    {translate('tracking.setup.autostart.fallback')}
                  </StyledText>
                ) : null}
                {errorMessage}
                {reviewedAutostart ? (
                  <>
                    <ActionButton
                      label="tracking.setup.autostart.confirm"
                      disabled={actionsDisabled || opening}
                      onPress={() => void acknowledgeAutostart(true)}
                    />
                    {confirmed && (
                      <ActionButton
                        label="tracking.setup.autostart.clear"
                        variant="quiet"
                        disabled={actionsDisabled || opening}
                        onPress={() => void acknowledgeAutostart(false)}
                      />
                    )}
                  </>
                ) : null}
                {(!selectedEnabled || canReview) && (
                  <ActionButton
                    testID="tracking-guide-open-settings"
                    label={
                      opening && !canReview
                        ? 'tracking.setup.activating'
                        : selected === 'alerts'
                          ? 'tracking.setup.alerts.open'
                          : selected === 'autostart'
                            ? 'tracking.setup.autostart.open'
                            : `tracking.setup.${selected}.enable`
                    }
                    variant={
                      selectedEnabled || reviewedAutostart
                        ? 'secondary'
                        : 'primary'
                    }
                    disabled={actionsDisabled}
                    loading={opening}
                    onPress={() => void runSetupAction(selected)}
                  />
                )}
              </>
            )}
            <ActionButton
              label="appShell.navigation.close"
              variant="quiet"
              onPress={dismiss}
            />
          </ScrollView>
        </AppSheet>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  completedRow: { paddingHorizontal: spacing.sm, borderRadius: radius.control },
  shortcutCard: { padding: 0 },
  header: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    minHeight: 76
  },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs },
  title: { fontSize: 14, lineHeight: 23, fontWeight: '700' },
  body: { fontSize: 12, lineHeight: 21 },
  guide: { padding: 0 },
  helpIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  guideContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm
  },
  guideRow: {
    gap: spacing.sm,
    alignItems: 'flex-start',
    borderTopWidth: 1,
    paddingVertical: spacing.md,
    minHeight: 48
  },
  number: {
    width: 25,
    height: 25,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  stepsLink: {
    fontSize: 12,
    lineHeight: 22,
    fontWeight: '600',
    textDecorationLine: 'underline'
  },
  guideLink: { alignSelf: 'center', flexShrink: 0 },
  sheetScroll: { flexShrink: 1 },
  sheetContent: { gap: spacing.md, paddingBottom: spacing.sm },
  sheetStep: { gap: spacing.sm, alignItems: 'flex-start' },
  stepText: { fontSize: 14, lineHeight: 26 },
  restricted: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderRadius: radius.control
  },
  restartNote: { paddingTop: spacing.sm },
  helpToggle: { minHeight: 48, justifyContent: 'center' },
  flipped: { transform: [{ rotate: '180deg' }] },
  pressed: { opacity: 0.7 }
});
