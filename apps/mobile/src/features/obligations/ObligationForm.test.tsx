import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';

import { changeLocale, translate } from '@/localization/i18n';
import { financialPlanningKeys } from '@/features/financial-planning/financial-planning-queries';
import { financialPlanningService } from '@/services/mocks/financial-planning-service';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithProviders, renderWithQueryData } from '@/test-utils/render';
import { ObligationForm } from './ObligationForm';

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default
);

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

beforeEach(async () => {
  changeLocale('en');
  usePreferenceStore.setState({
    locale: 'en',
    direction: 'ltr',
    baseCurrencyCode: 'SAR'
  });
  await financialPlanningService.discardDraft('planning-form-obligation:new');
});

it('saves a single payment directly from the short form without a car default', async () => {
  const screen = renderWithProviders(<ObligationForm />);
  fireEvent.changeText(
    await screen.findByLabelText('Obligation name'),
    'Single payment'
  );
  expect(screen.queryByText('Next')).toBeNull();
  expect(screen.queryByText('Review')).toBeNull();
  expect(screen.queryByLabelText('Provider or person')).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Amount'), '١٢٣٫٤٥');
  fireEvent.press(screen.getByRole('button', { name: 'Save obligation' }));
  expect(await screen.findByText('Saved')).toBeTruthy();
  const item = (await financialPlanningService.listObligations({})).items.find(
    (item) => item.title === 'Single payment'
  );
  expect(item).toMatchObject({
    type: 'custom',
    contractedTotalMinor: 12345,
    installmentAmountMinor: 12345,
    installmentCount: 1,
    scheduleKind: 'fixed_term'
  });
  expect(
    (await financialPlanningService.getObligation(item!.id)).schedule
  ).toMatchObject([{ scheduledMinor: 12345 }]);
});

