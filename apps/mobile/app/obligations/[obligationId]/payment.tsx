import { useLocalSearchParams } from 'expo-router';
import { ObligationPaymentScreen } from '@/features/obligations/ObligationPaymentScreen';

export default function ObligationPaymentRoute() {
  const { obligationId } = useLocalSearchParams<{ obligationId: string }>();
  return <ObligationPaymentScreen obligationId={obligationId} />;
}
