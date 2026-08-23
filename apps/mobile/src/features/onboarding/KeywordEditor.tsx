import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { ChipSelector } from '@/design-system/components/forms/ChipControls';
import { FormField } from '@/design-system/components/forms/FormField';
import {
  GroupedList,
  NavigationRow
} from '@/design-system/components/navigation/GroupedList';
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
      <ChipSelector
        options={[translate('common.arabic'), translate('common.english')]}
        selected={[
          translate(language === 'ar' ? 'common.arabic' : 'common.english')
        ]}
        onToggle={(label) =>
          setLanguage(label === translate('common.arabic') ? 'ar' : 'en')
        }
      />
      <FormField
        label={translate('appShell.tracking.keywords.search')}
        onChangeText={setQuery}
        variant="search"
        value={query}
      />
      <FormField
        label={translate('appShell.tracking.keywords.draft')}
        onChangeText={setDraft}
        value={draft}
      />
      <ActionButton
        label={translate('appShell.tracking.keywords.add')}
        onPress={commitAdd}
      />
      {error ? <StyledText accessibilityRole="alert">{error}</StyledText> : null}
      {visibleRules.map((rule) => (
        <GroupedList key={rule.id} label={rule.value}>
          <NavigationRow
            label={rule.value}
            description={translate('appShell.tracking.keywords.useCount').replace(
              '{{value}}',
              String(rule.recentUseCount)
            )}
            status={translate('tracking.action.disable')}
            onPress={() => commitDisable(rule.id)}
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
        </GroupedList>
      ))}
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
    gap: 12
  }
});
