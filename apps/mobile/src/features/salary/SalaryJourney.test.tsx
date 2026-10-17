import React from 'react';
import { router } from 'expo-router';
import { fireEvent } from '@testing-library/react-native';

import { localDateInTimeZone } from '@/domain/financial-period';
import { financialPlanningKeys } from '@/features/financial-planning/financial-planning-queries';
import { changeLocale, translate } from '@/localization/i18n';
import {
  createMockFinancialPlanningService,
  financialPlanningService
} from '@/services/mocks/financial-planning-service';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithProviders, renderWithQueryData } from '@/test-utils/render';
import { formatDate, formatMinorAmount } from '@/utils/format-financial-value';
import { fixtureSalaryProfile, fixtureSalaryReceipt } from '@/test-utils/financial-planning-fixtures';
import { ThemeContext } from '@/state/theme-context';
import { resolveTheme } from '@/design-system/theme';
import { SalaryOverviewScreen } from './SalaryOverviewScreen';
import { SalaryProfileForm } from './SalaryProfileForm';
import { SalaryReceiptReview } from './SalaryReceiptReview';

it('offers manual receipt confirmation and readable salary details in dark mode', async () => {
  changeLocale('en');
  const push = jest.spyOn(router, 'push').mockImplementation(() => {});
  const dark = resolveTheme('dark');
  const screen = renderWithProviders(
    <ThemeContext.Provider value={{ theme: dark }}><SalaryOverviewScreen /></ThemeContext.Provider>
  );
  try {
    expect(await screen.findByText(translate('planning.salary.spent'))).toHaveStyle({ color: dark.colors.content.secondary });
    fireEvent.press(screen.getByRole('button', { name: translate('planning.salary.confirmReceipt') }));
    expect(push).toHaveBeenCalledWith('/salary/receipt/select');
  } finally { screen.unmount(); push.mockRestore(); }
});

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
  const { findByLabelText, findByText, unmount } = renderWithProviders(
    <SalaryOverviewScreen />
  );
  expect(await findByText('Your salary cycle')).toBeTruthy();
  expect(await findByText('Edit salary settings')).toBeTruthy();
  expect(await findByLabelText(/Remaining from your salary/)).toBeTruthy();
  expect(await findByText(translate('planning.reason.salary_overdue'))).toBeTruthy();
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
    await profile.findByRole('header', { name: 'Salary setup' })
  ).toBeTruthy();
  expect(await profile.findByText('Draft Employer')).toBeTruthy();
  expect(
    await profile.findByLabelText(/Receiving account Daily account/)
  ).toBeTruthy();
  fireEvent.press(
    profile.getByRole('button', { name: /Expected salary amount/ })
  );
  expect(profile.queryByLabelText('Close')).toBeNull();
  fireEvent.changeText(profile.getByDisplayValue('14000'), '15000');
  fireEvent.press(
    profile.getByRole('button', { name: /Employer or salary source/ })
  );
  expect(profile.queryByDisplayValue('15000')).toBeNull();
  fireEvent.changeText(
    profile.getByDisplayValue('Draft Employer'),
    'Example Employer'
  );
  fireEvent.press(profile.getByText('Save'));
  expect(await profile.findByText('Saved')).toBeTruthy();
  expect(
    await financialPlanningService.loadDraft('planning-form-salary')
  ).toBeNull();
  profile.unmount();

  const receipt = renderWithProviders(
    <SalaryReceiptReview receiptId="receipt-jan" />
  );
  expect((await receipt.findAllByText('Confirmed')).length).toBeGreaterThan(0);
  expect(
    await receipt.findByLabelText(/Confirmed.*transaction-salary-jan/)
  ).toBeTruthy();
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
  expect(profile.queryByTestId('account-picker-list')).toBeNull();
  fireEvent.press(await profile.findByText('Precision account'));
  fireEvent.press(
    profile.getByRole('button', { name: /Expected salary amount/ })
  );
  fireEvent.changeText(profile.getByDisplayValue('15000'), '12.345');
  fireEvent.press(
    profile.getByRole('button', { name: /Employer or salary source/ })
  );
  fireEvent.changeText(
    profile.getByDisplayValue('Example Employer'),
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

it('loads the active salary profile before editing', async () => {
  changeLocale('en');
  await financialPlanningService.discardDraft('planning-form-salary');
  const currentProfile = await financialPlanningService.getSalaryProfile();
  const profile = renderWithProviders(<SalaryProfileForm />);

  expect(
    await profile.findByText(
      formatMinorAmount(
        currentProfile!.expectedAmountMinor,
        currentProfile!.currencyCode,
        'en'
      ).replace('\u00a0', ' ')
    )
  ).toBeTruthy();
  expect(profile.getByText(currentProfile!.sourceName)).toBeTruthy();
});

it('keeps multiline Arabic salary copy aligned to the right', async () => {
  changeLocale('ar');
  usePreferenceStore.setState({ locale: 'ar', direction: 'rtl' });
  const profile = renderWithProviders(<SalaryProfileForm />);

  expect(
    await profile.findByText('جهة العمل أو مصدر الراتب')
  ).toHaveStyle({ textAlign: 'left', writingDirection: 'rtl' });
  expect(
    profile.getByText(translate('planning.salary.automaticDetectionSubtitle'))
  ).toHaveStyle({ textAlign: 'left', writingDirection: 'rtl' });
  profile.unmount();
});

it('shows a configured salary cycle before the first receipt', async () => {
  changeLocale('en');
  const configuredService = createMockFinancialPlanningService();
  await configuredService.saveSalaryProfile(
    {
      expectedAmountMinor: 10_000_00,
      currencyCode: 'SAR',
      salaryDay: 25,
      sourceName: 'New employer',
      receivingAccountId: 'account-daily',
      automaticDetectionEnabled: false
    },
    'salary-profile-no-receipt'
  );
  const cycle = await configuredService.getSalaryOverview({
    today: '2026-01-15',
    timeZone: 'Asia/Riyadh'
  });
  const loadSalary = jest
    .spyOn(financialPlanningService, 'getSalaryOverview')
    .mockResolvedValue(cycle);
  const overview = renderWithProviders(<SalaryOverviewScreen />);

  expect(await overview.findByText('Remaining from your salary')).toBeTruthy();
  expect(overview.queryByText('Plan from payday to payday')).toBeNull();
  loadSalary.mockRestore();
});

it('shows the detected transaction before salary confirmation', async () => {
  changeLocale('en');
  const account = (await coreFinanceService.listAccounts())[0];
  const transaction = await coreFinanceService.createTransaction(
    {
      type: 'income',
      amountMinor: 12_000_00,
      currencyCode: 'SAR',
      accountId: account.id,
      destinationAccountId: null,
      feeMinor: 0,
      categoryId: 'salary',
      title: 'Salary',
      merchant: 'Pending employer',
      occurredAt: Date.UTC(2026, 8, 18, 12),
      notes: null
    },
    'pending-salary-transaction',
    'manual'
  );
  const receiptLookup = jest
    .spyOn(financialPlanningService, 'getSalaryReceiptReview')
    .mockResolvedValue(null);
  const receipt = renderWithProviders(
    <SalaryReceiptReview receiptId={transaction.value.id} />
  );

  expect(
    await receipt.findByLabelText(/12,000\.00.*SAR.*Pending employer/)
  ).toBeTruthy();
  receiptLookup.mockRestore();
});

it('prefills the actual expected occurrence for a late manual receipt and shows a confirmation error', async () => {
  changeLocale('en');
  const account = (await coreFinanceService.listAccounts()).find(item=>item.currencyCode==='SAR')!;
  const income = await coreFinanceService.createTransaction({type:'income',amountMinor:5000,currencyCode:'SAR',accountId:account.id,categoryId:'salary',
    title:'Manual salary candidate',occurredAt:Date.parse('2026-09-27T10:00:00Z')},'isolated-manual-review','manual');
  const profile = jest.spyOn(financialPlanningService,'getSalaryProfile').mockResolvedValue({...fixtureSalaryProfile,receivingAccountId:account.id});
  const receipt = jest.spyOn(financialPlanningService,'getSalaryReceiptReview').mockResolvedValue(null);
  const dates = jest.spyOn(financialPlanningService,'listSalaryExpectedDates').mockResolvedValue(['2026-09-25','2026-10-25']);
  const confirm = jest.spyOn(financialPlanningService,'confirmSalaryReceipt').mockRejectedValue(new Error('isolated rejection'));
  const screen = renderWithProviders(<SalaryReceiptReview receiptId={income.value.id} />);
  try {
    expect(await screen.findByText(formatDate(Date.parse('2026-09-25T12:00:00'), 'en'))).toBeTruthy();
    fireEvent.press(screen.getByRole('button',{name:translate('planning.salary.confirmReceipt')}));
    expect(await screen.findByRole('alert')).toHaveTextContent(translate('planning.state.error'));
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({transactionId:income.value.id,expectedOccurrenceDate:'2026-09-25',receivedDate:'2026-09-27'}),expect.any(String));
  } finally {screen.unmount();profile.mockRestore();receipt.mockRestore();dates.mockRestore();confirm.mockRestore();}
});

