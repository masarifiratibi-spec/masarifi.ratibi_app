import React from 'react';
import { router } from 'expo-router';
import { View, StyleSheet } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { translate } from '@/localization/i18n';
import { useTrackingStatus } from './useAutomaticTracking';

export function TrackingHomeCard() {
  const query = useTrackingStatus();
  const status = query.data;

  if (
    query.isLoading ||
    query.isError ||
    status?.platform !== 'android' ||
    status.permissionStatus !== 'not_requested'
  ) {
    return null;
  }

  return (
    <SurfaceCard>
      <View style={styles.stack}>
        <StyledText variant="subtitle">
          {translate('tracking.home.enableTitle')}
        </StyledText>
        <StyledText>{translate('tracking.home.enableBody')}</StyledText>
        <ActionButton
          label={translate('tracking.home.enableAction')}
          onPress={() => router.push('/tracking')}
          variant="secondary"
        />
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 }
});
