import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { saveReportPdf } from './report-pdf-file';

const pdf = new Uint8Array(
  Array.from('%PDF-1.7\nSynthetic test boundary\n%%EOF', (c) => c.charCodeAt(0))
);
let mockFileBytes: Uint8Array;
const mockWrite = jest.fn();
const mockClose = jest.fn();
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({
    get size() {
      return mockFileBytes.length;
    },
    open: () => {
      const handle = {
        offset: 0,
        close: mockClose,
        readBytes: (length: number) => {
          const data = mockFileBytes.slice(
            handle.offset,
            handle.offset + length
          );
          handle.offset += data.length;
          return data;
        }
      };
      return handle;
    },
    write: (bytes: Uint8Array, options: unknown) =>
      mockWrite(uri, bytes, options)
  }))
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => '00000000-0000-4000-8000-000000000022'
}));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  createDownloadResumable: jest.fn(),
  deleteAsync: jest.fn(async () => undefined),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(),
    createFileAsync: jest.fn()
  }
}));
const attempt = {
  id: 'attempt-1',
  downloadUrl: 'https://storage.example.test/signed.pdf',
  downloadUrlExpiresAt: 9999999999999
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'android');
  mockFileBytes = pdf;
  jest
    .mocked(FileSystem.createDownloadResumable)
    .mockReturnValue({
      downloadAsync: async () => ({
        status: 200,
        headers: { 'Content-Type': 'application/pdf' }
      }),
      pauseAsync: jest.fn(async () => ({}))
    } as never);
  jest
    .mocked(FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync)
    .mockResolvedValue({
      granted: true,
      directoryUri: 'content://documents/tree/exports'
    });
  jest
    .mocked(FileSystem.StorageAccessFramework.createFileAsync)
    .mockResolvedValue('content://documents/report.pdf');
});

test('validates and copies the actual PDF to the user-selected Android folder, without launching another app', async () => {
  const saved = await saveReportPdf(attempt, () => undefined);
  expect(saved).toMatchObject({
    uri: 'content://documents/report.pdf',
    bytes: pdf.length
  });
  expect(
    FileSystem.StorageAccessFramework.createFileAsync
  ).toHaveBeenCalledWith(
    'content://documents/tree/exports',
    expect.stringContaining('Masarifi'),
    'application/pdf'
  );
  expect(mockWrite).toHaveBeenCalledWith(
    'content://documents/report.pdf',
    pdf,
    { append: true }
  );
  expect(mockClose).toHaveBeenCalled();
});
test.each(['http://storage.example.test/x', 'file:///private/x'])(
  'rejects an insecure URL before transfer: %s',
  async (downloadUrl) => {
    await expect(
      saveReportPdf({ ...attempt, downloadUrl }, () => undefined)
    ).rejects.toThrow('REPORT_DOWNLOAD_INVALID');
    expect(FileSystem.createDownloadResumable).not.toHaveBeenCalled();
  }
);
test('rejects expired links and HTML/error responses without creating a user-visible file', async () => {
  await expect(
    saveReportPdf({ ...attempt, downloadUrlExpiresAt: 1 }, () => undefined)
  ).rejects.toThrow('REPORT_DOWNLOAD_INVALID');
  mockFileBytes = new Uint8Array(
    Array.from('<html>gateway error</html>', (c) => c.charCodeAt(0))
  );
  await expect(saveReportPdf(attempt, () => undefined)).rejects.toThrow(
    'REPORT_PDF_INVALID'
  );
  expect(
    FileSystem.StorageAccessFramework.createFileAsync
  ).not.toHaveBeenCalled();
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
    expect.stringMatching(/^file:\/\/\/cache\/masarifi-report-/),
    { idempotent: true }
  );
});
test('treats a cancelled Android folder selection as cancelled, never as a saved PDF', async () => {
  jest
    .mocked(FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync)
    .mockResolvedValue({ granted: false });
  await expect(saveReportPdf(attempt, () => undefined)).rejects.toThrow(
    'REPORT_SAVE_CANCELLED'
  );
  expect(mockWrite).not.toHaveBeenCalled();
});
test('rechecks ownership after transfer and never opens the folder picker for a changed owner', async () => {
  let current = true;
  jest.mocked(FileSystem.createDownloadResumable).mockReturnValue({
    downloadAsync: async () => {
      current = false;
      return { status: 200, headers: {} };
    },
    pauseAsync: jest.fn(async () => ({}))
  } as never);
  await expect(
    saveReportPdf(attempt, () => {
      if (!current) throw Error('OWNER_CHANGED');
    })
  ).rejects.toThrow('OWNER_CHANGED');
  expect(
    FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync
  ).not.toHaveBeenCalled();
});
