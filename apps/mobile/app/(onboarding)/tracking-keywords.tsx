import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';

import type { KeywordRule } from '@/domain/app-shell';
import { StyledText } from '@/components/StyledText';
import { KeywordEditor } from '@/features/onboarding/KeywordEditor';
import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { translate } from '@/localization/i18n';
import { trackingKeywordConfiguration } from '@/services/tracking-keyword-configuration';
import { routeForOnboardingProgress } from '@/features/onboarding/onboarding-progress';
import { useAppShellStore } from '@/state/app-shell';

const storage = {
  loadKeywords: trackingKeywordConfiguration.load,
  saveKeywords: trackingKeywordConfiguration.save
};

export default function TrackingKeywordsRoute() {
  const advanceOnboarding = useAppShellStore(
    (state) => state.advanceOnboarding
  );
  const [rules, setRules] = useState<KeywordRule[]>(() => {
    // Initialize fallback form values only when this onboarding screen opens.
    return (
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      require('@/services/mocks/default-keywords') as typeof import('@/services/mocks/default-keywords')
    ).defaultKeywordRules;
  });
  const [error, setError] = useState(false);

  useEffect(() => {
    void storage
      .loadKeywords()
      .then(setRules)
      .catch(() => setError(true));
  }, []);

  async function next() {
    setError(false);
    try {
      await storage.saveKeywords(rules, setRules);
      const progress = await advanceOnboarding(['keywords'], 'completed');
      if (progress) router.replace(routeForOnboardingProgress(progress));
    } catch {
      setError(true);
    }
  }

  return (
    <OnboardingScaffold
      onPrimary={next}
      title={translate('appShell.tracking.keywords.title')}
    >
      {error ? (
        <StyledText accessibilityRole="alert">
          {translate('appShell.error.persistenceFailed')}
        </StyledText>
      ) : null}
      <KeywordEditor onChange={setRules} rules={rules} />
    </OnboardingScaffold>
  );
}
