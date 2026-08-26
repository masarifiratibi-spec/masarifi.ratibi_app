import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { changeLocale } from '@/localization/i18n';
import {
  createMockFinancialPlanningService,
  financialPlanningService
} from '@/services/mocks/financial-planning-service';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithProviders } from '@/test-utils/render';
import { lightThemeColors } from '@/design-system/tokens';
import { SalaryOverviewScreen } from './SalaryOverviewScreen';
import { SalaryProfileForm } from './SalaryProfileForm';
import { SalaryReceiptReview } from './SalaryReceiptReview';

jest.mock('@/services/mocks/core-finance-service', () => {
  const actual = jest.requireActual<
    typeof import('@/services/mocks/core-finance-service')
  >('@/services/mocks/core-finance-service');
  return {
    ...actual,
    coreFinanceService: actual.createSeededCoreFinanceService()
  };
});

jest.mock('@/services/mocks/financial-planning-service', () => {
  const actual = jest.requireActual<
    typeof import('@/services/mocks/financial-planning-service')
  >('@/services/mocks/financial-planning-service');
  return {
    ...actual,
    financialPlanningService: actual.createSeededFinancialPlanningService()
  };
});

it('renders salary overview, setup, and receipt review states', async () => {
  changeLocale('en');
  usePreferenceStore.setState({ hideBalances: false });
  const { findByLabelText, findByText, unmount } = renderWithProviders(<SalaryOverviewScreen />);
  expect(await findByText('Salary cycle')).toBeTruthy();
  expect(await findByLabelText(/Remaining salary/)).toBeTruthy();
  expect(await findByText('Received early')).toHaveStyle({
    color: lightThemeColors.content.onFinancialHero
  });
  // The daily insight shows the reason when suggested daily is unavailable
  // When cycle has elapsed (fixture cycle is Jan 2026, real Date.now() is later), reason is cycle_elapsed
  expect(await findByText('Current salary cycle has ended')).toBeTruthy();
  unmount();

  await financialPlanningService.saveDraft({
    id: 'planning-form-salary',
    kind: 'salary',
    entityId: null,
    payload: {
      amount: '14000',
      salaryDay: '25',
      sourceName: 'Draft Employer',
      accountId: '',
      automaticDetectionEnabled: false
    },
    status: 'editing',
    updatedAt: 1
  });
  const profile = renderWithProviders(<SalaryProfileForm />);
  expect(
    await profile.findByRole('header', { name: 'Salary details' })
  ).toBeTruthy();
  expect(
    profile.getByRole('header', { name: 'Receiving and detection' })
  ).toBeTruthy();
  expect(await profile.findByDisplayValue('Draft Employer')).toBeTruthy();
  expect(await profile.findByLabelText(/Receiving account Daily account/)).toBeTruthy();
  fireEvent.changeText(profile.getByLabelText('Expected salary amount'), '15000');
  fireEvent.changeText(profile.getByLabelText('Employer or salary source'), 'Example Employer');
  fireEvent.press(profile.getByText('Save'));
  expect(await profile.findByText('Saved')).toBeTruthy();
  expect(await financialPlanningService.loadDraft('planning-form-salary')).toBeNull();
  profile.unmount();

  const receipt = renderWithProviders(<SalaryReceiptReview receiptId="receipt-jan" />);
  expect((await receipt.findAllByText('Confirmed')).length).toBeGreaterThan(0);
  expect(await receipt.findByLabelText(/Confirmed.*transaction-salary-jan/)).toBeTruthy();
  fireEvent.press(receipt.getByText('Undo receipt confirmation'));
  expect((await receipt.findAllByText('Undone')).length).toBeGreaterThan(0);
  receipt.unmount();
});

it('submits a three-decimal salary using the selected base currency', async () => {
  changeLocale('en');
  usePreferenceStore.setState({ baseCurrencyCode: 'OMR' });
  await financialPlanningService.discardDraft('planning-form-salary');
  const account = await coreFinanceService.createAccount({
    name: 'Precision account',
    type: 'bank',
    currencyCode: 'OMR',
    openingBalanceMinor: 0,
    institution: null,
    lastFour: null,
    creditLimitMinor: null,
    isDefault: true,
    notes: null
  });
  const save = jest.spyOn(financialPlanningService, 'saveSalaryProfile');
  const profile = renderWithProviders(<SalaryProfileForm />);

  fireEvent.press(
    await profile.findByLabelText(/Receiving account Daily account/)
  );
  fireEvent.press(await profile.findByText('Precision account'));
  fireEvent.changeText(
    profile.getByLabelText('Expected salary amount'),
    '12.345'
  );
  fireEvent.changeText(
    profile.getByLabelText('Employer or salary source'),
    'Precision employer'
  );
  fireEvent.press(profile.getByText('Save'));

  expect(await profile.findByText('Saved')).toBeTruthy();
  expect(save).toHaveBeenLastCalledWith(
    expect.objectContaining({
      expectedAmountMinor: 12_345,
      currencyCode: 'OMR',
      receivingAccountId: account.value.id
    }),
    expect.any(String)
  );
  save.mockRestore();
});

it('guides an unconfigured user to set up a salary cycle', async () => {
  changeLocale('en');
  const emptyService = createMockFinancialPlanningService();
  const emptyCycle = await emptyService.getSalaryOverview({
    today: '2026-08-26',
    timeZone: 'Asia/Riyadh'
  });
  const loadSalary = jest
    .spyOn(financialPlanningService, 'getSalaryOverview')
    .mockResolvedValue(emptyCycle);

  const overview = renderWithProviders(<SalaryOverviewScreen />);

  expect(
    await overview.findByRole('header', { name: 'Plan from payday to payday' })
  ).toBeTruthy();
  expect(
    overview.getByRole('button', { name: 'Salary setup' })
  ).toBeTruthy();
  loadSalary.mockRestore();
});
