import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { spacing } from '@/design-system/tokens';
import { useInitialHomeReadiness } from '@/features/shell/InitialHomeLoadingBoundary';
import { translate } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';

export function HomeTrackingEntry() {
  const session = useAppShellStore((state) => state.session);
  const profileSetupStatus = useAppShellStore((state) => state.profileSetupStatus);
  const direction = usePreferenceStore((state) => state.direction);
  const theme = useTheme();
  useInitialHomeReadiness('notice', 'ready');

  if (session?.status !== 'authenticated' || profileSetupStatus !== 'complete')
    return null;

  const textStyle = {
    textAlign: direction === 'rtl' ? ('right' as const) : ('left' as const),
    writingDirection: direction
  };

  return (
    <SurfaceCard testID="ios-tracking-home-card" style={styles.card}>
      <View style={styles.copy}>
        <StyledText variant="title" style={textStyle}>
          {translate('tracking.bankSms.homeTitle')}
        </StyledText>
        <StyledText style={[textStyle, { color: theme.colors.content.secondary }]}>
          {translate('tracking.bankSms.homeBody')}
        </StyledText>
      </View>
      <ActionButton
        label={translate('tracking.bankSms.homeAction')}
        onPress={() => router.push('/capture/ios')}
        variant="secondary"
      />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  copy: { gap: spacing.sm }
});
