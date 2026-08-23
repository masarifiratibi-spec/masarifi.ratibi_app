import React from 'react';
import { router } from 'expo-router';

import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';

export default function CompleteRoute() {
  const advanceOnboarding = useAppShellStore((state) => state.advanceOnboarding);

  async function finish() {
    await advanceOnboarding(['complete'], 'completed');
    router.replace('/(tabs)/home');
  }

  return (
    <OnboardingScaffold
      onPrimary={finish}
      primaryLabel={translate('appShell.onboarding.complete.openHome')}
      title={translate('appShell.onboarding.complete.title')}
    >
      <StyledText>{translate('appShell.onboarding.complete.destinations')}</StyledText>
    </OnboardingScaffold>
  );
}
