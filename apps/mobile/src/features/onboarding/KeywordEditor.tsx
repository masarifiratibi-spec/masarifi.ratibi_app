import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import type { KeywordRule } from '@/domain/app-shell';
import { currentLocale, translate } from '@/localization/i18n';
import {
  addKeywordRule,
  deleteKeywordRule,
  deriveKeywordRuleSummaries,
  disableKeywordRule,
  restoreDefaultKeywordRules
} from './keyword-rules';

interface KeywordEditorProps {
  rules: KeywordRule[];
  onChange: (rules: KeywordRule[]) => void;
  recentUseByRuleId?: Record<string, { count: number; lastUsedAt: number | null }>;
}

export function KeywordEditor({
  rules,
  onChange,
  recentUseByRuleId
}: KeywordEditorProps) {
  const [language, setLanguage] = useState<KeywordRule['language']>('ar');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const visibleRules = useMemo(
    () =>
      deriveKeywordRuleSummaries(rules, recentUseByRuleId).filter(
        (rule) =>
          rule.language === language &&
          rule.value.toLocaleLowerCase(currentLocale()).includes(query.toLocaleLowerCase(currentLocale()))
      ),
    [language, query, recentUseByRuleId, rules]
  );

  function commitAdd() {
    const result = addKeywordRule(rules, {
      group: 'expense',
      language,
      value: draft
    });
    setError(
      result.error === 'duplicate'
        ? translate('appShell.tracking.keywords.duplicate')
        : result.error === 'empty'
          ? translate('appShell.tracking.keywords.empty')
          : null
    );
    if (!result.error) {
      setDraft('');
      onChange(result.rules);
    }
  }

  function commitDisable(id: string) {
    const result = disableKeywordRule(rules, id);
    setError(
      result.warning === 'last_enabled'
        ? translate('appShell.tracking.keywords.lastEnabled')
        : null
    );
    if (!result.warning) onChange(result.rules);
  }

  return (
    <View style={styles.stack}>
      <View style={styles.row}>
        <ActionButton label={translate('common.arabic')} onPress={() => setLanguage('ar')} variant="secondary" />
        <ActionButton label={translate('common.english')} onPress={() => setLanguage('en')} variant="secondary" />
      </View>
      <TextInput
        accessibilityLabel={translate('appShell.tracking.keywords.search')}
        onChangeText={setQuery}
        style={styles.input}
        value={query}
      />
      <View style={styles.row}>
        <TextInput
          accessibilityLabel={translate('appShell.tracking.keywords.draft')}
          onChangeText={setDraft}
          style={styles.input}
          value={draft}
        />
        <ActionButton label={translate('appShell.tracking.keywords.add')} onPress={commitAdd} />
      </View>
      {error ? <StyledText accessibilityRole="alert">{error}</StyledText> : null}
      <ScrollView>
        {visibleRules.map((rule) => (
          <View key={rule.id} style={styles.keyword}>
            <StyledText>{rule.value}</StyledText>
            <StyledText variant="caption">
              {translate('appShell.tracking.keywords.useCount').replace(
                '{{value}}',
                String(rule.recentUseCount)
              )}
            </StyledText>
            <ActionButton
              label={translate('appShell.tracking.keywords.disable').replace(
                '{{value}}',
                rule.value
              )}
              onPress={() => commitDisable(rule.id)}
              variant="secondary"
            />
            {rule.origin === 'custom' ? (
              <ActionButton
                label={translate('appShell.tracking.keywords.delete').replace(
                  '{{value}}',
                  rule.value
                )}
                onPress={() => onChange(deleteKeywordRule(rules, rule.id))}
                variant="quiet"
              />
            ) : null}
          </View>
        ))}
      </ScrollView>
      <ActionButton
        label={translate('appShell.tracking.keywords.restore')}
        onPress={() => onChange(restoreDefaultKeywordRules(rules))}
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
    padding: 16
  },
  row: {
    flexDirection: 'row',
    gap: 8
  },
  input: {
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12
  },
  keyword: {
    gap: 8,
    paddingVertical: 8
  }
});
