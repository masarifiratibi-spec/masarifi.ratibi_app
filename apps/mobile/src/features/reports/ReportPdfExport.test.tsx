import React from 'react';
import * as Crypto from 'expo-crypto';
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor
} from '@testing-library/react-native';
import { changeLocale, translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { useAppShellStore } from '@/state/app-shell';
import { reportsService } from '@/services/reports-service';
import * as files from '@/services/platform/report-pdf-file';
import { readRecoveryNetwork } from '@/services/platform/read-recovery-network';
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
jest.mock('@/services/platform/read-recovery-network', () => ({
  readRecoveryNetwork: { available: false, isOnline: jest.fn() }
}));
const input = {
  kind: 'monthly' as const,
  anchorDate: '2026-10-29' as const,
  monthStartDay: 25,
  timeZone: 'Asia/Riyadh',
  currencyCode: 'SAR',
  accountIds: ['selected-account']
};
const owner = 'pdf_owner';
const accepted = {
  value: { id: 'attempt-1', status: 'scheduled' },
  affectedScopes: []
};
const press = () =>
  fireEvent.press(
    screen.getByRole('button', { name: translate('reports.pdf.download') })
  );
beforeEach(() => {
  jest.clearAllMocks();
  readRecoveryNetwork.available = false;
  jest.mocked(readRecoveryNetwork.isOnline).mockResolvedValue(true);
  jest
    .mocked(reportsService.previewOutput)
    .mockReset()
    .mockResolvedValue({ previewId: 'current-preview' } as never);
  jest
    .mocked(reportsService.requestOutput)
    .mockReset()
    .mockResolvedValue(accepted as never);
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
});
afterEach(() => {
  cleanup();
  useAppShellStore.setState({ session: null });
});

test.each(['ar', 'en'] as const)(
  'shows the waiting popup immediately and requests an owner-email PDF with every filter in %s',
  async (locale) => {
    changeLocale(locale);
    let finish!: (value: never) => void;
    jest.mocked(reportsService.requestOutput).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    renderWithProviders(<ReportPdfExport input={input} />);
    press();
    expect(
      screen.getByText(
        locale === 'ar' ? 'قد يستغرق هذا بعض الوقت' : 'This may take some time'
      )
    ).toBeTruthy();
    expect(screen.getByTestId('report-email-popup')).toBeTruthy();
    await waitFor(() =>
      expect(reportsService.requestOutput).toHaveBeenCalledTimes(1)
    );
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
      { kind: 'send_now', previewId: 'current-preview' },
      expect.any(String)
    );
    await act(async () => finish(accepted as never));
    expect(
      await screen.findByText(translate('reports.pdf.emailQueued'))
    ).toBeTruthy();
    expect(files.saveReportPdf).not.toHaveBeenCalled();
    expect(files.openReportPdf).not.toHaveBeenCalled();
    expect(files.shareReportPdf).not.toHaveBeenCalled();
    expect(reportsService.getAttempt).not.toHaveBeenCalled();
  }
);

test.each(['scheduled', 'ready', 'sending'] as const)(
  'does not duplicate an accepted email while its server status is %s',
  async (status) => {
    jest.mocked(reportsService.getAttempt).mockResolvedValue({
      id: 'attempt-1',
      status
    } as never);
    renderWithProviders(<ReportPdfExport input={input} />);
    act(() => {
      press();
      press();
    });
    await screen.findByText(translate('reports.pdf.emailQueued'));
    fireEvent.press(
      screen.getByRole('button', { name: translate('common.close') })
    );
    press();
    expect(
      await screen.findByText(translate('reports.pdf.emailQueued'))
    ).toBeTruthy();
    expect(reportsService.requestOutput).toHaveBeenCalledTimes(1);
  }
);

test.each(['sent', 'failed'] as const)(
  'allows a new email request with a fresh operation after the previous request is %s',
  async (status) => {
    jest
      .mocked(Crypto.randomUUID)
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000011')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000012');
    jest.mocked(reportsService.getAttempt).mockResolvedValue({
      id: 'attempt-1',
      status
    } as never);
    renderWithProviders(<ReportPdfExport input={input} />);
    press();
    await screen.findByText(translate('reports.pdf.emailQueued'));
    fireEvent.press(
      screen.getByRole('button', { name: translate('common.close') })
    );
    press();
    await waitFor(() =>
      expect(reportsService.requestOutput).toHaveBeenCalledTimes(2)
    );
    expect(reportsService.previewOutput).toHaveBeenCalledTimes(2);
    const calls = jest.mocked(reportsService.requestOutput).mock.calls;
    expect(calls[1][1]).not.toBe(calls[0][1]);
  }
);

