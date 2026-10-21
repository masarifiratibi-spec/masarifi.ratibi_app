import React, { useState } from 'react';
import { View } from 'react-native';
import { isMobileAutomationEnabled } from '@/config/mobile-automation';
import { SwitchRow } from '@/design-system/components/forms/SelectionControls';
import { StyledText } from '@/components/StyledText';
import { translateDynamic } from '@/localization/i18n';
import { usePreferenceStore, effectiveReturnRemindersEnabled } from '@/state/preferences';
import { useAppShellStore } from '@/state/app-shell';
import { phoneNotificationService } from '@/services/platform/phone-notification-service';
import { notificationService } from '@/services/engagement-service';
import { registerGuestRemindersChannel } from '@/services/platform/guest-onboarding-reminder';

export function ReminderConsentControl({ guest = false }: { guest?: boolean }) {
  const session = useAppShellStore((state) => state.session);
  const enabled = usePreferenceStore((state) => effectiveReturnRemindersEnabled(guest ? null : session?.userId ?? null, state));
  const locale = usePreferenceStore((state) => state.locale);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ownerId = guest ? null : (session?.userId ?? null);
  if (
    !isMobileAutomationEnabled() ||
    (guest ? Boolean(session?.userId) : session?.status !== 'authenticated')
  )
    return null;

  async function change(value: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (value) {
        await registerGuestRemindersChannel();
        const permission = guest
          ? await phoneNotificationService.requestPermission()
          : await notificationService.requestPermissionAfterEducation();
        if (permission !== 'granted') {
          setError('reminders.permission.denied');
          return;
        }
      }
      // A permission prompt can outlive its initiating account or guest session.
      if ((useAppShellStore.getState().session?.userId ?? null) !== ownerId)
        return;
      await usePreferenceStore
        .getState()
        .setReturnRemindersEnabled(value, ownerId);
    } catch {
      setError('appShell.error.persistenceFailed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <SwitchRow
        label={guest ? 'reminders.guest.label' : 'reminders.control.label'}
        subtext={
          guest
            ? 'reminders.guest.description'
            : 'reminders.control.description'
        }
        value={enabled}
        disabled={busy}
        onValueChange={(value) => {
          void change(value);
        }}
      />
      {error ? (
        <StyledText accessibilityRole="alert">
          {translateDynamic(error, {}, locale)}
        </StyledText>
      ) : null}
    </View>
  );
}
