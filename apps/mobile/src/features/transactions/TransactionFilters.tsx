import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { ActionButton } from '@/design-system/components/ActionButton';
import { translate } from '@/localization/i18n';
import { useCoreFinanceViewState } from '@/state/core-finance-view-state';
import { useTheme } from '@/state/theme-context';

export function TransactionFilters() {
  const theme = useTheme();
  const draft = useCoreFinanceViewState((state) => state.draftFilters);
  const edit = useCoreFinanceViewState((state) => state.editFilters);
  const apply = useCoreFinanceViewState((state) => state.applyFilters);
  const clear = useCoreFinanceViewState((state) => state.clearFilters);
  const fieldStyle = [
    styles.field,
    { borderColor: theme.colors.border, color: theme.colors.textPrimary }
  ];
  return (
    <View style={styles.stack}>
      <TextInput
        accessibilityLabel={translate('coreFinance.ledger.search')}
        value={draft.search}
        onChangeText={(search) => edit({ search })}
        style={fieldStyle}
      />
      <TextInput
        accessibilityLabel={translate('coreFinance.filters.minimum')}
        keyboardType="decimal-pad"
        onChangeText={(value) =>
          edit({ minMinor: value ? Math.round(Number(value) * 100) : null })
        }
        style={fieldStyle}
      />
      <TextInput
        accessibilityLabel={translate('coreFinance.filters.maximum')}
        keyboardType="decimal-pad"
        onChangeText={(value) =>
          edit({ maxMinor: value ? Math.round(Number(value) * 100) : null })
        }
        style={fieldStyle}
      />
      <ActionButton
        label={translate('coreFinance.filters.apply')}
        onPress={() => {
          apply();
          router.back();
        }}
      />
      <ActionButton
        label={translate('coreFinance.filters.clear')}
        variant="quiet"
        onPress={clear}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, padding: 16 },
  field: {
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 12
  }
});
