import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import {
  completeSelectionSession,
  getSelectionSession
} from '@/design-system/components/selection/selection-session';
import { CycleStartDaySelectionScreen } from '@/features/settings/CycleStartDaySelectionScreen';

export default function MonthStartSettingsRoute() {
  const { sessionId = '' } = useLocalSearchParams<{ sessionId?: string }>();
  const session = sessionId ? getSelectionSession<number>(sessionId) : undefined;

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
