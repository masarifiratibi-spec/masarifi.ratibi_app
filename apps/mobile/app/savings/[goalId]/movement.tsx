import { useLocalSearchParams } from 'expo-router';

import { SavingsMovementForm } from '@/features/savings/SavingsMovementForm';

export default function SavingsMovementRoute() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  return <SavingsMovementForm goalId={goalId} />;
}
