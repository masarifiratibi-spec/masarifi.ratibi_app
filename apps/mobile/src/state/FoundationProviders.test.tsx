import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, Pressable, Text } from 'react-native';
import { QueryClient } from '@tanstack/react-query';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { resolveTheme } from '@/design-system/theme';
import { usePreferenceStore } from '@/state/preferences';
import { FoundationProviders } from './FoundationProviders';
import { VoiceAnalysisResults } from '@/features/voice/VoiceAnalysisResults';
import { useAppShellStore } from '@/state/app-shell';
import { publishTrackingSave } from '@/services/tracking-save-events';
import type { ProfileSetupSnapshot, UserProfile } from '@/domain/settings';
import {
  resetRuntimeIdentityData,
  resetRuntimeUserData
} from '@/storage/runtime-user-data-reset';

const mockNavigationTheme = jest.fn();
let mockPathname = '/';
let mockSystemScheme: 'light' | 'dark' = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockSystemScheme
}));

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname
}));

jest.mock('@react-navigation/native', () => ({
  DefaultTheme: {
    fonts: {
      bold: { fontFamily: 'System', fontWeight: '700' },
      heavy: { fontFamily: 'System', fontWeight: '900' },
      medium: { fontFamily: 'System', fontWeight: '500' },
      regular: { fontFamily: 'System', fontWeight: '400' }
    }
  },
  ThemeProvider: ({
    children,
    value
  }: {
    children: React.ReactNode;
    value: unknown;
  }) => {
    mockNavigationTheme(value);
    return <>{children}</>;
  }
}));

beforeEach(() => {
  mockPathname = '/';
  mockSystemScheme = 'light';
  usePreferenceStore.setState({ theme: 'system' });
});

it('reuses the validated bootstrap profile and does not overwrite a newer profile query', async () => {
  usePreferenceStore.setState({ hydrated: true });
  useAppShellStore.setState({
    session: { status: 'authenticated', userId: 'bootstrap-owner' } as never,
    profileSetupSnapshot: null,
    profileSetupStatus: 'loading'
  });
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity } }
  });
  const profile = {
    name: 'Bootstrap name',
    currency: 'SAR',
    version: 2
  } as UserProfile;
  const snapshot = { complete: true, profile } as ProfileSetupSnapshot;
  const view = render(
    <FoundationProviders client={client}>
      <></>
    </FoundationProviders>
  );
  try {
    act(() =>
      useAppShellStore.getState().setProfileSetup('complete', snapshot)
    );
    const fetchProfile = jest.fn(async () => ({
      ...profile,
      name: 'Redundant fetch'
    }));
    await expect(
      client.fetchQuery({
        queryKey: ['settings', 'profile'],
        queryFn: fetchProfile
      })
    ).resolves.toEqual(profile);
    expect(fetchProfile).not.toHaveBeenCalled();
    client.setQueryData(['settings', 'profile'], {
      ...profile,
      name: 'Newer name',
      version: 3
    });
    act(() =>
      useAppShellStore.getState().setProfileSetup('complete', { ...snapshot })
    );
    expect(client.getQueryData(['settings', 'profile'])).toMatchObject({
      name: 'Newer name',
      version: 3
    });

    client.removeQueries({ queryKey: ['settings', 'profile'] });
    act(() => useAppShellStore.setState({ pendingDestination: '/accounts' }));
    expect(client.getQueryData(['settings', 'profile'])).toBeUndefined();
  } finally {
    view.unmount();
    client.clear();
    useAppShellStore.setState({
      session: null,
      profileSetupSnapshot: null,
      profileSetupStatus: 'unknown'
    });
  }
});

it('does not seed profile data from an unverified or signed out snapshot', () => {
  usePreferenceStore.setState({ hydrated: true });
  const client = new QueryClient();
  const view = render(
    <FoundationProviders client={client}>
      <></>
    </FoundationProviders>
  );
  try {
    const snapshot = {
      profile: { name: 'Unverified', version: 1 }
    } as ProfileSetupSnapshot;
    act(() =>
      useAppShellStore.setState({
        session: null,
        profileSetupStatus: 'complete',
        profileSetupSnapshot: snapshot
      })
    );
    expect(client.getQueryData(['settings', 'profile'])).toBeUndefined();
    act(() =>
      useAppShellStore.setState({
        session: { status: 'authenticated', userId: 'owner' } as never,
        profileSetupStatus: 'error',
        profileSetupSnapshot: { ...snapshot }
      })
    );
    expect(client.getQueryData(['settings', 'profile'])).toBeUndefined();
  } finally {
    view.unmount();
    client.clear();
    useAppShellStore.setState({
      session: null,
      profileSetupSnapshot: null,
      profileSetupStatus: 'unknown'
    });
  }
});

