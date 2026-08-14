import { useLocalSearchParams } from 'expo-router';

import { SavingsGoalForm } from '@/features/savings/SavingsGoalForm';

export default function EditSavingsGoalRoute() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  return <SavingsGoalForm goalId={goalId} />;
}
