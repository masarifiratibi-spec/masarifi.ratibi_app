import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
import { z } from 'zod';
import type { Locale } from '@/domain/foundation';
import { isMobileAutomationEnabled } from '@/config/mobile-automation';
import { translateDynamic } from '@/localization/i18n';
import { registerRuntimeIdentityReset } from '@/storage/runtime-user-data-reset';

const storageKey = 'masarifi.guest-onboarding-reminder.v1';
const identifier = 'masarifi.guest-onboarding-reminder.v1';
const accountSeenKey = 'masarifi.guest-onboarding-account-created.v1';
const channelId = 'return-reminders';
const cycleSchema = z.object({
  cycleId: z.string().uuid(),
  dueAt: z.number().finite(),
  locale: z.enum(['ar', 'en']),
  consumed: z.boolean().optional()
});
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work);
  queue = result.catch(() => undefined);
  return result;
}

async function loadCycle() {
  const raw = await SecureStore.getItemAsync(storageKey);
  if (!raw) return null;
  try {
    return cycleSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function registerGuestRemindersChannel(): Promise<void> {
  if (Platform.OS === 'android' && isMobileAutomationEnabled()) {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: translateDynamic('reminders.control.label'),
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PRIVATE
    });
  }
}

async function cancel() {
  await Notifications.cancelScheduledNotificationAsync(identifier);
  await SecureStore.deleteItemAsync(storageKey);
}

export function synchronizeGuestOnboardingReminder(input: {
  enabled: boolean;
  hasAccount: boolean;
  locale: Locale;
}): Promise<void> {
  return serialize(async () => {
    if (!isMobileAutomationEnabled() || Platform.OS === 'web') return;
    if (input.hasAccount) await SecureStore.setItemAsync(accountSeenKey, '1');
    if (!input.enabled || input.hasAccount) {
      await cancel();
      return;
    }
    if (await SecureStore.getItemAsync(accountSeenKey) === '1') { await cancel(); return; }
    const previous = await loadCycle();
    if (previous && (previous.consumed || previous.dueAt <= Date.now())) return;
    const cycle = previous ?? {
      cycleId: randomUUID(),
      dueAt: Date.now() + 86_400_000,
      locale: input.locale
    };
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    if (
      previous?.locale === input.locale &&
      pending.some((item) => item.identifier === identifier)
    )
      return;
    if (previous)
      await Notifications.cancelScheduledNotificationAsync(identifier);
    await registerGuestRemindersChannel();
    // Persist before scheduling so a restart recovers the same cycle and deadline.
    await SecureStore.setItemAsync(
      storageKey,
      JSON.stringify({ ...cycle, locale: input.locale })
    );
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: translateDynamic('reminders.onboarding.title', {}, input.locale),
        body: translateDynamic('reminders.onboarding.body', {}, input.locale),
        data: { kind: 'onboarding_resume', cycleId: cycle.cycleId }
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(cycle.dueAt),
        channelId
      }
    });
  });
}

export function consumeGuestOnboardingReminder(
  cycleId: string
): Promise<boolean> {
  return serialize(async () => {
    if (!isMobileAutomationEnabled() || Platform.OS === 'web') return false;
    const cycle = await loadCycle();
    if (!cycle || cycle.consumed || cycle.cycleId !== cycleId) return false;
    await SecureStore.setItemAsync(
      storageKey,
      JSON.stringify({ ...cycle, consumed: true })
    );
    await Notifications.cancelScheduledNotificationAsync(identifier);
    return true;
  });
}

registerRuntimeIdentityReset((context) =>
  serialize(async () => {
    // Signed-out restoration is also the normal guest cold-start path.
    if (context && 'kind' in context && context.kind === 'restore-unavailable') return;
    if (context && 'restoringOwnerId' in context && isMobileAutomationEnabled()) await SecureStore.setItemAsync(accountSeenKey, '1');
    if (isMobileAutomationEnabled() && Platform.OS !== 'web') await cancel();
  })
);
