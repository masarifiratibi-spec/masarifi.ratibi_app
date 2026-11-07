import React from 'react';
import { useLocalSearchParams } from 'expo-router';

export default function SubscriptionCheckoutRoute() {
  const { offerId } = useLocalSearchParams<{ offerId?: string }>();
  const { SubscriptionCheckoutScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/subscriptions/SubscriptionCheckoutScreen') as typeof import('@/features/subscriptions/SubscriptionCheckoutScreen');
  return <SubscriptionCheckoutScreen offerId={typeof offerId === 'string' ? offerId : undefined} />;
}
