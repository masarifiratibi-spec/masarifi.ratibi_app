import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { translate } from '@/localization/i18n';
import type { BiometricResult, BiometricService } from '@/services/contracts/app-shell-service';
import { renderWithProviders } from '@/test-utils/render';
import { UnlockScreen } from './UnlockScreen';

const serviceWith = (authenticate: BiometricService['authenticate']): BiometricService => ({
  getAvailability: async () => ({ status: 'supported', kinds: ['fingerprint'], deviceCredential: true }),
  authenticate,
  cancel: async () => undefined
});

beforeEach(() => { AppState.currentState = 'active'; });

test('a lock mounted in the background prompts once when the app returns to the foreground', async () => {
  const originalState = AppState.currentState;
  let changeState: ((state: AppStateStatus) => void) | undefined;
  const originalListener = AppState.addEventListener;
  AppState.addEventListener = (event, callback) => {
    if (event === 'change') changeState = callback;
    return { remove: jest.fn() };
  };
  const authenticate = jest.fn().mockResolvedValue({ status: 'cancelled' });
  const unlock = jest.fn();
  try {
    AppState.currentState = 'background';
    const view = render(<UnlockScreen biometricService={serviceWith(authenticate)} onUnlock={unlock} />);
    expect(authenticate).not.toHaveBeenCalled();
    await act(async () => changeState?.('inactive'));
    expect(authenticate).not.toHaveBeenCalled();
    AppState.currentState = 'active';
    await act(async () => changeState?.('active'));
    expect(authenticate).toHaveBeenCalledTimes(1);
    await act(async () => changeState?.('active'));
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(unlock).not.toHaveBeenCalled();
    view.unmount();
  } finally {
    AppState.addEventListener = originalListener;
    AppState.currentState = originalState;
  }
});

test('completes exactly once after native authentication succeeds', async () => {
  const unlock = jest.fn(async () => undefined);
  renderWithProviders(<UnlockScreen biometricService={serviceWith(async () => ({ status: 'authenticated' }))} onUnlock={unlock} />);
  await waitFor(() => expect(unlock).toHaveBeenCalledTimes(1));
});

test('foreground authentication uses the session callback current at prompt start', async () => {
  AppState.currentState = 'background';
  const original = AppState.addEventListener;
  let resume: ((state: AppStateStatus) => void) | undefined;
  AppState.addEventListener = (event, callback) => {
    if (event === 'change') resume = callback;
    return { remove: jest.fn() };
  };
  try {
    const prior = jest.fn();
    const fresh = jest.fn();
    const service = serviceWith(async () => ({ status: 'authenticated' }));
    const view = render(<UnlockScreen biometricService={service} onUnlock={prior} />);
    view.rerender(<UnlockScreen biometricService={service} onUnlock={fresh} />);
    AppState.currentState = 'active';
    await act(async () => resume?.('active'));
    expect(prior).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledTimes(1);
    view.unmount();
  } finally {
    AppState.addEventListener = original;
    AppState.currentState = 'active';
  }
});

test('a still-mounted lock offers retry after a successful scan whose session guard declined navigation', async () => {
  let resolveScan!: (result: BiometricResult) => void;
  const service = serviceWith(() => new Promise(resolve => { resolveScan = resolve; }));
  const originalGuard = jest.fn();
  const nextGuard = jest.fn();
  const view = render(<UnlockScreen biometricService={service} onUnlock={originalGuard} />);
  view.rerender(<UnlockScreen biometricService={service} onUnlock={nextGuard} />);
  await act(async () => resolveScan({ status: 'authenticated' }));
  expect(originalGuard).toHaveBeenCalledTimes(1);
  expect(nextGuard).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: translate('appShell.security.biometricUnlock') }));
  await act(async () => resolveScan({ status: 'authenticated' }));
  expect(nextGuard).toHaveBeenCalledTimes(1);
});

test.each(['cancelled', 'failed', 'locked_out', 'unavailable'] as const)('native %s keeps protected access locked and allows a new OS attempt', async status => {
  const unlock = jest.fn(async () => undefined);
  const authenticate = jest.fn().mockResolvedValueOnce({ status }).mockResolvedValueOnce({ status: 'authenticated' });
  renderWithProviders(<UnlockScreen biometricService={serviceWith(authenticate)} onUnlock={unlock} />);
  const retry = await screen.findByRole('button', { name: translate('appShell.security.biometricUnlock') });
  expect(unlock).not.toHaveBeenCalled();
  expect(screen.queryByLabelText(translate('appShell.auth.otp.code'))).toBeNull();
  fireEvent.press(retry);
  await waitFor(() => expect(unlock).toHaveBeenCalledTimes(1));
});

test('retries safely after successful native verification cannot persist the unlock', async () => {
  const unlock = jest.fn().mockRejectedValueOnce(new Error('storage unavailable')).mockResolvedValueOnce(undefined);
  renderWithProviders(<UnlockScreen biometricService={serviceWith(async () => ({ status: 'authenticated' }))} onUnlock={unlock} />);
  const retry = await screen.findByRole('button', { name: translate('appShell.security.biometricUnlock') });
  fireEvent.press(retry);
  await waitFor(() => expect(unlock).toHaveBeenCalledTimes(2));
});

test('ignores native success after the screen has unmounted', async () => {
  let finish!: (result: BiometricResult) => void;
  const unlock = jest.fn();
  const screenView = renderWithProviders(<UnlockScreen biometricService={serviceWith(() => new Promise(resolve => { finish = resolve; }))} onUnlock={unlock} />);
  screenView.unmount();
  await act(async () => finish({ status: 'authenticated' }));
  expect(unlock).not.toHaveBeenCalled();
});

test('does not use local device authentication to admit an expired remote session', async () => {
  const authenticate = jest.fn();
  const unlock = jest.fn();
  renderWithProviders(<UnlockScreen sessionExpired biometricService={serviceWith(authenticate)} onUnlock={unlock} />);
  expect(screen.getByText(translate('appShell.navigation.authRequired'))).toBeOnTheScreen();
  expect(authenticate).not.toHaveBeenCalled();
  expect(unlock).not.toHaveBeenCalled();
});
