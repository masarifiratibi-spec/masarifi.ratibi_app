import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { ActionButton } from '@/design-system/components/ActionButton';
import { AccountListScreen } from '@/features/accounts/AccountListScreen';
import { sanitizeReturnRoute } from '@/features/shell/navigation-context';
import { translate } from '@/localization/i18n';

export default function AccountsRoute() {
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = sanitizeReturnRoute(params.returnTo ?? null) ?? '/(tabs)/home';

  return (
    <>
      <AccountListScreen />
      <ActionButton
        label={translate('appShell.navigation.back')}
        onPress={() => router.replace(returnTo)}
        variant="secondary"
      />
    </>
  );
}
