import React from 'react';
import { AppState, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';
import { SensitiveVisibilityProvider, useSensitiveVisibility } from './SensitiveVisibilityProvider';

describe('SensitiveVisibilityProvider', () => {
  it('resets active reveal on background cleanup', () => {
    function Harness() {
      const { revealed, reveal, reset } = useSensitiveVisibility();
      return (
        <>
          <Text>{revealed ? 'revealed' : 'masked'}</Text>
          <Text accessibilityLabel="Reveal" onPress={reveal}>Reveal</Text>
          <Text accessibilityLabel="Reset" onPress={reset}>Reset</Text>
        </>
      );
    }

    const screen = renderWithProviders(
      <SensitiveVisibilityProvider>
        <Harness />
      </SensitiveVisibilityProvider>
    );
    fireEvent.press(screen.getByLabelText('Reveal'));
    expect(screen.getByText('revealed')).toBeTruthy();
    act(() => fireEvent.press(screen.getByLabelText('Reset')));
    expect(screen.getByText('masked')).toBeTruthy();
  });

  it('replaces sensitive content with a privacy shield outside the active state', () => {
    let listener: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, next) => {
      listener = next as (state: string) => void;
      return { remove: jest.fn() };
    });
    const view = render(<SensitiveVisibilityProvider><Text>private question text</Text></SensitiveVisibilityProvider>);
    act(() => listener?.('background'));
    expect(view.queryByText('private question text')).toBeNull();
    expect(view.getByTestId('privacy-shield')).toBeTruthy();
    act(() => listener?.('active'));
    expect(view.getByText('private question text')).toBeTruthy();
  });
});
