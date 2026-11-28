import React from 'react';
import { Platform } from 'react-native';
import { getClerkInstance } from '@clerk/expo';
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

jest.mock('@clerk/expo', () => ({ getClerkInstance: jest.fn() }));
jest.mock('@/services/reports-service', () => ({
  reportsService: {
    previewOutput: jest.fn(),
    requestOutput: jest.fn(),
    getAttempt: jest.fn(),
    findActivePdfFile: jest.fn(),
    deletePdfFile: jest.fn()
  }
}));
jest.mock('@/services/platform/report-pdf-file', () => ({
  downloadReportPdf: jest.fn(),
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
const originalPlatform = Platform.OS;
const accepted = {
  value: { id: 'attempt-1', status: 'scheduled' },
  affectedScopes: []
};
const press = () =>
  fireEvent.press(
    screen.getByRole('button', { name: translate('reports.pdf.download') })
  );
const confirm = () =>
  fireEvent.press(
    screen.getByRole('button', { name: translate('reports.pdf.confirmSend') })
  );
const send = () => {
  press();
  confirm();
};
const email = 'current@example.test';
let identityChanged: () => void;
function clerkIdentity(
  address = email,
  status = 'verified',
  sessionId = 'clerk-session'
) {
  jest.mocked(getClerkInstance).mockReturnValue({
    user: {
      id: owner,
      primaryEmailAddress: { emailAddress: address, verification: { status } }
    },
    session: { id: sessionId, status: 'active', user: { id: owner } },
    addListener: (callback: () => void) => {
      identityChanged = callback;
      return () => {};
    }
  } as never);
}
beforeEach(() => {
  jest.clearAllMocks();
  clerkIdentity();
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
  jest.mocked(reportsService.findActivePdfFile!).mockReset().mockResolvedValue(null);
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
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
});

// Build8's Arabic PDF button covered the last digits of the expense total.
test.each([
  ['ios', 'ar', 'flex-start'],
  ['ios', 'en', 'flex-end'],
  ['android', 'ar', 'flex-end']
] as const)('places the PDF action away from the %s %s reading edge', (platform, locale, alignment) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
  changeLocale(locale);
  renderWithProviders(<ReportPdfExport input={input} />);

  expect(screen.getByTestId('reports-pdf-overlay')).toHaveStyle({
    direction: 'ltr',
    alignItems: alignment
  });
});

test.each(['ar', 'en'] as const)(
  'requires explicit review of report type, cycle and verified recipient in %s',
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
      screen.getByText(translate('reports.pdf.confirmTitle'))
    ).toBeTruthy();
    expect(screen.getByText(email)).toBeTruthy();
    expect(
      screen.getByText(
        locale === 'en'
          ? 'Financial summary · Monthly · 25 October – 24 November 2026'
          : /الملخص المالي.*25.*24.*2026/
      )
    ).toBeTruthy();
    expect(reportsService.previewOutput).not.toHaveBeenCalled();
    expect(reportsService.requestOutput).not.toHaveBeenCalled();
    confirm();
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
      {
        kind: 'send_now',
        previewId: 'current-preview',
        expectedAccountEmail: email
      },
      expect.any(String),
      expect.any(Function)
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
    press();
    const button = screen.getByRole('button', {
      name: translate('reports.pdf.confirmSend')
    });
    act(() => {
      fireEvent.press(button);
      fireEvent.press(button);
    });
    await screen.findByText(translate('reports.pdf.emailQueued'));
    fireEvent.press(
      screen.getByRole('button', { name: translate('common.close') })
    );
    send();
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
    send();
    await screen.findByText(translate('reports.pdf.emailQueued'));
    fireEvent.press(
      screen.getByRole('button', { name: translate('common.close') })
    );
    send();
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
  send();
  await screen.findByText(translate('reports.pdf.emailQueued'));
  fireEvent.press(
    screen.getByRole('button', { name: translate('common.close') })
  );
  send();
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
  confirm();
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
  send();
  fireEvent.press(
    await screen.findByRole('button', { name: translate('reports.pdf.retry') })
  );
  confirm();
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
  send();
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
  send();
  await screen.findByText(translate('reports.pdf.accountUnsupported'));
  expect(reportsService.requestOutput).not.toHaveBeenCalled();
});

