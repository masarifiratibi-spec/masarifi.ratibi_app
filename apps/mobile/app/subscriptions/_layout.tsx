import React from 'react';
import { Stack } from 'expo-router';

import { ProtectedRouteGate } from '@/features/shell/ProtectedRouteGate';
import { isFixtureModeEnabled } from '@/config/demo-mode';
import { BackendUnavailableState } from '@/features/shell/BackendUnavailableState';
import { translate } from '@/localization/i18n';

export default function SubscriptionsLayout() {
  if (!isFixtureModeEnabled())
    return <BackendUnavailableState title={translate('subscriptions.backendUnavailable')} />;
  return (
    <ProtectedRouteGate>
      <Stack screenOptions={{ headerShown: false }} />
    </ProtectedRouteGate>
  );
}