it('shows receipt undo failures instead of leaving an unexplained old receipt', async () => {
  changeLocale('en');
  const receipt = jest.spyOn(financialPlanningService,'getSalaryReceiptReview').mockResolvedValue(fixtureSalaryReceipt);
  const undo = jest.spyOn(financialPlanningService,'undoSalaryReceipt').mockRejectedValue(new Error('isolated rejection'));
  const screen = renderWithProviders(<SalaryReceiptReview receiptId={fixtureSalaryReceipt.id} />);
  try {
    fireEvent.press(await screen.findByRole('button',{name:translate('planning.salary.undoReceipt')}));
    expect(await screen.findByRole('alert')).toHaveTextContent(translate('planning.state.error'));
  } finally {screen.unmount();receipt.mockRestore();undo.mockRestore();}
});

it.each(['ar', 'en'] as const)(
  'keeps the salary cycle design before setup without invented values in %s',
  async (locale) => {
    changeLocale(locale);
    const timeZone = 'Asia/Riyadh';
    usePreferenceStore.setState({ timeZone, hideBalances: false });
    const today = localDateInTimeZone(Date.now(), timeZone);
    const emptyCycle = await createMockFinancialPlanningService()
      .getSalaryOverview({ today, timeZone });
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    try {
      const overview = renderWithQueryData(<SalaryOverviewScreen />, [
        [financialPlanningKeys.salary(today, timeZone), emptyCycle]
      ]);

      expect(overview.getByRole('header', {
        name: translate('planning.salary.yourCycle')
      })).toBeTruthy();
      expect(overview.getByLabelText(translate('planning.salary.cycleDetails'))).toBeTruthy();
      expect(overview.getAllByText('—')).toHaveLength(7);
      expect(overview.queryByText(translate('planning.salary.emptyTitle'))).toBeNull();
      expect(overview.getByText(translate('planning.salary.emptySubtitle'))).toBeTruthy();
      fireEvent.press(overview.getByRole('button', {
        name: translate('planning.salary.setup')
      }));
      expect(push).toHaveBeenCalledWith('/salary/profile');
    } finally {
      push.mockRestore();
    }
  }
);
