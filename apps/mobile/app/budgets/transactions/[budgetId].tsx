import { useLocalSearchParams } from 'expo-router';
import { BudgetTransactionsScreen } from '@/features/budgets/BudgetTransactionsScreen';

export default function BudgetTransactionsRoute() {
  const { budgetId } = useLocalSearchParams<{ budgetId: string }>();
  return <BudgetTransactionsScreen budgetId={budgetId} />;
}
