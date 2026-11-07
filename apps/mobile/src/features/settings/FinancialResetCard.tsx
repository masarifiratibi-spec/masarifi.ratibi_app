import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MenuLink } from '@/components/MenuLink';
import { translate } from '@/localization/i18n';
import {
  fetchFinancialResetState,
  financialResetRuntimeAvailable
} from '@/services/financial-reset';
import { useTheme } from '@/state/theme-context';
import { usePreferenceStore } from '@/state/preferences';

export function FinancialResetCard({ ownerId }: { ownerId: string }) {
  const [available, setAvailable] = useState(false);
  const theme = useTheme();
  const locale = usePreferenceStore((state) => state.locale);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (financialResetRuntimeAvailable()) {
        void fetchFinancialResetState(ownerId).then(
          () => {
            if (active) setAvailable(true);
          },
          () => {
            if (active) setAvailable(false);
          }
        );
      }
      return () => {
        active = false;
      };
    }, [ownerId])
  );

  if (!available) return null;
  return (
    <View
      style={[
        styles.card,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface
        }
      ]}
    >
      <MenuLink
        label={translate('financialReset.title', locale)}
        subtitle={translate('financialReset.subtitle', locale)}
        icon="warning"
        iconColor={theme.colors.status.danger}
        showChevron
        hideBorder
        onPress={() => router.push('/financial-reset')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    overflow: 'hidden'
  }
});
