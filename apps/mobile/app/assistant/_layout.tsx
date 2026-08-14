import React from 'react';
import { Stack } from 'expo-router';

import { ProtectedRouteGate } from '@/features/shell/ProtectedRouteGate';

export default function AssistantLayout() {
  return (
    <ProtectedRouteGate>
      <Stack screenOptions={{ headerShown: false }} />
    </ProtectedRouteGate>
  );
}
