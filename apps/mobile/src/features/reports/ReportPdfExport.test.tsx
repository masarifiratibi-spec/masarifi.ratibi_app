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
