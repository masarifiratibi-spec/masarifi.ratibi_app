import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import { MenuLink } from '@/components/MenuLink';
import { translate } from '@/localization/i18n';

export function PlanningHomeCard() {
  return (
    <View>
      <MenuLink
        label={translate('planning.salary.title')}
        icon="profile"
        showChevron
        onPress={() => router.push('/salary')}
      />
      <MenuLink
        label={translate('planning.budgets.title')}
        icon="reports"
        showChevron
        onPress={() => router.push('/budgets')}
      />
      <MenuLink
        label={translate('planning.obligations.title')}
        icon="transactions"
        showChevron
        onPress={() => router.push('/obligations')}
      />
      <MenuLink
        label={translate('planning.savings.title')}
        icon="accounts"
        showChevron
        onPress={() => router.push('/savings')}
      />
    </View>
  );
}
