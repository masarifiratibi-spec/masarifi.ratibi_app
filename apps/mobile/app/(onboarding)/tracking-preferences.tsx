import React, { useState } from 'react';
import { router } from 'expo-router';

import type { TrackingPreference } from '@/domain/app-shell';
import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { TrackingModeSelector } from '@/features/onboarding/TrackingModeSelector';
import { translate } from '@/localization/i18n';
import { routeForOnboardingProgress } from '@/features/onboarding/onboarding-progress';
import { useAppShellStore } from '@/state/app-shell';

export default function TrackingPreferencesRoute() {
  const advanceOnboarding = useAppShellStore((state) => state.advanceOnboarding);
  const setTrackingPreference = useAppShellStore((state) => state.setTrackingPreference);
  const [preference, setPreference] = useState<TrackingPreference>({
    mode: 'automatic_clear',
    selectedAt: Date.now(),
    isRecommended: true
  });

  async function next() {
    await setTrackingPreference(preference);
    const progress = await advanceOnboarding(['preference'], 'completed');
    if (progress) router.replace(routeForOnboardingProgress(progress));
  }

  return (
    <OnboardingScaffold onPrimary={next} title={translate('appShell.tracking.mode.title')}>
      <TrackingModeSelector onChange={setPreference} />
    </OnboardingScaffold>
  );
}
