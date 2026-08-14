import type {
  NotificationEvent,
  NotificationPermissionState,
  NotificationPreferences
} from '@/domain/notifications';

export type NotificationPolicyOutcome =
  | 'present_local'
  | 'suppress_category'
  | 'suppress_phone_disabled'
  | 'suppress_permission'
  | 'suppress_private'
  | 'defer_quiet_hours'
  | 'include_daily_summary'
  | 'include_weekly_summary';

export function decideNotificationPolicy({
  event,
  preferences,
  permission,
  now,
  hideBalances,
  summaryWindow = 'none',
  summarizedEventKeys = []
}: {
  event: NotificationEvent;
  preferences: NotificationPreferences;
  permission: NotificationPermissionState;
  now: number;
  hideBalances: boolean;
  summaryWindow?: 'none' | 'daily' | 'weekly';
  summarizedEventKeys?: readonly string[];
}) {
  const hideSensitiveValues =
    hideBalances ||
    event.sensitivity === 'security_sensitive' ||
    (event.sensitivity === 'protected' && preferences.hideAmountsOnLockScreen);
  if (!preferences.categoryEnabled[event.category])
    return result('suppress_category', hideSensitiveValues);
  if (permission !== 'granted') return result('suppress_permission', hideSensitiveValues);
  if (!preferences.phoneEnabled) return result('suppress_phone_disabled', hideSensitiveValues);
  if (event.sensitivity === 'security_sensitive' && hideSensitiveValues)
    return result('suppress_private', true);
  if (summarizedEventKeys.includes(event.eventKey)) {
    return {
      ...result(summaryWindow === 'weekly' ? 'include_weekly_summary' : 'include_daily_summary', hideSensitiveValues),
      deduplicated: true
    };
  }
  if (isQuietNow(preferences.quietHours, now) && !isCriticalAccess(event)) {
    if (summaryWindow === 'daily' && preferences.dailySummary.enabled)
      return result('include_daily_summary', hideSensitiveValues);
    if (summaryWindow === 'weekly' && preferences.weeklySummary.enabled)
      return result('include_weekly_summary', hideSensitiveValues);
    return result('defer_quiet_hours', hideSensitiveValues);
  }
  if (summaryWindow === 'daily' && preferences.dailySummary.enabled)
    return result('include_daily_summary', hideSensitiveValues);
  if (summaryWindow === 'weekly' && preferences.weeklySummary.enabled)
    return result('include_weekly_summary', hideSensitiveValues);
  return result('present_local', hideSensitiveValues);
}

export function rewritePhoneCopy(
  event: NotificationEvent,
  { hideSensitiveValues }: { hideSensitiveValues: boolean }
) {
  return {
    titleKey: event.titleKey,
    bodyKey: event.bodyKey,
    messageValues: hideSensitiveValues
      ? Object.fromEntries(
          Object.keys(event.messageValues).map((key) => [key, 'hidden'])
        )
      : event.messageValues,
    accessibilityLabelKey: event.bodyKey,
    actionLabelKeys: event.availableActions.map(
      (action) => `notifications.actions.${action.kind}`
    )
  };
}

function result(outcome: NotificationPolicyOutcome, hideSensitiveValues = false) {
  return { inApp: true, outcome, hideSensitiveValues };
}

function isCriticalAccess(event: NotificationEvent) {
  return (
    event.category === 'security' &&
    ['new_session', 'session_revoked', 'access_protection_changed'].includes(
      event.eventType
    )
  );
}

function isQuietNow(
  quietHours: NotificationPreferences['quietHours'],
  now: number
) {
  if (!quietHours.enabled) return false;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: quietHours.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false
  }).formatToParts(new Date(now));
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  const weekdayName = parts.find((part) => part.type === 'weekday')?.value ?? 'Sun';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
    weekdayName
  );
  const current = hour * 60 + minute;
  const start = minutes(quietHours.start);
  const end = minutes(quietHours.end);
  const activeWeekday =
    start > end && current < end ? (weekday + 6) % 7 : weekday;
  if (!quietHours.weekdays.includes(activeWeekday)) return false;
  return start <= end ? current >= start && current < end : current >= start || current < end;
}

function minutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}
