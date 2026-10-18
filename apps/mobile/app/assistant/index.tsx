import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { AssistantHomeScreen } from '@/features/assistant/AssistantHomeScreen';
import { reportEntryQuestion } from '@/features/assistant/report-entry';
import { usePreferenceStore } from '@/state/preferences';

export default function AssistantRoute() {
  const params = useLocalSearchParams<{action?: string; reportContext?: string}>();
  const locale = usePreferenceStore(state => state.locale);
  return <AssistantHomeScreen initialQuestion={reportEntryQuestion(params, locale)} />;
}
