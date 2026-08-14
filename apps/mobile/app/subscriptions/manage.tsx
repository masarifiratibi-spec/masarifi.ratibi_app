import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { SubscriptionManageScreen } from '@/features/subscriptions/SubscriptionManageScreen';

export default function SubscriptionManageRoute() {
  const { operationId } = useLocalSearchParams<{ operationId?: string }>();
  return <SubscriptionManageScreen operationId={typeof operationId === 'string' ? operationId : undefined} />;
}
