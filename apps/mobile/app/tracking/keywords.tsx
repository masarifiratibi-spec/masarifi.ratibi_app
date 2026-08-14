import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { StyledText } from '@/components/StyledText';
import type { KeywordRule } from '@/domain/app-shell';
import { ActionButton } from '@/design-system/components/ActionButton';
import { KeywordEditor } from '@/features/onboarding/KeywordEditor';
import { translate } from '@/localization/i18n';
import { createAppShellStorage } from '@/storage/app-shell-storage';

const storage = createAppShellStorage();

export default function TrackingKeywordsRoute() {
  const [rules, setRules] = useState<KeywordRule[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    void storage
      .loadKeywords()
      .then(setRules)
      .catch(() => setError(true));
  }, []);

  async function save() {
    setError(false);
    try {
      await storage.saveKeywords(rules);
    } catch {
      setError(true);
    }
  }
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
