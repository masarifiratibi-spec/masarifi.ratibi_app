import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';
import { router } from 'expo-router';
import IosShortcutScreen from './IosShortcutScreen.ios';
import { resolveTheme } from '@/design-system/theme';
import { changeLocale } from '@/localization/i18n';
import {
  completeBankSmsSetup,
  disableBankSms,
  enableBankSms,
  readBankSmsSetup
} from '@/services/platform/bank-sms-setup.ios';
import { phoneNotificationService } from '@/services/platform/phone-notification-service';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('@/services/platform/bank-sms-setup.ios', () => ({
  completeBankSmsSetup: jest.fn(),
  disableBankSms: jest.fn(),
  enableBankSms: jest.fn(),
  readBankSmsSetup: jest.fn()
}));
const readStatus = jest.mocked(readBankSmsSetup);
const enable = jest.mocked(enableBankSms);
const disable = jest.mocked(disableBankSms);

beforeEach(() => {
  jest.mocked(completeBankSmsSetup).mockReset().mockResolvedValue(undefined);
  readStatus
    .mockReset()
    .mockResolvedValue({ enabled: false, pending: 0, setupCompleted: false });
  enable.mockReset().mockResolvedValue(undefined);
  disable.mockReset().mockResolvedValue(undefined);
  jest.replaceProperty(Platform, 'OS', 'ios');
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue('27.2');
  jest
    .spyOn(phoneNotificationService, 'getPermission')
    .mockResolvedValue('not_requested');
  changeLocale('en');
  usePreferenceStore.setState({ theme: 'light' });
});
afterEach(() => {
  jest.restoreAllMocks();
  changeLocale('ar');
  usePreferenceStore.setState({ theme: 'system' });
});

it('requests notifications independently of recording and guides all four stages', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const done = jest
    .spyOn(router, 'replace')
    .mockImplementation(() => undefined);
  const allowAlerts = jest
    .spyOn(phoneNotificationService, 'requestPermission')
    .mockResolvedValue('granted');
  renderWithProviders(<IosShortcutScreen />);
  fireEvent.press(
    await screen.findByRole('button', { name: 'Enable notifications' })
  );
  await screen.findByRole('button', { name: 'Notifications are on.' });
  expect(enable).not.toHaveBeenCalled();
  expect(allowAlerts).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  readStatus.mockResolvedValue({
    enabled: true,
    pending: 0,
    setupCompleted: false
  });
  fireEvent.press(screen.getByRole('switch', { name: /Record transactions/ }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  );
  fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() =>
    expect(screen.getByRole('progressbar')).toHaveAccessibilityValue({
      min: 1,
      max: 4,
      now: 2
    })
  );
  expect(screen.getByText('Choose Message.')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Open Shortcuts' }));
  expect(openURL).toHaveBeenCalledWith('shortcuts://');
  fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText(/SMS Text.+Content/)).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByRole('progressbar')).toHaveAccessibilityValue({
    min: 1,
    max: 4,
    now: 2
  });
  fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByRole('progressbar')).toHaveAccessibilityValue({
    min: 1,
    max: 4,
    now: 4
  });
  expect(screen.getByText(/Confirm Before Run/)).toBeOnTheScreen();
  expect(screen.queryByText('Tracking status')).toBeNull();
  for (const name of [
    'Check status',
    'View transactions',
    'Refresh accounts and categories',
    'Disable capture in this app'
  ]) {
    expect(screen.queryByRole('button', { name })).toBeNull();
  }
  fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(done).toHaveBeenCalledWith('/(tabs)/home'));
  expect(completeBankSmsSetup).toHaveBeenCalledTimes(1);
});

it('identifies a partial account suffix before submitting settings', async () => {
  readStatus.mockResolvedValue({
    enabled: true,
    pending: 0,
    setupCompleted: false,
    accounts: [
      {
        id: 'bank',
        name: 'QA Bank',
        kind: 'account',
        type: 'bank',
        currency: 'SAR',
        automaticRouting: true
      }
    ]
  });
  renderWithProviders(<IosShortcutScreen />);
  fireEvent.press(
    await screen.findByRole('button', { name: /Account or card/ })
  );
  fireEvent.press(screen.getByRole('button', { name: 'QA Bank' }));
  const field = screen.getByLabelText(
    'Last four bank account digits (optional)'
  );
  fireEvent.changeText(field, '١٢٣');
  expect(
    screen.getByText(
      'Enter the last four account digits or leave this field empty.'
    )
  ).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(enable).not.toHaveBeenCalled();
  fireEvent.changeText(field, '١٢٣٤');
  expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
});

