import React from 'react';
import * as Crypto from 'expo-crypto';
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor
} from '@testing-library/react-native';
import { changeLocale } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { useAppShellStore } from '@/state/app-shell';
import { reportsService } from '@/services/reports-service';
import * as files from '@/services/platform/report-pdf-file';
import { ReportPdfExport } from './ReportPdfExport';

jest.mock('@/services/reports-service', () => ({
  reportsService: {
    previewOutput: jest.fn(),
    requestOutput: jest.fn(),
    getAttempt: jest.fn()
  }
}));
jest.mock('@/services/platform/report-pdf-file', () => ({
  saveReportPdf: jest.fn(),
  openReportPdf: jest.fn(),
  shareReportPdf: jest.fn(),
  removeReportPdfCache: jest.fn()
}));
const input = {
  kind: 'monthly' as const,
  anchorDate: '2026-10-29' as const,
  monthStartDay: 25,
  timeZone: 'Asia/Riyadh',
  currencyCode: 'EGP',
  accountIds: ['selected-account']
};
const owner = 'pdf_owner';
const ready = {
  id: 'attempt-1',
  status: 'ready',
  downloadUrl: 'https://storage.example.test/fresh.pdf',
  downloadUrlExpiresAt: 9999999999999
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(reportsService.previewOutput).mockReset();
  jest.mocked(reportsService.requestOutput).mockReset();
  jest.mocked(reportsService.getAttempt).mockReset();
  jest
    .spyOn(Crypto, 'randomUUID')
    .mockReturnValue('00000000-0000-4000-8000-000000000011');
  changeLocale('en');
  useAppShellStore.setState({
    session: {
      userId: owner,
      status: 'authenticated',
      restoration: 'restored',
      method: 'google',
      issuedAt: 1,
      expiresAt: 9999999999999
    }
  });
  jest
    .mocked(reportsService.previewOutput)
    .mockResolvedValue({ previewId: 'current-preview' } as never);
  jest
    .mocked(reportsService.requestOutput)
    .mockResolvedValue({
      value: { id: ready.id },
      affectedScopes: []
    } as never);
  jest.mocked(reportsService.getAttempt).mockResolvedValue(ready as never);
  jest
    .mocked(files.saveReportPdf)
    .mockResolvedValue({
      uri: 'content://documents/saved.pdf',
      cacheUri: 'file:///cache/saved.pdf',
      name: 'Masarifi.pdf',
      bytes: 100
    });
  jest.mocked(files.removeReportPdfCache).mockResolvedValue(undefined);
  jest.mocked(files.openReportPdf).mockResolvedValue(undefined);
  jest.mocked(files.shareReportPdf).mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  useAppShellStore.setState({ session: null });
});

test.each(['ar', 'en'] as const)(
  'starts the existing PDF flow in one tap, keeps every filter, and saves before announcing success in %s',
  async (locale) => {
    changeLocale(locale);
    renderWithProviders(<ReportPdfExport input={input} />);
    fireEvent.press(
      screen.getByRole('button', {
        name:
          locale === 'ar' ? 'تنزيل التقرير بصيغة PDF' : 'Download report PDF'
      })
    );
    await waitFor(() => expect(files.saveReportPdf).toHaveBeenCalledTimes(1));
    expect(reportsService.previewOutput).toHaveBeenCalledWith(
      {
        ...input,
        language: locale,
        detailLevel: 'summary',
        recipientEmail: null
      },
      expect.objectContaining({ signal: expect.anything() })
    );
    expect(reportsService.requestOutput).toHaveBeenCalledWith(
      { kind: 'download', previewId: 'current-preview' },
      expect.any(String)
    );
    expect(
      await screen.findByText(locale === 'ar' ? 'تم حفظ ملف PDF' : 'PDF saved')
    ).toBeTruthy();
    expect(files.openReportPdf).not.toHaveBeenCalled();
    expect(files.shareReportPdf).not.toHaveBeenCalled();
  }
);

