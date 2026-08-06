/**
 * Root layout. Wraps every route in the foundation providers.
 */

import React from 'react';
import { Stack } from 'expo-router';

import { FoundationProviders } from '@/state/FoundationProviders';

export default function RootLayout() {
  return (
    <FoundationProviders>
      <Stack screenOptions={{ headerShown: true }} />
    </FoundationProviders>
  );
}
