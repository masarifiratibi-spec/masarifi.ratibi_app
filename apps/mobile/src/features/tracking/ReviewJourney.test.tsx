import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import { automaticTrackingKeys } from '@/state/automatic-tracking-view-state';
import { fixtureTransactions } from '@/test-utils/core-finance-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import { DuplicateComparison } from './DuplicateComparison';
import { ReviewQueue } from './ReviewQueue';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() }
}));

describe('ReviewJourney', () => {
  it('opens review items and renders duplicate actions accessibly', () => {
    renderWithQueryData(<ReviewQueue />, [
      [
        automaticTrackingKeys.review(),
        {
          items: [
            {
              id: 'review-1',
              detectedEventId: 'event-1',
              status: 'pending',
              reasonCodes: ['duplicate'],
              missingFields: [],
              proposedValues: {},
              selectedDuplicateResolution: null,
              selectedObligationId: null,
              resolutionErrorCode: null,
              createdAt: 1,
              resolvedAt: null,
              updatedAt: 1
            }
          ],
          total: 1,
          nextCursor: null
        }
      ]
    ]);

    fireEvent.press(screen.getByLabelText(translate('tracking.action.open')));
    expect(router.push).toHaveBeenCalledWith('/tracking/review/review-1');
    expect(
      screen.getByText(translate('tracking.reason.duplicate'))
    ).toBeOnTheScreen();
    expect(screen.queryByText('duplicate')).toBeNull();

    renderWithQueryData(<DuplicateComparison id="duplicate-1" />, [
      [
        automaticTrackingKeys.duplicate('duplicate-1'),
        {
          id: 'duplicate-1',
          detectedEventId: 'event-1',
          existingTransactionId: 'transaction-1',
          probabilityBasisPoints: 9_200,
          reasonCodes: ['amount'],
          resolution: null,
          status: 'pending',
          resolvedAt: null
        }
      ],
      [coreFinanceKeys.transaction('transaction-1'), fixtureTransactions[1]]
    ]);

    expect(
      screen.getByLabelText(translate('tracking.duplicate.keepExisting'))
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(translate('tracking.duplicate.merge'))
    ).toBeOnTheScreen();
    expect(screen.queryByText('transaction-1')).toBeNull();
  });
});
