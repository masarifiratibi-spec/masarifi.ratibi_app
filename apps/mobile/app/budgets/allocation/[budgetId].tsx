import { useLocalSearchParams } from 'expo-router';

import { BudgetAllocationEditor } from '@/features/budgets/BudgetAllocationEditor';

export default function BudgetAllocationRoute() {
  const { budgetId } = useLocalSearchParams<{ budgetId: string }>();
  return <BudgetAllocationEditor budgetId={budgetId} />;
}
