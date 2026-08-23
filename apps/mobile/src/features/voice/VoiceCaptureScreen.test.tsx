import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { translate } from '@/localization/i18n';
import { voiceRecorderService } from '@/services/platform/voice-recorder-service';
import { useVoiceCaptureStore } from '@/state/voice-capture';
import { renderWithProviders } from '@/test-utils/render';
import { VoiceCaptureScreen } from './VoiceCaptureScreen';

jest.mock('@/features/core-finance/core-finance-queries', () => ({
  useAccounts: () => ({ data: [] }),
  useCategories: () => ({ data: [] }),
  scopeToKey: () => ['core-finance']
}));
jest.mock('@/services/platform/voice-recorder-service', () => ({
  voiceRecorderService: {
    getPermission: jest.fn(), requestPermission: jest.fn(),
    openSettings: jest.fn(), start: jest.fn(), stop: jest.fn(), cancel: jest.fn(), remove: jest.fn()
  }
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

beforeEach(() => {
  jest.clearAllMocks();
  useVoiceCaptureStore.getState().reset();
  (voiceRecorderService.getPermission as jest.Mock).mockResolvedValue('denied');
});

it('explains the mock and keeps manual capture available', async () => {
  renderWithProviders(<VoiceCaptureScreen />);
  await waitFor(() => expect(screen.getByText(translate('voice.permission.title'))).toBeTruthy());
  expect(screen.getByText(translate('voice.demoNotice'))).toBeTruthy();
  expect(screen.getByText(translate('voice.action.manual'))).toBeTruthy();
  expect(
    screen.queryByText(translate('voice.scenario.clear_en'))
  ).toBeNull();
});

it('shows settings only for a permanently denied microphone', async () => {
  (voiceRecorderService.getPermission as jest.Mock).mockResolvedValueOnce(
    'permanently_denied'
  );
  renderWithProviders(<VoiceCaptureScreen />);

  expect(
    await screen.findByText(translate('voice.error.permission_permanent'))
  ).toBeTruthy();
  expect(screen.getByText(translate('voice.permission.settings'))).toBeTruthy();
  expect(screen.queryByText(translate('voice.permission.request'))).toBeNull();
});

it('keeps manual entry available when voice capture is unavailable', async () => {
  (voiceRecorderService.getPermission as jest.Mock).mockResolvedValueOnce(
    'unavailable'
  );
  renderWithProviders(<VoiceCaptureScreen />);

  expect(
    await screen.findByText(translate('voice.permission.unavailable'))
  ).toBeTruthy();
  expect(screen.getByText(translate('voice.action.manual'))).toBeTruthy();
  expect(screen.queryByText(translate('voice.permission.request'))).toBeNull();
});

it('starts recording once when automatic capture becomes ready', async () => {
  (voiceRecorderService.getPermission as jest.Mock).mockResolvedValueOnce(
    'granted'
  );
  (voiceRecorderService.start as jest.Mock).mockResolvedValueOnce({
    id: 'recording-1',
    startedAt: Date.now()
  });

  renderWithProviders(<VoiceCaptureScreen autoStart />);

  await waitFor(() =>
    expect(voiceRecorderService.start).toHaveBeenCalledTimes(1)
  );
  expect(screen.queryByText(translate('voice.action.manual'))).toBeNull();
});

it('shows a blocking processing overlay while transcribing', () => {
  (voiceRecorderService.getPermission as jest.Mock).mockImplementation(
    () => new Promise(() => undefined)
  );
  useVoiceCaptureStore.getState().patch({ state: 'transcribing' });

  renderWithProviders(<VoiceCaptureScreen />);

  expect(screen.getByTestId('voice-processing-overlay')).toBeTruthy();
  expect(screen.getByText(translate('voice.state.processing'))).toBeTruthy();
});

it('returns to Home after a successful save', async () => {
  (voiceRecorderService.getPermission as jest.Mock).mockImplementation(
    () => new Promise(() => undefined)
  );
  useVoiceCaptureStore.getState().patch({ state: 'saved' });
  renderWithProviders(<VoiceCaptureScreen />);

  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/home')
  );
});
