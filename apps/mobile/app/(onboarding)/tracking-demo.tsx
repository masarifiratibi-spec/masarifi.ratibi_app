import React, { useState } from 'react';
import { router } from 'expo-router';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { routeForOnboardingProgress } from '@/features/onboarding/onboarding-progress';
import {
  decideTrackingOutcome,
  type TrackingClassification
} from '@/features/onboarding/tracking-policy';
import { translate } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';

const unsafeFixtures: TrackingClassification[] = [
  'failed',
  'otp',
  'marketing',
  'duplicate',
  'conflicting',
  'low_confidence'
];

const modeMessageKey = {
  automatic_clear: 'appShell.tracking.mode.automatic',
  review_all: 'appShell.tracking.mode.review',
  paused: 'appShell.tracking.mode.paused'
} as const;

export default function TrackingDemoRoute() {
  const onboarding = useAppShellStore((state) => state.onboarding);
  const advanceOnboarding = useAppShellStore((state) => state.advanceOnboarding);
  const mode = onboarding?.trackingPreference?.mode ?? 'automatic_clear';
  const clearOutcome = decideTrackingOutcome(mode, 'clear_eligible');
  const unsafeOutcomes = unsafeFixtures.map((fixture) =>
    decideTrackingOutcome(mode, fixture)
  );
  const [demoResult, setDemoResult] = useState<'undo' | 'edit' | 'report' | null>(null);

  async function next() {
    const steps =
      onboarding?.platformPath === 'conservative'
        ? (['platform_explanation', 'manual_voice_demo'] as const)
        : (['demo'] as const);
    const progress = await advanceOnboarding(steps, 'completed');
    if (progress) router.replace(routeForOnboardingProgress(progress));
  }

  return (
    <OnboardingScaffold
      onPrimary={next}
      title={translate('appShell.tracking.demo.title')}
    >
      <StyledText>{translate(modeMessageKey[mode])}</StyledText>
      <StyledText>{translate('trust.source.automatic')}</StyledText>
      {clearOutcome === 'add' || clearOutcome === 'review' ? (
        <>
          <ActionButton label={translate('trust.undo')} onPress={() => setDemoResult('undo')} variant="secondary" />
          <ActionButton label={translate('trust.edit')} onPress={() => setDemoResult('edit')} variant="secondary" />
          <ActionButton label={translate('trust.report')} onPress={() => setDemoResult('report')} variant="secondary" />
          {demoResult ? <StyledText accessibilityRole="alert">{translate(`appShell.tracking.demo.${demoResult}`)}</StyledText> : null}
        </>
      ) : null}
      <StyledText accessibilityRole="alert">
        {unsafeOutcomes.every((outcome) => outcome !== 'add')
          ? translate('appShell.permission.manualFallback')
          : translate('appShell.error.unknown')}
      </StyledText>
    </OnboardingScaffold>
  );
}