test.each([false, true])(
  'refuses offline email without leaving Reports (native network available=%s)',
  async (nativeAvailable) => {
    readRecoveryNetwork.available = nativeAvailable;
    jest.mocked(readRecoveryNetwork.isOnline).mockResolvedValue(false);
    renderWithProviders(<ReportPdfExport input={input} offline />);
    send();
    await screen.findByText(translate('reports.pdf.internet'));
    expect(reportsService.previewOutput).not.toHaveBeenCalled();
    expect(reportsService.requestOutput).not.toHaveBeenCalled();
  }
);

test('uses current connectivity when the visible report was read offline', async () => {
  readRecoveryNetwork.available = true;
  renderWithProviders(<ReportPdfExport input={input} offline />);
  send();
  await screen.findByText(translate('reports.pdf.emailQueued'));
  expect(reportsService.requestOutput).toHaveBeenCalledTimes(1);
});

test('cancel closes the review without creating a preview or email attempt', () => {
  renderWithProviders(<ReportPdfExport input={input} />);
  press();
  fireEvent.press(
    screen.getByRole('button', {
      name: translate('designSystem.action.cancel')
    })
  );
  expect(screen.queryByText(email)).toBeNull();
  expect(reportsService.previewOutput).not.toHaveBeenCalled();
  expect(reportsService.requestOutput).not.toHaveBeenCalled();
});

test.each([
  ['o***@example.test', 'verified'],
  [email, 'unverified'],
  ['', 'verified']
])('refuses an unavailable or unverified address', (address, status) => {
  clerkIdentity(address, status);
  renderWithProviders(<ReportPdfExport input={input} />);
  press();
  expect(screen.getByText(translate('reports.pdf.emailMissing'))).toBeTruthy();
  expect(screen.queryByText(translate('reports.pdf.confirmSend'))).toBeNull();
  expect(reportsService.requestOutput).not.toHaveBeenCalled();
});

test.each([
  [email, 'replacement-session'],
  ['changed@example.test', 'clerk-session']
])(
  'invalidates review when the session or its primary address changes',
  (address, session) => {
    renderWithProviders(<ReportPdfExport input={input} />);
    press();
    act(() => {
      clerkIdentity(address, 'verified', session);
      identityChanged();
    });
    expect(screen.queryByText(translate('reports.pdf.confirmSend'))).toBeNull();
    expect(reportsService.requestOutput).not.toHaveBeenCalled();
  }
);

function enterFileMode() {
  const oldUrl = process.env.EXPO_PUBLIC_API_URL;
  const oldFlag = process.env.EXPO_PUBLIC_STAGING_REPORT_FILES;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.staging.masarifiratibi.com/qa-reports';
  process.env.EXPO_PUBLIC_STAGING_REPORT_FILES = 'true';
  return () => {
    if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = oldUrl;
    if (oldFlag === undefined) delete process.env.EXPO_PUBLIC_STAGING_REPORT_FILES;
    else process.env.EXPO_PUBLIC_STAGING_REPORT_FILES = oldFlag;
  };
}
const tapFileButton = (key: Parameters<typeof translate>[0]) =>
  fireEvent.press(screen.getByRole('button', { name: translate(key) }));

