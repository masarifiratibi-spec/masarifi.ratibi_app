import React, { useCallback, useState } from 'react';
import { AppState, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { layoutDirectionStyle } from '@/design-system/direction';
import { colorTokens, spacing } from '@/design-system/tokens';
import { useInitialHomeReadiness } from '@/features/shell/InitialHomeLoadingBoundary';
import { translate } from '@/localization/i18n';
import { readBankSmsSetup, subscribeBankSmsVerification, verifyPendingBankSms } from '@/services/platform/bank-sms-setup.ios';
import { useAppShellStore } from '@/state/app-shell';
import { useTrackingAdmission } from '@/state/tracking-admission';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';

const CARD_SCALE = 1.05;

export function HomeTrackingEntry() {
  const session = useAppShellStore((state) => state.session);
  const profileSetupStatus = useAppShellStore((state) => state.profileSetupStatus);
  useInitialHomeReadiness('notice', 'ready');

  if (session?.status !== 'authenticated' || profileSetupStatus !== 'complete')
    return null;

  return <TrackingSetupCard key={`${session.userId}:${session.issuedAt}`} />;
}

function TrackingSetupCard() {
  const direction = usePreferenceStore((state) => state.direction);
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const admissionReady = useTrackingAdmission((state) => state.ready);
  const [completed, setCompleted] = useState(false);
  const [verificationEpoch, setVerificationEpoch] = useState<string>();
  const [verifying, setVerifying] = useState(false);
  const [failed, setFailed] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    let revision = 0;
    async function refresh() {
      const request = ++revision;
      const setup = await readBankSmsSetup().catch(() => null);
      if (active && revision === request) {
        setCompleted(Boolean(setup?.enabled && setup.setupCompleted));
        setVerificationEpoch(setup?.enabled ? setup.verificationEpoch : undefined);
      }
    }
    if (!admissionReady) return;
    const verification = subscribeBankSmsVerification(refresh);
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      active = false;
      subscription.remove();
      verification?.remove();
    };
  }, [admissionReady]));

  async function verify() {
    if (!verificationEpoch || verifying) return;
    setVerifying(true);
    setFailed(false);
    try {
      await verifyPendingBankSms(verificationEpoch);
    } catch {
      setFailed(true);
    } finally {
      setVerifying(false);
    }
  }

  if (verificationEpoch)
    return (
      <View style={styles.section}>
        <StyledText accessibilityLiveRegion="polite">
          {translate('tracking.bankSms.verifyPending')}
        </StyledText>
        {failed ? <StyledText accessibilityRole="alert">{translate('tracking.bankSms.verifyFailed')}</StyledText> : null}
        <ActionButton
          label={translate('tracking.bankSms.verifyAction')}
          variant="secondary"
          loading={verifying}
          onPress={() => void verify()}
        />
      </View>
    );

  if (completed) return null;

  const textStyle = {
    textAlign: direction === 'rtl' ? ('right' as const) : ('left' as const),
    writingDirection: direction
  };
  const cardWidth = Math.min(
    312 * CARD_SCALE,
    Math.max(248 * CARD_SCALE, (width - spacing.xxl * 2) * CARD_SCALE)
  );

  return (
    <View style={styles.section}>
      <StyledText variant="title" style={textStyle}>
        {translate('tracking.home.onboardingHeading')}
      </StyledText>
      <SurfaceCard
        testID="ios-tracking-home-card"
        style={[styles.card, { width: cardWidth }]}
      >
        <View
          testID="ios-tracking-home-header"
          style={[
            styles.header,
            { flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' }
          ]}
        >
          <View accessible={false} style={styles.mark}>
            <Svg
              accessibilityElementsHidden
              height={30 * CARD_SCALE}
              width={30 * CARD_SCALE}
              viewBox="0 0 32 32"
            >
              <Path
                d="M7 4.5h16v21.75l-3-2-3 2-3-2-3 2-4-2V4.5Z"
                fill="none"
                stroke={colorTokens.raw['42A5F5']}
                strokeLinejoin="round"
                strokeWidth={2.6}
              />
              <Path
                d="M11 9h8M11 13h5"
                fill="none"
                stroke={colorTokens.raw['42A5F5']}
                strokeLinecap="round"
                strokeWidth={2.2}
              />
              <Circle
                cx={19.5}
                cy={18.5}
                fill={theme.colors.surfaces.card}
                r={4.25}
                stroke={colorTokens.bronze['500']}
                strokeWidth={2.4}
              />
              <Path
                d="m22.7 21.7 3.3 3.3"
                fill="none"
                stroke={colorTokens.bronze['500']}
                strokeLinecap="round"
                strokeWidth={2.7}
              />
            </Svg>
          </View>
          <StyledText variant="subtitle" style={[styles.title, textStyle]}>
            {translate('tracking.bankSms.homeTitle')}
          </StyledText>
        </View>
        <StyledText
          variant="caption"
          style={[
            styles.description,
            textStyle,
            { color: theme.colors.content.secondary }
          ]}
        >
          {translate('tracking.bankSms.homeBody')}
        </StyledText>
        <ActionButton
          label={translate('tracking.bankSms.homeAction')}
          onPress={() => router.push('/capture/ios')}
          style={styles.action}
          labelStyle={styles.actionLabel}
          variant="secondary"
        />
      </SurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { ...layoutDirectionStyle('ltr'), gap: spacing.sm },
  card: {
    alignSelf: 'center',
    borderRadius: 18 * CARD_SCALE,
    gap: spacing.sm * CARD_SCALE,
    maxWidth: '100%',
    minHeight: 156 * CARD_SCALE,
    padding: spacing.md * CARD_SCALE
  },
  header: {
    ...layoutDirectionStyle('ltr'),
    alignItems: 'center',
    gap: spacing.sm * CARD_SCALE
  },
  mark: {
    alignItems: 'center',
    flexShrink: 0,
    height: 36 * CARD_SCALE,
    justifyContent: 'center',
    width: 36 * CARD_SCALE
  },
  title: { flex: 1, fontSize: 16, lineHeight: 22 },
  description: { fontSize: 13, lineHeight: 20 },
  action: {
    alignSelf: 'stretch',
    borderRadius: 16 * CARD_SCALE,
    borderWidth: 0,
    marginTop: 'auto',
    minHeight: 48 * CARD_SCALE
  },
  actionLabel: { fontSize: 15, lineHeight: 22 }
});