it('opens Settings after permanent denial without blocking capture setup', async () => {
  readStatus.mockResolvedValue({
    enabled: true,
    pending: 0,
    setupCompleted: false
  });
  jest
    .mocked(phoneNotificationService.getPermission)
    .mockResolvedValue('permanently_denied');
  const openSettings = jest
    .spyOn(Linking, 'openSettings')
    .mockResolvedValue(undefined);
  renderWithProviders(<IosShortcutScreen />);
  fireEvent.press(
    await screen.findByRole('button', { name: 'Notification settings' })
  );
  await waitFor(() => expect(openSettings).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
});

it('starts from stage one for returning users and keeps consent reversible there', async () => {
  readStatus.mockResolvedValue({
    enabled: true,
    pending: 0,
    setupCompleted: false,
    lastSaved: Date.UTC(2026, 10, 17),
    outcome: 'saved'
  });
  renderWithProviders(<IosShortcutScreen />);
  await waitFor(() =>
    expect(screen.getByRole('switch')).toHaveAccessibilityState({
      checked: true
    })
  );
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(
    screen.queryByText('A transaction from Shortcuts was saved.')
  ).toBeNull();
  readStatus.mockResolvedValue({
    enabled: false,
    pending: 0,
    setupCompleted: false
  });
  fireEvent.press(screen.getByRole('switch'));
  await waitFor(() =>
    expect(screen.getByRole('switch')).toHaveAccessibilityState({
      checked: false
    })
  );
  expect(disable).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
});

it('retries a failed setup read without hiding the notification button or granting consent', async () => {
  readStatus
    .mockRejectedValueOnce(new Error('unavailable'))
    .mockResolvedValue({ enabled: true, pending: 0, setupCompleted: false });
  renderWithProviders(<IosShortcutScreen />);
  const retry = await screen.findByRole('button', { name: 'Try again' });
  expect(
    screen.getByRole('button', { name: 'Enable notifications' })
  ).toBeOnTheScreen();
  fireEvent.press(retry);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  );
  expect(
    screen.getByRole('button', { name: 'Enable notifications' })
  ).toBeOnTheScreen();
  expect(enable).not.toHaveBeenCalled();
});

it('keeps the older iOS Automation-tab instructions and Run Immediately option', async () => {
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue('18.0');
  readStatus.mockResolvedValue({
    enabled: true,
    pending: 0,
    setupCompleted: false
  });
  renderWithProviders(<IosShortcutScreen />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  );
  fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('In Shortcuts, open the Automation tab and tap +.');
  fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(
    screen.getByText('Choose Run Immediately, then tap Next.')
  ).toBeOnTheScreen();
  expect(screen.queryByText(/Confirm Before Run/)).toBeNull();
});

it.each([
  ['ar', 'light'],
  ['ar', 'dark'],
  ['en', 'light'],
  ['en', 'dark']
] as const)(
  'supports the %s notification button on the %s surface',
  async (locale, theme) => {
    changeLocale(locale);
    usePreferenceStore.setState({ theme });
    renderWithProviders(<IosShortcutScreen />);
    expect(screen.getByTestId('shortcut-setup')).toHaveStyle({
      backgroundColor: resolveTheme(theme).colors.surfaces.page
    });
    await screen.findByRole('button', {
      name: locale === 'ar' ? 'تفعيل الإشعارات' : 'Enable notifications'
    });
    expect(screen.queryByRole('progressbar')).toBeNull();
    fireEvent.press(
      screen.getByRole('link', {
        name: locale === 'ar' ? 'كيف يعمل التتبّع؟' : 'How does tracking work?'
      })
    );
    fireEvent.press(
      await screen.findByRole('button', {
        name: locale === 'ar' ? 'فهمت' : 'Got it'
      })
    );
    expect(screen.queryByTestId('app-sheet-modal')).toBeNull();
  }
);

it('lists only eligible destinations, cancels without changing the draft and preserves routing defaults', async () => {
  const preferences = {
    expenseId: 'personal-expense',
    incomeId: 'personal-income',
    feeId: 'fee',
    salaryId: 'pay'
  };
  const bank = {
    id: 'bank',
    name: 'My bank',
    kind: 'account',
    type: 'bank',
    currency: 'SAR',
    automaticRouting: true
  };
  readStatus.mockResolvedValue({
    enabled: true,
    pending: 0,
    setupCompleted: false,
    preferences,
    accounts: [
      bank,
      {
        ...bank,
        id: 'card',
        name: 'My card',
        type: 'credit_card',
        lastFour: '8765'
      },
      {
        ...bank,
        id: 'cash',
        name: 'My cash',
        type: 'cash',
        automaticRouting: false
      }
    ]
  });
  renderWithProviders(<IosShortcutScreen />);
  const open = () =>
    fireEvent.press(screen.getByRole('button', { name: /^Account or card/ }));
  await screen.findByRole('button', { name: /^Account or card/ });
  open();
  expect(screen.queryByRole('button', { name: 'My cash' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(
    screen.queryByLabelText('Last four bank account digits (optional)')
  ).toBeNull();
  open();
  fireEvent.press(screen.getByRole('button', { name: 'My card' }));
  expect(screen.getByText(/8765/)).toBeOnTheScreen();
  expect(
    screen.getByRole('button', { name: /Cash account for withdrawals/ })
  ).toBeEnabled();
  fireEvent.changeText(
    screen.getByLabelText('Last four bank account digits (optional)'),
    '1234'
  );
  open();
  fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByDisplayValue('1234')).toBeOnTheScreen();
  for (const label of [
    'Expense category for unknown merchants',
    'Income category',
    'Fee category',
    'Salary category'
  ])
    expect(screen.queryByText(label)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() =>
    expect(enable).toHaveBeenCalledWith({
      links: expect.objectContaining({
        card: expect.objectContaining({ accountEnding: '1234' })
      })
    })
  );
});

it('explains how to add an eligible destination when none can be selected', async () => {
  readStatus.mockResolvedValue({
    enabled: true,
    pending: 0,
    setupCompleted: false,
    accounts: []
  });
  renderWithProviders(<IosShortcutScreen />);
  await screen.findByText(
    'Turn on automatic tracking for a bank or card account in Accounts.'
  );
  expect(screen.queryByRole('button', { name: /^Account or card/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
});
