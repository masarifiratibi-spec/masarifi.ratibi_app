import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { DuplicateComparison } from '@/features/tracking/DuplicateComparison';

export default function TrackingDuplicateRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DuplicateComparison id={id ?? ''} />;
}
