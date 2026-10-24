import { useEffect } from 'react';
import { AppState } from 'react-native';
import { isMobileAutomationEnabled } from '@/config/mobile-automation';
import { useAppShellStore } from '@/state/app-shell';
import {
  usePreferenceStore,
  effectiveReturnRemindersEnabled
} from '@/state/preferences';
import { phoneNotificationService } from '@/services/platform/phone-notification-service';
import { automaticTrackingService } from '@/services/automatic-tracking-service';
import { synchronizeGuestOnboardingReminder } from '@/services/platform/guest-onboarding-reminder';

export function DevReminderRuntime() {
  const ready = useAppShellStore((state) => state.hydrated);
  const session = useAppShellStore((state) => state.session);
  const preferencesReady = usePreferenceStore((state) => state.hydrated);
  const enabled = usePreferenceStore((state) =>
    effectiveReturnRemindersEnabled(session?.userId ?? null, state)
  );
  const locale = usePreferenceStore((state) => state.locale);
  const timeZone = usePreferenceStore((state) => state.timeZone);

  useEffect(() => {
    if (!ready || !preferencesReady || !isMobileAutomationEnabled()) return;
    let active = true;
    const refresh = async () => {
      const permission = await phoneNotificationService.getPermission();
      if (!active) return;
      await synchronizeGuestOnboardingReminder({
        enabled: enabled && permission === 'granted',
        hasAccount: Boolean(session?.userId),
        locale
      });
    };
    void refresh().catch(() => undefined);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh().catch(() => undefined);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [ready, preferencesReady, enabled, locale, session?.userId]);

  useEffect(() => {
    if (
      !ready ||
      !preferencesReady ||
      !isMobileAutomationEnabled() ||
      session?.status !== 'authenticated'
    )
      return;
    // Reminder consent and foreground activity must sync even when capture is paused.
    const refresh = () => {
      void automaticTrackingService
        .getRuleConfiguration?.()
        .catch(() => undefined);
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [
    ready,
    preferencesReady,
    session?.status,
    session?.userId,
    enabled,
    locale,
    timeZone
  ]);
  return null;
}
