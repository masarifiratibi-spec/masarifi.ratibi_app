import React from 'react';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FirstLaunchOnboardingScreen } from '@/features/onboarding/FirstLaunchOnboardingScreen';
import { firstLaunchDestination } from '@/features/onboarding/first-launch-navigation';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';

export default function WelcomeRoute() {
  const theme = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaces.page }}>
      <FirstLaunchOnboardingScreen
        onStart={async () => {
          await usePreferenceStore.getState().completeFirstLaunchOnboarding();
          router.replace(firstLaunchDestination);
        }}
      />
    </SafeAreaView>
  );
}
