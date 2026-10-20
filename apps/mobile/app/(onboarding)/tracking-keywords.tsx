import React, { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';

import type { KeywordRule } from '@/domain/app-shell';
import { StyledText } from '@/components/StyledText';
import { KeywordEditor } from '@/features/onboarding/KeywordEditor';
import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { translate } from '@/localization/i18n';
import { trackingKeywordConfiguration } from '@/services/tracking-keyword-configuration';
import { routeForOnboardingProgress } from '@/features/onboarding/onboarding-progress';
import { useAppShellStore } from '@/state/app-shell';
import { StateView } from '@/design-system/components/feedback/StateView';

const storage = {
  loadKeywords: trackingKeywordConfiguration.load,
  saveKeywords: trackingKeywordConfiguration.save
};

export default function TrackingKeywordsRoute() {
  const advanceOnboarding = useAppShellStore(
    (state) => state.advanceOnboarding
  );
  const [rules, setRules] = useState<KeywordRule[]>([]);
  const [previousRules, setPreviousRules] = useState<KeywordRule[] | null>(
    null
  );
  const [error, setError] = useState(false);

  const loadKeywords = useCallback(async () => {
    setError(false);
    try {
      const loaded = await storage.loadKeywords();
      setRules(loaded);
      setPreviousRules(loaded);
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => {
    void loadKeywords();
  }, [loadKeywords]);

  async function next() {
    if (!previousRules) return;
    setError(false);
    try {
      await storage.saveKeywords(rules, previousRules, (saved) => {
        setRules(saved);
        setPreviousRules(saved);
      });
      const progress = await advanceOnboarding(['keywords'], 'completed');
      if (progress) router.replace(routeForOnboardingProgress(progress));
    } catch {
      setError(true);
    }
  }

  if (!previousRules)
    return (
      <StateView
        state={error ? 'error' : 'loading'}
        title={translate(
          error ? 'tracking.state.error' : 'tracking.state.loading'
        )}
        actionLabel={error ? translate('coreFinance.action.retry') : undefined}
        onAction={error ? () => void loadKeywords() : undefined}
      />
    );

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
