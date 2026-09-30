import React from 'react';
import {
  act,
  render,
  waitFor,
  screen,
  fireEvent
} from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  MobileIdentityProvider,
  getLiveClerkDisplayName,
  useLiveClerkSessionKey,
  useLiveIdentityStatus
} from './clerk-provider';
import { getClerkInstance } from '@clerk/expo';
import type { LiveClerkBridge } from './auth-service';

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
const mockStartSSOFlow = jest.fn();

it.each(['user-1', 'user-other', null])(
  'only returns the current authenticated owner name for %s',
  (ownerId) => {
    jest
      .mocked(getClerkInstance)
      .mockReturnValue({
        user: { id: 'user-1', fullName: 'Provider Person' }
      } as never);
    expect(getLiveClerkDisplayName(ownerId)).toBe(
      ownerId === 'user-1' ? 'Provider Person' : null
    );
  }
);

jest.mock('@clerk/expo', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  getClerkInstance: jest.fn(),
  useAuth: () => mockUseAuth(),
  useSignIn: () => ({ signIn: {} }),
  useSignUp: () => ({ signUp: {} })
}));
jest.mock('@clerk/expo/experimental', () => ({
  useSSO: () => ({ startSSOFlow: mockStartSSOFlow })
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

it('restores the active Clerk session expiry instead of the short-lived JWT expiry', async () => {
  jest.mocked(getClerkInstance).mockReturnValue({
    user: { id: 'user-1' },
    session: {
      id: 'session-1',
      status: 'active',
      lastActiveAt: new Date(1000),
      expireAt: new Date(4_000_000_000_000)
    }
  } as never);
  render(
    <MobileIdentityProvider>
      <SessionProbe />
    </MobileIdentityProvider>
  );
  const bridge = mockRegisterLiveClerkBridge.mock.calls.at(
    -1
  )![0] as LiveClerkBridge;
  expect(await bridge.getSession()).toMatchObject({
    expiresAt: 4_000_000_000_000
  });
});

it.each(['new', 'existing'] as const)(
  'accepts an SDK-activated %s Google session without activating it twice',
  async (kind) => {
    const setActive = jest.fn();
    jest.mocked(getClerkInstance).mockReturnValue({
      user: { id: 'user-1' },
      setActive,
      session: {
        id: 'session-1',
        status: 'active',
        lastActiveAt: new Date(1000),
        expireAt: new Date(4_000_000_000_000)
      }
    } as never);
    mockStartSSOFlow.mockResolvedValue({
      createdSessionId: kind === 'new' ? 'session-1' : null,
      signIn: {
        status: 'complete',
        existingSession: kind === 'existing' ? { sessionId: 'session-1' } : null
      },
      authSessionResult: { type: 'success' }
    });
    render(
      <MobileIdentityProvider>
        <SessionProbe />
      </MobileIdentityProvider>
    );
    const bridge = mockRegisterLiveClerkBridge.mock.calls.at(
      -1
    )![0] as LiveClerkBridge;
    let session: unknown;
    await act(async () => {
      session = await bridge.signInWithGoogle();
    });
    expect(session).toMatchObject({ id: 'session-1', userId: 'user-1' });
    expect(setActive).not.toHaveBeenCalled();
  }
);

it('does not misclassify incomplete Google registration as cancellation', async () => {
  mockStartSSOFlow.mockResolvedValue({
    createdSessionId: null,
    signUp: { status: 'missing_requirements' },
    authSessionResult: { type: 'success' }
  });
  render(
    <MobileIdentityProvider>
      <SessionProbe />
    </MobileIdentityProvider>
  );
  const bridge = mockRegisterLiveClerkBridge.mock.calls.at(
    -1
  )![0] as LiveClerkBridge;
  await act(async () => {
    await expect(bridge.signInWithGoogle()).rejects.toThrow(
      'googleAuth.incomplete'
    );
  });
});

function StatusProbe() {
  const identity = useLiveIdentityStatus();
  return <Text onPress={identity.retry}>{identity.status}</Text>;
}

it('keeps SSO progress in the identity provider across callback screen remounts and terminates cancellation', async () => {
  let finish!: (value: unknown) => void;
  mockStartSSOFlow.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  const view = render(
    <MobileIdentityProvider>
      <StatusProbe />
    </MobileIdentityProvider>
  );
  const bridge = mockRegisterLiveClerkBridge.mock.calls.at(
    -1
  )![0] as LiveClerkBridge;
  let attempt!: Promise<unknown>;
  act(() => {
    attempt = bridge.signInWithGoogle();
  });
  expect(screen.getByText('sso')).toBeOnTheScreen();
  view.rerender(
    <MobileIdentityProvider>
      <StatusProbe key="callback-return" />
    </MobileIdentityProvider>
  );
  expect(screen.getByText('sso')).toBeOnTheScreen();
  await act(async () => {
    finish({ authSessionResult: { type: 'cancel' } });
    await attempt;
  });
  expect(screen.getByText('cancelled')).toBeOnTheScreen();
});

it('terminates stalled Clerk initialization with a recoverable error', async () => {
  jest.useFakeTimers();
  authState = { ...authState, isLoaded: false };
  jest.mocked(getClerkInstance).mockReturnValue({ status: 'loading' } as never);
  render(
    <MobileIdentityProvider>
      <StatusProbe />
    </MobileIdentityProvider>
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000);
  });
  expect(screen.getByText('error')).toBeOnTheScreen();
  jest.useRealTimers();
});

it('terminates a stalled Clerk startup Retry as well as the first attempt', async () => {
  jest.useFakeTimers();
  authState = { ...authState, isLoaded: false };
  jest.mocked(getClerkInstance).mockReturnValue({
    status: 'loading',
    load: () => new Promise(() => {})
  } as never);
  render(
    <MobileIdentityProvider>
      <StatusProbe />
    </MobileIdentityProvider>
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000);
  });
  fireEvent.press(screen.getByText('error'));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30_000);
  });
  try {
    expect(screen.getByText('error')).toBeOnTheScreen();
  } finally {
    jest.useRealTimers();
  }
});

it.each(['ready', 'degraded'] as const)(
  'retries with Expo native initialization options and reports actual %s SDK status',
  async (status) => {
    authState = { ...authState, isLoaded: false };
    const clerk = {
      status: 'error',
      load: jest.fn(async () => {
        clerk.status = status;
      })
    };
    jest.mocked(getClerkInstance).mockReturnValue(clerk as never);
    render(
      <MobileIdentityProvider>
        <StatusProbe />
      </MobileIdentityProvider>
    );
    fireEvent.press(screen.getByText('error'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(clerk.load).toHaveBeenCalledWith(
      expect.objectContaining({
        standardBrowser: false,
        experimental: expect.objectContaining({
          runtimeEnvironment: 'headless'
        })
      })
    );
    expect(
      screen.getByText(status === 'ready' ? 'ready' : 'error')
    ).toBeOnTheScreen();
  }
);
