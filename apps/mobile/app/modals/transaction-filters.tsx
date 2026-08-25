import React from 'react';
import { router } from 'expo-router';

import { RouteModalContainer } from '@/design-system/components/overlays/RouteModalContainer';
import { TransactionFilters } from '@/features/transactions/TransactionFilters';
import { translate } from '@/localization/i18n';
import { useCoreFinanceViewState } from '@/state/core-finance-view-state';

export default function TransactionFiltersRoute() {
  const cancel = useCoreFinanceViewState((state) => state.cancelFilterSession);
  return (
    <RouteModalContainer
      title={translate('coreFinance.ledger.filters')}
      closeLabel={translate('appShell.navigation.close')}
      onDismiss={() => {
        cancel();
        router.back();
      }}
    >
      <TransactionFilters />
    </RouteModalContainer>
  );
}
