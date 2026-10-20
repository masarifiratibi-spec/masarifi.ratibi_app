import React, { useEffect } from 'react';
import { router } from 'expo-router';
import {
  ScrollView,
  Pressable,
  View,
  StyleSheet,
  AppState,
  useWindowDimensions
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { layoutDirectionStyle } from '@/design-system/direction';
import { colorTokens, minTouchTarget, spacing } from '@/design-system/tokens';
import { DesignIcon } from '@/design-system/icons';
import { translate } from '@/localization/i18n';
import {
  useNotificationPermission,
  useOpenNotificationSettings,
  useRequestNotificationPermission
} from '@/features/notifications/notification-preferences-queries';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useHomeSetupCardDismissals } from '@/state/home-setup-card-dismissals';
import { useTheme } from '@/state/theme-context';
import { useTrackingStatus } from './useAutomaticTracking';
import { useInitialHomeReadiness } from '@/features/shell/InitialHomeLoadingBoundary';

const CARD_SCALE = 1.05;

export function TrackingHomeCard() {
  const trackingQuery = useTrackingStatus();
  const notificationPermission = useNotificationPermission();
  const requestNotificationPermission = useRequestNotificationPermission();
  const openNotificationSettings = useOpenNotificationSettings();
  const { width } = useWindowDimensions();
  const status = trackingQuery.data;
  const direction = usePreferenceStore((state) => state.direction);
  const session = useAppShellStore((state) => state.session);
  const dismissals = useHomeSetupCardDismissals();
  const ownerId = session?.status === 'authenticated' ? session.userId : null;
  const dismissed = dismissals.ownerId === ownerId ? dismissals.cards : [];
  const profileSetupStatus = useAppShellStore(
    (state) => state.profileSetupStatus
  );
  const refetchNotificationPermission = notificationPermission.refetch;
  const refetchTrackingStatus = trackingQuery.refetch;
  const initialReadsReady = [trackingQuery, notificationPermission].every(
    (query) => query.data !== undefined || query.isError
  );
  useInitialHomeReadiness(
    'notice',
    session?.status !== 'authenticated' ||
      profileSetupStatus !== 'complete' ||
      initialReadsReady
      ? 'ready'
      : 'pending'
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refetchNotificationPermission();
        void refetchTrackingStatus();
      }
    });
    return () => subscription.remove();
  }, [refetchNotificationPermission, refetchTrackingStatus]);

  if (
    !ownerId ||
    session?.status !== 'authenticated' ||
    profileSetupStatus !== 'complete'
  ) {
    return null;
  }

  const showNotifications =
    !dismissed.includes('notifications') &&
    !notificationPermission.isLoading &&
    !notificationPermission.isError &&
    notificationPermission.data !== 'granted';
  const canRequestNotificationPermission =
    notificationPermission.data === 'not_requested';
  const hasSourcePreferences =
    status?.smsTrackingEnabled !== undefined ||
    status?.notificationTrackingEnabled !== undefined;
  const smsPermission = status?.smsPermissionStatus ?? status?.permissionStatus;
  const notificationAccess = status?.notificationAccessStatus ?? 'denied';
  const trackingReady =
    !trackingQuery.isLoading &&
    !trackingQuery.isError &&
    status?.platform === 'android';
  const showSmsTracking =
    !dismissed.includes('sms') &&
    trackingReady &&
    smsPermission !== 'unavailable' &&
    !(
      status.mode !== 'paused' &&
      smsPermission === 'granted' &&
      (hasSourcePreferences
        ? status.smsTrackingEnabled === true
        : status.permissionStatus === 'granted')
    );
  const showNotificationTracking =
    !dismissed.includes('transaction-notifications') &&
    trackingReady &&
    notificationAccess !== 'unavailable' &&
    !(
      status.mode !== 'paused' &&
      notificationAccess === 'granted' &&
      status.notificationTrackingEnabled === true
    );

  if (!showNotifications && !showSmsTracking && !showNotificationTracking)
    return null;

  const cardWidth = Math.min(
    312 * CARD_SCALE,
    Math.max(248 * CARD_SCALE, (width - spacing.xxl * 2) * CARD_SCALE)
  );
  const railInset = Math.max(
    1,
    (width - spacing.xxl * CARD_SCALE - cardWidth) / 2
  );

  return (
    <View testID="tracking-home-onboarding" style={styles.section}>
      <StyledText
        testID="tracking-home-heading"
        variant="title"
        style={{
          textAlign: direction === 'rtl' ? 'right' : 'left',
          writingDirection: direction
        }}
      >
        {translate('tracking.home.onboardingHeading')}
      </StyledText>
      <ScrollView
        key={[
          showNotifications,
          showSmsTracking,
          showNotificationTracking
        ].join(':')}
        contentContainerStyle={[
          styles.railContent,
          { paddingHorizontal: railInset }
        ]}
        horizontal
        showsHorizontalScrollIndicator={false}
        testID="home-setup-cards-rail"
      >
        {showNotifications ? (
          <SetupCard
            actionLabel={
              canRequestNotificationPermission
                ? translate('notifications.home.enableAction')
                : translate('notifications.preferences.openSettings')
            }
            body={translate('notifications.home.enableBody')}
            dismissLabel={translate('notifications.home.dismissAction')}
            onDismiss={() => dismissals.dismiss(ownerId, 'notifications')}
            mark={<NotificationMark />}
            onPress={() =>
              canRequestNotificationPermission
                ? requestNotificationPermission.mutate()
                : openNotificationSettings.mutate()
            }
            testID="notification-home-card"
            title={translate('notifications.home.enableTitle')}
            width={cardWidth}
          />
        ) : null}
        {showSmsTracking ? (
          <SetupCard
            actionLabel={translate('tracking.home.enableAction')}
            body={translate('tracking.home.smsBody')}
            dismissLabel={translate('tracking.home.dismissAction')}
            onDismiss={() => dismissals.dismiss(ownerId, 'sms')}
            mark={<TrackingMark testID="sms-tracking-home-icon" />}
            onPress={() => router.push('/tracking')}
            testID="sms-tracking-home-card"
            title={translate('tracking.source.smsTracking')}
            width={cardWidth}
          />
        ) : null}
        {showNotificationTracking ? (
          <SetupCard
            actionLabel={translate('tracking.home.enableAction')}
            body={translate('tracking.home.notificationBody')}
            dismissLabel={translate('tracking.home.dismissAction')}
            onDismiss={() =>
              dismissals.dismiss(ownerId, 'transaction-notifications')
            }
            mark={<TrackingMark testID="notification-tracking-home-icon" />}
            onPress={() => router.push('/tracking')}
            testID="notification-tracking-home-card"
            title={translate('tracking.home.notificationTitle')}
            width={cardWidth}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function SetupCard({
  actionLabel,
  body,
  dismissLabel,
  mark,
  onPress,
  onDismiss,
  testID,
  title,
  width
}: {
  actionLabel: string;
  body: string;
  dismissLabel: string;
  mark: React.ReactNode;
  onPress: () => void;
  onDismiss: () => void;
  testID: string;
  title: string;
  width: number;
}) {
  const direction = usePreferenceStore((state) => state.direction);
  const theme = useTheme();
  return (
    <SurfaceCard testID={testID} style={[styles.setupCard, { width }]}>
      <View style={styles.stack}>
        <View
          testID={`${testID}-header`}
          style={[
            styles.header,
            { flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' }
          ]}
        >
          {mark}
          <StyledText
            variant="subtitle"
            style={[
              styles.title,
              {
                textAlign: direction === 'rtl' ? 'right' : 'left',
                writingDirection: direction
              }
            ]}
          >
            {title}
          </StyledText>
          <Pressable
            accessibilityLabel={`${dismissLabel}: ${title}`}
            accessibilityRole="button"
            onPress={onDismiss}
            testID={`${testID}-dismiss`}
            style={({ pressed }) => [
              styles.dismiss,
              { opacity: pressed ? 0.6 : 1 }
            ]}
          >
            <DesignIcon
              name="close"
              size="sm"
              color={theme.colors.content.secondary}
              decorative
              label=""
            />
          </Pressable>
        </View>
        <StyledText
          variant="caption"
          style={[
            styles.description,
            {
              color: theme.colors.content.secondary,
              textAlign: direction === 'rtl' ? 'right' : 'left',
              writingDirection: direction
            }
          ]}
        >
          {body}
        </StyledText>
        <ActionButton
          label={actionLabel}
          onPress={onPress}
          style={styles.action}
          labelStyle={styles.actionLabel}
          variant="secondary"
        />
      </View>
    </SurfaceCard>
  );
}

function TrackingMark({ testID }: { testID: string }) {
  return (
    <View accessible={false} testID={testID} style={styles.trackingMark}>
      <Svg
        accessibilityElementsHidden
        height={30 * CARD_SCALE}
        testID={`${testID}-sync-icon`}
        viewBox="0 0 32 32"
        width={30 * CARD_SCALE}
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
          fill={colorTokens.raw['FFFFFF']}
          r={4.25}
          stroke={colorTokens.financial.expense}
          strokeWidth={2.4}
        />
        <Path
          d="m22.7 21.7 3.3 3.3"
          fill="none"
          stroke={colorTokens.financial.expense}
          strokeLinecap="round"
          strokeWidth={2.7}
        />
      </Svg>
    </View>
  );
}

function NotificationMark() {
  return (
    <View
      accessible={false}
      testID="notification-home-icon"
      style={styles.notificationMark}
    >
      <Svg
        accessibilityElementsHidden
        height={30 * CARD_SCALE}
        testID="notification-home-bell"
        viewBox="0 0 32 32"
        width={30 * CARD_SCALE}
      >
        <Path
          d="M16 4.5a6 6 0 0 0-6 6v4.25c0 2.1-.78 4.12-2.2 5.67L6.3 22h19.4l-1.5-1.58A8.35 8.35 0 0 1 22 14.75V10.5a6 6 0 0 0-6-6Z"
          fill={colorTokens.raw['42A5F5']}
        />
        <Path
          d="M12.8 24.2a3.35 3.35 0 0 0 6.4 0h-6.4Z"
          fill={colorTokens.financial.expense}
        />
        <Circle cx={23.5} cy={7.5} fill={colorTokens.financial.expense} r={4} />
        <Circle cx={23.5} cy={7.5} fill={colorTokens.raw['FFFFFF']} r={1.35} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  dismiss: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Math.max(48, minTouchTarget),
    minWidth: Math.max(48, minTouchTarget)
  },
  action: {
    alignSelf: 'stretch',
    borderRadius: 16 * CARD_SCALE,
    borderWidth: 0,
    marginTop: 'auto',
    minHeight: 48 * CARD_SCALE
  },
  actionLabel: {
    fontSize: 15,
    lineHeight: 22
  },
  description: {
    fontSize: 13,
    lineHeight: 20
  },
  header: {
    alignItems: 'center',
    ...layoutDirectionStyle('ltr'),
    gap: spacing.sm * CARD_SCALE
  },
  trackingMark: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flexShrink: 0,
    height: 36 * CARD_SCALE,
    justifyContent: 'center',
    position: 'relative',
    width: 36 * CARD_SCALE
  },
  notificationMark: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flexShrink: 0,
    height: 36 * CARD_SCALE,
    justifyContent: 'center',
    position: 'relative',
    width: 36 * CARD_SCALE
  },
  railContent: {
    ...layoutDirectionStyle('ltr'),
    alignItems: 'stretch',
    flexDirection: 'row',
    flexGrow: 1,
    gap: spacing.md * CARD_SCALE,
    paddingBottom: spacing.sm * CARD_SCALE,
    justifyContent: 'center'
  },
  section: { ...layoutDirectionStyle('ltr'), gap: spacing.sm },
  setupCard: {
    borderRadius: 18 * CARD_SCALE,
    minHeight: 156 * CARD_SCALE,
    padding: spacing.md * CARD_SCALE
  },
  stack: { flex: 1, gap: spacing.sm * CARD_SCALE },
  title: { flex: 1, fontSize: 16, lineHeight: 22 }
});
