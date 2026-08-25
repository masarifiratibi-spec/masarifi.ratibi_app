import React from 'react';
import { Redirect, Stack } from 'expo-router';

import { isFixtureModeEnabled } from '@/config/demo-mode';

export default function FoundationLayout() {
  return isFixtureModeEnabled() ? (
    <Stack screenOptions={{ headerShown: false }} />
  ) : (
    <Redirect href="/(tabs)/home" />
  );
}
