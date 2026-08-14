import { useLocalSearchParams } from 'expo-router';
import { BudgetForm } from '@/features/budgets/BudgetForm';

export default function EditBudgetRoute() {
  const { budgetId } = useLocalSearchParams<{ budgetId: string }>();
  return <BudgetForm budgetId={budgetId} />;
}
