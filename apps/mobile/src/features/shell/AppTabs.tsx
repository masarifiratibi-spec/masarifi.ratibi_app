import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { StyledText } from '@/components/StyledText';
import { DesignIcon } from '@/design-system/icons';
import {
  elevation,
  minTouchTarget,
  spacing,
  typography
} from '@/design-system/tokens';
import { translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import {
  tabOrderForDirection,
  type PrimaryTabRoute
} from './navigation-context';

export const tabItems = [
  { route: '/(tabs)/home', label: 'appShell.tabs.home', icon: 'home' },
  { route: '/assistant', label: 'appShell.shell.assistant', icon: 'assistant' },
  {
    route: '/(tabs)/transactions',
    label: 'appShell.tabs.transactions',
    icon: 'transactions'
  }
] as const;

interface AppTabsProps {
  currentRoute: string;
  onSelect: (route: PrimaryTabRoute) => void;
}

export function AppTabs({ currentRoute, onSelect }: AppTabsProps) {
  const theme = useTheme();
  const locale = usePreferenceStore((state) => state.locale);
  const direction = usePreferenceStore((state) => state.direction);
  const insets = React.useContext(SafeAreaInsetsContext);
  const routes = tabOrderForDirection(direction);

  return (
    <View
      accessibilityRole="tablist"
      testID="app-tabs"
      style={[
        styles.root,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          flexDirection: direction === 'rtl' ? 'row-reverse' : 'row',
          paddingBottom: Math.max(insets?.bottom ?? 0, spacing.xs)
        }
      ]}
    >
      {routes.map((route) => {
        const item = tabItems.find((candidate) => candidate.route === route)!;
        const selected = item.route === currentRoute;
        const prominent = item.route === '/assistant';
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
              pressed && { backgroundColor: theme.colors.surfaceMuted }
            ]}
          >
            <View
              style={[
                styles.iconShell,
                selected && {
                  backgroundColor: theme.colors.surfaces.brandSubtle
                },
                prominent && [
                  styles.assistantControl,
                  elevation.raised,
                  { backgroundColor: theme.colors.interactions.primary }
                ]
              ]}
            >
              <DesignIcon
                name={item.icon}
                label={label}
                testID={prominent ? 'app-tabs-assistant-icon' : undefined}
                color={
                  prominent
                    ? theme.colors.content.inverse
                    : selected
                      ? theme.colors.primary
                      : theme.colors.textSecondary
                }
                direction={direction}
                decorative
              />
            </View>
            <StyledText
              accessible={false}
              maxFontSizeMultiplier={1.5}
              numberOfLines={2}
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
    paddingTop: spacing.xs,
    position: 'relative'
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 64,
    minWidth: minTouchTarget,
    paddingHorizontal: 0,
    paddingVertical: spacing.sm
  },
  iconShell: {
    alignItems: 'center',
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    width: 32
  },
  assistantControl: {
    borderRadius: 14,
    height: 52,
    marginTop: -18,
    width: 52
  },
  label: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    textAlign: 'center',
    width: '100%'
  },
  selectedLabel: {
    fontWeight: '700'
  }
});
