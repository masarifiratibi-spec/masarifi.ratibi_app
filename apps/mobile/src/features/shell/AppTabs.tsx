import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { StyledText } from '@/components/StyledText';
import { DesignIcon, type DesignIconName } from '@/design-system/icons';
import { minTouchTarget, spacing, typography } from '@/design-system/tokens';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { tabOrderForDirection } from './navigation-context';

export const tabItems = [
  { route: '/(tabs)/home', label: 'appShell.tabs.home', icon: 'home' },
  {
    route: '/(tabs)/transactions',
    label: 'appShell.tabs.transactions',
    icon: 'transactions'
  },
  { route: '/(tabs)/add', label: 'appShell.tabs.add', icon: 'add' },
  { route: '/(tabs)/reports', label: 'appShell.tabs.reports', icon: 'reports' },
  { route: '/(tabs)/more', label: 'appShell.tabs.more', icon: 'more' }
] as const;

interface AppTabsProps {
  currentRoute: string;
  onSelect: (route: (typeof tabItems)[number]['route']) => void;
}

export function AppTabs({ currentRoute, onSelect }: AppTabsProps) {
  const theme = useTheme();
  const locale = usePreferenceStore((state) => state.locale);
  const direction = usePreferenceStore((state) => state.direction);
  const routes = tabOrderForDirection(direction);
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.root,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border
        }
      ]}
    >
      {routes.map((route) => {
        const item = tabItems.find((candidate) => candidate.route === route)!;
        const selected = item.route === currentRoute;
        const label = translate(item.label, locale);
        return (
          <Pressable
            accessibilityLabel={label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={item.route}
            onPress={() => onSelect(item.route)}
            style={({ pressed }) => [
              styles.tab,
              item.route === '/(tabs)/add' && styles.add,
              selected && { backgroundColor: theme.colors.surfaceMuted },
              pressed && { backgroundColor: theme.colors.surfaceMuted }
            ]}
          >
            <DesignIcon
              name={item.icon as DesignIconName}
              label={label}
              color={
                selected ? theme.colors.primary : theme.colors.textSecondary
              }
              direction={direction}
              decorative
            />
            <StyledText
              accessible={false}
              numberOfLines={1}
              variant="caption"
              style={[
                styles.label,
                {
                  color: selected
                    ? theme.colors.primary
                    : theme.colors.textSecondary
                },
                selected && styles.selectedLabel
              ]}
            >
              {label}
            </StyledText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingTop: spacing.xs
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 64,
    minWidth: minTouchTarget,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm
  },
  add: {
    flex: 1.2
  },
  label: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    textAlign: 'center'
  },
  selectedLabel: {
    fontWeight: '700'
  }
});
