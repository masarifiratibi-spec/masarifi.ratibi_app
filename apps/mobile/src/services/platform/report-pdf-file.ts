import { requireOptionalNativeModule } from 'expo';
import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export interface SavedReportPdf {
  uri: string;
  cacheUri: string;
  name: string;
  bytes: number;
}
const maxBytes = 52_428_800;
const mimeType = 'application/pdf';

/** Saves the existing server-generated PDF; it does not generate a report or share it. */
export async function saveReportPdf(
  attempt: { id: string; downloadUrl?: string; downloadUrlExpiresAt?: number },
  assertCurrent: () => void,
  signal?: AbortSignal
): Promise<SavedReportPdf> {
  assertCurrent();
  if (
    !attempt.downloadUrl ||
    new URL(attempt.downloadUrl).protocol !== 'https:' ||
    !Number.isFinite(attempt.downloadUrlExpiresAt) ||
    (attempt.downloadUrlExpiresAt ?? 0) <= Date.now() ||
    !/^[A-Za-z0-9-]{1,64}$/.test(attempt.id)
  )
    throw new Error('REPORT_DOWNLOAD_INVALID');
  if (Platform.OS !== 'android' || !FileSystem.cacheDirectory)
    throw new Error('REPORT_SAVE_UNAVAILABLE');
  const cacheUri = `${FileSystem.cacheDirectory}masarifi-report-${randomUUID()}.pdf`;
  const name = `Masarifi-report-${attempt.id}.pdf`;
  let created: string | undefined;
  let completed = false;
  let tooLarge = false;
  const transfer = FileSystem.createDownloadResumable(
    attempt.downloadUrl,
    cacheUri,
    {},
    (progress) => {
      if (
        progress.totalBytesWritten > maxBytes ||
        progress.totalBytesExpectedToWrite > maxBytes
      ) {
        tooLarge = true;
        void transfer.pauseAsync().catch(() => undefined);
      }
    }
  );
  const abort = () => {
    void transfer.pauseAsync().catch(() => undefined);
  };
  signal?.addEventListener('abort', abort, { once: true });
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    if (signal?.aborted) throw new Error('REPORT_SAVE_CANCELLED');
    const response = await Promise.race([
      transfer.downloadAsync(),
      new Promise<never>((_, reject) => {
        deadline = setTimeout(
          () => reject(new Error('REPORT_DOWNLOAD_TIMEOUT')),
          60_000
        );
      })
    ]);
    if (deadline) {
      clearTimeout(deadline);
      deadline = undefined;
    }
    assertCurrent();
    if (signal?.aborted) throw new Error('REPORT_SAVE_CANCELLED');
    if (tooLarge) throw new Error('REPORT_PDF_TOO_LARGE');
    const source = new File(cacheUri);
    const bytes = source.size;
    if (
      !response ||
      response.status !== 200 ||
      !Number.isSafeInteger(bytes) ||
      bytes < 12 ||
      bytes > maxBytes
    )
      throw new Error('REPORT_PDF_INVALID');
    const reader = source.open();
    try {
      const header = String.fromCharCode(...reader.readBytes(5));
      reader.offset = Math.max(0, bytes - 1024);
      const tail = String.fromCharCode(...reader.readBytes(1024));
      if (header !== '%PDF-' || !tail.includes('%%EOF'))
        throw new Error('REPORT_PDF_INVALID');
      const permission =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      assertCurrent();
      if (!permission.granted || signal?.aborted)
        throw new Error('REPORT_SAVE_CANCELLED');
      if (!permission.directoryUri.startsWith('content://'))
        throw new Error('REPORT_SAVE_UNAVAILABLE');
      created = await FileSystem.StorageAccessFramework.createFileAsync(
        permission.directoryUri,
        name.slice(0, -4),
        mimeType
      );
      assertCurrent();
      const destination = new File(created);
      reader.offset = 0;
      while ((reader.offset ?? bytes) < bytes) {
        assertCurrent();
        if (signal?.aborted) throw new Error('REPORT_SAVE_CANCELLED');
        const chunk = reader.readBytes(
          Math.min(65_536, bytes - (reader.offset ?? bytes))
        );
        if (!chunk.length) throw new Error('REPORT_PDF_INVALID');
        destination.write(chunk, { append: true });
      }
      if (destination.size !== bytes) throw new Error('REPORT_PDF_INVALID');
      assertCurrent();
      completed = true;
      return { uri: created, cacheUri, name, bytes };
    } finally {
      reader.close();
    }
  } finally {
    if (deadline) clearTimeout(deadline);
    signal?.removeEventListener('abort', abort);
    if (!completed) {
      await transfer.pauseAsync().catch(() => undefined);
      await FileSystem.deleteAsync(cacheUri, { idempotent: true }).catch(
        () => undefined
      );
      if (created)
        await FileSystem.deleteAsync(created, { idempotent: true }).catch(
          () => undefined
        );
    }
  }
}

export async function openReportPdf(
  file: SavedReportPdf,
  assertCurrent: () => void
) {
  assertCurrent();
  if (!requireOptionalNativeModule('ExpoIntentLauncher'))
    throw new Error('REPORT_FILE_NATIVE_UPDATE_REQUIRED');
  const intents = await import('expo-intent-launcher');
  assertCurrent();
  await intents.startActivityAsync('android.intent.action.VIEW', {
    data: file.uri,
    type: mimeType,
    flags: 1
  });
}

export async function shareReportPdf(
  file: SavedReportPdf,
  assertCurrent: () => void
) {
  assertCurrent();
  if (!requireOptionalNativeModule('ExpoSharing'))
    throw new Error('REPORT_FILE_NATIVE_UPDATE_REQUIRED');
  const sharing = await import('expo-sharing');
  assertCurrent();
  if (!(await sharing.isAvailableAsync()))
    throw new Error('REPORT_SHARE_UNAVAILABLE');
  assertCurrent();
  await sharing.shareAsync(file.cacheUri, { mimeType, UTI: 'com.adobe.pdf' });
}

export async function removeReportPdfCache(file: SavedReportPdf) {
  if (
    FileSystem.cacheDirectory &&
    file.cacheUri.startsWith(`${FileSystem.cacheDirectory}masarifi-report-`) &&
    /^masarifi-report-[A-Za-z0-9-]+\.pdf$/.test(
      file.cacheUri.split('/').at(-1) ?? ''
    )
  )
    await FileSystem.deleteAsync(file.cacheUri, { idempotent: true });
}
