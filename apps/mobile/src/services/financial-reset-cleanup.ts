import { useAppShellStore } from '@/state/app-shell';
import { assistantSecureJournal } from '@/storage/assistant-secure-journal';
import { ownerVoiceAudioReferences } from '@/storage/pending-owner-work';
import { clearPrivacyExportJournal } from '@/storage/privacy-export-journal';
import { HttpError } from './live/http-client';
import { clearOwnerReportPdfCache } from './platform/report-pdf-file';
import { voiceRecorderService } from './platform/voice-recorder-service';

// SQLite still owns the preview IDs and audio references until this cleanup succeeds.
export async function clearExternalFinancialData(
  owner: string,
  previewIds: readonly string[]
) {
  const assertOwner = () => {
    const session = useAppShellStore.getState().session;
    if (session?.status !== 'authenticated' || session.userId !== owner)
      throw new HttpError('session_expired', 401);
  };
  assertOwner();
  await assistantSecureJournal.clearOwner(owner, previewIds);
  assertOwner();
  await clearPrivacyExportJournal(owner);
  assertOwner();
  await clearOwnerReportPdfCache(owner);
  assertOwner();
  for (const uri of await ownerVoiceAudioReferences(owner)) {
    assertOwner();
    await voiceRecorderService.remove(uri);
  }
  assertOwner();
}
