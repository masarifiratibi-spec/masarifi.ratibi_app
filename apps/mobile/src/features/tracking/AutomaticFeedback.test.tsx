import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { renderWithProviders } from '@/test-utils/render';
import { AutomaticFeedback } from './AutomaticFeedback';
import { automaticTrackingService } from '@/services/mocks/automatic-tracking-service';
import { translate } from '@/localization/i18n';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() }
}));

describe('AutomaticFeedback', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes view, edit, and undo without source text', async () => {
    const undo = jest
      .spyOn(automaticTrackingService, 'undoAutomaticAddition')
      .mockResolvedValue({ value: {} as never, affectedScopes: [] });
    const onDone = jest.fn();
    renderWithProviders(
      <AutomaticFeedback
        feedback={{
          id: 'feedback-1',
          detectedEventId: 'event-1',
          transactionId: 'transaction-1',
          kind: 'transaction_added',
          undoExpiresAt: Date.now() + 30_000,
          notificationOutcome: 'suppressed_private',
          status: 'active',
          createdAt: 1,
          updatedAt: 1
        }}
        onDone={onDone}
      />
    );

    fireEvent.press(screen.getByLabelText(translate('tracking.action.view')));
    expect(router.push).toHaveBeenCalledWith('/transactions/transaction-1');

    fireEvent.press(screen.getByLabelText(translate('tracking.action.edit')));
    expect(router.push).toHaveBeenCalledWith('/transactions/transaction-1/edit');

    fireEvent.press(screen.getByLabelText(translate('tracking.action.undo')));
    expect(undo).toHaveBeenCalledWith('feedback-1');
  });
});