it('calculates installments and a smaller final payment in minor units', async () => {
  const screen = renderWithProviders(<ObligationForm />);
  fireEvent.changeText(
    await screen.findByLabelText('Obligation name'),
    'Calculated installments'
  );
  fireEvent.press(screen.getByRole('button', { name: 'Installments' }));
  fireEvent.changeText(screen.getByLabelText('Contracted total'), '١٢٠٠');
  fireEvent.changeText(screen.getByLabelText('Monthly installment'), '٥٠٠');
  expect(screen.getByText(/3 payments.*200.00/)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Save obligation' }));
  await screen.findByText('Saved');
  const item = (await financialPlanningService.listObligations({})).items.find(
    (item) => item.title === 'Calculated installments'
  );
  const detail = await financialPlanningService.getObligation(item!.id);
  expect(item).toMatchObject({
    contractedTotalMinor: 120000,
    installmentAmountMinor: 50000,
    installmentCount: 3
  });
  expect(detail.schedule.map((entry) => entry.scheduledMinor)).toEqual([
    50000, 50000, 20000
  ]);
});

it('saves yearly recurring payments without inventing a contracted total', async () => {
  const screen = renderWithProviders(<ObligationForm />);
  fireEvent.changeText(
    await screen.findByLabelText('Obligation name'),
    'Yearly subscription'
  );
  fireEvent.press(screen.getByRole('button', { name: 'Recurring' }));
  fireEvent.changeText(screen.getByLabelText('Payment amount'), '200');
  fireEvent.press(screen.getByRole('button', { name: 'Yearly' }));
  fireEvent.press(screen.getByRole('button', { name: 'Save obligation' }));
  await screen.findByText('Saved');
  const item = (await financialPlanningService.listObligations({})).items.find(
    (item) => item.title === 'Yearly subscription'
  );
  expect(item).toMatchObject({
    scheduleKind: 'open_ended',
    frequency: 'yearly',
    contractedTotalMinor: 0,
    installmentAmountMinor: 20000,
    installmentCount: null,
    endDate: null
  });
});

it('shows a field error and leaves the ledger unchanged for an excessive installment', async () => {
  const screen = renderWithProviders(<ObligationForm />);
  fireEvent.changeText(
    await screen.findByLabelText('Obligation name'),
    'Invalid installment'
  );
  fireEvent.press(screen.getByRole('button', { name: 'Installments' }));
  fireEvent.changeText(screen.getByLabelText('Contracted total'), '100');
  fireEvent.changeText(screen.getByLabelText('Monthly installment'), '200');
  fireEvent.press(screen.getByRole('button', { name: 'Save obligation' }));
  expect(
    await screen.findByText(
      'Enter an installment no greater than the remaining balance.'
    )
  ).toBeTruthy();
  expect(
    (await financialPlanningService.listObligations({})).items.some(
      (item) => item.title === 'Invalid installment'
    )
  ).toBe(false);
});

it('preserves legacy draft values and custom installment counts', async () => {
  await financialPlanningService.saveDraft({
    id: 'planning-form-obligation:new',
    kind: 'obligation',
    entityId: null,
    status: 'editing',
    updatedAt: Date.now(),
    payload: {
      step: 2,
      direction: 'receivable',
      type: 'debt',
      scheduleKind: 'fixed_term',
      title: 'Restored balloon plan',
      total: '1200',
      installment: '100',
      count: '3',
      startDate: '2026-11-01',
      provider: 'Family'
    }
  });
  const screen = renderWithProviders(<ObligationForm />);
  expect(await screen.findByDisplayValue('Restored balloon plan')).toBeTruthy();
  expect(screen.getByLabelText('Monthly installment')).toHaveProp(
    'value',
    '100'
  );
  fireEvent.press(screen.getByRole('button', { name: 'Save obligation' }));
  await screen.findByText('Saved');
  const item = (await financialPlanningService.listObligations({})).items.find(
    (item) => item.title === 'Restored balloon plan'
  );
  expect(item).toMatchObject({
    direction: 'receivable',
    type: 'debt',
    provider: 'Family',
    installmentCount: 3
  });
});

it('recalculates an invalid hidden count from a legacy draft', async () => {
  await financialPlanningService.saveDraft({
    id: 'planning-form-obligation:new',
    kind: 'obligation',
    entityId: null,
    status: 'editing',
    updatedAt: Date.now(),
    payload: {
      scheduleKind: 'fixed_term',
      title: 'Legacy count corrected',
      total: '100',
      installment: '50',
      count: '3',
      startDate: '2026-11-01'
    }
  });
  const screen = renderWithProviders(<ObligationForm />);
  await screen.findByDisplayValue('Legacy count corrected');
  expect(screen.getByText(/2 payments.*50.00/)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Save obligation' }));
  await screen.findByText('Saved');
  expect(
    (await financialPlanningService.listObligations({})).items.find(
      (item) => item.title === 'Legacy count corrected'
    )
  ).toMatchObject({ installmentCount: 2 });
});

it('keeps a valid balloon plan when an amount is only reformatted', async () => {
  await financialPlanningService.saveDraft({
    id: 'planning-form-obligation:new',
    kind: 'obligation',
    entityId: null,
    status: 'editing',
    updatedAt: Date.now(),
    payload: {
      scheduleKind: 'fixed_term',
      title: 'Same value different format',
      total: '1200',
      installment: '100',
      count: '3',
      startDate: '2026-11-01'
    }
  });
  const screen = renderWithProviders(<ObligationForm />);
  await screen.findByDisplayValue('Same value different format');
  fireEvent.changeText(screen.getByLabelText('Contracted total'), '1200.00');
  expect(screen.getByText(/3 payments.*1,000.00/)).toBeTruthy();
});

it('renders the short Arabic form and reveals optional fields on demand', async () => {
  changeLocale('ar');
  usePreferenceStore.setState({ locale: 'ar', direction: 'rtl' });
  const screen = renderWithProviders(<ObligationForm />);
  expect(await screen.findByLabelText('اسم الالتزام')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'حفظ الالتزام' })).toBeTruthy();
  expect(screen.queryByLabelText('الجهة أو الشخص')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'تفاصيل اختيارية' }));
  expect(screen.getByLabelText('الجهة أو الشخص')).toBeTruthy();
});

it('starts a monthly installment plan after switching from yearly recurrence', async () => {
  const screen = renderWithProviders(<ObligationForm />);
  fireEvent.changeText(
    await screen.findByLabelText('Obligation name'),
    'Switched payment method'
  );
  fireEvent.press(screen.getByRole('button', { name: 'Recurring' }));
  fireEvent.press(screen.getByRole('button', { name: 'Yearly' }));
  fireEvent.press(screen.getByRole('button', { name: 'Installments' }));
  fireEvent.changeText(screen.getByLabelText('Contracted total'), '1000');
  fireEvent.changeText(screen.getByLabelText('Monthly installment'), '250');
  fireEvent.press(screen.getByRole('button', { name: 'Save obligation' }));
  await screen.findByText('Saved');
  expect(
    (await financialPlanningService.listObligations({})).items.find(
      (item) => item.title === 'Switched payment method'
    )
  ).toMatchObject({ frequency: 'monthly', installmentCount: 4 });
});

