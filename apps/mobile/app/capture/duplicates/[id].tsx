import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Platform } from 'react-native';
import { DuplicateComparison } from '@/features/tracking/DuplicateComparison';

export default function IosDuplicateDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return Platform.OS === 'ios' ? (
    <DuplicateComparison id={id ?? ''} />
  ) : (
    <Redirect href="/(tabs)/add" />
  );
}
