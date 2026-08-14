import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';

import type { KeywordRule } from '@/domain/app-shell';
import { StyledText } from '@/components/StyledText';
import { KeywordEditor } from '@/features/onboarding/KeywordEditor';
import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { translate } from '@/localization/i18n';
import { defaultKeywordRules } from '@/services/mocks/default-keywords';
import { createAppShellStorage } from '@/storage/app-shell-storage';
import { routeForOnboardingProgress } from '@/features/onboarding/onboarding-progress';
import { useAppShellStore } from '@/state/app-shell';

const storage = createAppShellStorage();

export default function TrackingKeywordsRoute() {
  const advanceOnboarding = useAppShellStore(
    (state) => state.advanceOnboarding
  );
  const [rules, setRules] = useState<KeywordRule[]>(defaultKeywordRules);
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
      await storage.saveKeywords(rules);
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
