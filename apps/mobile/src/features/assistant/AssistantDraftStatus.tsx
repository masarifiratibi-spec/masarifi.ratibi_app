import React from 'react';
import { StateView } from '@/design-system/components/feedback/StateView';
import { translate } from '@/localization/i18n';
import type { useAssistantDraft } from './useAssistantDraft';

export function AssistantDraftStatus({
  draft
}: {
  draft: ReturnType<typeof useAssistantDraft>;
}) {
  if (!draft.failure) return null;
  return (
    <StateView
      state="error"
      title={translate(
        draft.failure === 'restore'
          ? 'assistant.draft.restoreFailed'
          : 'assistant.draft.saveFailed'
      )}
      actionLabel={translate('coreFinance.action.retry')}
      onAction={draft.retry}
    />
  );
}
