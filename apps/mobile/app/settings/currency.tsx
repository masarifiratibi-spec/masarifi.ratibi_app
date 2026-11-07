import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import {
  completeSelectionSession,
  getSelectionSession
} from '@/design-system/components/selection/selection-session';

export default function CurrencySettingsRoute() {
  const { sessionId = '' } = useLocalSearchParams<{ sessionId?: string }>();
  const session = sessionId ? getSelectionSession<string>(sessionId) : undefined;

  const { CurrencySelectionScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/settings/CurrencySelectionScreen') as typeof import('@/features/settings/CurrencySelectionScreen');
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
