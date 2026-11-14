import {
  loadAssistantDraft,
  saveAssistantDraft,
  discardAssistantDraft
} from '@/storage/app-shell-storage';

export type { AssistantDraft } from '@/storage/app-shell-storage';

export const assistantDraftService = {
  load: loadAssistantDraft,
  save: saveAssistantDraft,
  discard: discardAssistantDraft
};
