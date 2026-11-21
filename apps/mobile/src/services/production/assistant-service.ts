import { createLiveAssistantApiService } from '../live/assistant-api-service';
import { captureLiveAssistantClerkIdentity } from '../live/auth-service';
import { iosTextConsent } from '@/storage/ios-text-consent';
import { assistantSecureJournal } from '@/storage/assistant-secure-journal';
export const assistantService = createLiveAssistantApiService({
  identity: captureLiveAssistantClerkIdentity,
  consentStore: iosTextConsent,
    journal: assistantSecureJournal
});
