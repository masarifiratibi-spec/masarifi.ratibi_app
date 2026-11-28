import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { useTrackingAdmission } from '@/state/tracking-admission';
import { useLiveIdentityStatus } from '@/services/live/clerk-context';
import { bankSmsNative } from '@/services/platform/bank-sms-bridge.ios';
import { synchronizeBankSmsNotificationLocale } from '@/services/platform/bank-sms-notice-locale.ios';
import {
  readLastBankSmsReceipt,
  refreshEnabledBankSms
} from '@/services/platform/bank-sms-setup.ios';
import { publishTrackingSave } from '@/services/tracking-save-events';
import { BankSmsForegroundNotice } from './BankSmsForegroundNotice.ios';

export function BankSmsNoticeRuntime() {
  const ready = useAppShellStore((state) => state.hydrated);
  const session = useAppShellStore((state) => state.session);
  const preferencesReady = usePreferenceStore((state) => state.hydrated);
  const locale = usePreferenceStore((state) => state.locale);
  const client = useQueryClient();
  const active =
    ready && preferencesReady && session?.status === 'authenticated';
  const identity = useLiveIdentityStatus();
  const ownerId = active && identity.status === 'ready' ? session.userId : null;
  const admitted = useTrackingAdmission((state) =>
    state.ready && (!state.admittedOwnerId || state.admittedOwnerId === ownerId));
  const unlocked = useAppShellStore((state) =>
    !state.logoutQuiescingOwnerId &&
    (!state.privacyLock?.enabled || state.privacyLock.appLockStatus === 'unlocked'));

  useEffect(() => {
    if (!ownerId || !admitted || !unlocked) return;
    const native = bankSmsNative();
    if (!native) return;
    let revision = 0;
    let lastPublished: string | undefined;
    const refreshReceipt = async () => {
      const request = ++revision;
      if (AppState.currentState !== 'active') return;
      const receipt = await readLastBankSmsReceipt().catch(() => undefined);
      if (
        request !== revision ||
        !receipt ||
        receipt.ownerId !== ownerId ||
        AppState.currentState !== 'active' ||
        lastPublished === receipt.transactionId
      ) return;
      lastPublished = receipt.transactionId;
      publishTrackingSave({ ownerId, transactionIds: [receipt.transactionId] });
    };
    // Subscribe first, then catch up on saves made while JS was suspended or unmounted.
    const saved = native.addListener('onReceiptSaved', refreshReceipt);
    const app = AppState.addEventListener('change', (status) => {
      if (status === 'active') void refreshReceipt();
      else revision++;
    });
    void refreshReceipt();
    return () => {
      revision++;
      app.remove();
      saved.remove();
    };
  }, [ownerId, admitted, unlocked]);

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
  return active ? <BankSmsForegroundNotice /> : null;
}
