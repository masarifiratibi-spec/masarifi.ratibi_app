import { automaticTrackingService } from './automatic-tracking-service';
import { synchronizeLiveCoreFinance } from './live/core-finance-service';
import { useAppShellStore } from '@/state/app-shell';
import { publishTrackingSave } from './tracking-save-events';
import { ensureTrackingSyncDevice } from './tracking-sync-device';
import Constants from 'expo-constants';
import { resolveClientRuntime } from '@/config/client-runtime';
import { coreFinanceService } from './mocks/core-finance-service';
import { trackingNativeRuntime } from './platform/tracking-native-runtime.android';
import { usePreferenceStore } from '@/state/preferences';
import { translate } from '@/localization/i18n';
import { formatMinorAmount } from '@/utils/format-financial-value';

export async function reconcileTrackingSaves(
  ownerId: string,
  sessionId: string
): Promise<boolean> {
  if (useAppShellStore.getState().session?.userId !== ownerId) return false;
  const items =
    (await automaticTrackingService.listImportOutcomes?.(sessionId)) ?? [];
  const accepted = items.filter(
    (item) => item.status === 'accepted' && item.transactionId
  );
  if (!accepted.length) return false;
  await ensureTrackingSyncDevice(ownerId);
  if (useAppShellStore.getState().session?.userId !== ownerId) return false;
  await synchronizeLiveCoreFinance();
  if (useAppShellStore.getState().session?.userId !== ownerId) return false;
  publishTrackingSave();
  if (
    Constants.expoConfig?.android?.package === 'com.masarifi.mobile.dev' &&
    resolveClientRuntime().apiUrl ===
      'https://api.staging.masarifiratibi.com' &&
    trackingNativeRuntime
  ) {
    const presented = new Set<string>();
    for (const item of accepted) {
      if (!item.notificationId || presented.has(item.transactionId!)) continue;
      const transaction = await coreFinanceService.getTransaction(
        item.transactionId!
      );
      if (useAppShellStore.getState().session?.userId !== ownerId) return false;
      if (
        transaction.id !== item.transactionId ||
        transaction.source !== 'automatic' ||
        transaction.status !== 'posted' ||
        transaction.syncStatus !== 'synced' ||
        transaction.deletedAt !== null
      )
        continue;
      const locale = usePreferenceStore.getState().locale;
      const title = translate(
        transaction.type === 'income'
          ? 'tracking.saved.income'
          : 'tracking.saved.expense',
        locale
      );
      const body =
        `${formatMinorAmount(Math.abs(transaction.amountMinor), transaction.currencyCode, locale)} · ${transaction.title}`.slice(
          0,
          240
        );
      // The native encrypted receipt deduplicates this same durable notice
      // across sessions, retries and application restarts.
      await trackingNativeRuntime.presentCaptureConfirmation(
        ownerId,
        item.notificationId,
        title,
        body
      );
      presented.add(transaction.id);
    }
  }
  return true;
}

// Already scheduled push callbacks must not present a second notification.
export async function presentTrackingConfirmation(
  ownerId: string,
  _notificationId: string
): Promise<boolean> {
  return useAppShellStore.getState().session?.userId === ownerId;
}
