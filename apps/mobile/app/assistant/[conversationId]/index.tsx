import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { AssistantConversationScreen } from '@/features/assistant/AssistantConversationScreen';

export default function AssistantConversationRoute() {
  const params = useLocalSearchParams<{ conversationId?: string }>();
  return <AssistantConversationScreen conversationId={params.conversationId ?? ''} />;
}
