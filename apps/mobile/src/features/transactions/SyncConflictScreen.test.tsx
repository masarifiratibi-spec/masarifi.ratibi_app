import React from 'react';
import { screen } from '@testing-library/react-native';

import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { translate } from '@/localization/i18n';
import {
  fixtureTransactions,
  makeConflict
} from '@/test-utils/core-finance-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import { SyncConflictScreen } from './SyncConflictScreen';

it('shows masked local and later snapshots with two supported explicit choices', () => {
  const conflict = makeConflict(fixtureTransactions[0]);
  renderWithQueryData(<SyncConflictScreen id={conflict.id} />, [
    [coreFinanceKeys.conflict(conflict.id), conflict]
  ]);
  expect(screen.getAllByText(/•••• SAR/)).toHaveLength(2);
  expect(screen.getByText(translate('coreFinance.conflict.keepLocal'))).toBeTruthy();
  expect(screen.getByText(translate('coreFinance.conflict.keepLater'))).toBeTruthy();
  expect(screen.queryByText(translate('coreFinance.conflict.keepBoth'))).toBeNull();
});
