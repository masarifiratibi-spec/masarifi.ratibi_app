import { useLocalSearchParams } from 'expo-router';

import { AssistantActionPreviewScreen } from '@/features/assistant/AssistantActionPreviewScreen';

export default function AssistantActionPreviewRoute() {
  const params = useLocalSearchParams<{ conversationId?: string; previewId?: string }>();
  return <AssistantActionPreviewScreen conversationId={params.conversationId ?? ''} previewId={params.previewId ?? ''} />;
}
