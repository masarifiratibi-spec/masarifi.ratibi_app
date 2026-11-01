import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { readRecoveryNetwork } from '@/services/platform/read-recovery-network';

import RootLayout from '@app/_layout';
import AccountsLayout from '@app/accounts/_layout';
import AssistantLayout from '@app/assistant/_layout';
import ProfileLayout from '@app/profile/_layout';
import SecurityLayout from '@app/security/_layout';
import { useAppShellStore } from '@/state/app-shell';

const mockStack = jest.fn((_props: unknown) => null);
const mockShellRender = jest.fn();
const mockPrivacyProps = jest.fn();
let mockFontsReady = true;
let mockPathname = '/(public)/legal';
const mockPathListeners = new Set<() => void>();

jest.mock('expo-router', () => ({
  Stack: (props: unknown) => mockStack(props),
  usePathname: () => {
    const React = jest.requireActual('react');
    return React.useSyncExternalStore(
      (listener: () => void) => {
        mockPathListeners.add(listener);
        return () => mockPathListeners.delete(listener);
      },
      () => mockPathname
    );
  }
}));

jest.mock('@/design-system/typography', () => ({
  ...jest.requireActual('@/design-system/typography'),
  FontGate: ({ children }: { children: React.ReactNode }) =>
    mockFontsReady ? <>{children}</> : null
}));

jest.mock('@/services/platform/read-recovery-network', () => ({
  readRecoveryNetwork: {
    available: false,
    isOnline: jest.fn(async () => false)
  }
}));

jest.mock('@/state/FoundationProviders', () => {
  const { QueryClient, QueryClientProvider } = jest.requireActual(
    '@tanstack/react-query'
  );
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } }
  });
  return {
    FoundationProviders: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
  };
});

jest.mock('@/state/AppShellProvider', () => ({
  AppShellProvider: ({ children }: { children: React.ReactNode }) => {
    mockShellRender();
    return <>{children}</>;
  }
}));

jest.mock('@/features/security/AppPrivacyGate', () => ({
  AppPrivacyGate: ({ children, ...props }: { children: React.ReactNode }) => {
    mockPrivacyProps(props);
    return <>{children}</>;
  }
}));

jest.mock('@/features/shell/ProtectedRouteGate', () => ({
  NotificationResponseRuntime: () => null,
  ProtectedRouteGate: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  )
}));

describe('RootLayout navigation chrome', () => {
  beforeEach(() => {
    mockStack.mockClear();
    mockShellRender.mockClear();
    mockPrivacyProps.mockClear();
    mockFontsReady = true;
    readRecoveryNetwork.available = false;
    mockPathname = '/(public)/legal';
  });

  it('shows the real root connectivity dialog before fonts or protected routes can mount', async () => {
    const previousState = AppState.currentState;
    AppState.currentState = 'active';
    readRecoveryNetwork.available = true;
    mockFontsReady = false;
    try {
      render(<RootLayout />);
      await act(async () => {});
      expect(screen.getByRole('alert')).toHaveTextContent(
        /أنت غير متصل بالإنترنت/
      );
      expect(mockStack).not.toHaveBeenCalled();
    } finally {
      AppState.currentState = previousState;
    }
  });

  it('updates route privacy without rerendering the global shell', () => {
    useAppShellStore.setState({
      privacyLock: {
        enabled: true,
        autoLockDuration: 'immediate',
        appLockStatus: 'locked'
      } as never
    });
    render(<RootLayout />);
    expect(mockPrivacyProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ immediate: true, locked: true })
    );
    const initialRenders = mockShellRender.mock.calls.length;
    act(() => {
      mockPathname = '/security/unlock';
      mockPathListeners.forEach((listener) => listener());
    });
    expect(mockShellRender).toHaveBeenCalledTimes(initialRenders);
    expect(mockPrivacyProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ immediate: false, locked: false })
    );
    act(() => useAppShellStore.setState({ privacyLock: null }));
  });

  it('does not expose Expo route group names as screen headers', () => {
    render(<RootLayout />);

    expect(mockStack).toHaveBeenCalledWith(
      expect.objectContaining({
        screenOptions: expect.objectContaining({ headerShown: false })
      })
    );
  });

  it.each([
    ['accounts', AccountsLayout],
    ['assistant', AssistantLayout],
    ['profile', ProfileLayout],
    ['security', SecurityLayout]
  ])(
    'does not expose nested %s route filenames as headers',
    (_name, Layout) => {
      render(<Layout />);

      expect(mockStack).toHaveBeenCalledWith(
        expect.objectContaining({
          screenOptions: { headerShown: false }
        })
      );
    }
  );
});
