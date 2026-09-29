import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

import {
  MobileIdentityProvider,
  useLiveClerkSessionKey
} from './clerk-provider';

let authState = {
  getToken: jest.fn(),
  isLoaded: true,
  isSignedIn: true,
  sessionClaims: { exp: 2, iat: 1 },
  sessionId: 'session-1',
  signOut: jest.fn(),
  userId: 'user-1'
};
const mockUseAuth = jest.fn(() => authState);
const mockRegisterLiveClerkBridge = jest.fn();

jest.mock('@clerk/expo', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  getClerkInstance: jest.fn(),
  useAuth: () => mockUseAuth(),
  useSignIn: () => ({ signIn: {} }),
  useSignUp: () => ({ signUp: {} })
}));
jest.mock('@clerk/expo/experimental', () => ({
  useSSO: () => ({ startSSOFlow: jest.fn() })
}));
jest.mock('@/config/client-runtime', () => ({
  resolveClientRuntime: () => ({
    clerkPublishableKey: 'pk_test_staging',
    mode: 'live'
  })
}));
jest.mock('./auth-service', () => ({
  registerLiveClerkBridge: (bridge: unknown) =>
    mockRegisterLiveClerkBridge(bridge)
}));

function SessionProbe() {
  useLiveClerkSessionKey();
  return null;
}

beforeEach(() => {
  jest.clearAllMocks();
  authState = {
    getToken: jest.fn(),
    isLoaded: true,
    isSignedIn: true,
    sessionClaims: { exp: 2, iat: 1 },
    sessionId: 'session-1',
    signOut: jest.fn(),
    userId: 'user-1'
  };
});

it('synchronizes a stable Clerk session without another state update pass', async () => {
  const rendered = render(
    <MobileIdentityProvider>
      <SessionProbe />
    </MobileIdentityProvider>
  );

  await waitFor(() => expect(mockUseAuth).toHaveBeenCalledTimes(2));
  rendered.rerender(
    <MobileIdentityProvider>
      <SessionProbe />
    </MobileIdentityProvider>
  );
  await act(async () => Promise.resolve());

  expect(mockUseAuth).toHaveBeenCalledTimes(3);
  expect(mockRegisterLiveClerkBridge).toHaveBeenCalledTimes(1);
});

it('reinstalls the bridge once when the Clerk session identity changes', async () => {
  const rendered = render(
    <MobileIdentityProvider>
      <SessionProbe />
    </MobileIdentityProvider>
  );
  await waitFor(() =>
    expect(mockRegisterLiveClerkBridge).toHaveBeenCalledTimes(1)
  );

  authState = { ...authState, sessionId: 'session-2' };
  rendered.rerender(
    <MobileIdentityProvider>
      <SessionProbe />
    </MobileIdentityProvider>
  );
  await waitFor(() =>
    expect(mockRegisterLiveClerkBridge).toHaveBeenCalledTimes(2)
  );

  rendered.rerender(
    <MobileIdentityProvider>
      <SessionProbe />
    </MobileIdentityProvider>
  );
  await act(async () => Promise.resolve());
  expect(mockRegisterLiveClerkBridge).toHaveBeenCalledTimes(2);
});
