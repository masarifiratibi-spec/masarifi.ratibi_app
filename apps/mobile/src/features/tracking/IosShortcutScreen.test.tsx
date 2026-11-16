import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';
import IosShortcutScreen from './IosShortcutScreen.ios';
import { resolveTheme } from '@/design-system/theme';
import { changeLocale } from '@/localization/i18n';
import {
  disableBankSms,
  enableBankSms,
  readBankSmsSetup
} from '@/services/platform/bank-sms-setup.ios';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('@/services/platform/bank-sms-setup.ios', () => ({
  disableBankSms: jest.fn(),
  enableBankSms: jest.fn(),
  readBankSmsSetup: jest.fn()
}));

const readStatus = jest.mocked(readBankSmsSetup);
const enable = jest.mocked(enableBankSms);
const disable = jest.mocked(disableBankSms);

beforeEach(() => {
  readStatus.mockReset();
  enable.mockReset();
  disable.mockReset();
  jest.replaceProperty(Platform, 'OS', 'ios');
  changeLocale('en');
  usePreferenceStore.setState({ theme: 'light' });
});

afterEach(() => {
  jest.restoreAllMocks();
  changeLocale('ar');
  usePreferenceStore.setState({ theme: 'system' });
});

it('guides setup and shows confirmation only after the first saved transaction', async () => {
  readStatus.mockResolvedValue({ enabled: false, pending: 0 });
  enable.mockResolvedValue(undefined);
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

  renderWithProviders(<IosShortcutScreen />);
  expect(screen.getByTestId('shortcut-setup')).toHaveStyle({
    backgroundColor: resolveTheme('light').colors.surfaces.page
  });
  await screen.findByText('SMS capture is off.');
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

  readStatus.mockResolvedValue({ enabled: true, pending: 0 });
  fireEvent.press(screen.getByRole('button', { name: 'Allow capture' }));
  await screen.findByText('SMS capture is allowed.');
  expect(enable).toHaveBeenCalledTimes(1);

  fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Step 2 of 3')).toBeOnTheScreen();
  expect(screen.getByText('Choose Message.')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Open Shortcuts' }));
  expect(openURL).toHaveBeenCalledWith('shortcuts://');

  fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Step 3 of 3')).toBeOnTheScreen();
  expect(screen.getByText('Choose Process Bank SMS.')).toBeOnTheScreen();
  expect(
    screen.queryByText('A transaction from Shortcuts was saved.')
  ).toBeNull();
  expect(
    screen.getByText(/^Waiting for the first transaction\./)
  ).toBeOnTheScreen();

  readStatus.mockResolvedValue({
    enabled: true,
    pending: 0,
    lastSaved: Date.UTC(2026, 10, 17),
    outcome: 'saved'
  });
  fireEvent.press(screen.getByRole('button', { name: 'Check status' }));
  await screen.findByText('A transaction from Shortcuts was saved.');
  expect(screen.getByText(/^Last confirmed financial save:/)).toBeOnTheScreen();

  readStatus.mockResolvedValue({ enabled: false, pending: 0 });
  fireEvent.press(
    screen.getByRole('button', { name: 'Disable capture in this app' })
  );
  await waitFor(() =>
    expect(screen.getByText('SMS capture is off.')).toBeOnTheScreen()
  );
  expect(disable).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Step 1 of 3')).toBeOnTheScreen();
});

it('renders the Arabic setup in dark mode and allows a failed read to be retried', async () => {
  changeLocale('ar');
  usePreferenceStore.setState({ theme: 'dark' });
  readStatus.mockRejectedValueOnce(new Error('unavailable'));
  readStatus.mockResolvedValue({ enabled: true, pending: 0 });

  renderWithProviders(<IosShortcutScreen />);
  expect(screen.getByTestId('shortcut-setup')).toHaveStyle({
    backgroundColor: resolveTheme('dark').colors.surfaces.page
  });
  expect(screen.getByText('إعداد تتبع الرسائل')).toBeOnTheScreen();
  expect(screen.getByText('الخطوة ١ من ٣')).toBeOnTheScreen();
  await screen.findByText(/^تعذّر قراءة حالة التتبع\./);
  fireEvent.press(screen.getByRole('button', { name: 'تحقّق من الحالة' }));
  await screen.findByText('تم السماح بالتقاط الرسائل.');
  fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
  expect(screen.getByText('الخطوة ٢ من ٣')).toBeOnTheScreen();
  expect(screen.getByText('اختر «رسالة» (Message).')).toBeOnTheScreen();
});