test('blocks repeated taps while generating, then opens or shares only after an explicit action', async () => {
  let finish!: (value: never) => void;
  jest.mocked(reportsService.requestOutput).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  renderWithProviders(<ReportPdfExport input={input} />);
  const button = screen.getByRole('button', { name: 'Download report PDF' });
  act(() => {
    fireEvent.press(button);
    fireEvent.press(button);
  });
  await waitFor(() =>
    expect(reportsService.requestOutput).toHaveBeenCalledTimes(1)
  );
  expect(button).toHaveAccessibilityState({ disabled: true, busy: true });
  await act(async () =>
    finish({ value: { id: ready.id }, affectedScopes: [] } as never)
  );
  fireEvent.press(await screen.findByRole('button', { name: 'Open PDF' }));
  await waitFor(() => expect(files.openReportPdf).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Share PDF' })).toBeEnabled()
  );
  fireEvent.press(screen.getByRole('button', { name: 'Share PDF' }));
  await waitFor(() => expect(files.shareReportPdf).toHaveBeenCalledTimes(1));
});

test('retries an uncertain POST with the same operation identity', async () => {
  jest
    .mocked(reportsService.requestOutput)
    .mockRejectedValueOnce(new Error('network uncertainty'))
    .mockResolvedValueOnce({
      value: { id: ready.id },
      affectedScopes: []
    } as never);
  renderWithProviders(<ReportPdfExport input={input} />);
  fireEvent.press(screen.getByRole('button', { name: 'Download report PDF' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Retry' }));
  await screen.findByText('PDF saved');
  expect(
    jest.mocked(reportsService.requestOutput).mock.calls.map(([, key]) => key)
  ).toEqual([expect.any(String), expect.any(String)]);
  expect(jest.mocked(reportsService.requestOutput).mock.calls[0][1]).toBe(
    jest.mocked(reportsService.requestOutput).mock.calls[1][1]
  );
});

test('does not save or share when the owner changes during generation', async () => {
  let finish!: (value: never) => void;
  jest.mocked(reportsService.getAttempt).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  renderWithProviders(<ReportPdfExport input={input} />);
  fireEvent.press(screen.getByRole('button', { name: 'Download report PDF' }));
  await waitFor(() =>
    expect(reportsService.getAttempt).toHaveBeenCalledTimes(1)
  );
  await act(async () => {
    useAppShellStore.setState({ session: null });
    finish(ready as never);
  });
  expect(files.saveReportPdf).not.toHaveBeenCalled();
  expect(screen.queryByText('PDF saved')).toBeNull();
});

test('keeps an unsupported account-filter error visible and never retries without the filter', async () => {
  jest
    .mocked(reportsService.previewOutput)
    .mockRejectedValue({ code: 'report_account_scope_unavailable' });
  renderWithProviders(<ReportPdfExport input={input} />);
  fireEvent.press(screen.getByRole('button', { name: 'Download report PDF' }));
  await screen.findByText(
    'This account filter cannot be exported. Your filters were kept.'
  );
  expect(reportsService.requestOutput).not.toHaveBeenCalled();
  expect(files.saveReportPdf).not.toHaveBeenCalled();
});

test('explains the internet requirement offline without creating a request or leaving Reports', async () => {
  renderWithProviders(<ReportPdfExport input={input} offline />);
  fireEvent.press(screen.getByRole('button', { name: 'Download report PDF' }));
  await screen.findByText(
    'Reports work offline. Connect to the internet to download a PDF.'
  );
  expect(reportsService.previewOutput).not.toHaveBeenCalled();
  expect(reportsService.requestOutput).not.toHaveBeenCalled();
  expect(files.saveReportPdf).not.toHaveBeenCalled();
});

test('keeps the saved file actions after an opener failure instead of downloading another copy', async () => {
  jest
    .mocked(files.openReportPdf)
    .mockRejectedValueOnce(Error('REPORT_FILE_NATIVE_UPDATE_REQUIRED'));
  renderWithProviders(<ReportPdfExport input={input} />);
  fireEvent.press(screen.getByRole('button', { name: 'Download report PDF' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Open PDF' }));
  await screen.findByText(
    'This app build needs an update to open or share PDF files. Your saved PDF is still in the folder you selected.'
  );
  expect(screen.getByRole('button', { name: 'Share PDF' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  expect(files.saveReportPdf).toHaveBeenCalledTimes(1);
});
