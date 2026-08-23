import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { type AppIconName, DesignIcon } from '@/design-system/icons';
import { colorTokens, radius, spacing } from '@/design-system/tokens';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';

export function AccountSettingCard({
  icon,
  iconBg = colorTokens.raw["EBF5EC"],
  iconFg = colorTokens.raw["1F7A5A"],
  title,
  description,
  value,
  onValueChange
}: {
  icon: AppIconName;
  iconBg?: string;
  iconFg?: string;
  title: string;
  description: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
}) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const isRtl = direction === 'rtl';

  return (
    <View
      style={[
        styles.card,
        styles.physicalLtr,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borders?.subtle ?? colorTokens.raw["E7E9E6"],
          flexDirection: isRtl ? 'row-reverse' : 'row'
        }
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
        <DesignIcon
          name={icon}
          label={title}
          color={iconFg}
          size="control"
          direction={direction}
          decorative
        />
      </View>

      <View
        style={[
          styles.textContainer,
          { alignItems: isRtl ? 'flex-end' : 'flex-start' }
        ]}
      >
        <Text
          style={[
            styles.title,
            {
              color: theme.colors.textPrimary,
              textAlign: isRtl ? 'right' : 'left',
              writingDirection: direction
            }
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.desc,
            {
              color: theme.colors.textSecondary,
              textAlign: isRtl ? 'right' : 'left',
              writingDirection: direction
            }
          ]}
        >
          {description}
        </Text>
      </View>

      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: theme.colors.borders?.subtle ?? colorTokens.raw["E0E0E0"],
          true: colorTokens.teal[700]
        }}
        thumbColor={colorTokens.raw["FFFFFF"]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  physicalLtr: {
    display: 'flex',
    writingDirection: 'ltr'
  },
  card: {
    alignItems: 'center',
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 68,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  iconContainer: {
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
  title: {
    fontSize: 14,
    fontWeight: '700'
  },
  desc: {
    fontSize: 12,
    lineHeight: 16
  }
});
