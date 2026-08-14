import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';
import { translate } from '@/localization/i18n';
import { Snackbar, Toast, UndoSnackbar } from './TransientFeedback';

describe('TransientFeedback', () => {
  it('renders toast, snackbar, undo timeout, action, and accessible announcement', () => {
    const onAction = jest.fn();
    const screen = renderWithProviders(
      <>
        <Toast message="Saved" />
        <Snackbar
          message="Could not sync"
          actionLabel="Retry"
          onAction={onAction}
        />
        <UndoSnackbar
          message="Transaction added"
          onUndo={onAction}
          timeoutMs={4000}
        />
      </>
    );

    expect(screen.getByLabelText('Saved')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Retry'));
    fireEvent.press(screen.getByLabelText(translate('coreFinance.undo')));
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(screen.getByText('4000 ms')).toBeTruthy();
    expect(screen.getByLabelText(translate('coreFinance.undo'))).toBeTruthy();
  });
});
