import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react-native';
import { resolveTheme } from '@/design-system/theme';
import { translate } from '@/localization/i18n';
import { ThemeContext } from '@/state/theme-context';
import { useAppShellStore } from '@/state/app-shell';
import * as reset from '@/services/financial-reset';
import { FinancialResetCard } from './FinancialResetCard';

jest.mock('@/services/financial-reset');
jest.mock('@/services/financial-generation');
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) =>
    jest.requireActual('react').useEffect(callback, [callback])
}));
let client: QueryClient;
const ready = {
  generation: 0,
  status: 'ready' as const,
  resetAt: null,
  requestId: null
};
const ownerSession = (userId: string) =>
  useAppShellStore.setState({
    session: { userId, status: 'authenticated' } as never
  });
const card = (ownerId: string) => (
  <QueryClientProvider client={client}>
    <ThemeContext.Provider value={{ theme: resolveTheme('light') }}>
      <FinancialResetCard ownerId={ownerId} key={ownerId} />
    </ThemeContext.Provider>
  </QueryClientProvider>
);
beforeEach(() => {
  jest.resetAllMocks();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  });
  ownerSession('owner-a');
  jest.mocked(reset.financialResetRuntimeAvailable).mockReturnValue(true);
  jest.mocked(reset.loadFinancialResetOperation).mockResolvedValue(null);
  jest.mocked(reset.fetchFinancialResetState).mockResolvedValue(ready);
});
afterEach(() => client.clear());

it('retains the entry when its background request fails and shows a recoverable sheet', async () => {
  jest
    .mocked(reset.fetchFinancialResetState)
    .mockRejectedValue(new Error('offline'));
  render(card('owner-a'));
  const entry = screen.getByRole('link');
  expect(screen.getByText(translate('financialReset.title'))).toBeOnTheScreen();
  fireEvent.press(entry);
  await screen.findByText(translate('financialReset.error'));
  expect(
    screen.getByText(translate('financialReset.confirmMessage'))
  ).toBeOnTheScreen();
  expect(
    screen.getByRole('button', { name: translate('financialReset.submit') })
  ).toBeDisabled();
  fireEvent.press(
    screen.getByRole('button', { name: translate('coreFinance.cancel') })
  );
  expect(screen.getByText(translate('financialReset.title'))).toBeOnTheScreen();
  expect(reset.submitFinancialReset).not.toHaveBeenCalled();
});

it('reuses a completed background read when opening the shared sheet', async () => {
  render(card('owner-a'));
  await act(async () => {});
  fireEvent.press(screen.getByRole('link'));
  await waitFor(() =>
    expect(
      screen.getByRole('button', {
        name: translate('financialReset.submit')
      })
    ).toBeEnabled()
  );
  expect(reset.fetchFinancialResetState).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('app-sheet-menu')).toBeOnTheScreen();
  expect(reset.submitFinancialReset).not.toHaveBeenCalled();
});

it('loads the new owner independently of the previous owner’s prefetched result', async () => {
  const view = render(card('owner-a'));
  await act(async () => {});
  let release!: (state: typeof ready) => void;
  jest.mocked(reset.fetchFinancialResetState).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  ownerSession('owner-b');
  view.rerender(card('owner-b'));
  fireEvent.press(screen.getByRole('link'));
  const submit = screen.getByRole('button', {
    name: translate('financialReset.submit')
  });
  expect(submit).toBeDisabled();
  await act(async () => release(ready));
  await waitFor(() => expect(submit).toBeEnabled());
  expect(reset.fetchFinancialResetState).toHaveBeenLastCalledWith('owner-b');
});
