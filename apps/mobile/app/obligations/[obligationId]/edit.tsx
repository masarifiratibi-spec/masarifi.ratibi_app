import { useLocalSearchParams } from 'expo-router';

import { ObligationForm } from '@/features/obligations/ObligationForm';

export default function EditObligationRoute() {
  const { obligationId } = useLocalSearchParams<{ obligationId: string }>();
  return <ObligationForm obligationId={obligationId} />;
}
