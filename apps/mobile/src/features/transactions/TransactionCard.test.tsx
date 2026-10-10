import React from 'react';

import { elevation } from '@/design-system/tokens';
import { renderWithProviders } from '@/test-utils/render';
import { fixtureTransactions } from '@/test-utils/core-finance-fixtures';
import { TransactionCard } from './TransactionCard';
import { changeLocale, translate } from '@/localization/i18n';

const transaction = fixtureTransactions[0];

function renderTransactionCard(groupedPosition?: 'only') {
  return renderWithProviders(
    <TransactionCard
      accountName="Main account"
      groupedPosition={groupedPosition}
      hidden={false}
      largeText={false}
      testIDPrefix="home"
      transaction={transaction}
    />
  );
}

describe('TransactionCard surface hierarchy', () => {
  afterEach(() => changeLocale('ar'));

  it.each(['ar', 'en'] as const)('does not classify an uncategorized income as salary in %s', (locale) => {
    changeLocale(locale);
    const screen = renderWithProviders(
      <TransactionCard accountName="Voice Staging Test" groupedPosition="only" hidden={false} largeText={false} testIDPrefix="home" transaction={{ ...transaction, type: 'income', categoryId: null }} />
    );
    expect(screen.getByLabelText(translate('coreFinance.ledger.uncategorized', locale))).toBeTruthy();
    expect(screen.queryByTestId('category-visual-openmoji-salary')).toBeNull();
  });
  it('elevates a standalone home transaction card', () => {
    const screen = renderTransactionCard();

    expect(
      screen.getByTestId(`home-transaction-row-${transaction.id}`)
    ).toHaveStyle({ shadowOpacity: elevation.card.shadowOpacity });
  });

  it('keeps a grouped transaction row flat', () => {
    const screen = renderTransactionCard('only');

    expect(
      screen.getByTestId(`home-transaction-row-${transaction.id}`)
    ).not.toHaveStyle({ shadowOpacity: elevation.card.shadowOpacity });
  });
});
