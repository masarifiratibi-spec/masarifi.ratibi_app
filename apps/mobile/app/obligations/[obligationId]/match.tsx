import { useLocalSearchParams } from 'expo-router';
import { PaymentMatchReviewScreen } from '@/features/obligations/PaymentMatchReviewScreen';

export default function PaymentMatchRoute() {
  const { obligationId, matchId } = useLocalSearchParams<{ obligationId: string; matchId?: string }>();
  return <PaymentMatchReviewScreen matchId={matchId ?? obligationId} />;
}
