import Constants from 'expo-constants';
import { isMobileAutomationEnabled } from './mobile-automation';
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { android: { package: 'com.masarifi.mobile.dev' } } }
}));
const before = { ...process.env };
afterEach(() => {
  process.env = { ...before };
});
it.each(['com.masarifi.mobile.dev', 'com.masarifi.mobile'])(
  'enables any user only in a configured live supported package %s',
  (packageName) => {
    const env: Record<string, string | undefined> = { ...process.env };
    env.EXPO_PUBLIC_MOBILE_AUTOMATION_ENABLED = 'true';
    env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
    env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_live_bWFzYXJpZmkudGVzdCQ';
    Constants.expoConfig!.android!.package = packageName;
    expect(isMobileAutomationEnabled('https://api.example.test', env)).toBe(
      true
    );
    expect(isMobileAutomationEnabled('https://evil.example.test', env)).toBe(
      false
    );
    env.EXPO_PUBLIC_MOBILE_AUTOMATION_ENABLED = 'false';
    expect(isMobileAutomationEnabled(undefined, env)).toBe(false);
    env.EXPO_PUBLIC_MOBILE_AUTOMATION_ENABLED = 'true';
    env.EXPO_PUBLIC_APP_VARIANT = 'staging-development-privacy';
    expect(isMobileAutomationEnabled(undefined, env)).toBe(false);
    delete env.EXPO_PUBLIC_APP_VARIANT;
    env.EXPO_PUBLIC_CLIENT_MODE = 'demo';
    expect(isMobileAutomationEnabled(undefined, env)).toBe(false);
    env.EXPO_PUBLIC_CLIENT_MODE = 'live';
    Constants.expoConfig!.android!.package = 'com.masarifi.mobile.dev.privacy';
    expect(isMobileAutomationEnabled(undefined, env)).toBe(false);
  }
);
