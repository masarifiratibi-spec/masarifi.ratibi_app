import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ActionButton } from '@/design-system/components/ActionButton';
import { translate, changeLocale } from '@/localization/i18n';
import { voiceAnalyzerService } from '@/services/mocks/voice-analyzer-service';
import { voiceRecorderService } from '@/services/platform/voice-recorder-service';
import { useAppShellStore } from '@/state/app-shell';
import { useVoiceCaptureStore } from '@/state/voice-capture';
import { useVoiceUpdateInteraction } from '@/state/voice-update-interaction';
import { authenticatedSession, lockedPrivacy, unlockedPrivacy } from '@/test-utils/app-shell-fixtures';
import { renderWithProviders } from '@/test-utils/render';
import { useVoiceCapture } from './useVoiceCapture';

function CaptureActions() {
  const voice = useVoiceCapture({ permissionSync: 'on-demand' });
  return <>
    <ActionButton label="Start" onPress={() => void voice.start()} />
    <ActionButton label="Manage" onPress={() => voice.reviewProcessingConsent()} />
  </>;
}

const metadata = voiceAnalyzerService.metadata;
beforeEach(async () => {
  await AsyncStorage.clear();
  useVoiceCaptureStore.getState().reset();
  useAppShellStore.setState({ session: authenticatedSession, privacyLock: unlockedPrivacy });
  voiceAnalyzerService.metadata = { ...metadata, kind: 'live' };
  jest.spyOn(voiceRecorderService, 'getPermission').mockResolvedValue('granted');
  jest.spyOn(voiceRecorderService, 'start').mockResolvedValue({ id: 'consented-recording', startedAt: Date.now() });
  jest.spyOn(voiceRecorderService, 'cancel').mockResolvedValue();
  jest.spyOn(voiceRecorderService, 'remove').mockResolvedValue();
  jest.spyOn(router, 'replace').mockImplementation(() => undefined);
});
afterEach(() => {
  voiceAnalyzerService.metadata = metadata;
  jest.restoreAllMocks();
});

it.each(['ar', 'en'] as const)('requires affirmative disclosure consent before microphone access in %s and keeps refusal usable', async locale => {
  changeLocale(locale);
  const transcribe = jest.spyOn(voiceAnalyzerService, 'transcribe');
  const analyze = jest.spyOn(voiceAnalyzerService, 'analyze');
  renderWithProviders(<CaptureActions />);
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  await screen.findByText(translate('voice.processingConsent.title'));
  expect(voiceRecorderService.getPermission).not.toHaveBeenCalled();
  expect(voiceRecorderService.start).not.toHaveBeenCalled();
  expect(transcribe).not.toHaveBeenCalled();
  expect(analyze).not.toHaveBeenCalled();
  expect(screen.getByTestId('voice-processing-consent-modal')).toBeOnTheScreen();
  expect(screen.queryByText(translate('voice.processingConsent.data'))).toBeNull();
  expect(screen.queryByRole('button', { name: translate('privacy.details') })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: translate('voice.processingConsent.decline') }));
  await waitFor(() => expect(screen.queryByText(translate('voice.processingConsent.title'))).toBeNull());
  expect(voiceRecorderService.start).not.toHaveBeenCalled();
  expect(transcribe).not.toHaveBeenCalled();
  expect(analyze).not.toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith('/(tabs)/add');
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  fireEvent.press(await screen.findByRole('button', { name: translate('voice.processingConsent.accept') }));
  await waitFor(() => expect(voiceRecorderService.start).toHaveBeenCalledTimes(1));
});

it('dismisses the popup without consenting or accessing the microphone', async () => {
  renderWithProviders(<CaptureActions />);
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  fireEvent.press(await screen.findByRole('button', { name: translate('appShell.navigation.close') }));
  await waitFor(() => expect(screen.queryByText(translate('voice.processingConsent.title'))).toBeNull());
  expect(voiceRecorderService.getPermission).not.toHaveBeenCalled();
  expect(voiceRecorderService.start).not.toHaveBeenCalled();
});

it('remembers an accepted disclosure for the owner and requires consent again after withdrawal', async () => {
  const first = renderWithProviders(<CaptureActions />);
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  fireEvent.press(await screen.findByRole('button', { name: translate('voice.processingConsent.accept') }));
  await waitFor(() => expect(voiceRecorderService.start).toHaveBeenCalledTimes(1));
  first.unmount();
  useVoiceCaptureStore.getState().reset();
  renderWithProviders(<CaptureActions />);
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  await waitFor(() => expect(voiceRecorderService.start).toHaveBeenCalledTimes(2));
  fireEvent.press(screen.getByRole('button', { name: 'Manage' }));
  fireEvent.press(await screen.findByRole('button', { name: translate('voice.processingConsent.withdraw') }));
  await act(async () => {});
  await waitFor(() => expect(screen.queryByText(translate('voice.processingConsent.title'))).toBeNull());
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  await screen.findByRole('button', { name: translate('voice.processingConsent.accept') });
  expect(voiceRecorderService.start).toHaveBeenCalledTimes(2);
});

