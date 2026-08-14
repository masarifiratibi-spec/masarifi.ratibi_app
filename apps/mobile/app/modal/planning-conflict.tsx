import { useLocalSearchParams } from 'expo-router';

import { PlanningConflictScreen } from '@/features/financial-planning/PlanningConflictScreen';

export default function PlanningConflictRoute() {
  const { conflictId } = useLocalSearchParams<{ conflictId: string }>();
  return <PlanningConflictScreen conflictId={conflictId} />;
}
