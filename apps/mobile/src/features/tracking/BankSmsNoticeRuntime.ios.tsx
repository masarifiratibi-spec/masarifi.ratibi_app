import { useEffect } from 'react';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { synchronizeBankSmsNotificationLocale } from '@/services/platform/bank-sms-notice-locale.ios';

export function BankSmsNoticeRuntime() {
  const ready = useAppShellStore((state) => state.hydrated);
  const session = useAppShellStore((state) => state.session);
  const preferencesReady = usePreferenceStore((state) => state.hydrated);
  const locale = usePreferenceStore((state) => state.locale);
  useEffect(() => {
    if (!ready || !preferencesReady || session?.status !== 'authenticated')
      return;
    void synchronizeBankSmsNotificationLocale(locale).catch(() => undefined);
  }, [ready, preferencesReady, session, locale]);
  return null;
}
