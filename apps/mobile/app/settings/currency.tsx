import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import {
  completeSelectionSession,
  getSelectionSession
} from '@/design-system/components/selection/selection-session';
import { CurrencySelectionScreen } from '@/features/settings/CurrencySelectionScreen';

export default function CurrencySettingsRoute() {
  const { sessionId = '' } = useLocalSearchParams<{ sessionId?: string }>();
  const session = sessionId ? getSelectionSession<string>(sessionId) : undefined;

  return (
    <CurrencySelectionScreen
      selectedCurrencyCode={session?.selectedId ?? undefined}
      onSelectCurrency={
        session
          ? (code) => {
              completeSelectionSession(sessionId, code);
            }
          : undefined
      }
    />
  );
}
