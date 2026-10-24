import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  clearPrivacyExportJournal,
  savePrivacyExportJournal
} from '@/storage/privacy-export-journal';
import { Linking } from 'react-native';
import { PrivacyExportPanel } from './PrivacyExportPanel';
import { settingsService } from '@/services/mocks/subscription-settings-service';
import { useAppShellStore } from '@/state/app-shell';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translateDynamic } from '@/localization/i18n';
jest.mock('@/services/mocks/subscription-settings-service', () => ({
  settingsService: {
    getPrivacyExport: jest.fn(),
    requestPrivacyAction: jest.fn()
  }
}));
const operationId = '00000000-0000-4000-8000-000000000001';
const owner = 'export_owner';
const status = {
  id: 'export-1',
  status: 'ready',
  scope: ['ledger'],
  requestedAt: '2026-10-24T00:00:00.000Z',
  expiresAt: null,
  version: 1,
  downloadUrl: 'https://storage.example.com/fresh',
  downloadUrlExpiresAt: '2099-10-24T00:00:00.000Z'
};
beforeEach(async () => {
  jest.clearAllMocks();
  await clearPrivacyExportJournal(owner);
  changeLocale('en');
  useAppShellStore.setState({
    session: {
      status: 'authenticated',
      restoration: 'restored',
      userId: owner,
      method: 'google',
      issuedAt: 1,
      expiresAt: 9999999999999
    }
  });
});
afterEach(() => useAppShellStore.setState({ session: null }));
it('reloads the owner journal and refreshes a ready signed URL before opening it', async () => {
  await savePrivacyExportJournal(owner, { operationId, requestId: status.id });
  jest
    .mocked(settingsService.getPrivacyExport)
    .mockResolvedValue(status as never);
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  renderWithProviders(<PrivacyExportPanel />);
  const download = await screen.findByText(
    translateDynamic('settings.privacy.exportDownload')
  );
  fireEvent.press(download);
  await waitFor(() => expect(open).toHaveBeenCalledWith(status.downloadUrl));
  expect(settingsService.getPrivacyExport).toHaveBeenCalledTimes(2);
});
it('keeps a stable operation across an uncertain network retry', async () => {
  await savePrivacyExportJournal(owner, { operationId });
  jest
    .mocked(settingsService.requestPrivacyAction)
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValue({
      value: { id: status.id },
      affectedScopes: []
    } as never);
  jest
    .mocked(settingsService.getPrivacyExport)
    .mockResolvedValue(status as never);
  renderWithProviders(<PrivacyExportPanel />);
  await waitFor(() =>
    expect(
      screen.getByText(translateDynamic('settings.privacy.exportRequest'))
    ).toBeEnabled()
  );
  fireEvent.press(
    screen.getByText(translateDynamic('settings.privacy.exportRequest'))
  );
  await screen.findByText(translateDynamic('settings.privacy.exportFailure'));
  fireEvent.press(
    screen.getByText(translateDynamic('settings.privacy.exportRequest'))
  );
  await screen.findByText(translateDynamic('settings.privacy.exportDownload'));
  expect(
    jest
      .mocked(settingsService.requestPrivacyAction)
      .mock.calls.map((call) => call[1])
  ).toEqual([operationId, operationId]);
});
it('does not open a download when the authenticated owner changes while refreshing', async () => {
  await savePrivacyExportJournal(owner, { operationId, requestId: status.id });
  jest
    .mocked(settingsService.getPrivacyExport)
    .mockResolvedValueOnce(status as never);
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  let finish!: (value: never) => void;
  renderWithProviders(<PrivacyExportPanel />);
  const download = await screen.findByText(
    translateDynamic('settings.privacy.exportDownload')
  );
  jest.mocked(settingsService.getPrivacyExport).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  fireEvent.press(download);
  await waitFor(() =>
    expect(settingsService.getPrivacyExport).toHaveBeenCalledTimes(2)
  );
  await act(async () => {
    useAppShellStore.setState({ session: null });
    finish(status as never);
  });
  expect(open).not.toHaveBeenCalled();
});
