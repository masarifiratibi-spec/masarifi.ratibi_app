import { assistantSecureJournal } from '@/storage/assistant-secure-journal';
import { ownerVoiceAudioReferences } from '@/storage/pending-owner-work';
import { clearPrivacyExportJournal } from '@/storage/privacy-export-journal';
import { useAppShellStore } from '@/state/app-shell';
import { clearOwnerReportPdfCache } from './platform/report-pdf-file';
import { voiceRecorderService } from './platform/voice-recorder-service';
import { clearExternalFinancialData } from './financial-reset-cleanup';

jest.mock('@/storage/assistant-secure-journal', () => ({assistantSecureJournal:{clearOwner:jest.fn()}}));
jest.mock('@/storage/pending-owner-work');
jest.mock('@/storage/privacy-export-journal');
jest.mock('./platform/report-pdf-file');
jest.mock('./platform/voice-recorder-service', () => ({voiceRecorderService:{remove:jest.fn()}}));

beforeEach(() => {
  jest.clearAllMocks();
  useAppShellStore.setState({session:{status:'authenticated', userId:'owner-a'} as never});
  jest.mocked(ownerVoiceAudioReferences).mockResolvedValue(['file:///cache/Audio/sample.m4a']);
});
it('retains an incomplete purge for retry when owned device audio cannot be erased', async () => {
  jest.mocked(voiceRecorderService.remove).mockRejectedValueOnce(new Error('media locked'));
  await expect(clearExternalFinancialData('owner-a', ['preview-a'])).rejects.toThrow('media locked');
  await clearExternalFinancialData('owner-a', ['preview-a']);
  expect(assistantSecureJournal.clearOwner).toHaveBeenCalledWith('owner-a', ['preview-a']);
  expect(clearPrivacyExportJournal).toHaveBeenCalledWith('owner-a');
  expect(clearOwnerReportPdfCache).toHaveBeenCalledWith('owner-a');
  expect(voiceRecorderService.remove).toHaveBeenCalledTimes(2);
});
it('never erases another owner’s files', async () => {
  await expect(clearExternalFinancialData('owner-b', [])).rejects.toMatchObject({code:'session_expired'});
  expect(assistantSecureJournal.clearOwner).not.toHaveBeenCalled();
  expect(voiceRecorderService.remove).not.toHaveBeenCalled();
});
