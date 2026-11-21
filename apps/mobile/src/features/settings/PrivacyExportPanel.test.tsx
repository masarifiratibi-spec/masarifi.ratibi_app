import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  clearPrivacyExportJournal,
  savePrivacyExportJournal
} from '@/storage/privacy-export-journal';
import { Linking, Share } from 'react-native';
import * as Crypto from 'expo-crypto';
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
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.mocked(settingsService.getPrivacyExport).mockReset();
  jest.mocked(settingsService.requestPrivacyAction).mockReset();
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
it('explains the supported account ZIP and empty state without making a request on entry', async () => {
  renderWithProviders(<PrivacyExportPanel />);
  await screen.findByText('No export requested yet');
  expect(
    screen.getByText(
      'ZIP archive · Account data. Report filters do not limit this export.'
    )
  ).toBeTruthy();
  expect(settingsService.requestPrivacyAction).not.toHaveBeenCalled();
});
it('refreshes before sharing a private expiring link and does not claim it was delivered', async () => {
  await savePrivacyExportJournal(owner, { operationId, requestId: status.id });
  jest
    .mocked(settingsService.getPrivacyExport)
    .mockResolvedValueOnce(status as never)
    .mockResolvedValueOnce({
      ...status,
      downloadUrl: 'https://storage.example.com/new-link'
    } as never);
  const share = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: Share.sharedAction });
  renderWithProviders(<PrivacyExportPanel />);
  fireEvent.press(
    await screen.findByRole('button', { name: 'Share download link' })
  );
  await waitFor(() =>
    expect(share).toHaveBeenCalledWith({
      message: 'https://storage.example.com/new-link',
      url: 'https://storage.example.com/new-link'
    })
  );
  expect(await screen.findByText('Sharing options opened')).toBeTruthy();
  expect(settingsService.requestPrivacyAction).not.toHaveBeenCalled();
});
it('serializes same-frame taps when creating a new copy of an expired export', async () => {
  jest
    .spyOn(Crypto, 'randomUUID')
    .mockReturnValue('00000000-0000-4000-8000-000000000002');
  await savePrivacyExportJournal(owner, { operationId, requestId: status.id });
  jest
    .mocked(settingsService.getPrivacyExport)
    .mockResolvedValue({ ...status, status: 'expired' } as never);
  let finish!: (value: never) => void;
  jest.mocked(settingsService.requestPrivacyAction).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  renderWithProviders(<PrivacyExportPanel />);
  const button = await screen.findByRole('button', {
    name: 'Request a new export'
  });
  await waitFor(() => expect(button).toBeEnabled());
  act(() => {
    fireEvent.press(button);
    fireEvent.press(button);
  });
  await waitFor(() =>
    expect(settingsService.requestPrivacyAction).toHaveBeenCalledTimes(1)
  );
  await act(async () =>
    finish({ value: { id: status.id }, affectedScopes: [] } as never)
  );
});
it('never sends a non-HTTPS link to the system share dialog', async () => {
  await savePrivacyExportJournal(owner, { operationId, requestId: status.id });
  jest
    .mocked(settingsService.getPrivacyExport)
    .mockResolvedValueOnce(status as never)
    .mockResolvedValueOnce({
      ...status,
      downloadUrl: 'http://storage.example.com/insecure'
    } as never);
  const share = jest.spyOn(Share, 'share');
  renderWithProviders(<PrivacyExportPanel />);
  fireEvent.press(
    await screen.findByRole('button', { name: 'Share download link' })
  );
  await screen.findByText(translateDynamic('settings.privacy.exportFailure'));
  expect(share).not.toHaveBeenCalled();
});
it('shows processing without a download, then refreshes the same request to ready', async () => {
  await savePrivacyExportJournal(owner, { operationId, requestId: status.id });
  jest
    .mocked(settingsService.getPrivacyExport)
    .mockResolvedValueOnce({
      ...status,
      status: 'processing',
      downloadUrl: undefined,
      downloadUrlExpiresAt: undefined
    } as never)
    .mockResolvedValueOnce(status as never);
  renderWithProviders(<PrivacyExportPanel />);
  await screen.findByText('Preparing your export');
  expect(screen.queryByRole('button', { name: 'Download export' })).toBeNull();
  const refresh = screen.getByRole('button', { name: 'Refresh export status' });
  await waitFor(() => expect(refresh).toBeEnabled());
  fireEvent.press(refresh);
  await screen.findByRole('button', { name: 'Download export' });
  expect(settingsService.requestPrivacyAction).not.toHaveBeenCalled();
});
it('does not share another owner’s link when the owner changes while refreshing', async () => {
  await savePrivacyExportJournal(owner, { operationId, requestId: status.id });
  jest
    .mocked(settingsService.getPrivacyExport)
    .mockResolvedValueOnce(status as never);
  const share = jest.spyOn(Share, 'share');
  let finish!: (value: never) => void;
  renderWithProviders(<PrivacyExportPanel />);
  const button = await screen.findByRole('button', {
    name: 'Share download link'
  });
  await waitFor(() => expect(button).toBeEnabled());
  jest.mocked(settingsService.getPrivacyExport).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  fireEvent.press(button);
  await waitFor(() =>
    expect(settingsService.getPrivacyExport).toHaveBeenCalledTimes(2)
  );
  await act(async () => {
    useAppShellStore.setState({ session: null });
    finish(status as never);
  });
  expect(share).not.toHaveBeenCalled();
});
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
it('rejects an expired signed link and recovers with a freshly checked link for the same export', async () => {
  await savePrivacyExportJournal(owner, { operationId, requestId: status.id });
  const freshUrl = 'https://storage.example.com/refreshed';
  jest
    .mocked(settingsService.getPrivacyExport)
    .mockResolvedValueOnce(status as never)
    .mockResolvedValueOnce({
      ...status,
      downloadUrlExpiresAt: '2020-01-01T00:00:00.000Z'
    } as never)
    .mockResolvedValueOnce({ ...status, downloadUrl: freshUrl } as never);
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  renderWithProviders(<PrivacyExportPanel />);
  fireEvent.press(
    await screen.findByText(translateDynamic('settings.privacy.exportDownload'))
  );
  await screen.findByText(translateDynamic('settings.privacy.exportFailure'));
  expect(open).not.toHaveBeenCalled();
  fireEvent.press(
    screen.getByText(translateDynamic('settings.privacy.exportDownload'))
  );
  await waitFor(() => expect(open).toHaveBeenCalledWith(freshUrl));
  expect(settingsService.requestPrivacyAction).not.toHaveBeenCalled();
  expect(
    jest.mocked(settingsService.getPrivacyExport).mock.calls.map(([id]) => id)
  ).toEqual([status.id, status.id, status.id]);
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
