import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { SubscriptionCheckoutScreen } from '@/features/subscriptions/SubscriptionCheckoutScreen';

export default function SubscriptionCheckoutRoute() {
  const { offerId } = useLocalSearchParams<{ offerId?: string }>();
  return <SubscriptionCheckoutScreen offerId={typeof offerId === 'string' ? offerId : undefined} />;
}
