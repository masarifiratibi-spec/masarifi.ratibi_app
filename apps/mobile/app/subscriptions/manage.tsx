import React from 'react';
import { useLocalSearchParams } from 'expo-router';

export default function SubscriptionManageRoute() {
  const { operationId } = useLocalSearchParams<{ operationId?: string }>();
  const { SubscriptionManageScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/subscriptions/SubscriptionManageScreen') as typeof import('@/features/subscriptions/SubscriptionManageScreen');
  return <SubscriptionManageScreen operationId={typeof operationId === 'string' ? operationId : undefined} />;
}
