import { useLocalSearchParams } from 'expo-router';
import { ObligationDetailScreen } from '@/features/obligations/ObligationDetailScreen';

export default function ObligationDetailRoute() {
  const { obligationId } = useLocalSearchParams<{ obligationId: string }>();
  return <ObligationDetailScreen obligationId={obligationId} />;
}
