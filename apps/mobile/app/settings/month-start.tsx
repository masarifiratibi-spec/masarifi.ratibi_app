import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import {
  completeSelectionSession,
  getSelectionSession
} from '@/design-system/components/selection/selection-session';

export default function MonthStartSettingsRoute() {
  const { sessionId = '' } = useLocalSearchParams<{ sessionId?: string }>();
  const session = sessionId ? getSelectionSession<number>(sessionId) : undefined;

  const { CycleStartDaySelectionScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/settings/CycleStartDaySelectionScreen') as typeof import('@/features/settings/CycleStartDaySelectionScreen');
  return (
    <CycleStartDaySelectionScreen
      selectedDay={session?.selectedId ?? undefined}
      onSelectDay={
        session
          ? (day) => {
              completeSelectionSession(sessionId, day);
            }
          : undefined
      }
    />
  );
}
