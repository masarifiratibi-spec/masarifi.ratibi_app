import { createLiveAssistantApiService } from '../live/assistant-api-service';
import { captureLiveAssistantClerkIdentity } from '../live/auth-service';
import { assistantSecureJournal } from '@/storage/assistant-secure-journal';
export const assistantService = createLiveAssistantApiService({
  identity: captureLiveAssistantClerkIdentity,
  journal: assistantSecureJournal
});
