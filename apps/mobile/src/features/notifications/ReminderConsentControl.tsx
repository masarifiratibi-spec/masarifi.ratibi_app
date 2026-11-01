import React, { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { isMobileAutomationEnabled } from '@/config/mobile-automation';
import type { NotificationPermissionState } from '@/domain/notifications';
import { ActionButton } from '@/design-system/components/ActionButton';
import { SwitchRow } from '@/design-system/components/forms/SelectionControls';
import { StyledText } from '@/components/StyledText';
import { translateDynamic } from '@/localization/i18n';
import { usePreferenceStore, effectiveReturnRemindersEnabled } from '@/state/preferences';
import { useAppShellStore } from '@/state/app-shell';
import { phoneNotificationService } from '@/services/platform/phone-notification-service';
import { notificationService } from '@/services/engagement-service';
import { automaticTrackingService } from '@/services/automatic-tracking-service';
import {
  registerGuestRemindersChannel,
  synchronizeGuestOnboardingReminder
} from '@/services/platform/guest-onboarding-reminder';

export function ReminderConsentControl({ guest = false }: { guest?: boolean }) {
  const session = useAppShellStore((state) => state.session);
  const enabled = usePreferenceStore((state) => effectiveReturnRemindersEnabled(guest ? null : session?.userId ?? null, state));
  const locale = usePreferenceStore((state) => state.locale);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermissionState | null>(null);
  const ownerId = guest ? null : (session?.userId ?? null);
  const visible = isMobileAutomationEnabled() &&
    (guest ? !session?.userId : session?.status === 'authenticated');

  useEffect(() => {
    if (!visible) return;
    let current = true;
    setPermission(null);
    const refresh = async () => {
      const value = await phoneNotificationService.getPermission();
      if (current) setPermission(value);
    };
    void refresh().catch(() => undefined);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh().catch(() => undefined);
    });
    return () => {
      current = false;
      subscription.remove();
    };
  }, [visible, ownerId]);

  if (!visible) return null;

  const isCurrentOwner = () =>
    (useAppShellStore.getState().session?.userId ?? null) === ownerId;

  async function change(value: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (value) {
        await registerGuestRemindersChannel();
        let result: NotificationPermissionState;
        try {
          result = guest
            ? await phoneNotificationService.requestPermission()
            : await notificationService.requestPermissionAfterEducation();
        } catch {
          // Push registration may fail after the OS has already granted permission.
          result = await phoneNotificationService.getPermission();
        }
        if (!isCurrentOwner()) return;
        setPermission(result);
        if (result !== 'granted') {
          setError('reminders.permission.denied');
          return;
        }
      }
      // A permission prompt can outlive its initiating account or guest session.
      if (!isCurrentOwner()) return;
      await usePreferenceStore
        .getState()
        .setReturnRemindersEnabled(value, ownerId);
      if (value && isCurrentOwner()) {
        try {
          if (guest) {
            await synchronizeGuestOnboardingReminder({
              enabled: true,
              hasAccount: false,
              locale: usePreferenceStore.getState().locale
            });
          } else {
            await automaticTrackingService.getRuleConfiguration?.();
          }
        } catch {
          // Permission and the saved choice stand; the runtime retries on foreground.
        }
      }
    } catch {
      setError('appShell.error.persistenceFailed');
    } finally {
      setBusy(false);
    }
  }

  async function openSettings(enableIntent = false) {
    setBusy(true);
    setError(null);
    let persisting = enableIntent;
    try {
      if (!isCurrentOwner()) return;
      if (enableIntent)
        await usePreferenceStore.getState().setReturnRemindersEnabled(true, ownerId);
      if (!isCurrentOwner()) return;
      persisting = false;
      await phoneNotificationService.openSystemSettings();
    } catch {
      if (isCurrentOwner())
        setError(persisting ? 'appShell.error.persistenceFailed' : 'reminders.permission.denied');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <SwitchRow
        label={guest ? 'reminders.guest.label' : 'reminders.control.label'}
        icon={guest ? undefined : 'notifications'}
        subtext={
          guest
            ? 'reminders.guest.description'
            : 'reminders.control.description'
        }
        value={enabled && (guest || permission === 'granted')}
        disabled={busy}
        onValueChange={(value) => {
          void (!guest && value && permission === 'permanently_denied'
            ? openSettings(!enabled)
            : change(value));
        }}
      />
      {enabled && permission && permission !== 'granted' ? (
        <ActionButton
          label={permission === 'permanently_denied'
            ? 'appShell.permission.openSettings'
            : 'reminders.permission.allow'}
          variant="secondary"
          loading={busy}
          onPress={() => {
            void (permission === 'permanently_denied' ? openSettings() : change(true));
          }}
        />
      ) : null}
      {error ? (
        <StyledText accessibilityRole="alert">
          {translateDynamic(error, {}, locale)}
        </StyledText>
      ) : null}
    </View>
  );
}
