import type { Locale } from '@/domain/foundation';
import {
  isBenchmarkReadOnly,
  resolveClientRuntime
} from '@/config/client-runtime';
import { currentLocale } from '@/localization/i18n';
import { useAppShellStore } from '@/state/app-shell';
import { captureTrackingAdmission } from '@/state/tracking-admission';
import { readLogoutSessionAnchor } from '../live/auth-service';
import { bankSmsNative } from './bank-sms-bridge.ios';

export async function synchronizeBankSmsNotificationLocale(locale: Locale) {
  if (isBenchmarkReadOnly() || resolveClientRuntime().mode !== 'live') return;
  const session = useAppShellStore.getState().session;
  if (session?.status !== 'authenticated' || !session.userId) return;
  const admitted = captureTrackingAdmission(session.userId);
  const anchor = await readLogoutSessionAnchor(session.userId);
  admitted();
  if (
    !anchor ||
    useAppShellStore.getState().session !== session ||
    currentLocale() !== locale
  )
    return;
  await bankSmsNative()?.updateNotificationLocale(
    session.userId,
    anchor,
    locale
  );
}
