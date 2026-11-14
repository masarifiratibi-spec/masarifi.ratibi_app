import React from 'react';
import { BackendUnavailableState } from '@/features/shell/BackendUnavailableState';
import { translate } from '@/localization/i18n';

// Billing is explicitly deferred; live bundles contain no simulated checkout actions.
export default function DeferredSubscriptionRoute() {
  return (
    <BackendUnavailableState
      title={translate('subscriptions.backendUnavailable')}
    />
  );
}
