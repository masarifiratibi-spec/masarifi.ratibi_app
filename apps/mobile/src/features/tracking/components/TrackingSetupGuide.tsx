import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { AppSheet } from '@/design-system/components/overlays/AppSheet';
import { DesignIcon } from '@/design-system/icons';
import { radius, spacing } from '@/design-system/tokens';
import { translate, type MessageKey } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';

type GuideTopic = 'sms' | 'notification' | 'alerts';
const topics: readonly GuideTopic[] = ['sms', 'notification', 'alerts'];

export function TrackingSetupGuide({
  smsAvailable,
  notificationAvailable,
  smsEnabled,
  notificationEnabled,
  onEnableSmsTracking,
  onEnableNotificationTracking,
  onOpenAlertSettings
}: {
  smsAvailable: boolean;
  notificationAvailable: boolean;
  smsEnabled: boolean;
  notificationEnabled: boolean;
  onEnableSmsTracking: () => Promise<void>;
  onEnableNotificationTracking: () => Promise<void>;
  onOpenAlertSettings: () => Promise<boolean>;
}) {
  const { colors } = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const reducedMotion = usePreferenceStore((state) => state.reducedMotion);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<GuideTopic | null>(null);
  const [restrictedHelp, setRestrictedHelp] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
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
  const selectedEnabled =
    selected === 'sms'
      ? smsEnabled
      : selected === 'notification'
        ? notificationEnabled
        : false;
  const unavailableMessage: MessageKey | null =
    Platform.OS === 'web'
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
    setRestrictedHelp(false);
    setError(null);
    setOpening(false);
  }

  async function runSetupAction(topic: GuideTopic) {
    if (opening) return;
    if (
      (topic === 'sms' && smsEnabled) ||
      (topic === 'notification' && notificationEnabled)
    )
      return;
    const version = ++actionVersion.current;
    setOpening(true);
    setError(null);
    try {
      const opened =
        topic === 'sms'
          ? await onEnableSmsTracking()
          : topic === 'notification'
            ? await onEnableNotificationTracking()
            : await onOpenAlertSettings();
      if (version === actionVersion.current && opened === false) {
        setError('tracking.setup.webUnavailable');
      }
    } catch {
      if (version === actionVersion.current)
        setError(
          topic === 'alerts'
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
          accessibilityState={{ disabled: opening, busy: opening }}
          disabled={opening}
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
                accessibilityLabel={`${translate(`tracking.setup.${topic}.title`)}، ${translate('tracking.setup.viewSteps')}`}
                onPress={() => {
                  actionVersion.current += 1;
                  setOpening(false);
                  setError(null);
                  setRestrictedHelp(false);
                  setSelected(topic);
                }}
                style={({ pressed }) => [
                  styles.guideRow,
                  row,
                  { borderTopColor: colors.borders.default },
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
                  <StyledText
                    accessible={false}
                    style={[styles.body, { color: colors.content.link }]}
                  >
                    {index + 1}
                  </StyledText>
                </View>
                <View style={styles.copy}>
                  <StyledText style={titleStyle}>
                    {translate(`tracking.setup.${topic}.title`)}
                  </StyledText>
                  <StyledText style={bodyStyle}>
                    {translate(`tracking.setup.${topic}.description`)}
                  </StyledText>
                  <StyledText
                    style={[
                      styles.stepsLink,
                      text,
                      { color: colors.content.link }
                    ]}
                  >
                    {translate('tracking.setup.viewSteps')}
                  </StyledText>
                </View>
              </Pressable>
            ))}
            <StyledText style={bodyStyle}>
              {translate('tracking.setup.footer')}
            </StyledText>
          </View>
        ) : null}
      </SurfaceCard>
      <StyledText
        testID="tracking-setup-privacy"
        style={[styles.privacy, { color: colors.content.secondary }, text]}
      >
        {translate('tracking.setup.privacy')}
      </StyledText>

      {selected ? (
        <AppSheet
          title={translate(`tracking.setup.${selected}.sheetTitle`)}
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
                {[1, 2, 3].map((step) => {
                  const key =
                    selected === 'alerts' && Platform.OS === 'ios' && step > 1
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
                          style={[styles.body, { color: colors.content.link }]}
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
                <StyledText style={bodyStyle}>
                  {translate(`tracking.setup.${selected}.note`)}
                </StyledText>
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
                {errorMessage}
                <ActionButton
                  testID="tracking-guide-open-settings"
                  label={
                    selectedEnabled
                      ? 'tracking.setup.enabled'
                      : selected === 'alerts'
                        ? 'tracking.setup.alerts.open'
                        : `tracking.setup.${selected}.enable`
                  }
                  disabled={selectedEnabled}
                  style={selectedEnabled ? styles.completedAction : undefined}
                  loading={opening}
                  onPress={() => void runSetupAction(selected)}
                />
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
  completedAction: { opacity: 1 },
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
  privacy: { fontSize: 12, lineHeight: 21, paddingHorizontal: spacing.xs },
  sheetScroll: { flexShrink: 1 },
  sheetContent: { gap: spacing.md, paddingBottom: spacing.sm },
  sheetStep: { gap: spacing.sm, alignItems: 'flex-start' },
  stepText: { fontSize: 14, lineHeight: 26 },
  restricted: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderRadius: radius.control
  },
  helpToggle: { minHeight: 48, justifyContent: 'center' },
  flipped: { transform: [{ rotate: '180deg' }] },
  pressed: { opacity: 0.7 }
});
