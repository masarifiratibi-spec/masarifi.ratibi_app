import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { minTouchTarget } from '@/design-system/tokens';
import { StyledText } from '@/components/StyledText';
import { fontFamilyForLocale } from '@/design-system/typography';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';

export function ChipSelector({
  options,
  selected,
  disabledOptions = [],
  onToggle
}: {
  options: string[];
  selected: string[];
  disabledOptions?: string[];
  onToggle: (value: string) => void;
}) {
  const direction = usePreferenceStore((state) => state.direction);
  return (
    <View
      testID="chip-selector"
      style={[
        styles.wrap,
        {
          direction: 'ltr',
          flexDirection: direction === 'rtl' ? 'row-reverse' : 'row'
        }
      ]}
    >
      {options.map((option) => {
        const isSelected = selected.includes(option);
        const disabled = disabledOptions.includes(option);
        return (
          <Chip
            key={option}
            label={option}
            accessibilityLabel={`${option} ${translate(
              disabled
                ? 'designSystem.state.disabled'
                : isSelected
                  ? 'designSystem.state.selected'
                  : 'designSystem.state.available'
            )}`}
            disabled={disabled}
            selected={isSelected}
            onPress={() => onToggle(option)}
          />
        );
      })}
    </View>
  );
}

export function KeywordChipEditor({
  keywords,
  onChange
}: {
  keywords: string[];
  onChange: (keywords: string[]) => void;
}) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const locale = usePreferenceStore((state) => state.locale);
  const [draft, setDraft] = useState('');

  function addKeyword() {
    const next = draft.trim();
    if (next && !keywords.includes(next)) {
      onChange([...keywords, next]);
    }
    setDraft('');
  }

  return (
    <View style={styles.stack}>
      <TextInput
        accessibilityLabel={translate('designSystem.form.keyword')}
        onChangeText={setDraft}
        style={[
          styles.input,
          {
            borderColor: theme.colors.border,
            color: theme.colors.textPrimary,
            fontFamily: fontFamilyForLocale(locale, 400)
          }
        ]}
        value={draft}
      />
      <Pressable
        accessibilityLabel={translate('designSystem.form.addKeyword')}
        accessibilityRole="button"
        onPress={addKeyword}
        style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
      >
        <StyledText accessible={false} variant="subtitle" style={{ color: theme.colors.textInverse }}>
          {translate('designSystem.action.add')}
        </StyledText>
      </Pressable>
      <View
        style={[
          styles.wrap,
          {
            direction: 'ltr',
            flexDirection: direction === 'rtl' ? 'row-reverse' : 'row'
          }
        ]}
      >
        {keywords.map((keyword) => (
          <Chip
            key={keyword}
            label={keyword}
            accessibilityLabel={`${translate('designSystem.action.remove')} ${keyword}`}
            onPress={() =>
              onChange(keywords.filter((item) => item !== keyword))
            }
          />
        ))}
      </View>
    </View>
  );
}

function Chip({
  label,
  accessibilityLabel,
  selected = false,
  disabled = false,
  onPress
}: {
  label: string;
  accessibilityLabel: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: selected ? theme.colors.primary : theme.colors.border }
      ]}
    >
      <StyledText accessible={false} variant="subtitle" style={{ color: theme.colors.textPrimary }}>
        {label}
      </StyledText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 8
  },
  wrap: {
    writingDirection: 'ltr',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: minTouchTarget,
    paddingHorizontal: 12
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: 12
  },
  addButton: {
    alignItems: 'center',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12
  }
});
