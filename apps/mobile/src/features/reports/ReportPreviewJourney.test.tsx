import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { buildSchedule, verifyRecipient } from '@/domain/reports';
import { changeLocale } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useReportsViewState } from '@/state/reports-view-state';
import { renderWithQueryData } from '@/test-utils/render';
import { ReportPreviewScreen } from './ReportPreviewScreen';
import { reportKeys } from './report-queries';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { reportsService } from '@/services/reports-service';
import { useCoreFinanceViewState } from '@/state/core-finance-view-state';

test('preview reviews provenance and recipient before recording output history', async () => {
  usePreferenceStore.setState({ locale: 'en', direction: 'ltr' });
  changeLocale('en');
  useReportsViewState.setState({
    followToday: false,
    selectedKind: 'monthly',
    anchorDate: '2026-08-09'
  });
  const verification = verifyRecipient('reports@example.com');
  const schedule = buildSchedule(
    {
      recipientEmail: 'reports@example.com',
      frequency: 'monthly',
      language: 'en',
      currencyCode: 'SAR',
      deliveryDay: 1,
      timeZone: 'Asia/Riyadh',
      includeAssistantSummary: false,
      detailLevel: 'summary'
    },
    null,
    1,
    verification
  );
  const screen = renderWithQueryData(<ReportPreviewScreen />, [
    [reportKeys.schedule, schedule]
  ]);

  expect(await screen.findByText('Report preview')).toBeTruthy();
  expect(
    await screen.findByText('Recipient: reports@example.com')
  ).toBeTruthy();
  expect(screen.getByText(/Period:/)).toBeTruthy();
  expect(screen.getByText(/Generated:/)).toBeTruthy();
  expect(screen.getByText('Detail level: Summary only')).toBeTruthy();
  expect(
    screen.getByText(
      'Privacy warning: Report content leaves the app for email delivery.'
    )
  ).toBeTruthy();
  expect(screen.getByText('Send test')).toBeTruthy();
  expect(screen.getByText('Simulate download')).toBeTruthy();
  expect(screen.getByText('Simulate share')).toBeTruthy();

  fireEvent.press(screen.getByText('Send now'));
  expect(await screen.findByText('Sent')).toBeTruthy();
});

test('a selected-account preview cannot turn into a global export', async () => {
  changeLocale('en');
  const account = (await coreFinanceService.listAccounts(false))[0];
  const before = useCoreFinanceViewState.getState().selectedAccountId;
  useCoreFinanceViewState.setState({ selectedAccountId: account.id });
  const originalPreview = reportsService.previewOutput.bind(reportsService);
  const spy = jest
    .spyOn(reportsService, 'previewOutput')
    .mockImplementation(originalPreview);
  const screen = renderWithQueryData(<ReportPreviewScreen />, []);
  try {
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          accountIds: [account.id],
          currencyCode: account.currencyCode
        }),
        expect.anything()
      )
    );
    expect(await screen.findByText('Report preview')).toBeTruthy();
  } finally {
    screen.unmount();
    spy.mockRestore();
    useCoreFinanceViewState.setState({ selectedAccountId: before });
  }
});
