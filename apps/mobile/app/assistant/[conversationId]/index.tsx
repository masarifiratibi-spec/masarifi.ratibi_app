import React from 'react';
import { useLocalSearchParams } from 'expo-router';

export default function AssistantConversationRoute() {
  const params = useLocalSearchParams<{ conversationId?: string }>();
  const { AssistantConversationScreen } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('@/features/assistant/AssistantConversationScreen') as typeof import('@/features/assistant/AssistantConversationScreen');
  return <AssistantConversationScreen conversationId={params.conversationId ?? ''} />;
}
