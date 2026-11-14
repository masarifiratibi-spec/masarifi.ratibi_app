export function validTimeZone(
  value: string | null | undefined
): value is string {
  if (!value?.trim()) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function resolveEffectiveTimeZone(
  profileZone?: string | null,
  deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone
): string {
  if (validTimeZone(profileZone)) return profileZone;
  if (validTimeZone(deviceZone)) return deviceZone;
  throw new Error('TIMEZONE_SELECTION_REQUIRED');
}
