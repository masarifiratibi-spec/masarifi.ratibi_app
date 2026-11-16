import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Platform } from 'react-native';
import { ReviewDetail } from '@/features/tracking/ReviewDetail';

export default function IosReviewDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return Platform.OS === 'ios' ? (
    <ReviewDetail id={id ?? ''} />
  ) : (
    <Redirect href="/(tabs)/add" />
  );
}
