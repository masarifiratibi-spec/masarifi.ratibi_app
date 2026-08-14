import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { MenuLink } from '@/components/MenuLink';
import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { NotificationBadge } from '@/design-system/components/feedback/NotificationBadge';
import { useAssistantAvailability, useAssistantConsent } from '@/features/assistant/assistant-queries';
import { useUnreadNotificationCount } from '@/features/notifications/notification-queries';
import { spacing } from '@/design-system/tokens';
import { translate } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';

export default function MoreRoute() {
  const notificationsLabel = translate('appShell.shell.notifications');
  const assistantLabel = translate('appShell.shell.assistant');
  const unreadNotifications = useUnreadNotificationCount();
  const assistantConsent = useAssistantConsent();
  const assistantAvailability = useAssistantAvailability();
  const unreadCount = unreadNotifications.data ?? 0;
  const assistantStateLabel =
    assistantConsent.data?.status === 'disabled'
      ? translate('appShell.shell.assistantDisabled')
      : assistantAvailability.data?.status === 'limit_reached'
        ? translate('appShell.shell.assistantLimitReached')
        : null;
  const signOut = useAppShellStore((state) => state.signOut);
  const reopenProfilePrompt = useAppShellStore(
    (state) => state.reopenProfilePrompt
  );
  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <StyledText variant="title">{translate('appShell.tabs.more')}</StyledText>
      <MenuLink
        label={translate('appShell.shell.accounts')}
        icon="accounts"
        showChevron
        onPress={() => router.push('/accounts')}
      />
      <MenuLink
        label={assistantLabel}
        icon="info"
        showChevron
        accessibilityLabel={assistantStateLabel ? `${assistantLabel} ${assistantStateLabel}` : assistantLabel}
        accessory={assistantStateLabel ? <StyledText>{assistantStateLabel}</StyledText> : null}
        onPress={() => router.push('/assistant')}
      />
      <MenuLink
        label={notificationsLabel}
        icon="info"
        showChevron
        accessibilityLabel={
          unreadCount > 0
            ? `${notificationsLabel} ${unreadCount}`
            : notificationsLabel
        }
        accessory={
          unreadCount > 0 ? (
            <NotificationBadge
              count={unreadCount}
              label={notificationsLabel}
              decorative
            />
          ) : null
        }
        onPress={() => router.push('/notifications')}
      />
      <MenuLink
        label={translate('appShell.shell.profile')}
        icon="profile"
        showChevron
        onPress={() => router.push('/profile')}
      />
      <MenuLink
        label={translate('appShell.shell.security')}
        icon="security"
        showChevron
        onPress={() => router.push('/security/settings')}
      />
      <MenuLink
        label={translate('appShell.shell.privacy')}
        icon="settings"
        showChevron
        onPress={() => router.push('/profile/privacy')}
      />
      <MenuLink
        label={translate('appShell.shell.subscriptions')}
        icon="reports"
        showChevron
        onPress={() => router.push('/subscriptions')}
      />
      <MenuLink
        label={translate('appShell.shell.support')}
        icon="info"
        showChevron
        onPress={() => router.push('/support')}
      />
      <MenuLink
        label={translate('tracking.action.openTracking')}
        icon="tracking"
        showChevron
        onPress={() => router.push('/tracking')}
      />
      <MenuLink
        label={translate('planning.salary.title')}
        icon="profile"
        showChevron
        onPress={() => router.push('/salary')}
      />
      <MenuLink
        label={translate('planning.budgets.title')}
        icon="reports"
        showChevron
        onPress={() => router.push('/budgets')}
      />
      <MenuLink
        label={translate('planning.obligations.title')}
        icon="transactions"
        showChevron
        onPress={() => router.push('/obligations')}
      />
      <MenuLink
        label={translate('planning.savings.title')}
        icon="accounts"
        showChevron
        onPress={() => router.push('/savings')}
      />
      <MenuLink
        label={translate('appShell.profile.reopen')}
        icon="settings"
        onPress={reopenProfilePrompt}
      />
      <ActionButton
        label={translate('appShell.auth.signOut')}
        onPress={async () => {
          await signOut();
          router.replace('/(public)/language');
        }}
        variant="destructive"
      />
      <ActionButton
        label={translate('appShell.security.mockSignOutAll')}
        onPress={async () => {
          await signOut();
          router.replace('/(public)/language');
        }}
        variant="secondary"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxl
  }
});
