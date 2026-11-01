import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { translate } from '@/localization/i18n';
import type { BiometricResult, BiometricService } from '@/services/contracts/app-shell-service';
import { renderWithProviders } from '@/test-utils/render';
import { UnlockScreen } from './UnlockScreen';

const serviceWith = (authenticate: BiometricService['authenticate']): BiometricService => ({
  getAvailability: async () => ({ status: 'supported', kinds: ['fingerprint'], deviceCredential: true }),
  authenticate,
  cancel: async () => undefined
});

test('completes exactly once after native authentication succeeds', async () => {
  const unlock = jest.fn(async () => undefined);
  renderWithProviders(<UnlockScreen biometricService={serviceWith(async () => ({ status: 'authenticated' }))} onUnlock={unlock} />);
  await waitFor(() => expect(unlock).toHaveBeenCalledTimes(1));
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
