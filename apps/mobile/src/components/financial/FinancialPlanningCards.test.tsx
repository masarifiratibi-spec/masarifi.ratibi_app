import React from 'react';

import { BudgetCard } from '@/design-system/components/financial/BudgetCard';
import { ObligationProgressCard } from '@/design-system/components/financial/ObligationProgressCard';
import { SavingsGoalCard } from '@/design-system/components/financial/SavingsGoalCard';
import { renderWithProviders } from '@/test-utils/render';

it('renders zero planning totals without invalid progress text', () => {
  const { getAllByText } = renderWithProviders(
    <>
      <BudgetCard title="Budget" spent={0} limit={0} currency="SAR" />
      <ObligationProgressCard title="Debt" paid={0} total={0} currency="SAR" />
      <SavingsGoalCard title="Goal" saved={0} target={0} currency="SAR" />
    </>
  );
  expect(getAllByText('0%')).toHaveLength(3);
});
