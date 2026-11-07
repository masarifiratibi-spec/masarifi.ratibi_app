import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { reportEntryQuestion } from '@/features/assistant/report-entry';
import { usePreferenceStore } from '@/state/preferences';

export default function AssistantRoute() {
  const params = useLocalSearchParams<{action?: string; reportContext?: string}>();
  const locale = usePreferenceStore(state => state.locale);
  const { AssistantHomeScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/assistant/AssistantHomeScreen') as typeof import('@/features/assistant/AssistantHomeScreen');
  return <AssistantHomeScreen initialQuestion={reportEntryQuestion(params, locale)} />;
}
