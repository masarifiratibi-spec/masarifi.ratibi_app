import React, { useCallback, useRef } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { MenuLink } from '@/components/MenuLink';
import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { AppBar } from '@/design-system/components/navigation/AppNavigation';
import {
  useAssistantAvailability,
  useAssistantConsent
} from '@/features/assistant/assistant-queries';
import { spacing } from '@/design-system/tokens';
import { sanitizePrimaryTabRoute } from '@/features/shell/navigation-context';
import { translate } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { colorTokens } from '@/design-system/tokens';
import { isFixtureModeEnabled } from '@/config/demo-mode';
import { authService } from '@/features/auth/auth-flow';
import { signOutAppShellSession } from '@/features/auth/session-controller';
import { useSettingsProfile } from '@/features/settings/settings-queries';
import { resolvePublicDisplayName } from '@/services/live/clerk-name';
import { getLiveClerkDisplayName } from '@/services/live/clerk-provider';
import { localDateInTimeZone } from '@/domain/financial-period';
import { prefetchPlanningDestinations } from '@/features/financial-planning/financial-planning-queries';
import { AccountDeletionPanel } from '@/features/settings/AccountDeletionPanel';
import { SocialMediaFooter } from '@/features/settings/SocialMediaLinks';

// Keep these settings and their routes available while hiding their menu entries.
const SHOW_SECURITY_SETTINGS = false;
const SHOW_NOTIFICATION_PREFERENCES = false;

