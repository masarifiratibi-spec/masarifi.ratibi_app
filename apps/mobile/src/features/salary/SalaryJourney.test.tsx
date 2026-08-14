import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { changeLocale } from '@/localization/i18n';
import { financialPlanningService } from '@/services/mocks/financial-planning-service';
import { renderWithProviders } from '@/test-utils/render';
import { SalaryOverviewScreen } from './SalaryOverviewScreen';
import { SalaryProfileForm } from './SalaryProfileForm';
import { SalaryReceiptReview } from './SalaryReceiptReview';

it('renders salary overview, setup, and receipt review states', async () => {
  changeLocale('en');
  const { findByText, unmount } = renderWithProviders(<SalaryOverviewScreen />);
  expect(await findByText('Salary cycle')).toBeTruthy();
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
  expect(await profile.findByDisplayValue('Draft Employer')).toBeTruthy();
  fireEvent.changeText(profile.getByLabelText('Expected salary amount'), '15000');
  fireEvent.changeText(profile.getByLabelText('Employer or salary source'), 'Example Employer');
  fireEvent.press(profile.getByText('Save'));
  expect(await profile.findByText('Saved')).toBeTruthy();
  expect(await financialPlanningService.loadDraft('planning-form-salary')).toBeNull();
  profile.unmount();

  const receipt = renderWithProviders(<SalaryReceiptReview receiptId="receipt-jan" />);
  expect(await receipt.findByText('Confirmed')).toBeTruthy();
  fireEvent.press(receipt.getByText('Undo receipt confirmation'));
  expect(await receipt.findByText('Undone')).toBeTruthy();
  receipt.unmount();
});
