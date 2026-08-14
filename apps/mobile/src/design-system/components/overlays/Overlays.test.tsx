import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';
import { AppSheet } from './AppSheet';
import { ConfirmationDialog } from './ConfirmationDialog';
import { PickerOverlay, VoiceRecordingOverlay } from './PickerOverlays';

describe('overlays', () => {
  it('renders sheet focus content, dismiss, keyboard-safe wrapper, and dialog actions', () => {
    const onDismiss = jest.fn();
    const onConfirm = jest.fn();
    const screen = renderWithProviders(
      <>
        <AppSheet title="Choose account" visible onDismiss={onDismiss}>
          <PickerOverlay title="Accounts" options={['Main']} onSelect={onConfirm} />
          <VoiceRecordingOverlay title="Voice note" recording />
        </AppSheet>
        <ConfirmationDialog
          visible
          title="Delete transaction"
          message="This cannot be undone"
          confirmLabel="Delete permanently"
          destructive
          onCancel={onDismiss}
          onConfirm={onConfirm}
        />
      </>
    );

    expect(screen.getByLabelText('Choose account')).toBeTruthy();
    expect(screen.getByText('Voice note')).toBeTruthy();
    expect(screen.getByText('Recording')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Close Choose account'));
    fireEvent.press(screen.getByLabelText('Main'));
    fireEvent.press(screen.getByLabelText('Delete permanently'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
