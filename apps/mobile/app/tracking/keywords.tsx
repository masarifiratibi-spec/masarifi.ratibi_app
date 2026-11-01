import React from 'react';
import { useAppShellStore } from '@/state/app-shell';
import { useTrackingKeywordDraft } from '@/features/tracking/useTrackingKeywordDraft';
import { FinancialRefreshStatus } from '@/features/core-finance/FinancialRefreshStatus';
import { ScrollView, StyleSheet } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { KeywordEditor } from '@/features/onboarding/KeywordEditor';
import { translate } from '@/localization/i18n';
import { StateView } from '@/design-system/components/feedback/StateView';

export default function TrackingKeywordsRoute() {
  const ownerId = useAppShellStore((state) => state.session?.userId ?? null);
  return <TrackingKeywordsContent key={ownerId} />;
}

function TrackingKeywordsContent() {
  const { query, rules, readable, blocked, saving, error, save, setRules } =
    useTrackingKeywordDraft();
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
    <ScrollView contentContainerStyle={styles.stack}>
      <StyledText variant="title">
        {translate('tracking.keywords.title')}
      </StyledText>
      <StyledText>{translate('tracking.keywords.permissionScope')}</StyledText>
      <FinancialRefreshStatus query={query} />
      {error ? (
        <StyledText accessibilityRole="alert">
          {translate('appShell.error.persistenceFailed')}
        </StyledText>
      ) : null}
      <KeywordEditor rules={rules} onChange={setRules} />
      <ActionButton
        label={translate('tracking.action.save')}
        onPress={() => void save()}
        disabled={blocked}
        loading={saving}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, padding: 16 }
});
