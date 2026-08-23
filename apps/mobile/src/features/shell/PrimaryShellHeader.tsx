import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { DesignIcon } from '@/design-system/icons';
import { StyledText } from '@/components/StyledText';
import { radius, spacing } from '@/design-system/tokens';
import { useSettingsProfile } from '@/features/settings/settings-queries';
import { translate } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import type { PrimaryTabRoute } from './navigation-context';

export function PrimaryShellHeader({
  origin,
  appearance = 'default',
  showReports = true,
  showAvatar = true,
  onBack,
  children
}: {
  origin: PrimaryTabRoute;
  appearance?: 'default' | 'financialHero';
  showReports?: boolean;
  showAvatar?: boolean;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const userId = useAppShellStore((state) => state.session?.userId ?? null);
  const profile = useSettingsProfile(showAvatar && userId !== null);
  const reportsLabel = translate('appShell.navigation.reports');
  const backLabel = translate('appShell.navigation.back');
  const moreLabel = translate('appShell.navigation.more');
  const onFinancialHero = appearance === 'financialHero';
  const actionColor = onFinancialHero
    ? theme.colors.content.onFinancialHero
    : theme.colors.primary;

  return (
    <View
      testID="primary-shell-header"
      style={[
        styles.root,
        styles.physicalLtr,
        {
          flexDirection: onBack
            ? direction === 'rtl'
              ? 'row-reverse'
              : 'row'
            : direction === 'rtl'
              ? 'row'
              : 'row-reverse'
        }
      ]}
    >
      {onBack ? (
        <Pressable
          testID="primary-shell-back-action"
          accessibilityLabel={backLabel}
          accessibilityRole="button"
          onPress={onBack}
          style={styles.action}
        >
          <DesignIcon
            testID="primary-shell-back-icon"
            name="back"
            label={backLabel}
            color={actionColor}
            direction={direction}
            decorative
          />
        </Pressable>
      ) : showReports ? (
        <Pressable
          testID="primary-shell-reports-action"
          accessibilityLabel={reportsLabel}
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: '/(tabs)/reports',
              params: { returnTo: origin }
            })
          }
          style={styles.action}
        >
          <DesignIcon
            testID="primary-shell-reports-icon"
            name="reports"
            label={reportsLabel}
            color={actionColor}
            decorative
          />
        </Pressable>
      ) : null}
      <View testID="primary-shell-center" style={styles.center}>
        {children}
      </View>
      {showAvatar ? (
        <Pressable
          testID="primary-shell-more-action"
          accessibilityLabel={moreLabel}
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: '/(tabs)/more',
              params: { returnTo: origin }
            })
          }
          style={styles.action}
        >
          <View
            testID="primary-shell-avatar"
            style={[
              styles.avatar,
              {
                backgroundColor: onFinancialHero
                  ? `${actionColor}18`
                  : theme.colors.surfaces.brandSubtle,
                borderColor: onFinancialHero
                  ? `${actionColor}30`
                  : theme.colors.borders.default
              }
            ]}
          >
            <StyledText
              accessible={false}
              variant="title"
              style={[
                styles.initials,
                {
                  color: onFinancialHero
                    ? actionColor
                    : theme.colors.content.link
                }
              ]}
            >
              {profileInitials(
                profile.data?.name ?? null,
                profile.data?.email ?? null,
                userId
              )}
            </StyledText>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  physicalLtr: { display: 'flex', writingDirection: 'ltr' },
  root: {
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48
  },
  avatar: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  initials: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  center: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0
  }
});

export function profileInitials(
  name: string | null,
  email: string | null,
  userId: string | null
): string {
  const source =
    name?.trim() || email?.split('@')[0]?.trim() || userId?.trim() || 'M';
  const words = source
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const characters = Array.from(words[0] ?? 'M');
  const initials =
    words.length > 1
      ? `${Array.from(words[0])[0]}${Array.from(words.at(-1) ?? '')[0] ?? ''}`
      : characters.slice(0, 2).join('');
  return initials.toLocaleUpperCase();
}
