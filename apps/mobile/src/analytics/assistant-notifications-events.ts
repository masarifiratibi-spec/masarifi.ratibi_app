export const assistantNotificationsEventNames = [
  'assistant_notifications.notification',
  'assistant_notifications.assistant',
  'assistant_notifications.subscription',
  'assistant_notifications.settings',
  'assistant_notifications.support'
] as const;

export type AssistantNotificationsEventName =
  (typeof assistantNotificationsEventNames)[number];

export const assistantNotificationsPropertyNames = ['category', 'outcome'] as const;
export type AssistantNotificationsPropertyName =
  (typeof assistantNotificationsPropertyNames)[number];

export const assistantNotificationsCategories = [
  'notification',
  'assistant',
  'subscription',
  'settings',
  'support'
] as const;
export const assistantNotificationsOutcomes = [
  'opened',
  'viewed',
  'enabled',
  'disabled',
  'submitted',
  'completed',
  'cancelled',
  'failed'
] as const;

export type AssistantNotificationsEventPayload = Partial<{
  category: (typeof assistantNotificationsCategories)[number];
  outcome: (typeof assistantNotificationsOutcomes)[number];
}>;

export interface AssistantNotificationsEvent {
  readonly name: AssistantNotificationsEventName;
  readonly payload: Readonly<AssistantNotificationsEventPayload>;
  readonly recordedAt: number;
}

const sensitiveKeyPattern = /amount|minor|currency|title|body|question|answer|snapshot|context|source|id|email|phone|contact|ticket|subject|description|message|pin|credential|token|secret|password/i;

export function createAssistantNotificationsEvent(
  name: AssistantNotificationsEventName,
  payload: AssistantNotificationsEventPayload = {}
): AssistantNotificationsEvent {
  if (
    !assistantNotificationsEventNames.includes(name) ||
    Object.entries(payload).some(
      ([key, value]) =>
        sensitiveKeyPattern.test(key) ||
        !assistantNotificationsPropertyNames.includes(key as AssistantNotificationsPropertyName) ||
        typeof value !== 'string' ||
        (key === 'category' && !assistantNotificationsCategories.includes(value as never)) ||
        (key === 'outcome' && !assistantNotificationsOutcomes.includes(value as never))
    )
  ) {
    throw new Error('Sensitive analytics payload');
  }
  const safePayload: AssistantNotificationsEventPayload = {};
  if (payload.category) safePayload.category = payload.category;
  if (payload.outcome) safePayload.outcome = payload.outcome;
  return Object.freeze({
    name,
    payload: Object.freeze(safePayload),
    recordedAt: Date.now()
  });
}
