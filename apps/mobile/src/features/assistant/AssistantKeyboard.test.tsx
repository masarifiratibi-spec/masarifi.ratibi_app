import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { DeviceEventEmitter, Keyboard, Platform } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { AssistantConversationView } from './AssistantConversationView';

const originalOS = Platform.OS;
afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: originalOS });
  jest.restoreAllMocks();
  DeviceEventEmitter.emit('keyboardDidHide');
});

// Catches edge-to-edge windows leaving the composer under the IME while the
// conversation still occupies the full safe-area height.
test.each(['android', 'ios'] as const)('keeps the whole %s chat above the keyboard, including the safe-area origin', async os => {
  Object.defineProperty(Platform, 'OS', { value: os });
  // The Jest native stub omits the singleton receiver required on real Hermes.
  jest.spyOn(Keyboard, 'isVisible').mockImplementation(function (this: typeof Keyboard) {
    if (this !== Keyboard) throw new Error('Native keyboard receiver lost');
    return false;
  });
  render(
    <SafeAreaInsetsContext.Provider value={{top: 38, bottom: 47, left: 0, right: 0}}>
      <AssistantConversationView conversationId="keyboard-test" responses={[]} onSendMessage={jest.fn()} />
    </SafeAreaInsetsContext.Provider>
  );
  await act(async () => {
    fireEvent(screen.getByTestId('assistant-conversation-view'), 'layout', {
      nativeEvent: {layout: {x: 0, y: 0, width: 393, height: 810}}, persist: () => undefined
    });
    DeviceEventEmitter.emit(os === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', {
      duration: 0, easing: 'keyboard', endCoordinates: {screenX: 0, screenY: 593, width: 393, height: 255}
    });
  });
  expect(screen.getByTestId('assistant-conversation-view')).toHaveStyle({paddingBottom: 255});
  expect(screen.getByTestId('assistant-composer-input')).toBeTruthy();
  expect(screen.getByTestId('assistant-composer-send-button')).toBeTruthy();
  await act(async () => {
    DeviceEventEmitter.emit(os === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', {
      // Android reports the safe-area height when hiding, rather than screen Y.
      duration: 0, easing: 'keyboard', endCoordinates: {screenX: 0, screenY: os === 'android' ? 810 : 895, width: 393, height: 0}
    });
  });
  expect(screen.getByTestId('assistant-conversation-view')).toHaveStyle({paddingBottom: 0});
});
