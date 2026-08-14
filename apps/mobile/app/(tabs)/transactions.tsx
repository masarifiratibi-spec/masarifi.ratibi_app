import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { ActionButton } from '@/design-system/components/ActionButton';
import { sanitizeReturnRoute } from '@/features/shell/navigation-context';
import { TransactionListScreen } from '@/features/transactions/TransactionListScreen';
import { translate } from '@/localization/i18n';

export default function TransactionsRoute() {
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = sanitizeReturnRoute(params.returnTo ?? null);

  return (
    <>
      <TransactionListScreen />
      {returnTo ? (
        <ActionButton
          label={translate('appShell.navigation.back')}
          onPress={() => router.navigate(returnTo)}
          variant="secondary"
        />
      ) : null}
    </>
  );
}