test('blocks repeated taps while checking the prior request, then permits a fresh request after a failed check is retried', async () => {
  let rejectCheck!: (reason: Error) => void;
  jest
    .mocked(reportsService.getAttempt)
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectCheck = reject;
        })
    )
    .mockResolvedValue({ id: 'attempt-1', status: 'sent' } as never);
  renderWithProviders(<ReportPdfExport input={input} />);
  press();
  await screen.findByText(translate('reports.pdf.emailQueued'));
  fireEvent.press(
    screen.getByRole('button', { name: translate('common.close') })
  );
  act(() => {
    press();
    press();
  });
  await waitFor(() =>
    expect(reportsService.getAttempt).toHaveBeenCalledTimes(1)
  );
  expect(reportsService.requestOutput).toHaveBeenCalledTimes(1);
  await act(async () => rejectCheck(new Error('network uncertainty')));
  expect(
    await screen.findByText(translate('reports.pdf.failure'))
  ).toBeTruthy();
  fireEvent.press(
    screen.getByRole('button', { name: translate('reports.pdf.retry') })
  );
  await waitFor(() =>
    expect(reportsService.requestOutput).toHaveBeenCalledTimes(2)
  );
  expect(reportsService.getAttempt).toHaveBeenCalledTimes(2);
});

test('retries an uncertain email POST with its original operation identity', async () => {
  jest
    .mocked(reportsService.requestOutput)
    .mockRejectedValueOnce(new Error('network uncertainty'))
    .mockResolvedValueOnce(accepted as never);
  renderWithProviders(<ReportPdfExport input={input} />);
  press();
  fireEvent.press(
    await screen.findByRole('button', { name: translate('reports.pdf.retry') })
  );
  await screen.findByText(translate('reports.pdf.emailQueued'));
  const calls = jest.mocked(reportsService.requestOutput).mock.calls;
  expect(calls).toHaveLength(2);
  expect(calls[0][1]).toBe(calls[1][1]);
});

test('does not submit the email if the owner changes during preview', async () => {
  let finish!: (value: never) => void;
  jest.mocked(reportsService.previewOutput).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  renderWithProviders(<ReportPdfExport input={input} />);
  press();
  await waitFor(() =>
    expect(reportsService.previewOutput).toHaveBeenCalledTimes(1)
  );
  await act(async () => {
    useAppShellStore.setState({ session: null });
    finish({ previewId: 'old-owner-preview' } as never);
  });
  expect(reportsService.requestOutput).not.toHaveBeenCalled();
});

test('keeps unsupported account filters instead of retrying an unscoped report', async () => {
  jest
    .mocked(reportsService.previewOutput)
    .mockRejectedValue({ code: 'report_account_scope_unavailable' });
  renderWithProviders(<ReportPdfExport input={input} />);
  press();
  await screen.findByText(translate('reports.pdf.accountUnsupported'));
  expect(reportsService.requestOutput).not.toHaveBeenCalled();
});

test.each([false, true])(
  'refuses offline email without leaving Reports (native network available=%s)',
  async (nativeAvailable) => {
    readRecoveryNetwork.available = nativeAvailable;
    jest.mocked(readRecoveryNetwork.isOnline).mockResolvedValue(false);
    renderWithProviders(<ReportPdfExport input={input} offline />);
    press();
    await screen.findByText(translate('reports.pdf.internet'));
    expect(reportsService.previewOutput).not.toHaveBeenCalled();
    expect(reportsService.requestOutput).not.toHaveBeenCalled();
  }
);

test('uses current connectivity when the visible report was read offline', async () => {
  readRecoveryNetwork.available = true;
  renderWithProviders(<ReportPdfExport input={input} offline />);
  press();
  await screen.findByText(translate('reports.pdf.emailQueued'));
  expect(reportsService.requestOutput).toHaveBeenCalledTimes(1);
});
