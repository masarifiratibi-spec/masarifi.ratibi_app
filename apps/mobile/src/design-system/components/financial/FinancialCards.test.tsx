import React from 'react';

import { renderWithProviders } from '@/test-utils/render';
import { BudgetCard } from './BudgetCard';
import { InstallmentTimeline } from './InstallmentTimeline';
import { ObligationProgressCard } from './ObligationProgressCard';
import { SavingsGoalCard } from './SavingsGoalCard';

describe('financial composition cards', () => {
  it('renders budget and savings compositions from shared primitives', () => {
    const screen = renderWithProviders(
      <>
        <BudgetCard title="Groceries budget" spent={750} limit={1000} currency="EGP" />
        <SavingsGoalCard title="Emergency fund" saved={3000} target={5000} currency="EGP" />
      </>
    );

    expect(screen.getByText('Groceries budget')).toBeTruthy();
    expect(screen.getByText('-750.00 EGP')).toBeTruthy();
    expect(screen.getByText('75%')).toBeTruthy();
    expect(screen.getByText('Emergency fund')).toBeTruthy();
    expect(screen.getByText('+3,000.00 EGP')).toBeTruthy();
    expect(screen.getByText('60%')).toBeTruthy();
  });

  it('renders obligation progress and installment timeline', () => {
    const screen = renderWithProviders(
      <>
        <ObligationProgressCard title="Car loan" paid={4000} total={10000} currency="EGP" />
        <InstallmentTimeline
          title="Installments"
          items={[
            { label: 'Paid', amount: 1000, currency: 'EGP', status: 'success' },
            { label: 'Next', amount: 1200, currency: 'EGP', status: 'pending' }
          ]}
        />
      </>
    );

    expect(screen.getByText('Car loan')).toBeTruthy();
    expect(screen.getByText('40%')).toBeTruthy();
    expect(screen.getByText('Installments')).toBeTruthy();
    expect(screen.getByText('Paid')).toBeTruthy();
    expect(screen.getByText('Next')).toBeTruthy();
  });
});