it('does not create another obligation on rapid or repeated save presses', async () => {
  const screen = renderWithProviders(<ObligationForm />);
  fireEvent.changeText(
    await screen.findByLabelText('Obligation name'),
    'Only one payment'
  );
  fireEvent.changeText(screen.getByLabelText('Amount'), '10');
  const save = screen.getByRole('button', { name: 'Save obligation' });
  fireEvent.press(save);
  fireEvent.press(save);
  await screen.findByText('Saved');
  fireEvent.press(save);
  expect(
    (await financialPlanningService.listObligations({})).items.filter(
      (item) => item.title === 'Only one payment'
    )
  ).toHaveLength(1);
  await waitFor(async () =>
    expect(
      await financialPlanningService.loadDraft('planning-form-obligation:new')
    ).toBeNull()
  );
});

it('preserves paid amounts, payment cadence and metadata when editing a yearly plan', async () => {
  const created = await financialPlanningService.createObligation(
    {
      direction: 'payable',
      type: 'debt',
      scheduleKind: 'fixed_term',
      frequency: 'yearly',
      title: 'Existing yearly plan',
      currencyCode: 'SAR',
      contractedTotalMinor: 120000,
      openingPaidMinor: 20000,
      installmentAmountMinor: 20000,
      installmentCount: 3,
      dueDay: 31,
      startDate: '2026-01-31',
      endDate: '2028-01-31',
      notes: 'Preserve notes',
      providerKeywords: ['Loan provider'],
      reminderTiming: 'before_due'
    },
    'yearly-edit-fixture'
  );
  const screen = renderWithProviders(
    <ObligationForm obligationId={created.value.id} />
  );
  expect(await screen.findByDisplayValue('Existing yearly plan')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Save obligation' }));
  await screen.findByText('Saved');
  expect(
    (await financialPlanningService.getObligation(created.value.id)).obligation
  ).toMatchObject({
    openingPaidMinor: 20000,
    frequency: 'yearly',
    installmentCount: 3,
    endDate: '2028-01-31',
    notes: 'Preserve notes',
    providerKeywords: ['Loan provider'],
    reminderTiming: 'before_due'
  });
});

it('keeps a restored and edited working copy bound to its original version after a background refresh', async () => {
  const created = await financialPlanningService.createObligation({
    direction: 'payable', type: 'custom', scheduleKind: 'fixed_term',
    title: 'Original server name', currencyCode: 'SAR',
    contractedTotalMinor: 1000, installmentAmountMinor: 1000,
    installmentCount: 1, startDate: '2026-11-04'
  }, 'working-copy-create');
  const id = created.value.id;
  const original = await financialPlanningService.getObligation(id);
  await financialPlanningService.saveDraft({
    id: `planning-form-obligation:${id}`, kind: 'obligation', entityId: id,
    status: 'editing', updatedAt: Date.now(),
    payload: { title: 'Restored draft name', amount: '10' }
  });
  let client!: QueryClient;
  function CacheBoundary() {
    client = useQueryClient();
    return <ObligationForm obligationId={id} />;
  }
  const screen = renderWithQueryData(<CacheBoundary />, [
    [financialPlanningKeys.obligation(id), original]
  ]);
  await screen.findByDisplayValue('Restored draft name');
  fireEvent.changeText(screen.getByLabelText('Obligation name'), 'Unsaved typed name');
  await financialPlanningService.updateObligation(id, original.obligation.version, {
    ...original.obligation, title: 'Concurrent server name'
  }, 'working-copy-concurrent-update');
  const refreshed = await financialPlanningService.getObligation(id);
  await act(async () => {
    client.setQueryData(financialPlanningKeys.obligation(id), refreshed);
  });
  expect(screen.getByLabelText('Obligation name').props.value).toBe('Unsaved typed name');
  fireEvent.press(screen.getByRole('button', { name: 'Save obligation' }));
  await screen.findByText(translate('planning.state.error'));
  expect((await financialPlanningService.getObligation(id)).obligation).toMatchObject({
    title: 'Concurrent server name', version: refreshed.obligation.version
  });
});
