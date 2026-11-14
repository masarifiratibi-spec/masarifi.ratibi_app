import React, { type PropsWithChildren } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buildFinancialReport, resolveReportPeriod } from '@/domain/reports';
import { reportsService } from '@/services/reports-service';
import { useAppShellStore } from '@/state/app-shell';
import { useReport } from './report-queries';

jest.mock('@/services/reports-service', () => ({ reportsService: { getReport: jest.fn() } }));
const input = { kind: 'monthly' as const, anchorDate: '2026-10-29' as const, timeZone: 'Asia/Riyadh', currencyCode: 'SAR', accountIds: ['account-A'] };
const report = buildFinancialReport({ period: resolveReportPeriod({ ...input, now: Date.now() }), transactions: [], categories: [], currencyCode: 'SAR' });
const local = { ...report, dataState: 'offline' as const, localData: { pendingSyncCount: 0, excludedCount: 0, empty: true } };
const owner = (userId: string) => ({ userId, status: 'authenticated' as const, restoration: 'restored' as const, method: 'google' as const, issuedAt: 1, expiresAt: 9999999999999 });
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, ...renderHook(() => {
    const result = useReport(input);
    return { data: result.data, isError: result.isError };
  }, { wrapper }) };
}
beforeAll(() => notifyManager.setNotifyFunction(callback => act(callback)));
afterAll(() => notifyManager.setNotifyFunction(callback => callback()));
beforeEach(() => { jest.mocked(reportsService.getReport).mockReset(); useAppShellStore.setState({ session: owner('owner-A') }); });
afterEach(() => { cleanup(); jest.useRealTimers(); useAppShellStore.setState({ session: null }); });

test('automatically replaces the local projection with the recovered server read without changing the selected scope', async () => {
  jest.useFakeTimers();
  let online = false;
  jest.mocked(reportsService.getReport).mockImplementation(async () => online ? report : local);
  const view = setup();
  await waitFor(() => expect(view.result.current.data?.dataState).toBe('offline'));
  online = true;
  await act(async () => { await jest.advanceTimersByTimeAsync(10_000); });
  await waitFor(() => expect(view.result.current.data?.dataState).toBe(report.dataState));
  expect(jest.mocked(reportsService.getReport).mock.calls.every(([query]) => JSON.stringify(query) === JSON.stringify(input))).toBe(true);
  view.unmount(); view.client.clear();
});

test('retains the last valid report on a failed refresh and never reuses it for another owner', async () => {
  jest.mocked(reportsService.getReport).mockResolvedValue(local);
  const view = setup();
  await waitFor(() => expect(view.result.current.data).toEqual(local));
  jest.mocked(reportsService.getReport).mockRejectedValue(Error('service unavailable'));
  await act(async () => { await view.client.refetchQueries({ queryKey: ['reports'] }); });
  await waitFor(() => expect(view.result.current.isError).toBe(true));
  expect(view.result.current.data).toEqual(local);
  act(() => useAppShellStore.setState({ session: owner('owner-B') }));
  await waitFor(() => expect(view.result.current.isError).toBe(true));
  expect(view.result.current.data).toBeUndefined();
  view.unmount(); view.client.clear();
});
