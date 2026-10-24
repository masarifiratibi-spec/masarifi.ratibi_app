import '@testing-library/jest-native/extend-expect';
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import { changeLocale } from '@/localization/i18n';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
// The native Clerk SDK opens MessagePorts at import time. Offline UI tests use
// an inert SDK boundary; provider tests supply their own explicit auth responses.
jest.mock('@clerk/expo', () => {
  const auth = {
    isLoaded: true,
    isSignedIn: false,
    sessionId: null,
    userId: null,
    sessionClaims: null,
    getToken: jest.fn(async () => null),
    signOut: jest.fn(async () => undefined)
  };
  return {
    ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
    getClerkInstance: jest.fn(() => ({ user: null })),
    useAuth: jest.fn(() => auth),
    useSignIn: jest.fn(() => ({ isLoaded: true, signIn: null })),
    useSignUp: jest.fn(() => ({ isLoaded: true, signUp: null }))
  };
});
jest.mock('@clerk/expo/experimental', () => ({
  useSSO: () => ({
    startSSOFlow: jest.fn(async () => {
      throw new Error('Clerk SSO unavailable in offline tests');
    })
  })
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: jest.fn(() => ({ dispatch: jest.fn() })),
  usePreventRemove: jest.fn()
}));

beforeEach(() => {
  const expoRouter =
    jest.requireMock<typeof import('expo-router')>('expo-router');
  expoRouter.usePathname ??= jest.fn(() => '/');
});

afterEach(() => changeLocale('ar'));

// React Native's setup happens via jest-expo preset. This file adds only the
// shared matchers and test-environment adjustments consumed by the foundation
// suite. The mobile Intl implementation under Node 20+ is sufficient for the
// locale-aware number and currency formatting used by the foundation, so no
// polyfill is required.
