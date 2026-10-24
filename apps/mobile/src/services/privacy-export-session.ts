import { randomUUID } from 'expo-crypto';
import {
  loadPrivacyExportJournal,
  savePrivacyExportJournal,
  type PrivacyExportJournal
} from '@/storage/privacy-export-journal';
import type { SettingsService } from '@/services/contracts/assistant-notifications-service';

// One owner-scoped export operation survives retries without persisting signed links.
export function createPrivacyExportSession(owner: string) {
  let journal: PrivacyExportJournal | null = null;
  return {
    async restore() {
      journal = await loadPrivacyExportJournal(owner);
      return journal?.requestId;
    },
    async request(
      service: Pick<SettingsService, 'requestPrivacyAction'>,
      assertCurrent: () => void,
      newRequest = false
    ) {
      assertCurrent();
      if (newRequest) journal = null;
      journal ??= { operationId: randomUUID() };
      await savePrivacyExportJournal(owner, journal);
      assertCurrent();
      if (!journal.requestId) {
        const result = await service.requestPrivacyAction(
          'data_export',
          journal.operationId
        );
        assertCurrent();
        journal.requestId = result.value.id;
        await savePrivacyExportJournal(owner, journal);
        assertCurrent();
      }
      return journal.requestId;
    }
  };
}
