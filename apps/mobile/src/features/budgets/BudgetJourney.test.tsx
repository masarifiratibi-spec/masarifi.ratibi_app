import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { changeLocale } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithProviders } from '@/test-utils/render';
import { BudgetAllocationEditor } from './BudgetAllocationEditor';
import { BudgetForm } from './BudgetForm';
import { BudgetOverviewScreen } from './BudgetOverviewScreen';
import { BudgetTransactionsScreen } from './BudgetTransactionsScreen';

it('renders budget overview, form, allocation, and transaction states', async () => {
  changeLocale('en');
  usePreferenceStore.setState({ hideBalances: false });
  const form = renderWithProviders(<BudgetForm />);
  fireEvent.changeText(await form.findByLabelText('Expense limit'), '5000');
  fireEvent.changeText(form.getByLabelText('Income target'), '12000');
  fireEvent.changeText(form.getByLabelText('Savings target'), '2000');
  fireEvent.press(form.getByText('Save'));
  expect(await form.findByText('Saved')).toBeTruthy();
  form.unmount();

  const overview = renderWithProviders(<BudgetOverviewScreen />);
  expect(await overview.findByText('Budgets')).toBeTruthy();
  expect(await overview.findByText('Remaining')).toBeTruthy();
  overview.unmount();

  const allocation = renderWithProviders(<BudgetAllocationEditor budgetId="budget-jan" />);
  fireEvent.changeText(await allocation.findByLabelText('Amount to move'), '100');
  fireEvent.press(allocation.getByText('Review allocation move'));
  expect(await allocation.findByText('Housing: 1,400.00 SAR')).toBeTruthy();
  fireEvent.press(allocation.getByText('Confirm allocation move'));
  expect(await allocation.findByText('Saved')).toBeTruthy();
  allocation.unmount();
  const transactions = renderWithProviders(<BudgetTransactionsScreen budgetId="budget-jan" />);
  expect(await transactions.findByText('Budget transactions')).toBeTruthy();
  expect(await transactions.findByText('2026-01')).toBeTruthy();
  transactions.unmount();
});
