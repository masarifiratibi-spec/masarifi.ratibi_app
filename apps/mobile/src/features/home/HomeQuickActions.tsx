import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { ActionButton } from '@/design-system/components/ActionButton';
import { translate } from '@/localization/i18n';

const actions = [
  ['coreFinance.action.accounts', '/accounts'],
  ['coreFinance.action.categories', '/categories'],
  ['capture.manual', '/(tabs)/add'],
  ['coreFinance.action.expense', '/(tabs)/add?type=expense'],
  ['coreFinance.action.income', '/(tabs)/add?type=income'],
  ['coreFinance.action.transfer', '/(tabs)/add?type=transfer'],
  ['coreFinance.action.voice', '/(tabs)/add?mode=voice'],
  ['coreFinance.action.obligation', '/(tabs)/add?type=obligation_payment'],
  ['coreFinance.action.assistant', '/assistant']
] as const;

export function HomeQuickActions() {
  return (
    <View style={styles.grid}>
      {actions.map(([label, destination]) => (
        <ActionButton
          key={label}
          label={translate(label)}
          onPress={() => router.push(destination)}
          variant="secondary"
          style={styles.action}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { flexGrow: 1, minWidth: 130 }
});
