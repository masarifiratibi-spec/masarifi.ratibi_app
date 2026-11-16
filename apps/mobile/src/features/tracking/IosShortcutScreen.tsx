import React from 'react';
import { Redirect } from 'expo-router';

// A manually opened iOS-only destination does not enroll or change Android tracking.
export default function IosShortcutScreen() {
  return <Redirect href="/(tabs)/add" />;
}
