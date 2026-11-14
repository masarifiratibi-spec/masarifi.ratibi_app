import React from 'react';

export default function SubscriptionsRoute() {
  const { SubscriptionScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/subscriptions/SubscriptionScreen') as typeof import('@/features/subscriptions/SubscriptionScreen');
  return <SubscriptionScreen />;
}
