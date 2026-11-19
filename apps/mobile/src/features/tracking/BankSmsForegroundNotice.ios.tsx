import { useContext, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { addNotificationReceivedListener } from 'expo-notifications';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Toast } from '@/design-system/components/feedback/TransientFeedback';
import { spacing } from '@/design-system/tokens';
import { readLogoutSessionAnchor } from '@/services/live/auth-service';
import { bankSmsNative } from '@/services/platform/bank-sms-bridge.ios';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useTrackingAdmission } from '@/state/tracking-admission';
import { useTheme } from '@/state/theme-context';

export function BankSmsForegroundNotice() {
  const session = useAppShellStore((state) => state.session);
  const unlocked = useAppShellStore((state) =>
    !state.privacyLock?.enabled || state.privacyLock.appLockStatus === 'unlocked');
  const showBalances = usePreferenceStore((state) => state.hydrated && !state.hideBalances);
  const admitted = useTrackingAdmission((state) =>
    state.ready && state.admittedOwnerId === session?.userId);
  const visible = admitted && unlocked && showBalances;
  const [message, setMessage] = useState<{ text: string; session: typeof session }>();
  const { colors } = useTheme();
  const top = useContext(SafeAreaInsetsContext)?.top ?? 0;

  useEffect(() => {
    setMessage(undefined);
    if (!visible || session?.status !== 'authenticated' || !session.userId) return;
    const owner = session.userId;
    let revision = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      revision++;
      clearTimeout(timer);
      setMessage(undefined);
    };
    const app = AppState.addEventListener('change', (state) => {
      if (state !== 'active') clear();
    });
    const receive = async (id: string) => {
      if (!id.startsWith('bank-sms-saved-') || AppState.currentState !== 'active') return;
      const current = ++revision;
      const anchor = await readLogoutSessionAnchor(owner);
      if (!anchor || revision !== current) return;
      const text = await bankSmsNative()?.takeForegroundNotice(owner, anchor, id);
      if (!text || revision !== current || AppState.currentState !== 'active' ||
          usePreferenceStore.getState().hideBalances || useAppShellStore.getState().session !== session) return;
      clearTimeout(timer);
      setMessage({ text, session });
      timer = setTimeout(clear, 5000);
    };
    const notices = addNotificationReceivedListener(({ request }) => {
      void receive(request.identifier).catch(() => undefined);
    });
    return () => {
      revision++;
      clearTimeout(timer);
      app.remove();
      notices.remove();
    };
  }, [visible, session]);

  if (!visible || !message || message.session !== session) return null;
  return (
    <View pointerEvents="none" style={{
      position: 'absolute', top: top + spacing.sm, left: spacing.md, right: spacing.md,
      zIndex: 10, backgroundColor: colors.surfaces.card
    }}>
      <Toast message={message.text} />
    </View>
  );
}
