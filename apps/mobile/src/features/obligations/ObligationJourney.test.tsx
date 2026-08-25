import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { changeLocale } from '@/localization/i18n';
import { financialPlanningService } from '@/services/mocks/financial-planning-service';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithProviders } from '@/test-utils/render';
import { ObligationDetailScreen } from './ObligationDetailScreen';
import { ObligationForm } from './ObligationForm';
import { ObligationOverviewScreen } from './ObligationOverviewScreen';

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

it('renders obligation overview, form, and detail states', async () => {
  changeLocale('en');
  const form = renderWithProviders(<ObligationForm />);
  expect(await form.findByLabelText(/Funding account Daily account/)).toBeTruthy();
  fireEvent.changeText(await form.findByLabelText('Title'), 'Home appliance');
  fireEvent.changeText(form.getByLabelText('Contracted total'), '1200');
  fireEvent.changeText(form.getByLabelText('Installment amount'), '100');
  fireEvent.changeText(form.getByLabelText('Number of installments'), '12');
  fireEvent.press(form.getByText('Save'));
  expect(await form.findByText('Saved')).toBeTruthy();
  form.unmount();

  const overview = renderWithProviders(<ObligationOverviewScreen />);
  expect(await overview.findByText('Home appliance')).toBeTruthy();
  expect(await overview.findByLabelText(/Total payable/)).toBeTruthy();
  overview.unmount();

  const detail = renderWithProviders(<ObligationDetailScreen obligationId="obligation-car" />);
  expect(await detail.findByText('Car installment')).toBeTruthy();
  expect(await detail.findByLabelText(/Contracted total/)).toBeTruthy();
  fireEvent.press(detail.getByText('Pause obligation'));
  expect(await detail.findByText('Paused')).toBeTruthy();
  detail.unmount();
});

it.each([
  ['JPY', '12345'],
  ['SAR', '123.45'],
  ['OMR', '12.345']
])(
  'round-trips %s obligation create and edit amounts without changing minor units',
  async (currencyCode, majorAmount) => {
    changeLocale('en');
    usePreferenceStore.setState({ baseCurrencyCode: currencyCode });
    const title = `Precision ${currencyCode} obligation`;
    const createForm = renderWithProviders(<ObligationForm />);

    fireEvent.changeText(await createForm.findByLabelText('Title'), title);
    fireEvent.changeText(createForm.getByLabelText('Contracted total'), majorAmount);
    fireEvent.changeText(createForm.getByLabelText('Installment amount'), majorAmount);
    fireEvent.changeText(createForm.getByLabelText('Number of installments'), '1');
    fireEvent.press(createForm.getByText('Save'));
    expect(await createForm.findByText('Saved')).toBeTruthy();
    createForm.unmount();

    const created = (await financialPlanningService.listObligations({})).items.find(
      (obligation) => obligation.title === title
    );
    expect(created).toMatchObject({
      currencyCode,
      contractedTotalMinor: 12_345,
      installmentAmountMinor: 12_345
    });

    const editForm = renderWithProviders(
      <ObligationForm obligationId={created?.id} />
    );
    await waitFor(() =>
      expect(editForm.getAllByDisplayValue(majorAmount)).toHaveLength(2)
    );
    fireEvent.press(editForm.getByText('Save'));
    expect(await editForm.findByText('Saved')).toBeTruthy();

    const updated = await financialPlanningService.getObligation(created!.id);
    expect(updated.obligation).toMatchObject({
      currencyCode,
      contractedTotalMinor: 12_345,
      installmentAmountMinor: 12_345
    });
  }
);