test('isolated staging creates one download, opens the file and deletes it after confirmation', async () => {
  const restore = enterFileMode();
  const ready = {
    id: 'attempt-1',
    status: 'ready',
    downloadUrl: 'https://example.test/report',
    downloadUrlExpiresAt: Date.now() + 60000
  };
  jest.mocked(reportsService.getAttempt).mockResolvedValue(ready as never);
  jest
    .mocked(files.downloadReportPdf)
    .mockResolvedValue({
      uri: 'content://file',
      cacheUri: 'file:///cache/file',
      bytes: 1000,
      name: 'report.pdf'
    });
  try {
    const view = renderWithProviders(<ReportPdfExport input={input} />);
    tapFileButton('reports.pdf.files');
    await screen.findByText(translate('reports.pdf.createFile'));
    tapFileButton('reports.pdf.createFile');
    await screen.findByText(translate('reports.pdf.fileReady'));
    expect(reportsService.requestOutput).toHaveBeenCalledTimes(1);
    expect(reportsService.requestOutput).toHaveBeenCalledWith(
      { kind: 'download', previewId: 'current-preview' },
      expect.any(String),
      expect.any(Function)
    );
    tapFileButton('common.close');
    view.unmount();
    renderWithProviders(<ReportPdfExport input={{ ...input, anchorDate: '2026-11-28', accountIds: ['other-account'] }} />);
    jest.mocked(reportsService.findActivePdfFile!).mockResolvedValue({ id: ready.id, status: 'ready' });
    tapFileButton('reports.pdf.files');
    await screen.findByText(translate('reports.pdf.fileReady'));
    tapFileButton('reports.pdf.saveFile');
    await screen.findByText(translate('reports.pdf.success'));
    expect(files.downloadReportPdf).toHaveBeenCalledTimes(1);
    tapFileButton('reports.pdf.open');
    await waitFor(() => {
      expect(files.openReportPdf).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: translate('reports.pdf.deleteFile') })).toBeEnabled();
    });
    tapFileButton('reports.pdf.deleteFile');
    expect(reportsService.deletePdfFile).not.toHaveBeenCalled();
    tapFileButton('reports.pdf.confirmDelete');
    await screen.findByText(translate('reports.pdf.fileDeleted'));
    expect(reportsService.deletePdfFile).toHaveBeenCalledWith(
      'attempt-1',
      expect.any(Function)
    );
    expect(screen.queryByText(translate('reports.pdf.saveFile'))).toBeNull();
    tapFileButton('common.close');
    jest.mocked(reportsService.findActivePdfFile!).mockResolvedValue(null);
    tapFileButton('reports.pdf.files');
    await screen.findByText(translate('reports.pdf.createFile'));
    expect(screen.queryByText(translate('reports.pdf.deleteFile'))).toBeNull();
  } finally {
    restore();
  }
});

test('changing the report account invalidates an open confirmation', () => {
  let switchAccount!: () => void;
  function Report() {
    const [accountIds, setAccounts] = React.useState(input.accountIds);
    switchAccount = () => setAccounts(['other-account']);
    return <ReportPdfExport input={{ ...input, accountIds }} />;
  }
  renderWithProviders(<Report />);
  press();
  act(switchAccount);
  expect(screen.queryByText(translate('reports.pdf.confirmSend'))).toBeNull();
  expect(reportsService.requestOutput).not.toHaveBeenCalled();
});

test('an in-flight file lookup cannot display the previous report after a session change', async () => {
  const restore = enterFileMode();
  let finish!: () => void;
  const find = jest.mocked(reportsService.findActivePdfFile!);
  find.mockImplementationOnce(() => new Promise(resolve => {
    finish = () => resolve({ id: 'first-owner-report', status: 'ready' });
  }));
  try {
    renderWithProviders(<ReportPdfExport input={input} />);
    tapFileButton('reports.pdf.files');
    await waitFor(() => expect(find).toHaveBeenCalledTimes(1));
    act(() => useAppShellStore.setState({
      session: { ...useAppShellStore.getState().session!, userId: 'second-owner' }
    }));
    expect(find.mock.calls[0][0].signal?.aborted).toBe(true);
    expect(find.mock.calls[0][1]()).toBe(false);
    await act(async () => finish());
    tapFileButton('reports.pdf.files');
    await screen.findByText(translate('reports.pdf.createFile'));
    expect(screen.queryByText(translate('reports.pdf.saveFile'))).toBeNull();
    expect(reportsService.getAttempt).not.toHaveBeenCalled();
  } finally {
    restore();
  }
});

test.each(['not_found', 'expired'])('retries recovery and clears unavailable file actions on %s', async (code) => {
  const restore = enterFileMode();
  jest.mocked(reportsService.findActivePdfFile!)
    .mockRejectedValueOnce({ code: 'offline' })
    .mockResolvedValueOnce({ id: 'removed-on-server', status: 'ready' });
  jest.mocked(reportsService.getAttempt).mockRejectedValue({ code });
  try {
    renderWithProviders(<ReportPdfExport input={input} />);
    tapFileButton('reports.pdf.files');
    await screen.findByText(translate('reports.pdf.internet'));
    expect(screen.queryByText(translate('reports.pdf.createFile'))).toBeNull();
    tapFileButton('reports.pdf.refreshFile');
    await screen.findByText(translate('reports.pdf.fileReady'));
    tapFileButton('reports.pdf.saveFile');
    await screen.findByText(translate('reports.pdf.fileDeleted'));
    expect(screen.queryByText(translate('reports.pdf.deleteFile'))).toBeNull();
    expect(screen.getByText(translate('reports.pdf.createFile'))).toBeTruthy();
    expect(files.downloadReportPdf).not.toHaveBeenCalled();
  } finally { restore(); }
});
