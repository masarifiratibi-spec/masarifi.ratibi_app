import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { RouteModalContainer } from '@/design-system/components/overlays/RouteModalContainer';
import { SyncConflictScreen } from '@/features/transactions/SyncConflictScreen';
import { translate } from '@/localization/i18n';

export default function SyncConflictRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RouteModalContainer
      title={translate('coreFinance.conflict.title')}
      closeLabel={translate('appShell.navigation.close')}
      onDismiss={() => router.back()}
    >
      <SyncConflictScreen id={id ?? ''} />
    </RouteModalContainer>
  );
}
