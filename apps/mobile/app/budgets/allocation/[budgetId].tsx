import { useLocalSearchParams } from 'expo-router';

export default function BudgetAllocationRoute() {
  const { budgetId } = useLocalSearchParams<{ budgetId: string }>();
  const { BudgetAllocationEditor } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/budgets/BudgetAllocationEditor') as typeof import('@/features/budgets/BudgetAllocationEditor');
  return <BudgetAllocationEditor budgetId={budgetId} />;
}
