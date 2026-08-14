import React from 'react';
import { Redirect, Stack } from 'expo-router';

import { ProtectedRouteGate } from '@/features/shell/ProtectedRouteGate';
import { resolveTrackingRouteCapability } from '@/features/tracking/tracking-route-guard';

export default function TrackingLayout() {
  const capability = resolveTrackingRouteCapability();
  if (!capability.canUseAndroidTracking) {
    return <Redirect href={capability.fallbackRoute} />;
  }
  return (
    <ProtectedRouteGate>
      <Stack screenOptions={{ headerShown: false }} />
    </ProtectedRouteGate>
  );
}
