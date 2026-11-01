import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { changeLocale, translate } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';
import {
  configureAppShellStorageOwner,
  clearAppShellStorageOwner
} from '@/storage/app-shell-storage';
import { renderWithProviders } from '@/test-utils/render';
import { AssistantLanding } from '@/features/assistant/AssistantLanding';
import { AssistantComposer } from '@/features/assistant/components/AssistantComposer';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  randomUUID: () => jest.requireActual('node:crypto').randomUUID(),
  digestStringAsync: async (_algorithm: string, text: string) =>
    jest
      .requireActual('node:crypto')
      .createHash('sha256')
      .update(text)
      .digest('hex')
}));

const protectedValues = new Map<string, string>();

beforeEach(async () => {
  protectedValues.clear();
  jest
    .mocked(SecureStore.getItemAsync)
    .mockImplementation(async (key) => protectedValues.get(key) ?? null);
  jest
    .mocked(SecureStore.setItemAsync)
    .mockImplementation(async (key, value) => {
      protectedValues.set(key, value);
    });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => {
    protectedValues.delete(key);
  });
  await configureAppShellStorageOwner('draft-owner-a');
  useAppShellStore.setState({
    session: {
      userId: 'draft-owner-a',
      status: 'authenticated',
      method: 'phone',
      issuedAt: 10,
      expiresAt: 9999999999999,
      restoration: 'restored'
    }
  });
});

afterEach(() => {
  clearAppShellStorageOwner();
  useAppShellStore.setState({ session: null });
  jest.restoreAllMocks();
});

it.each(['ar', 'en'] as const)(
  'restores an unsent assistant question after the view is recreated in %s without sending it',
  async (locale) => {
    changeLocale(locale);
    const send = jest.fn();
    const view = () => (
      <AssistantLanding onAskQuestion={send} onEnableConsent={jest.fn()} />
    );
    const first = renderWithProviders(view());
    await waitFor(() =>
      expect(screen.getByTestId('assistant-ask-input')).toHaveProp(
        'editable',
        true
      )
    );
    await act(async () => {
      fireEvent.changeText(
        screen.getByTestId('assistant-ask-input'),
        'مسودة محلية لم تُرسل QA'
      );
    });
    first.unmount();
    renderWithProviders(view());
    await waitFor(() =>
      expect(screen.getByTestId('assistant-ask-input')).toHaveProp(
        'value',
        'مسودة محلية لم تُرسل QA'
      )
    );
    expect(send).not.toHaveBeenCalled();
  }
);

it('keeps the draft and stays on the screen when protected discard fails', async () => {
  const back = jest.fn();
  const alert = jest.spyOn(Alert, 'alert');
  renderWithProviders(
    <AssistantLanding
      onBack={back}
      onAskQuestion={jest.fn()}
      onEnableConsent={jest.fn()}
    />
  );
  await waitFor(() =>
    expect(screen.getByTestId('assistant-ask-input')).toHaveProp(
      'editable',
      true
    )
  );
  await act(async () => {
    fireEvent.changeText(
      screen.getByTestId('assistant-ask-input'),
      'Keep this local draft'
    );
  });
  jest
    .mocked(SecureStore.deleteItemAsync)
    .mockRejectedValueOnce(new Error('protected store unavailable'));
  fireEvent.press(
    screen.getByRole('button', { name: translate('appShell.navigation.back') })
  );
  const discard = alert.mock.calls
    .at(-1)?.[2]
    ?.find((button) => button.style === 'destructive');
  if (!discard?.onPress)
    throw new Error('Expected ordinary discard confirmation');
  await act(async () => {
    discard.onPress?.();
  });
  expect(back).not.toHaveBeenCalled();
  expect(screen.getByTestId('assistant-ask-input')).toHaveProp(
    'value',
    'Keep this local draft'
  );
  expect(
    screen.getByText(translate('assistant.draft.saveFailed'))
  ).toBeTruthy();
});

it('restores a conversation draft only in its original conversation', async () => {
  const send = jest.fn(async () => false);
  const first = renderWithProviders(
    <AssistantComposer conversationId="conversation-one" onSendMessage={send} />
  );
  await waitFor(() =>
    expect(screen.getByTestId('assistant-composer-input')).toHaveProp(
      'editable',
      true
    )
  );
  await act(async () => {
    fireEvent.changeText(
      screen.getByTestId('assistant-composer-input'),
      'Unsent reply in conversation one'
    );
  });
  first.unmount();
  const second = renderWithProviders(
    <AssistantComposer conversationId="conversation-two" onSendMessage={send} />
  );
  await waitFor(() =>
    expect(screen.getByTestId('assistant-composer-input')).toHaveProp(
      'editable',
      true
    )
  );
  expect(screen.getByTestId('assistant-composer-input')).toHaveProp(
    'value',
    ''
  );
  second.unmount();
  renderWithProviders(
    <AssistantComposer conversationId="conversation-one" onSendMessage={send} />
  );
  await waitFor(() =>
    expect(screen.getByTestId('assistant-composer-input')).toHaveProp(
      'value',
      'Unsent reply in conversation one'
    )
  );
  expect(send).not.toHaveBeenCalled();
});
