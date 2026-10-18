import { useLocalSearchParams } from 'expo-router';

export default function SavingsMovementRoute() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  const { SavingsMovementForm } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/savings/SavingsMovementForm') as typeof import('@/features/savings/SavingsMovementForm');
  return <SavingsMovementForm goalId={goalId} />;
}
