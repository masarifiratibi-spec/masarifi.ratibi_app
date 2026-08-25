import React from 'react';
import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import AuthRequiredRoute from '@app/modals/auth-required';
import { changeLocale, translate } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    replace: jest.fn()
  }
}));

describe('AuthRequiredRoute', () => {
  beforeEach(() => {
    changeLocale('en');
    jest.clearAllMocks();
    useAppShellStore.setState({
      pendingDestination: '/reports',
      setPendingDestination: jest.fn(async () => undefined)
    });
  });

  it('stores a safe pending destination before navigating to sign in', async () => {
    const setPendingDestination = jest.fn(async () => undefined);
    useAppShellStore.setState({ setPendingDestination });
    const screen = renderWithProviders(<AuthRequiredRoute />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText(translate('appShell.auth.signIn.title')));
    });

    expect(setPendingDestination).toHaveBeenCalledWith('/reports');
    expect(router.replace).toHaveBeenCalledWith('/(public)/sign-in');
  });

  it('falls back to home for unsafe or absent pending destinations', async () => {
    const setPendingDestination = jest.fn(async () => undefined);
    useAppShellStore.setState({
      pendingDestination: 'https://example.com',
      setPendingDestination
    });
    const screen = renderWithProviders(<AuthRequiredRoute />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText(translate('appShell.auth.signIn.title')));
    });

    expect(setPendingDestination).toHaveBeenCalledWith('/(tabs)/home');
  });

  it('disables duplicate submit and keeps navigation blocked on write failure', async () => {
    let reject!: () => void;
    const setPendingDestination = jest.fn(
      () =>
        new Promise<void>((_resolve, rejectPromise) => {
          reject = () => rejectPromise(new Error('fail'));
        })
    );
    useAppShellStore.setState({ setPendingDestination });
    const screen = renderWithProviders(<AuthRequiredRoute />);
    const signIn = screen.getByLabelText(translate('appShell.auth.signIn.title'));

    fireEvent.press(signIn);
    fireEvent.press(signIn);
    expect(setPendingDestination).toHaveBeenCalledTimes(1);

    await act(async () => {
      reject();
    });

    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByText(translate('appShell.auth.required.saveFailed'))).toBeTruthy();
  });
});
