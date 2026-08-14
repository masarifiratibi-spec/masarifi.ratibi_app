import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { SyncConflictScreen } from '@/features/transactions/SyncConflictScreen';

export default function SyncConflictRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SyncConflictScreen id={id ?? ''} />;
}
