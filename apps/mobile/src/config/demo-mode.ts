export function isDemoModeEnabled(
  value = process.env.EXPO_PUBLIC_DEMO_MODE
): boolean {
  return value === '1';
}

export function isFixtureModeEnabled(
  nodeEnv = process.env.NODE_ENV,
  demoMode = isDemoModeEnabled()
): boolean {
  return nodeEnv === 'test' || demoMode;
}
