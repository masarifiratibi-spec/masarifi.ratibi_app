import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { changeLocale, translate } from '@/localization/i18n';
import { renderWithQueryData } from '@/test-utils/render';
import { authenticatedSession } from '@/test-utils/app-shell-fixtures';
import { useAppShellStore } from '@/state/app-shell';
import type { ReportOutputAttempt } from '@/domain/reports';
import type { ReportsRepository } from '@/storage/reports-repository';
import * as files from '@/services/platform/report-pdf-file';
import { reportKeys } from './report-queries';
import { ReportHistoryScreen } from './ReportHistoryScreen';
import { router } from 'expo-router';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(() => true)
  }
}));
jest.mock('@/services/reports-service', () => {
  const { ReportsRepository: Repository } = jest.requireActual(
    '@/storage/reports-repository'
  );
  const { createMockReportsService } = jest.requireActual(
    '@/services/mocks/reports-service'
  );
  const repository = new Repository();
  return {
    reportsService: createMockReportsService(repository),
    historyTestRepository: repository
  };
});
jest.mock('@/services/platform/report-pdf-file', () => ({
  saveReportPdf: jest.fn(),
  removeReportPdfCache: jest.fn(async () => undefined)
}));
const repository = (
  jest.requireMock('@/services/reports-service') as {
    historyTestRepository: ReportsRepository;
  }
).historyTestRepository;
const attempt: ReportOutputAttempt = {
  id: 'history-attempt-a',
  operationId: 'history-operation-a',
  kind: 'download',
  format: 'pdf',
  status: 'ready',
  scheduleId: null,
  snapshot: null,
  retryOfAttemptId: null,
  failureCategory: null,
  requestedAt: Date.UTC(2026, 9, 30, 12),
  completedAt: Date.UTC(2026, 9, 30, 12, 1),
  scheduleStatusAtCompletion: null,
  downloadUrl: 'https://files.example.test/expired.pdf',
  downloadUrlExpiresAt: 1
};
const saved = {
  uri: 'content://documents/report.pdf',
  cacheUri: 'file:///cache/masarifi-report-fixture.pdf',
  name: 'report.pdf',
  bytes: 80
};
function renderHistory() {
  return renderWithQueryData(<ReportHistoryScreen />, [
    [
      reportKeys.attempts(),
      {
        pages: [{ items: [attempt], nextCursor: null }],
        pageParams: [undefined]
      }
    ]
  ]);
}
beforeEach(() => {
  repository.reset();
  jest.clearAllMocks();
  changeLocale('en');
  useAppShellStore.setState({
    session: { ...authenticatedSession, userId: 'history-owner-a' }
  });
  jest.mocked(files.saveReportPdf).mockResolvedValue(saved);
});

test.each([true, false])(
  'returns to Reports safely when navigation history is %s',
  (canGoBack) => {
    jest.mocked(router.canGoBack).mockReturnValue(canGoBack);
    renderHistory();
    fireEvent.press(
      screen.getByRole('button', { name: translate('common.back') })
    );
    if (canGoBack) {
      expect(router.back).toHaveBeenCalledTimes(1);
      expect(router.replace).not.toHaveBeenCalled();
    } else {
      expect(router.replace).toHaveBeenCalledWith('/reports');
      expect(router.back).not.toHaveBeenCalled();
    }
  }
);

test('withdraws the former owner’s cached history immediately after owner change', async () => {
  renderHistory();
  expect(screen.getByTestId(`report-history-${attempt.id}`)).toBeTruthy();
  act(() =>
    useAppShellStore.setState({
      session: { ...authenticatedSession, userId: 'history-owner-b' }
    })
  );
  await waitFor(() =>
    expect(screen.queryByTestId(`report-history-${attempt.id}`)).toBeNull()
  );
  expect(files.saveReportPdf).not.toHaveBeenCalled();
});

test('offers PDF downloads only for PDF history rows', () => {
  renderWithQueryData(<ReportHistoryScreen />, [
    [
      reportKeys.attempts(),
      {
        pages: [
          {
            items: [
              attempt,
              { ...attempt, id: 'csv-attempt', format: 'csv' },
              { ...attempt, id: 'unknown-attempt', format: undefined }
            ],
            nextCursor: null
          }
        ],
        pageParams: [undefined]
      }
    ]
  ]);
  expect(screen.getByTestId(`report-history-${attempt.id}`)).toBeTruthy();
  expect(screen.queryByTestId('report-history-csv-attempt')).toBeNull();
  expect(screen.queryByTestId('report-history-unknown-attempt')).toBeNull();
});

test('saves a fresh ready attempt once without generating another report', async () => {
  const fresh = {
    ...attempt,
    downloadUrl: 'https://files.example.test/fresh.pdf',
    downloadUrlExpiresAt: Date.now() + 60_000
  };
  await repository.saveAttempt(fresh);
  renderHistory();
  const button = screen.getByRole('button', {
    name: translate('reports.pdf.download')
  });
  fireEvent.press(button);
  fireEvent.press(button);
  await screen.findByText(translate('reports.pdf.success'));
  expect(files.saveReportPdf).toHaveBeenCalledTimes(1);
  expect(jest.mocked(files.saveReportPdf).mock.calls[0][0]).toEqual(fresh);
  expect(await repository.listAttempts()).toHaveLength(1);
  await waitFor(() =>
    expect(files.removeReportPdfCache).toHaveBeenCalledWith(saved)
  );
});

test('does not save a stale ready row when its fresh request no longer exists', async () => {
  renderHistory();
  fireEvent.press(
    screen.getByRole('button', { name: translate('reports.pdf.download') })
  );
  await screen.findByText(translate('reports.pdf.historyUnavailable'));
  expect(files.saveReportPdf).not.toHaveBeenCalled();
  expect(await repository.listAttempts()).toHaveLength(0);
});

test('reports a cancelled folder choice without claiming a saved PDF', async () => {
  await repository.saveAttempt(attempt);
  jest
    .mocked(files.saveReportPdf)
    .mockRejectedValueOnce(new Error('REPORT_SAVE_CANCELLED'));
  renderHistory();
  fireEvent.press(
    screen.getByRole('button', { name: translate('reports.pdf.download') })
  );
  await screen.findByText(translate('reports.pdf.cancelled'));
  expect(screen.queryByText(translate('reports.pdf.success'))).toBeNull();
  expect(await repository.listAttempts()).toHaveLength(1);
});

test('aborts a pending save on owner change and never announces it to the next owner', async () => {
  await repository.saveAttempt(attempt);
  let finish!: () => void;
  let saving!: () => void;
  const started = new Promise<void>((resolve) => {
    saving = resolve;
  });
  jest
    .mocked(files.saveReportPdf)
    .mockImplementationOnce(async (_attempt, assertCurrent, signal) => {
      saving();
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      expect(signal?.aborted).toBe(true);
      assertCurrent();
      return saved;
    });
  renderHistory();
  fireEvent.press(
    screen.getByRole('button', { name: translate('reports.pdf.download') })
  );
  await act(async () => started);
  repository.reset();
  act(() =>
    useAppShellStore.setState({
      session: { ...authenticatedSession, userId: 'history-owner-b' }
    })
  );
  await act(async () => finish());
  expect(screen.queryByText(translate('reports.pdf.success'))).toBeNull();
  expect(screen.queryByTestId(`report-history-${attempt.id}`)).toBeNull();
});