it('does not record or save an acknowledgement after the owner changes while the disclosure is open', async () => {
  renderWithProviders(<CaptureActions />);
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  await screen.findByText(translate('voice.processingConsent.title'));
  act(() => useAppShellStore.setState({ session: { ...authenticatedSession, userId: 'other-owner' } }));
  await waitFor(() => expect(screen.queryByText(translate('voice.processingConsent.title'))).toBeNull());
  expect(voiceRecorderService.start).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  await screen.findByRole('button', { name: translate('voice.processingConsent.accept') });
  expect(voiceRecorderService.start).not.toHaveBeenCalled();
});

it('does not reuse another owner\'s saved consent', async () => {
  renderWithProviders(<CaptureActions />);
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  fireEvent.press(await screen.findByRole('button', { name: translate('voice.processingConsent.accept') }));
  await waitFor(() => expect(voiceRecorderService.start).toHaveBeenCalledTimes(1));
  act(() => useAppShellStore.setState({ session: { ...authenticatedSession, userId: 'second-owner' } }));
  await act(async () => {});
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  await screen.findByRole('button', { name: translate('voice.processingConsent.accept') });
  expect(voiceRecorderService.start).toHaveBeenCalledTimes(1);
});

it('dismisses a pending recording choice when the app locks', async () => {
  renderWithProviders(<CaptureActions />);
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  await screen.findByText(translate('voice.processingConsent.title'));
  act(() => useAppShellStore.setState({ privacyLock: lockedPrivacy }));
  await act(async () => {});
  expect(screen.queryByText(translate('voice.processingConsent.title'))).toBeNull();
  expect(voiceRecorderService.start).not.toHaveBeenCalled();
});

it('stops new recording after withdrawal even when saving the withdrawal fails', async () => {
  renderWithProviders(<CaptureActions />);
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  fireEvent.press(await screen.findByRole('button', { name: translate('voice.processingConsent.accept') }));
  await waitFor(() => expect(voiceRecorderService.start).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByRole('button', { name: 'Manage' }));
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk unavailable'));
  fireEvent.press(await screen.findByRole('button', { name: translate('voice.processingConsent.withdraw') }));
  await screen.findByText(translate('voice.processingConsent.error'));
  fireEvent.press(screen.getByRole('button', { name: translate('voice.processingConsent.decline') }));
  await act(async () => {});
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  await screen.findByRole('button', { name: translate('voice.processingConsent.accept') });
  expect(voiceRecorderService.start).toHaveBeenCalledTimes(1);
});

it('fails closed when acknowledgement persistence fails and leaves decline and retry available', async () => {
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk unavailable'));
  renderWithProviders(<CaptureActions />);
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  fireEvent.press(await screen.findByRole('button', { name: translate('voice.processingConsent.accept') }));
  await screen.findByText(translate('voice.processingConsent.error'));
  expect(voiceRecorderService.start).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: translate('voice.processingConsent.decline') })).toBeEnabled();
  fireEvent.press(screen.getByRole('button', { name: translate('voice.processingConsent.accept') }));
  await waitFor(() => expect(voiceRecorderService.start).toHaveBeenCalledTimes(1));
});

it('does not overwrite the next owner after a deferred withdrawal cancellation', async () => {
  renderWithProviders(<CaptureActions />);
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  fireEvent.press(await screen.findByRole('button', { name: translate('voice.processingConsent.accept') }));
  await waitFor(() => expect(useVoiceCaptureStore.getState().state).toBe('recording'));
  fireEvent.press(screen.getByRole('button', { name: 'Manage' }));
  let releaseCancel!: () => void;
  jest.mocked(voiceRecorderService.cancel).mockImplementationOnce(() => new Promise<void>(resolve => { releaseCancel = resolve; }));
  fireEvent.press(await screen.findByRole('button', { name: translate('voice.processingConsent.withdraw') }));
  await waitFor(() => expect(releaseCancel).toBeDefined());
  act(() => useAppShellStore.setState({ session: { ...authenticatedSession, userId: 'next-owner' } }));
  await act(async () => {});
  act(() => useVoiceCaptureStore.getState().patch({ state: 'confirmation_unknown', recordingId: 'next-owner-capture', errorCode: 'save_failed' }));
  await act(async () => { releaseCancel(); });
  expect(useVoiceCaptureStore.getState()).toMatchObject({ state: 'confirmation_unknown', recordingId: 'next-owner-capture', errorCode: 'save_failed' });
});

