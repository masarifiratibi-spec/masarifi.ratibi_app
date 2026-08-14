export const appShellEventNames = [
  'app_shell.auth',
  'app_shell.onboarding',
  'app_shell.permission',
  'app_shell.navigation',
  'app_shell.security'
] as const;

export type AppShellEventName = (typeof appShellEventNames)[number];
export type AppShellEventPayload = Record<string, string | number | boolean | null>;

export interface AppShellEvent {
  readonly name: AppShellEventName;
  readonly payload: Readonly<AppShellEventPayload>;
  readonly recordedAt: number;
}

const sensitiveKeyPattern = /phone|otp|pin|message|account|identifier|amount|balance|transaction|transcript|question|answer|support|credential|rawError/i;

export function createAppShellEvent(
  name: AppShellEventName,
  payload: AppShellEventPayload = {}
): AppShellEvent {
  for (const key of Object.keys(payload)) {
    if (sensitiveKeyPattern.test(key)) {
      throw new Error('Sensitive analytics payload');
    }
  }
  return Object.freeze({ name, payload: Object.freeze({ ...payload }), recordedAt: Date.now() });
}

export function recordAppShellEvent(_event: AppShellEvent): true {
  return true;
}
