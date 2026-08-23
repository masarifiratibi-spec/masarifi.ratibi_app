import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import {
  fixtureTransactions,
  makeConflict
} from '@/test-utils/core-finance-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import { SyncConflictScreen } from './SyncConflictScreen';
import { coreFinanceService } from '@/services/mocks/core-finance-service';

it('shows masked local and later snapshots with two supported explicit choices', () => {
  const conflict = makeConflict(fixtureTransactions[0]);
  renderWithQueryData(<SyncConflictScreen id={conflict.id} />, [
    [coreFinanceKeys.conflict(conflict.id), conflict]
  ]);
  expect(screen.getAllByText(/•••• SAR/)).toHaveLength(2);
  expect(screen.getByText(translate('coreFinance.conflict.keepLocal'))).toBeTruthy();
  expect(screen.getByText(translate('coreFinance.conflict.keepLater'))).toBeTruthy();
  expect(screen.queryByText(translate('coreFinance.conflict.keepBoth'))).toBeNull();
  expect(
    screen.getByRole('button', {
      name: translate('coreFinance.conflict.resolve')
    })
  ).toBeDisabled();
});

it('requires an explicit choice and confirmation before resolving', () => {
  const conflict = makeConflict(fixtureTransactions[0]);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  const resolve = jest.spyOn(coreFinanceService, 'resolveConflict');
  renderWithQueryData(<SyncConflictScreen id={conflict.id} />, [
    [coreFinanceKeys.conflict(conflict.id), conflict]
  ]);

  fireEvent.press(screen.getByText(translate('coreFinance.conflict.keepLocal')));
  fireEvent.press(screen.getByText(translate('coreFinance.conflict.resolve')));
  expect(alert).toHaveBeenCalled();
  expect(resolve).not.toHaveBeenCalled();
});
