import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { synchronizeBankSmsNotificationLocale } from '@/services/platform/bank-sms-notice-locale.ios';
import { refreshEnabledBankSms } from '@/services/platform/bank-sms-setup.ios';

export function BankSmsNoticeRuntime() {
  const ready = useAppShellStore((state) => state.hydrated);
  const session = useAppShellStore((state) => state.session);
  const preferencesReady = usePreferenceStore((state) => state.hydrated);
  const locale = usePreferenceStore((state) => state.locale);
  const client = useQueryClient();
  const active =
    ready && preferencesReady && session?.status === 'authenticated';

  useEffect(() => {
    if (active)
      void synchronizeBankSmsNotificationLocale(locale).catch(() => undefined);
  }, [active, session, locale]);

  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void refreshEnabledBankSms().catch(() => undefined);
      }, 350);
    };
    const app = AppState.addEventListener('change', (status) => {
      if (status === 'active') refresh();
    });
    const unsubscribe = client.getQueryCache().subscribe((event) => {
      const [scope, subject] = event.query.queryKey;
      if (
        event.type === 'updated' &&
        event.action.type === 'invalidate' &&
        scope === 'core-finance' &&
        (subject === 'accounts' || subject === 'categories')
      )
        refresh();
    });
    refresh();
    return () => {
      clearTimeout(timer);
      app.remove();
      unsubscribe();
    };
  }, [active, client, session]);
  return null;
}
