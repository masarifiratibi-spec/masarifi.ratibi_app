export function isDemoModeEnabled(
  value = process.env.EXPO_PUBLIC_DEMO_MODE
): boolean {
  return value === '1';
}
