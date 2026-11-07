import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { MenuLink } from '@/components/MenuLink';
import { translate } from '@/localization/i18n';
import { financialResetRuntimeAvailable } from '@/services/financial-reset';
import { useTheme } from '@/state/theme-context';
import { usePreferenceStore } from '@/state/preferences';
import { FinancialResetDialog } from './FinancialResetDialog';
import { financialResetStateQuery } from './financial-reset-queries';

export function FinancialResetCard({ ownerId }: { ownerId: string }) {
  const [confirming, setConfirming] = useState(false);
  const queryClient = useQueryClient();
  const theme = useTheme();
  const locale = usePreferenceStore((state) => state.locale);
  useFocusEffect(
    useCallback(() => {
      if (financialResetRuntimeAvailable()) {
        void queryClient.prefetchQuery(financialResetStateQuery(ownerId));
      }
    }, [ownerId, queryClient])
  );

  if (!financialResetRuntimeAvailable()) return null;
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
        onPress={() => setConfirming(true)}
      />
      {confirming ? (
        <FinancialResetDialog
          ownerId={ownerId}
          onClose={() => setConfirming(false)}
        />
      ) : null}
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
