import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { StyledText } from '@/components/StyledText';
import type { KeywordRule } from '@/domain/app-shell';
import { ActionButton } from '@/design-system/components/ActionButton';
import { KeywordEditor } from '@/features/onboarding/KeywordEditor';
import { translate } from '@/localization/i18n';
import { trackingKeywordConfiguration } from '@/services/tracking-keyword-configuration';
import { StateView } from '@/design-system/components/feedback/StateView';

const storage = {
  loadKeywords: trackingKeywordConfiguration.load,
  saveKeywords: trackingKeywordConfiguration.save
};

export default function TrackingKeywordsRoute() {
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

  async function save() {
    if (!previousRules) return;
    setError(false);
    try {
      await storage.saveKeywords(rules, previousRules, (saved) => {
        setRules(saved);
        setPreviousRules(saved);
      });
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
    <ScrollView contentContainerStyle={styles.stack}>
      <StyledText variant="title">
        {translate('tracking.keywords.title')}
      </StyledText>
      <StyledText>{translate('tracking.keywords.permissionScope')}</StyledText>
      {error ? (
        <StyledText accessibilityRole="alert">
          {translate('appShell.error.persistenceFailed')}
        </StyledText>
      ) : null}
      <KeywordEditor rules={rules} onChange={setRules} />
      <ActionButton label={translate('tracking.action.save')} onPress={save} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, padding: 16 }
});