it('invalidates only the current owner financial reads after a tracking receipt', async () => {
  usePreferenceStore.setState({ hydrated: true });
  useAppShellStore.setState({
    session: { status: 'authenticated', userId: 'owner' } as never
  });
  const client = new QueryClient();
  const home = ['core-finance', 'home', 'SAR'];
  const settings = ['settings', 'profile'];
  const categories = ['core-finance', 'categories', false];
  const draft = ['planning', 'draft', 'salary'];
  const history = ['reports', 'history'];
  for (const key of [home, settings, categories, draft, history])
    client.setQueryData(key, { ready: true });
  const view = render(
    <FoundationProviders client={client}>
      <></>
    </FoundationProviders>
  );
  try {
    await act(async () =>
      publishTrackingSave({ ownerId: 'other', transactionIds: ['t'] })
    );
    expect(client.getQueryState(home)?.isInvalidated).toBe(false);
    await act(async () =>
      publishTrackingSave({ ownerId: 'owner', transactionIds: ['t'] })
    );
    expect(client.getQueryState(home)?.isInvalidated).toBe(true);
    expect(client.getQueryState(history)?.isInvalidated).toBe(true);
    for (const key of [settings, categories, draft])
      expect(client.getQueryState(key)?.isInvalidated).toBe(false);
  } finally {
    view.unmount();
    client.clear();
  }
});

it('applies an explicit dark override to nested navigators', () => {
  usePreferenceStore.setState({ hydrated: true, theme: 'dark' });

  render(
    <FoundationProviders>
      <></>
    </FoundationProviders>
  );

  const colors = resolveTheme('dark', 'light').colors;
  expect(mockNavigationTheme).toHaveBeenLastCalledWith(
    expect.objectContaining({
      dark: true,
      colors: expect.objectContaining({
        background: colors.surfaces.page,
        card: colors.surfaces.card,
        text: colors.content.primary
      })
    })
  );
});

it('follows live OS theme changes while preserving a saved app override', () => {
  usePreferenceStore.setState({ hydrated: true, theme: 'system' });
  const view = render(
    <FoundationProviders>
      <Text>Theme probe</Text>
    </FoundationProviders>
  );
  expect(mockNavigationTheme).toHaveBeenLastCalledWith(
    expect.objectContaining({ dark: false })
  );
  mockSystemScheme = 'dark';
  view.rerender(
    <FoundationProviders>
      <Text>Theme probe</Text>
    </FoundationProviders>
  );
  expect(mockNavigationTheme).toHaveBeenLastCalledWith(
    expect.objectContaining({ dark: true })
  );
  act(() => usePreferenceStore.getState().setTheme('light'));
  expect(mockNavigationTheme).toHaveBeenLastCalledWith(
    expect.objectContaining({ dark: false })
  );
  view.unmount();
});

it('uses the obligation reference color behind the safe area on detail routes', () => {
  mockPathname = '/obligations/obligation-1';

  render(
    <SafeAreaInsetsContext.Provider
      value={{ bottom: 0, left: 0, right: 0, top: 24 }}
    >
      <FoundationProviders>
        <></>
      </FoundationProviders>
    </SafeAreaInsetsContext.Provider>
  );

  expect(
    screen.UNSAFE_getByProps({ pointerEvents: 'none' }).props.style
  ).toEqual(
    expect.objectContaining({
      backgroundColor: resolveTheme('light').colors.horizon.referenceStart,
      height: 24,
      position: 'absolute',
      top: 0
    })
  );
});

it('uses the web-safe writing direction without passing direction as a style', () => {
  const originalPlatform = Platform.OS;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  usePreferenceStore.setState({
    direction: 'rtl',
    hydrated: true,
    locale: 'ar'
  });

  try {
    render(
      <FoundationProviders>
        <></>
      </FoundationProviders>
    );

    expect(screen.getByTestId('foundation-direction-root')).toHaveStyle({
      writingDirection: 'rtl'
    });
    expect(screen.getByTestId('foundation-direction-root')).not.toHaveStyle({
      direction: 'rtl'
    });
  } finally {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform
    });
  }
});

