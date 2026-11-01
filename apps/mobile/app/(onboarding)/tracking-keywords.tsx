import React, { useState } from 'react';
import { router } from 'expo-router';

import { useTrackingKeywordDraft } from '@/features/tracking/useTrackingKeywordDraft';
import { FinancialRefreshStatus } from '@/features/core-finance/FinancialRefreshStatus';
import { StyledText } from '@/components/StyledText';
import { KeywordEditor } from '@/features/onboarding/KeywordEditor';
import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { translate } from '@/localization/i18n';
import { routeForOnboardingProgress } from '@/features/onboarding/onboarding-progress';
import { useAppShellStore } from '@/state/app-shell';
import { StateView } from '@/design-system/components/feedback/StateView';

export default function TrackingKeywordsRoute() {
  const ownerId = useAppShellStore((state) => state.session?.userId ?? null);
  return <TrackingKeywordsContent key={ownerId} />;
}

function TrackingKeywordsContent() {
  const ownerId = useAppShellStore((state) => state.session?.userId ?? null);
  const advanceOnboarding = useAppShellStore(
    (state) => state.advanceOnboarding
  );
  const { query, rules, readable, blocked, saving, error, save, setRules } =
    useTrackingKeywordDraft();
  const [progressError, setProgressError] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  async function next() {
    if (blocked || advancing) return;
    setAdvancing(true);
    try {
      if (
        !(await save()) ||
        (useAppShellStore.getState().session?.userId ?? null) !== ownerId
      )
        return;
      setProgressError(false);
      const progress = await advanceOnboarding(['keywords'], 'completed');
      if (
        progress &&
        (useAppShellStore.getState().session?.userId ?? null) === ownerId
      )
        router.replace(routeForOnboardingProgress(progress));
    } catch {
      setProgressError(true);
    } finally {
      setAdvancing(false);
    }
  }
  if (!readable)
    return (
      <StateView
        state={query.isLoading ? 'loading' : 'error'}
        title={translate(
          query.isLoading ? 'tracking.state.loading' : 'tracking.state.error'
        )}
        actionLabel={
          query.isError ? translate('coreFinance.action.retry') : undefined
        }
        onAction={query.isError ? () => void query.refetch() : undefined}
      />
    );

  return (
    <OnboardingScaffold
      onPrimary={() => void next()}
      primaryDisabled={blocked || advancing}
      primaryLoading={saving || advancing}
      title={translate('appShell.tracking.keywords.title')}
    >
      <FinancialRefreshStatus query={query} />
      {error || progressError ? (
        <StyledText accessibilityRole="alert">
          {translate('appShell.error.persistenceFailed')}
        </StyledText>
      ) : null}
      <KeywordEditor onChange={setRules} rules={rules} />
    </OnboardingScaffold>
  );
}
