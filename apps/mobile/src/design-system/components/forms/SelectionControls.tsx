import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { DesignIcon } from '@/design-system/icons';
import { minTouchTarget } from '@/design-system/tokens';
import { useTheme } from '@/state/theme-context';
import { translateDynamic } from '@/localization/i18n';

export function SwitchRow({
  label,
  value,
  onValueChange
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  const text = translateDynamic(label);
  return (
    <Pressable
      accessibilityLabel={text}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={styles.row}
    >
      <Text
        accessible={false}
        style={[styles.label, { color: theme.colors.textPrimary }]}
      >
        {text}
      </Text>
      <Switch
        accessible={false}
        pointerEvents="none"
        value={value}
        trackColor={{
          false: theme.colors.border,
          true: theme.colors.primary
        }}
      />
    </Pressable>
  );
}

export function CheckboxRow({
  label,
  checked,
  disabled = false,
  onPress
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const text = translateDynamic(label);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={text}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.row, { minHeight: Math.max(48, minTouchTarget) }]}
    >
      <View
        accessible={false}
        style={[
          styles.checkbox,
          {
            backgroundColor: checked ? theme.colors.primary : 'transparent',
            borderColor: checked ? theme.colors.primary : theme.colors.border
          }
        ]}
      >
        {checked ? (
          <DesignIcon
            name="check"
            label={text}
            color={theme.colors.textInverse}
            size="sm"
            decorative
          />
        ) : null}
      </View>
      <Text
        accessible={false}
        style={[styles.label, { color: theme.colors.textPrimary }]}
      >
        {text}
      </Text>
    </Pressable>
  );
}

export function RadioCard({
  label,
  selected,
  disabled = false,
  onPress
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const text = translateDynamic(label);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={text}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.card,
        { borderColor: selected ? theme.colors.primary : theme.colors.border }
      ]}
    >
      <Text accessible={false} style={{ color: theme.colors.textPrimary }}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    minHeight: 48
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    minHeight: Math.max(48, minTouchTarget),
    padding: 12
  },
  checkbox: {
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24
  },
  label: {
    flex: 1
  }
});
