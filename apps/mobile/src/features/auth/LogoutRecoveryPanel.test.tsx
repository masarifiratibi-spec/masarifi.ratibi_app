import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { changeLocale } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';
import { retryPendingLogout } from '@/services/owner-lifecycle';
import { HttpError } from '@/services/live/http-client';
import { LogoutRecoveryPanel } from './LogoutRecoveryPanel';
import { usePreferenceStore } from '@/state/preferences';

jest.mock('@/services/owner-lifecycle', () => ({ retryPendingLogout: jest.fn() }));

afterEach(() => { act(() => useAppShellStore.getState().reset()); jest.resetAllMocks(); });

it.each([
  ['en', 'Retry sign-out', 'The original session could not be verified. Your data has been kept. Retry when that session is available.'],
  ['ar', 'إعادة محاولة تسجيل الخروج', 'تعذّر التحقق من الجلسة الأصلية. حُفظت بياناتك. أعد المحاولة عندما تكون الجلسة متاحة.']
] as const)('shows a bounded original-session recovery action in %s', async (locale, label, message) => {
  changeLocale(locale);
  usePreferenceStore.setState({ locale });
  useAppShellStore.setState({ logoutRecoveryOwnerId: 'user_pending_logout' });
  jest.mocked(retryPendingLogout).mockRejectedValue(new HttpError('session_expired', 401, 'LOGOUT_SESSION_UNVERIFIED'));
  render(<LogoutRecoveryPanel />);
  fireEvent.press(screen.getByRole('button', { name: label }));
  await waitFor(() => expect(screen.getByText(message)).toBeOnTheScreen());
  expect(retryPendingLogout).toHaveBeenCalledTimes(1);
  expect(retryPendingLogout).toHaveBeenCalledWith('user_pending_logout');
});
