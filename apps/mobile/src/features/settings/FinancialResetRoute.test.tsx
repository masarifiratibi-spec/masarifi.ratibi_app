import React from 'react';
import { TextInput } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render as renderNative,
  screen,
  waitFor
} from '@testing-library/react-native';
import { FinancialResetDialog } from './FinancialResetDialog';
import { changeLocale, translate } from '@/localization/i18n';
import { resolveTheme } from '@/design-system/theme';
import { ThemeContext } from '@/state/theme-context';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import * as reset from '@/services/financial-reset';
import { reconcileFinancialReset } from '@/services/financial-generation';

jest.mock('@/services/financial-reset');
jest.mock('@/services/financial-generation');
function render(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  });
  return renderNative(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}
const close = jest.fn();
const id = '00000000-0000-4000-8000-000000000001';
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(reset.financialResetRuntimeAvailable).mockReturnValue(true);
  jest.mocked(reset.loadFinancialResetOperation).mockResolvedValue(null);
  jest.mocked(reset.fetchFinancialResetState).mockResolvedValue({
    generation: 0,
    status: 'ready',
    resetAt: null,
    requestId: null
  });
  useAppShellStore.setState({
    session: { userId: 'owner', status: 'authenticated' } as never
  });
});

it.each([
  ['ar', 'dark'],
  ['ar', 'light'],
  ['en', 'light'],
  ['en', 'dark']
] as const)(
  'confirms directly in %s/%s and waits for server and local reconciliation',
  async (locale, theme) => {
    changeLocale(locale);
    usePreferenceStore.setState({
      locale,
      direction: locale === 'ar' ? 'rtl' : 'ltr'
    });
    let release!: () => void;
    jest.mocked(reconcileFinancialReset).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ generation: 1, cutoff: 0, changed: true });
        })
    );
    jest
      .mocked(reset.submitFinancialReset)
      .mockResolvedValue({ id, generation: 1, status: 'completed' });
    render(
      <ThemeContext.Provider value={{ theme: resolveTheme(theme) }}>
        <FinancialResetDialog ownerId="owner" onClose={close} />
      </ThemeContext.Provider>
    );
    await screen.findByText(translate('financialReset.confirmMessage'));
    expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
    const button = screen.getByRole('button', {
      name: translate('financialReset.submit')
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: translate('financialReset.submit') })
      ).toBeEnabled()
    );
    expect(reset.submitFinancialReset).not.toHaveBeenCalled();
    fireEvent.press(button);
    fireEvent.press(button);
    expect(reset.submitFinancialReset).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(reconcileFinancialReset).toHaveBeenCalledWith('owner')
    );
    expect(reset.submitFinancialReset).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(translate('financialReset.complete'))).toBeNull();
    await act(async () => release());
    expect(screen.getByText(translate('financialReset.complete'))).toBeTruthy();
    fireEvent.press(
      screen.getByRole('button', { name: translate('financialReset.done') })
    );
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  }
);

it('closes cancellation without submitting financial changes', async () => {
  render(<FinancialResetDialog ownerId="owner" onClose={close} />);
  await screen.findByText(translate('financialReset.confirmMessage'));
  fireEvent.press(
    screen.getByRole('button', { name: translate('coreFinance.cancel') })
  );
  expect(close).toHaveBeenCalledTimes(1);
  expect(reset.submitFinancialReset).not.toHaveBeenCalled();
});

it('resumes a known server receipt after reopening without submitting a new reset', async () => {
  jest
    .mocked(reset.loadFinancialResetOperation)
    .mockResolvedValue({ id, generation: 0 });
  jest
    .mocked(reset.readFinancialReset)
    .mockResolvedValue({ id, generation: 1, status: 'completed' });
  jest
    .mocked(reconcileFinancialReset)
    .mockResolvedValue({ generation: 1, cutoff: 0, changed: false });
  render(<FinancialResetDialog ownerId="owner" onClose={close} />);
  await screen.findByText(translate('financialReset.complete'));
  expect(reset.readFinancialReset).toHaveBeenCalledWith('owner', id);
  expect(reset.submitFinancialReset).not.toHaveBeenCalled();
});

it('keeps confirmation unavailable when the state contract cannot be confirmed', async () => {
  jest
    .mocked(reset.fetchFinancialResetState)
    .mockRejectedValue(new Error('missing capability'));
  render(<FinancialResetDialog ownerId="owner" onClose={close} />);
  await screen.findByText(translate('financialReset.error'));
  expect(
    screen.getByRole('button', { name: translate('financialReset.submit') })
  ).toBeDisabled();
  expect(
    screen.getByText(translate('financialReset.confirmMessage'))
  ).toBeOnTheScreen();
});
