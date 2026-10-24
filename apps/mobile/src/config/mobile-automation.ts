import Constants from 'expo-constants';
import { resolveClientRuntime } from './client-runtime';

export function isMobileAutomationEnabled(
  apiUrl?: string,
  environment: Record<string, string | undefined> = {
    EXPO_PUBLIC_MOBILE_AUTOMATION_ENABLED:
      process.env.EXPO_PUBLIC_MOBILE_AUTOMATION_ENABLED,
    EXPO_PUBLIC_APP_VARIANT: process.env.EXPO_PUBLIC_APP_VARIANT,
    EXPO_PUBLIC_CLIENT_MODE: process.env.EXPO_PUBLIC_CLIENT_MODE,
    EXPO_PUBLIC_DEMO_MODE: process.env.EXPO_PUBLIC_DEMO_MODE,
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
  }
): boolean {
  if (
    environment.EXPO_PUBLIC_MOBILE_AUTOMATION_ENABLED !== 'true' ||
    environment.EXPO_PUBLIC_APP_VARIANT === 'staging-development-privacy' ||
    !['com.masarifi.mobile.dev', 'com.masarifi.mobile'].includes(
      Constants.expoConfig?.android?.package ?? ''
    )
  )
    return false;
  try {
    const runtime = resolveClientRuntime(environment);
    return (
      runtime.mode === 'live' &&
      (apiUrl === undefined || apiUrl.replace(/\/$/, '') === runtime.apiUrl)
    );
  } catch {
    return false;
  }
}
