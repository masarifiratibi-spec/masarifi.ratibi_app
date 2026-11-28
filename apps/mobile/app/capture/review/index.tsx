import React from 'react';
import { Redirect } from 'expo-router';
import { Platform } from 'react-native';
import { IosShortcutReviewQueue } from '@/features/tracking/IosShortcutReviewQueue';

export default function IosReviewQueueRoute() {
  return Platform.OS === 'ios' ? (
    <IosShortcutReviewQueue />
  ) : (
    <Redirect href="/(tabs)/add" />
  );
}
