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
  return (
    <SurfaceCard>
      <View style={styles.stack}>
        <StyledText variant="subtitle">{translate('tracking.home.title')}</StyledText>
        <StyledText>
          {translate('tracking.home.summary')
            .replace('{{review}}', String(status?.reviewCount ?? 0))
            .replace('{{detected}}', String(status?.detectedThisMonth ?? 0))}
        </StyledText>
        <ActionButton
          label={translate('tracking.action.openTracking')}
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
