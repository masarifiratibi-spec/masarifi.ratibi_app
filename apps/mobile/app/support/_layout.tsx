import React from 'react';
import { Stack } from 'expo-router';
import { ProtectedRouteGate } from '@/features/shell/ProtectedRouteGate';

export default function SupportLayout() {
  return <ProtectedRouteGate>
    <Stack>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" />
      <Stack.Screen name="tickets/index" />
      <Stack.Screen name="tickets/[id]" />
    </Stack>
  </ProtectedRouteGate>;
}
