import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { AccountForm } from './AccountForm';
import { translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { fixtureAccounts } from '@/test-utils/core-finance-fixtures';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { buildNetWorthTrend } from '@/features/reports/report-net-worth';
import { registerLiveClerkBridge } from '@/services/live/auth-service';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() }
}));

afterEach(() => jest.restoreAllMocks());
beforeEach(() =>
  registerLiveClerkBridge({
    getSession: async () => ({
      id: 'session-synthetic',
      userId: 'user_synthetic',
      method: 'google',
      issuedAt: 1,
      expiresAt: 9999999999999
    }),
    getToken: async () => 'synthetic-token',
    startPhone: jest.fn(),
    verifyPhone: jest.fn(),
    resendPhone: jest.fn(),
    signInWithGoogle: jest.fn(),
    reverifyConflict: jest.fn(),
    signOut: jest.fn()
  })
);

function fill(name: Parameters<typeof translate>[0], value: string) {
  fireEvent.changeText(screen.getByLabelText(translate(name)), value);
}

it.each([
  ['7000', '10000', -300000],
  ['10000', '10000', 0],
  ['١٢٣٫٤٥', '٢٠٠', -7655],
  ['11000', '10000', 100000]
])(
  'saves available %s with limit %s as signed balance %s',
  async (available, limit, expected) => {
    const create = jest
      .spyOn(coreFinanceService, 'createAccount')
      .mockResolvedValue({
        value: { ...fixtureAccounts[3], id: 'isolated-card' },
        affectedScopes: []
      });
    renderWithProviders(<AccountForm initialType="credit_card" />);
    fill('coreFinance.accounts.name', 'Synthetic card');
    fill('coreFinance.accounts.setup.availableBalance', available);
    fill('coreFinance.accounts.setup.creditLimit', limit);
    fireEvent.press(screen.getByText(translate('coreFinance.accounts.create')));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ openingBalanceMinor: expected })
      )
    );
    const saved = create.mock.calls[0][0];
    const points = buildNetWorthTrend({
      accounts: [
        {
          ...fixtureAccounts[3],
          ...saved,
          id: 'isolated-card',
          status: 'active'
        }
      ],
      accountIds: [],
      currencyCode: 'SAR',
      pointInstants: [Date.now()],
      ratesByAccount: new Map(),
      transactions: []
    });
    expect(points[0].minorUnits).toBe(expected);
  }
);

it.each(['', '0', '-10'])(
  'explains an absent or invalid credit limit %s without saving',
  async (limit) => {
    const create = jest.spyOn(coreFinanceService, 'createAccount');
    renderWithProviders(<AccountForm initialType="credit_card" />);
    fill('coreFinance.accounts.name', 'Synthetic card');
    fill('coreFinance.accounts.setup.availableBalance', '7000');
    fill('coreFinance.accounts.setup.creditLimit', limit);
    fireEvent.press(screen.getByText(translate('coreFinance.accounts.create')));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  }
);

it('keeps an existing signed card opening unchanged when editing its limit', async () => {
  const account = {
    ...fixtureAccounts[3],
    type: 'credit_card' as const,
    openingBalanceMinor: -300000,
    creditLimitMinor: 1000000
  };
  const update = jest
    .spyOn(coreFinanceService, 'updateAccount')
    .mockResolvedValue({ value: account, affectedScopes: [] });
  renderWithProviders(<AccountForm account={account} />);
  fill('coreFinance.accounts.setup.creditLimit', '12000');
  fireEvent.press(screen.getByText(translate('coreFinance.accounts.save')));
  await waitFor(() =>
    expect(update).toHaveBeenCalledWith(
      account.id,
      expect.objectContaining({
        openingBalanceMinor: -300000,
        creditLimitMinor: 1200000
      })
    )
  );
});

it('requires the available amount instead of silently treating an untouched field as full debt', async () => {
  const create = jest.spyOn(coreFinanceService, 'createAccount');
  renderWithProviders(<AccountForm initialType="credit_card" />);
  fill('coreFinance.accounts.name', 'Synthetic new card');
  fill('coreFinance.accounts.setup.creditLimit', '10000');
  fireEvent.press(screen.getByText(translate('coreFinance.accounts.create')));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(create).not.toHaveBeenCalled();
});
