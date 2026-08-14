import { useLocalSearchParams } from 'expo-router';
import { SavingsGoalDetailScreen } from '@/features/savings/SavingsGoalDetailScreen';

export default function SavingsGoalDetailRoute() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  return <SavingsGoalDetailScreen goalId={goalId} />;
}