it.each(['saving', 'confirmation_unknown'] as const)('preserves the %s financial outcome when voice consent is withdrawn', async state => {
  renderWithProviders(<CaptureActions />);
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  fireEvent.press(await screen.findByRole('button', { name: translate('voice.processingConsent.accept') }));
  await waitFor(() => expect(useVoiceCaptureStore.getState().state).toBe('recording'));
  fireEvent.press(screen.getByRole('button', { name: 'Manage' }));
  await screen.findByRole('button', { name: translate('voice.processingConsent.withdraw') });
  act(() => useVoiceCaptureStore.getState().patch({ state, errorCode: 'save_failed' }));
  jest.mocked(voiceRecorderService.cancel).mockClear();
  fireEvent.press(screen.getByRole('button', { name: translate('voice.processingConsent.withdraw') }));
  await act(async () => {});
  expect(useVoiceCaptureStore.getState()).toMatchObject({ state, errorCode: 'save_failed' });
  expect(voiceRecorderService.cancel).not.toHaveBeenCalled();
});

it('holds the update interaction during a deferred disclosure read until the user closes it', async () => {
  let releaseRead!: (value: string | null) => void;
  jest.spyOn(AsyncStorage, 'getItem').mockImplementationOnce(() => new Promise(resolve => { releaseRead = resolve; }));
  const view = renderWithProviders(<CaptureActions />);
  fireEvent.press(screen.getByRole('button', { name: 'Manage' }));
  expect(useVoiceUpdateInteraction.getState().pending).toBeGreaterThan(0);
  await act(async () => { releaseRead(null); });
  await screen.findByRole('button', { name: translate('voice.processingConsent.accept') });
  expect(useVoiceUpdateInteraction.getState().pending).toBeGreaterThan(0);
  fireEvent.press(screen.getByRole('button', { name: translate('voice.processingConsent.decline') }));
  await waitFor(() => expect(useVoiceUpdateInteraction.getState().pending).toBe(0));
  view.unmount();
  expect(useVoiceUpdateInteraction.getState().pending).toBe(0);
});

it('keeps the update interaction active through deferred native preparation after accepting consent', async () => {
  let releaseStart!: (value: { id: string; startedAt: number }) => void;
  jest.mocked(voiceRecorderService.start).mockImplementationOnce(() => new Promise(resolve => { releaseStart = resolve; }));
  renderWithProviders(<CaptureActions />);
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  fireEvent.press(await screen.findByRole('button', { name: translate('voice.processingConsent.accept') }));
  await waitFor(() => expect(releaseStart).toBeDefined());
  expect(screen.queryByText(translate('voice.processingConsent.title'))).toBeNull();
  expect(useVoiceUpdateInteraction.getState().pending).toBeGreaterThan(0);
  await act(async () => { releaseStart({ id: 'prepared-capture', startedAt: Date.now() }); });
  expect(useVoiceCaptureStore.getState().state).toBe('recording');
  expect(useVoiceUpdateInteraction.getState().pending).toBe(0);
});

it('does not release the next owner\'s disclosure token when the old native start finishes', async () => {
  let releaseStart!: (value: { id: string; startedAt: number }) => void;
  jest.mocked(voiceRecorderService.start).mockImplementationOnce(() => new Promise(resolve => { releaseStart = resolve; }));
  const first = renderWithProviders(<CaptureActions />);
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  fireEvent.press(await screen.findByRole('button', { name: translate('voice.processingConsent.accept') }));
  await waitFor(() => expect(releaseStart).toBeDefined());
  first.unmount();
  act(() => useAppShellStore.setState({ session: { ...authenticatedSession, userId: 'token-owner-b' } }));
  const second = renderWithProviders(<CaptureActions />);
  fireEvent.press(screen.getByRole('button', { name: 'Manage' }));
  await screen.findByRole('button', { name: translate('voice.processingConsent.accept') });
  await act(async () => { releaseStart({ id: 'old-owner-preparation', startedAt: Date.now() }); });
  expect(useVoiceUpdateInteraction.getState().pending).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: translate('voice.processingConsent.accept') })).toBeOnTheScreen();
  second.unmount();
  await waitFor(() => expect(useVoiceUpdateInteraction.getState().pending).toBe(0));
});

it('releases the preparation interaction when native start fails', async () => {
  jest.mocked(voiceRecorderService.start).mockRejectedValueOnce(new Error('native start failed'));
  renderWithProviders(<CaptureActions />);
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  fireEvent.press(await screen.findByRole('button', { name: translate('voice.processingConsent.accept') }));
  await waitFor(() => expect(useVoiceCaptureStore.getState().state).toBe('failed'));
  expect(useVoiceUpdateInteraction.getState().pending).toBe(0);
});
