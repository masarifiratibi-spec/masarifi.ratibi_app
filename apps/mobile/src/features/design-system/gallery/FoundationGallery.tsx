import React from 'react';
import { StyleSheet, View } from 'react-native';

import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { AmountText } from '@/design-system/components/financial/FinancialPrimitives';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { useTheme } from '@/state/theme-context';

export function FoundationGallery() {
  const theme = useTheme();

  return (
    <View style={styles.stack}>
      <StyledText variant="title">
        {translate('designSystem.gallery.foundation')}
      </StyledText>
      <SurfaceCard style={{ backgroundColor: theme.colors.surfaces.page }}>
        <StyledText variant="subtitle">
          {translate('designSystem.foundation.pageSurface')}
        </StyledText>
        <StyledText>
          {translate('designSystem.foundation.longContent')}
        </StyledText>
      </SurfaceCard>
      <SurfaceCard>
        <StyledText variant="subtitle">
          {translate('designSystem.foundation.summaryAmount')}
        </StyledText>
        <AmountText
          value={1234}
          currency="EGP"
          meaning="income"
          sign="none"
        />
      </SurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12
  }
});
