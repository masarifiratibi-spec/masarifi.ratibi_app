import React from 'react';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { translate } from '@/localization/i18n';
import { routeForOnboardingProgress } from '@/features/onboarding/onboarding-progress';
import { useAppShellStore } from '@/state/app-shell';

export default function TrackingIntroRoute() {
  const advanceOnboarding = useAppShellStore((state) => state.advanceOnboarding);
  const skipOnboarding = useAppShellStore((state) => state.skipOnboarding);

  async function next() {
    const progress = await advanceOnboarding(['tracking_intro'], 'completed');
    if (progress) router.replace(routeForOnboardingProgress(progress));
  }

  async function skip() {
    await skipOnboarding();
    router.replace('/(tabs)/home');
  }

  return (
    <OnboardingScaffold
      onPrimary={next}
      onSkip={skip}
      title={translate('appShell.onboarding.trackingIntro.title')}
    >
      <StyledText>{translate('appShell.onboarding.trackingIntro.body')}</StyledText>
    </OnboardingScaffold>
  );
}
