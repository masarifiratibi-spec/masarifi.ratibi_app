import React from 'react';
import { AppState, Linking, Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { AppShellProvider } from './AppShellProvider';
import { useAppShellStore } from './app-shell';
import { usePreferenceStore } from './preferences';

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn()
}));

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() }
}));

describe('AppShellProvider', () => {
  beforeEach(() => {
    useAppShellStore.getState().reset();
    usePreferenceStore.setState({ locale: 'en', direction: 'ltr' });
    jest.clearAllMocks();
  });

  it('always renders children on first render so the navigator mounts immediately', () => {
    // Before hydration, children must still render. The entry route — not the
    // provider — owns the loading gate, so the Expo Router Stack is never
    // unmounted (which previously caused "navigate before mounting Root Layout").
    useAppShellStore.setState({ hydrated: false });
    const hydrate = jest
      .spyOn(useAppShellStore.getState(), 'hydrate')
      .mockResolvedValue(undefined);
    render(
      <AppShellProvider>
        <ProtectedContent />
      </AppShellProvider>
    );

    expect(screen.getByText('protected child')).toBeOnTheScreen();
    hydrate.mockRestore();
  });

  it('triggers hydration once when not yet hydrated', async () => {
    const hydrate = jest
      .spyOn(useAppShellStore.getState(), 'hydrate')
      .mockResolvedValue(undefined);

    render(
      <AppShellProvider>
        <ProtectedContent />
      </AppShellProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(hydrate).toHaveBeenCalledTimes(1);
  });

  it('forwards app state changes and preserves locale preferences', async () => {
    let listener: ((state: string) => void) | null = null;
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, callback) => {
        listener = callback as (state: string) => void;
        return { remove: jest.fn() };
      });
    useAppShellStore.setState({ hydrated: true });
    const onAppStateChange = jest.fn();

    render(
      <AppShellProvider onAppStateChange={onAppStateChange}>
        <ProtectedContent />
      </AppShellProvider>
    );
    const emitAppState = listener as ((state: string) => void) | null;
    emitAppState?.('background');

    expect(onAppStateChange).toHaveBeenCalledWith('background');
    expect(usePreferenceStore.getState()).toMatchObject({
      locale: 'en',
      direction: 'ltr'
    });
  });

  it('retains only a safe initial deep-link destination across authentication gates', async () => {
    jest
      .spyOn(Linking, 'getInitialURL')
      .mockResolvedValue('masarifi://reports');
    useAppShellStore.setState({ hydrated: true });

    render(
      <AppShellProvider>
        <ProtectedContent />
      </AppShellProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(useAppShellStore.getState().pendingDestination).toBe(
      '/(tabs)/reports'
    );
  });

  it('opens a safe runtime deep link through the current access gate', async () => {
    let linkListener: ((event: { url: string }) => void) | null = null;
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest
      .spyOn(Linking, 'addEventListener')
      .mockImplementation((_type, listener) => {
        linkListener = listener;
        return { remove: jest.fn() } as never;
      });
    useAppShellStore.setState({
      hydrated: true,
      session: {
        status: 'authenticated',
        userId: 'user-1',
        method: 'google',
        issuedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        restoration: 'restored'
      },
      onboarding: null,
      privacyLock: null
    });

    render(
      <AppShellProvider>
        <ProtectedContent />
      </AppShellProvider>
    );
    await act(async () => {
      linkListener?.({ url: 'masarifi://tracking' });
      await Promise.resolve();
    });

    expect(router.replace).toHaveBeenCalledWith('/tracking');
  });
});

function ProtectedContent() {
  return <Text>protected child</Text>;
}
