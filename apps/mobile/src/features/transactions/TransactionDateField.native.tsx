import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent
} from '@react-native-community/datetimepicker';

import { AppSheet } from '@/design-system/components/overlays/AppSheet';
import { DesignIcon } from '@/design-system/icons';
import { minTouchTarget, radius, spacing } from '@/design-system/tokens';
import { currentLocale, translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { formatDate } from '@/utils/format-financial-value';
import { replaceLocalDate } from './transaction-date';

export function TransactionDateField({
  value,
  disabled = false,
  label: providedLabel,
  onChange
}: {
  value: number;
  disabled?: boolean;
  label?: string;
  onChange: (value: number) => void;
}) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const [visible, setVisible] = useState(false);
  const label = providedLabel ?? translate('coreFinance.transaction.date');
  const update = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'set' && selected) {
      onChange(replaceLocalDate(value, selected.getTime()));
    }
  };
  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: new Date(value), mode: 'date', onChange: update });
    } else {
      setVisible(true);
    }
  };

  return (
    <View style={styles.stack}>
      <Text style={[styles.label, { color: theme.colors.content.primary }]}>
        {label}
      </Text>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={open}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: pressed
              ? theme.colors.interactions.quietPressed
              : theme.colors.surfaces.card,
            borderColor: theme.colors.borders.subtle,
            direction: 'ltr',
            flexDirection: direction === 'rtl' ? 'row-reverse' : 'row',
            opacity: disabled ? 0.56 : 1
          }
        ]}
      >
        <DesignIcon
          name="calendar"
          label={label}
          color={theme.colors.content.link}
          decorative
        />
        <Text style={[styles.value, { color: theme.colors.content.primary }]}>
          {formatDate(value, currentLocale())}
        </Text>
        <DesignIcon
          name="chevronEnd"
          label={label}
          color={theme.colors.content.muted}
          direction={direction}
          decorative
        />
      </Pressable>
      {Platform.OS === 'ios' ? (
        <AppSheet title={label} visible={visible} onDismiss={() => setVisible(false)}>
          <DateTimePicker
            display="inline"
            mode="date"
            value={new Date(value)}
            onChange={update}
          />
        </AppSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  label: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  card: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    writingDirection: 'ltr',
    gap: spacing.md,
    minHeight: minTouchTarget + spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  value: { flex: 1, fontSize: 16, fontWeight: '600', lineHeight: 24 }
});