it('preserves a child state while changing locale direction', () => {
  usePreferenceStore.setState({
    direction: 'ltr',
    hydrated: true,
    locale: 'en'
  });

  function StatefulChild() {
    const [count, setCount] = React.useState(0);

    return (
      <Pressable
        testID="stateful-child"
        onPress={() => setCount((value) => value + 1)}
      >
        <Text testID="stateful-child-count">{count}</Text>
      </Pressable>
    );
  }

  render(
    <FoundationProviders>
      <StatefulChild />
    </FoundationProviders>
  );

  fireEvent.press(screen.getByTestId('stateful-child'));
  act(() => {
    void usePreferenceStore.getState().setLocale('ar');
  });

  expect(screen.getByTestId('foundation-direction-root')).toHaveStyle({
    direction: 'rtl'
  });
  expect(screen.getByTestId('stateful-child-count')).toHaveTextContent('1');
});

it('clears cached user data when runtime user data resets', () => {
  const client = new QueryClient();
  client.setQueryData(['accounts', 'list'], [{ id: 'account-1' }]);

  render(
    <FoundationProviders client={client}>
      <></>
    </FoundationProviders>
  );

  resetRuntimeUserData();

  expect(client.getQueryData(['accounts', 'list'])).toBeUndefined();
});

it('keeps an unsaved voice result visible when switching language without refreshing', () => {
  usePreferenceStore.setState({
    hydrated: true,
    locale: 'en',
    direction: 'ltr'
  });
  useAppShellStore.setState({
    session: {
      status: 'authenticated',
      userId: 'voice-owner',
      method: 'phone',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600_000,
      restoration: 'restored'
    }
  });
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } }
  });
  client.setQueryData(
    ['voice-analysis', 'voice-owner'],
    [
      {
        sessionId: '11111111-1111-4111-8111-111111111111',
        batchId: '22222222-2222-4222-8222-222222222222',
        status: 'completed',
        addedCount: 0,
        transactionIds: [],
        ledgerVersion: 0,
        analysis: {
          mode: 'analysis_only',
          persisted: false,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          events: [
            {
              ordinal: 0,
              kind: 'expense',
              amountMinor: 2500,
              currency: 'SAR',
              accountId: '33333333-3333-4333-8333-333333333333',
              categoryId: null,
              title: 'Breakfast',
              merchant: null,
              occurredAt: '2026-10-05T09:00:00.000Z'
            }
          ]
        }
      }
    ]
  );
  client.setQueryData(['accounts', 'list'], [{ id: 'account-1' }]);
  render(
    <FoundationProviders client={client}>
      <VoiceAnalysisResults />
    </FoundationProviders>
  );
  expect(screen.getByText('Breakfast')).toBeVisible();
  act(() => {
    void usePreferenceStore.getState().setLocale('ar');
  });
  expect(client.getQueryData(['voice-analysis', 'voice-owner'])).toHaveLength(
    1
  );
  expect(screen.getByText('Breakfast')).toBeVisible();
  expect(client.getQueryData(['accounts', 'list'])).toBeUndefined();
  act(() => {
    void usePreferenceStore.getState().setLocale('en');
  });
  expect(screen.getByText('Breakfast')).toBeVisible();
  act(() => {
    resetRuntimeUserData();
  });
  expect(
    client.getQueryData(['voice-analysis', 'voice-owner'])
  ).toBeUndefined();
  useAppShellStore.setState({ session: null });
});

it('clears cached user data when the authenticated identity changes', async () => {
  const client = new QueryClient();
  client.setQueryData(['accounts', 'list'], [{ id: 'account-1' }]);
  client.setQueryData(
    ['voice-analysis', 'voice-owner'],
    [{ sessionId: 'session-1' }]
  );

  render(
    <FoundationProviders client={client}>
      <></>
    </FoundationProviders>
  );

  await resetRuntimeIdentityData();

  expect(client.getQueryData(['accounts', 'list'])).toBeUndefined();
  expect(
    client.getQueryData(['voice-analysis', 'voice-owner'])
  ).toBeUndefined();
});
