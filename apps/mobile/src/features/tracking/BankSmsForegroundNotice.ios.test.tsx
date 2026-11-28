import { act, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useTrackingAdmission } from '@/state/tracking-admission';
import { renderWithProviders } from '@/test-utils/render';
import { BankSmsForegroundNotice } from './BankSmsForegroundNotice.ios';

const mockTake = jest.fn();
jest.mock('expo-notifications', () => ({
  ...jest.requireActual('expo-notifications'),
  addNotificationReceivedListener: jest.fn()
}));
jest.mock('@/services/platform/bank-sms-bridge.ios', () => ({
  bankSmsNative: () => ({ takeForegroundNotice: mockTake })
}));
jest.mock('@/services/live/auth-service', () => ({
  ...jest.requireActual('@/services/live/auth-service'),
  readLogoutSessionAnchor: async () => 'session'
}));

it('displays details only inside the active visible session and removes them on hide', async () => {
  const subscription = jest.mocked(Notifications.addNotificationReceivedListener)
    .mockReturnValue({ remove: jest.fn() });
  const previousState = AppState.currentState;
  const session = useAppShellStore.getState().session;
  const admission = useTrackingAdmission.getState();
  const { hydrated, hideBalances } = usePreferenceStore.getState();
  try {
    useAppShellStore.setState({ session: { status: 'authenticated', userId: 'owner',
      method: 'google', issuedAt: 1, expiresAt: Date.now() + 60000, restoration: 'restored' } });
    usePreferenceStore.setState({ hydrated: true, hideBalances: false });
    useTrackingAdmission.setState({ ready: true, admittedOwnerId: 'owner' });
    mockTake.mockResolvedValue('12.34 SAR · QA');
    const view = renderWithProviders(
      <SafeAreaInsetsContext.Provider value={{ top: 16, bottom: 0, left: 0, right: 0 }}>
        <BankSmsForegroundNotice />
      </SafeAreaInsetsContext.Provider>
    );
    const deliver = () => subscription.mock.calls[0][0]({
      request: { identifier: 'bank-sms-saved-qa' }
    } as Notifications.Notification);
    AppState.currentState = 'background';
    await act(async () => deliver());
    expect(mockTake).not.toHaveBeenCalled();
    AppState.currentState = 'active';
    await act(async () => deliver());
    expect(await screen.findByText('12.34 SAR · QA')).toBeOnTheScreen();
    act(() => usePreferenceStore.setState({ hideBalances: true }));
    expect(screen.queryByText('12.34 SAR · QA')).toBeNull();
    view.unmount();
  } finally {
    AppState.currentState = previousState;
    subscription.mockReset();
    useAppShellStore.setState({ session });
    useTrackingAdmission.setState(admission);
    usePreferenceStore.setState({ hydrated, hideBalances });
  }
});
