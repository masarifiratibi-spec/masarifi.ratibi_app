import React from 'react';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { routeForOnboardingProgress } from '@/features/onboarding/onboarding-progress';
import { translate } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';

export default function IosAutomationRoute() {
  const advanceOnboarding = useAppShellStore((state) => state.advanceOnboarding);

  async function next(result: 'completed' | 'skipped') {
    const progress = await advanceOnboarding(['optional_automation'], result);
    if (progress) router.replace(routeForOnboardingProgress(progress));
  }

  return (
    <OnboardingScaffold
      onPrimary={() => next('completed')}
      onSkip={() => next('skipped')}
      title={translate('tracking.ios.title')}
    >
      <StyledText>{translate('tracking.ios.recovery')}</StyledText>
      <StyledText>{translate('tracking.ios.alternatives')}</StyledText>
      <ActionButton
        label={translate('capture.ios.alternatives')}
        onPress={() => router.push('/(tabs)/add')}
        variant="secondary"
      />
    </OnboardingScaffold>
  );
}
