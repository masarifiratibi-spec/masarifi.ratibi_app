import { router, useLocalSearchParams } from 'expo-router';

import { RouteModalContainer } from '@/design-system/components/overlays/RouteModalContainer';
import { PlanningConflictScreen } from '@/features/financial-planning/PlanningConflictScreen';
import { translate } from '@/localization/i18n';

export default function PlanningConflictRoute() {
  const { conflictId } = useLocalSearchParams<{ conflictId: string }>();
  return (
    <RouteModalContainer
      closeLabel={translate('appShell.navigation.close')}
      onDismiss={() => router.back()}
      title={translate('planning.conflict.title')}
    >
      <PlanningConflictScreen conflictId={conflictId} />
    </RouteModalContainer>
  );
}
