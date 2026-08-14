import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { ReviewDetail } from '@/features/tracking/ReviewDetail';

export default function TrackingReviewDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReviewDetail id={id ?? ''} />;
}
