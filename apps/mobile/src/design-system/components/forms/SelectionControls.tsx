import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { type AppIconName, DesignIcon } from '@/design-system/icons';
import { minTouchTarget, spacing } from '@/design-system/tokens';
import { useTheme } from '@/state/theme-context';
import { translateDynamic } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { colorTokens } from '@/design-system/tokens';

export function Toggle({
  value,
  disabled = false,
  onValueChange,
  accessibilityLabel,
  testID
}: {
  value: boolean;
  disabled?: boolean;
  onValueChange?: (value: boolean) => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const theme = useTheme();
  const reducedMotion = usePreferenceStore((state) => state.reducedMotion);
  const animValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      animValue.setValue(value ? 1 : 0);
    } else {
      Animated.timing(animValue, {
        toValue: value ? 1 : 0,
        duration: 180,
        useNativeDriver: true
      }).start();
    }
  }, [animValue, value, reducedMotion]);

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20]
  });

  const activeTrackBg = theme.colors.interactions?.primary ?? colorTokens.raw["103F37"];
  const inactiveTrackBg =
    theme.colors.surfaceMuted === colorTokens.raw["202B27"] ? colorTokens.raw["2C3934"] : colorTokens.raw["DDE5E1"];

  const isInteractive = Boolean(onValueChange && !disabled);

  return (
    <Pressable
      testID={testID}
      accessible={Boolean(accessibilityLabel || onValueChange)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={!isInteractive}
      onPress={() => onValueChange?.(!value)}
      style={({ pressed }) => [
        styles.toggleContainer,
        styles.physicalLtr,
        disabled && styles.toggleDisabled,
        pressed && isInteractive && { opacity: 0.85 }
      ]}
    >
      <View
        style={[
          styles.toggleTrack,
          styles.physicalLtr,
          {
            backgroundColor: value ? activeTrackBg : inactiveTrackBg
          }
        ]}
      >
        <Animated.View
          style={[
            styles.toggleThumb,
            styles.physicalLtr,
            {
              transform: [{ translateX }]
            }
          ]}
        />
      </View>
    </Pressable>
  );
}

export function SwitchRow({
  label,
  value,
  subtext,
  icon,
  iconBg,
  iconFg,
  disabled = false,
  onValueChange
}: {
  label: string;
  value: boolean;
  subtext?: string;
  icon?: AppIconName;
  iconBg?: string;
  iconFg?: string;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const locale = usePreferenceStore((state) => state.locale);
  const isRtl = direction === 'rtl';
  const text = translateDynamic(label, {}, locale);
  const subtextResolved = subtext
    ? translateDynamic(subtext, {}, locale)
    : undefined;

  return (
    <Pressable
      accessibilityLabel={
        subtextResolved ? `${text}, ${subtextResolved}` : text
      }
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [
        styles.switchRow,
        styles.physicalLtr,
        { flexDirection: isRtl ? 'row-reverse' : 'row' },
        disabled && styles.toggleDisabled,
        pressed && { backgroundColor: theme.colors.surfaceMuted }
      ]}
    >
      <View
        style={[
          styles.switchRowContent,
          styles.physicalLtr,
          { flexDirection: isRtl ? 'row-reverse' : 'row' }
        ]}
      >
        {icon ? (
          <View
            style={[
              styles.iconBadge,
              { backgroundColor: iconBg ?? colorTokens.raw["EBF5EC"] }
            ]}
          >
            <DesignIcon
              name={icon}
              label={text}
              color={iconFg ?? colorTokens.raw["1F7A5A"]}
              size="control"
              decorative
            />
          </View>
        ) : null}

        <View
          style={[
            styles.textContainer,
            { alignItems: isRtl ? 'flex-end' : 'flex-start' }
          ]}
        >
          <Text
            accessible={false}
            style={[
              styles.label,
              {
                color: theme.colors.textPrimary,
                textAlign: isRtl ? 'right' : 'left',
                writingDirection: direction
              }
            ]}
          >
            {text}
          </Text>
          {subtextResolved ? (
            <Text
              accessible={false}
              style={[
                styles.subtext,
                {
                  color: theme.colors.textSecondary,
                  textAlign: isRtl ? 'right' : 'left',
                  writingDirection: direction
                }
              ]}
            >
              {subtextResolved}
            </Text>
          ) : null}
        </View>
      </View>

      <View pointerEvents="none" accessible={false} style={styles.physicalLtr}>
        <Toggle value={value} disabled={disabled} />
      </View>
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
  physicalLtr: { direction: 'ltr', display: 'flex', writingDirection: 'ltr' },
  toggleContainer: {
    minHeight: Math.max(44, minTouchTarget),
    minWidth: Math.max(44, minTouchTarget),
    justifyContent: 'center',
    alignItems: 'center'
  },
  toggleTrack: {
    width: 50,
    height: 30,
    borderRadius: 15,
    position: 'relative',
    overflow: 'hidden'
  },
  toggleThumb: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colorTokens.raw["FFFFFF"],
    shadowColor: colorTokens.raw["000"],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2.5,
    elevation: 2
  },
  toggleDisabled: {
    opacity: 0.45
  },
  switchRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    minHeight: Math.max(48, minTouchTarget),
    gap: spacing.md
  },
  switchRowContent: {
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textContainer: {
    flex: 1,
    gap: 2
  },
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
    fontSize: 14,
    fontWeight: '600',
    flex: 1
  },
  subtext: {
    fontSize: 12,
    lineHeight: 16
  }
});