export default function MoreRoute() {
  const loggingOut = useRef(false);
  const signOut = async () => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    try {
      const completed = await signOutAppShellSession(authService, 'local', {
        confirmRemoval: () =>
          new Promise<boolean>((resolve) =>
            Alert.alert(
              translate('logout.unsyncedTitle'),
              translate('logout.unsyncedBody'),
              [
                {
                  text: translate('logout.wait'),
                  style: 'cancel',
                  onPress: () => resolve(false)
                },
                {
                  text: translate('logout.remove'),
                  style: 'destructive',
                  onPress: () => resolve(true)
                }
              ],
              { cancelable: true, onDismiss: () => resolve(false) }
            )
          )
      });
      if (completed !== false) router.replace('/(public)/auth-pending');
    } catch {
      Alert.alert(translate('logout.failed'));
    } finally {
      loggingOut.current = false;
    }
  };
  const client = useQueryClient();
  const theme = useTheme();
  const locale = usePreferenceStore((state) => state.locale);
  const direction = usePreferenceStore((state) => state.direction);
  const timeZone = usePreferenceStore((state) => state.timeZone);
  const isRtl = direction === 'rtl';

  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = sanitizePrimaryTabRoute(
    typeof params.returnTo === 'string' ? params.returnTo : null
  );

  const assistantLabel = translate('appShell.shell.assistant');
  const assistantConsent = useAssistantConsent();
  const assistantAvailability = useAssistantAvailability();

  const assistantStateLabel =
    assistantConsent.data?.status === 'disabled'
      ? translate('appShell.shell.assistantDisabled')
      : assistantAvailability.data?.status === 'limit_reached'
        ? translate('appShell.shell.assistantLimitReached')
        : null;

  const session = useAppShellStore((state) => state.session);
  const ownerId = session?.status === 'authenticated' ? session.userId : null;
  useFocusEffect(
    useCallback(() => {
      if (ownerId)
        void prefetchPlanningDestinations(
          client,
          localDateInTimeZone(Date.now(), timeZone),
          timeZone
        );
    }, [client, ownerId, timeZone])
  );
  const profile = useSettingsProfile(Boolean(ownerId));
  const userName = resolvePublicDisplayName(
    ownerId ? profile.data?.name : null,
    getLiveClerkDisplayName(ownerId),
    translate('appShell.more.defaultUserName', locale)
  );
  const accountLabel =
    (ownerId && profile.data?.googleAccount?.trim()) ||
    translate('appShell.more.defaultUserEmail', locale);
  const initial =
    Array.from(userName.trim())[0]?.toUpperCase() || (isRtl ? '\u0639' : 'M');

  return (
    <ScrollView
      contentContainerStyle={[
        styles.stack,
        { backgroundColor: theme.colors.surfaces.page }
      ]}
    >
      <AppBar
        title={translate('appShell.tabs.more', locale)}
        onBack={() => router.navigate(returnTo)}
        direction={direction}
      />

      {/* Top Profile Summary Card */}
      <View
        style={[
          styles.profileCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            flexDirection: 'row'
          }
        ]}
      >
        <View style={styles.avatar}>
          <StyledText style={styles.avatarText} accessible={false}>
            {initial}
          </StyledText>
        </View>
        <View style={[styles.profileInfo, { alignItems: 'flex-start' }]}>
          <StyledText style={styles.profileName} variant="body">
            {userName}
          </StyledText>
          <StyledText
            style={[
              styles.profileSub,
              { color: theme.colors.content.secondary }
            ]}
          >
            {accountLabel}
          </StyledText>
        </View>
      </View>

      {/* Section 1: Account and Settings */}
      <View style={styles.section}>
        <StyledText style={styles.sectionHeading} variant="subtitle">
          {translate('appShell.more.accountSettings')}
        </StyledText>
        <View
          style={[
            styles.cardGroup,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border
            }
          ]}
        >
          <MenuLink
            label={translate('appShell.shell.profile')}
            icon="profile"
            iconBackground={colorTokens.raw['E7F3EF']}
            iconColor={colorTokens.raw['175B4F']}
            showChevron
            hideBorder
            onPress={() => router.push('/profile')}
          />
          <Divider />
          {SHOW_SECURITY_SETTINGS ? (
            <>
              <MenuLink
                label={translate('appShell.shell.security')}
                icon="security"
                iconBackground={colorTokens.raw['EAF2FB']}
                iconColor={colorTokens.raw['2E7087']}
                showChevron
                hideBorder
                onPress={() => router.push('/security/settings')}
              />
              <Divider />
            </>
          ) : null}
          <MenuLink
            label={translate('settings.profile.applicationOwner')}
            icon="settings"
            iconBackground={colorTokens.raw['FFF5EB']}
            iconColor={colorTokens.raw['93663D']}
            showChevron
            hideBorder
            onPress={() => router.push('/profile/application')}
          />
          <Divider />
          {SHOW_NOTIFICATION_PREFERENCES ? (
            <>
              <MenuLink
                label={translate('appShell.shell.notifications')}
                icon="notifications"
                iconBackground={colorTokens.raw['EAF2FB']}
                iconColor={colorTokens.raw['2E7087']}
                showChevron
                hideBorder
                onPress={() => router.push('/notifications/preferences')}
              />
              <Divider />
            </>
          ) : null}
          <MenuLink
            label={translate('tracking.action.openTracking')}
            icon="tracking"
            iconBackground={colorTokens.raw['F3EEF9']}
            iconColor={colorTokens.raw['68469C']}
            showChevron
            hideBorder
            onPress={() => router.push('/tracking')}
          />
        </View>
      </View>

      {/* Section 2: Finance and Planning */}
      <View style={styles.section}>
        <StyledText style={styles.sectionHeading} variant="subtitle">
          {translate('appShell.more.financePlanning')}
        </StyledText>
        <View
          style={[
            styles.cardGroup,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border
            }
          ]}
        >
          <MenuLink
            label={translate('appShell.shell.accounts')}
            icon="accounts"
            iconBackground={colorTokens.raw['E7F3EF']}
            iconColor={colorTokens.raw['175B4F']}
            showChevron
            hideBorder
            onPress={() => router.push('/accounts')}
          />
          <Divider />
          <MenuLink
            label={translate('coreFinance.action.categories')}
            icon="category"
            iconBackground={colorTokens.raw['EBF5EC']}
            iconColor={colorTokens.raw['1F7A5A']}
            showChevron
            hideBorder
            onPress={() => router.push('/categories')}
          />
          <Divider />
          <MenuLink
            label={translate('planning.salary.title')}
            icon="profile"
            iconBackground={colorTokens.raw['E3F7F2']}
            iconColor={colorTokens.raw['0F6B58']}
            showChevron
            hideBorder
            onPress={() => router.push('/salary')}
          />
          <Divider />
          <MenuLink
            label={translate('planning.obligations.title')}
            icon="receipt"
            iconBackground={colorTokens.raw['FCECEB']}
            iconColor={colorTokens.raw['B4473F']}
            showChevron
            hideBorder
            onPress={() => router.push('/obligations')}
          />
        </View>
      </View>

      {/* Section 4: Services */}
      <View style={styles.section}>
        <StyledText style={styles.sectionHeading} variant="subtitle">
          {translate('appShell.more.services')}
        </StyledText>
        <View
          style={[
            styles.cardGroup,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border
            }
          ]}
        >
          <MenuLink
            label={assistantLabel}
            icon="voice"
            iconBackground={colorTokens.raw['F3EEF9']}
            iconColor={colorTokens.raw['68469C']}
            showChevron
            hideBorder
            accessibilityLabel={
              assistantStateLabel
                ? `${assistantLabel} ${assistantStateLabel}`
                : assistantLabel
            }
            accessory={
              assistantStateLabel ? (
                <StyledText style={styles.stateLabel}>
                  {assistantStateLabel}
                </StyledText>
              ) : null
            }
            onPress={() => router.push('/assistant')}
          />
          <Divider />
          <MenuLink
            label={translate('appShell.shell.support')}
            icon="info"
            iconBackground={colorTokens.raw['F1F5F3']}
            iconColor={colorTokens.raw['4B534E']}
            showChevron
            hideBorder
            onPress={() => router.push('/support')}
          />
        </View>
      </View>

      <View style={styles.actionsWrapper}>
        <View
          style={[
            styles.cardGroup,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border
            }
          ]}
        >
          <MenuLink
            label={translate('appShell.auth.signOut')}
            accessibilityRole="button"
            icon="signOut"
            iconBackground={colorTokens.raw['F1F5F3']}
            iconColor={theme.colors.content.secondary}
            hideBorder
            onPress={signOut}
          />
        </View>
        <View>
          <AccountDeletionPanel presentation="link" />
          <SocialMediaFooter />
        </View>
        {isFixtureModeEnabled() ? (
          <ActionButton
            label={translate('appShell.security.mockSignOutAll')}
            onPress={async () => {
              await signOutAppShellSession(authService, 'all');
              router.replace('/(public)/auth-pending');
            }}
            variant="secondary"
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

function Divider() {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.divider,
        {
          backgroundColor: theme.colors.border,
          marginStart: 64
        }
      ]}
    />
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl
  },
  section: {
    gap: spacing.sm
  },
  sectionHeading: {
    paddingHorizontal: spacing.xs
  },
  profileCard: {
    borderRadius: 18,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colorTokens.raw['103F37'],
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: colorTokens.raw['FFFFFF'],
    fontSize: 18,
    fontWeight: '700'
  },
  profileInfo: {
    flex: 1
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700'
  },
  profileSub: {
    fontSize: 12,
    marginTop: 2
  },
  cardGroup: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden'
  },
  divider: {
    height: StyleSheet.hairlineWidth
  },
  stateLabel: {
    fontSize: 12,
    marginHorizontal: spacing.sm
  },
  actionsWrapper: {
    gap: spacing.sm,
    marginTop: spacing.sm
  }
});
