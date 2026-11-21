import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearPrivacyExportJournal,
  loadPrivacyExportJournal,
  savePrivacyExportJournal
} from './privacy-export-journal';
const operationId = '00000000-0000-4000-8000-000000000001';
beforeEach(async () => {
  await AsyncStorage.clear();
});
it('restores only the selected owner replay identifiers and removes them independently', async () => {
  await savePrivacyExportJournal('owner_a', {
    operationId,
    requestId: 'request_a'
  });
  await savePrivacyExportJournal('owner_b', {
    operationId,
    requestId: 'request_b'
  });
  expect(await loadPrivacyExportJournal('owner_a')).toEqual({
    operationId,
    requestId: 'request_a'
  });
  await clearPrivacyExportJournal('owner_a');
  expect(await loadPrivacyExportJournal('owner_a')).toBeNull();
  expect(await loadPrivacyExportJournal('owner_b')).toEqual({
    operationId,
    requestId: 'request_b'
  });
});
it('refuses financial or signed-link fields instead of persisting them', async () => {
  await expect(
    savePrivacyExportJournal('owner_a', {
      operationId,
      downloadUrl: 'https://storage.example.com/private'
    } as never)
  ).rejects.toThrow();
  expect(await loadPrivacyExportJournal('owner_a')).toBeNull();
});
it('surfaces a corrupted journal and rejects missing owner identity', async () => {
  await AsyncStorage.setItem('masarifi.export.owner_a', 'invalid-json');
  await expect(loadPrivacyExportJournal('owner_a')).rejects.toThrow();
  await expect(loadPrivacyExportJournal('')).rejects.toThrow(
    'EXPORT_OWNER_INVALID'
  );
});
