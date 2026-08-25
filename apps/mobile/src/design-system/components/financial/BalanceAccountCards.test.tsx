import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';
import { usePreferenceStore } from '@/state/preferences';
import { BalanceCard } from './BalanceCard';
import { AccountCard } from './AccountCard';

describe('balance and account cards', () => {
  beforeEach(() => usePreferenceStore.setState({ hideBalances: false }));

  it('renders balance hierarchy, hidden slot, trend, and action', () => {
    const onPress = jest.fn();
    const screen = renderWithProviders(
      <BalanceCard
        title="Current balance"
        value={4200}
        currency="EGP"
        hidden
        trend="12% higher than last month"
        actionLabel="Review"
        onAction={onPress}
      />
    );

    expect(screen.getByText('Current balance')).toBeTruthy();
    expect(screen.getByText('•••• EGP')).toBeTruthy();
    expect(screen.getByText('12% higher than last month')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Review'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders account type, masked identifier, visible balance, status, and action', () => {
    const screen = renderWithProviders(
      <AccountCard
        name="Main account"
        type="Checking"
        maskedIdentifier="•• 2481"
        balance={1800}
        currency="EGP"
        statusLabel="Synced"
        actionLabel="Open"
      />
    );

    expect(screen.getByText('Main account')).toBeTruthy();
    expect(screen.getByText('Checking')).toBeTruthy();
    expect(screen.getByText('•• 2481')).toBeTruthy();
    expect(screen.getByText('+1,800.00 EGP')).toBeTruthy();
    expect(screen.getByText('Synced')).toBeTruthy();
  });

  it('masks the shared account balance when Hide Balances is enabled', () => {
    usePreferenceStore.setState({ hideBalances: true });
    const screen = renderWithProviders(
      <AccountCard
        name="Main account"
        type="Checking"
        maskedIdentifier="•• 2481"
        balance={1800}
        currency="EGP"
      />
    );

    expect(screen.getByText('•••• EGP')).toBeTruthy();
    expect(screen.queryByText('+1,800.00 EGP')).toBeNull();
  });
});
