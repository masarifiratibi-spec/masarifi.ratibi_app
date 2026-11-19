import { useLocalSearchParams } from 'expo-router';
import { BudgetOverviewScreen } from '@/features/budgets/BudgetOverviewScreen';

export default function BudgetsRoute() {
  const { periodKey } = useLocalSearchParams<{ periodKey?: string }>();
  return (
    <BudgetOverviewScreen
      periodKey={
        typeof periodKey === 'string' &&
        /^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey)
          ? periodKey
          : undefined
      }
    />
  );
}
