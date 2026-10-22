import { automaticTrackingService } from './automatic-tracking-service';
import {
  createLiveLedgerService,
  synchronizeLiveCoreFinance
} from './live/core-finance-service';
import { useAppShellStore } from '@/state/app-shell';
import { publishTrackingSave } from './tracking-save-events';
import { ensureTrackingSyncDevice } from './tracking-sync-device';
import Constants from 'expo-constants';
import { resolveClientRuntime } from '@/config/client-runtime';
import { trackingNativeRuntime } from './platform/tracking-native-runtime.android';
import { usePreferenceStore } from '@/state/preferences';
import { translate } from '@/localization/i18n';
import { formatMinorAmount } from '@/utils/format-financial-value';
import { openDatabase } from '@/storage/database';

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
  const currentOwner = () =>
    useAppShellStore.getState().session?.status === 'authenticated' &&
    useAppShellStore.getState().session?.userId === ownerId;
  const refreshFinance = async (): Promise<boolean> => {
    if (!currentOwner()) return false;
    let phase = 'device_registration';
    try {
      await ensureTrackingSyncDevice(ownerId);
      if (!currentOwner()) return false;
      phase = 'finance_sync';
      await synchronizeLiveCoreFinance();
      return currentOwner();
    } catch (error) {
      const diagnostic =
        error &&
        typeof error === 'object' &&
        'code' in error &&
        typeof error.code === 'string' &&
        /^[A-Za-z_]{1,80}$/.test(error.code)
          ? error.code
          : error instanceof Error &&
              /^(?:SYNC_|SQLITE_|tracking_)[A-Za-z_]{1,80}$/.test(error.message)
            ? error.message
            : 'unknown';
      console.warn('tracking_finance_refresh_failed', phase, diagnostic);
      throw error;
    } finally {
      // The accepted server receipt remains valid if local cache sync fails.
      // Refresh live financial reads while preserving the failed sync for retry.
      if (currentOwner())
        publishTrackingSave({
          ownerId,
          transactionIds: accepted.map((item) => item.transactionId!)
        });
    }
  };
  const native = trackingNativeRuntime;
  const { apiUrl } = resolveClientRuntime();
  if (
    !['com.masarifi.mobile', 'com.masarifi.mobile.dev'].includes(
      Constants.expoConfig?.android?.package ?? ''
    ) ||
    apiUrl !== 'https://api.staging.masarifiratibi.com' ||
    !native
  )
    return refreshFinance();
  const ordinary =
    Constants.expoConfig?.android?.package === 'com.masarifi.mobile';
  const presentVerifiedSaves = async (): Promise<boolean> => {
    // Notice text needs validated ledger details, not category identifier mapping.
    const noticeLedger = createLiveLedgerService({
      baseUrl: apiUrl
    });
    const presented = new Set<string>();
    for (const item of accepted) {
      if (!currentOwner()) return false;
      if (presented.has(item.transactionId!)) continue;
      if (!item.notificationId) continue;
      const transaction = await noticeLedger.getTransaction(
        item.transactionId!
      );
      if (!currentOwner()) return false;
      if (
        transaction.id !== item.transactionId ||
        transaction.source !== 'automatic' ||
        transaction.status !== 'posted' ||
        transaction.syncStatus !== 'synced' ||
        transaction.deletedAt !== null
      ) {
        continue;
      }
      const locale = usePreferenceStore.getState().locale;
      const direction = translate(
        transaction.type === 'income'
          ? 'tracking.notice.deposit'
          : 'tracking.notice.payment',
        locale
      );
      const title = `${direction} · ${formatMinorAmount(Math.abs(transaction.amountMinor), transaction.currencyCode, locale)}`;
      let labels: {
        accountName: string | null;
        categoryAr: string | null;
        categoryEn: string | null;
      } | null = null;
      try {
        const database = await openDatabase(ownerId);
        if (!currentOwner()) return false;
        labels = await database.getFirstAsync(
          `SELECT json_extract(a.payload,'$.name') AS accountName,
            json_extract(c.payload,'$.labelAr') AS categoryAr,
            json_extract(c.payload,'$.labelEn') AS categoryEn
           FROM (SELECT 1) LEFT JOIN finance_accounts a ON a.id=?
           LEFT JOIN sync_id_mappings m ON m.domain='categories' AND m.server_id=?
           LEFT JOIN finance_categories c ON c.id=COALESCE(m.local_id,?)`,
          transaction.accountId,
          transaction.categoryId,
          transaction.categoryId
        );
      } catch {
        // Optional cached labels must not delay or suppress verified ledger details.
      }
      if (!currentOwner()) return false;
      const category =
        locale === 'ar' ? labels?.categoryAr : labels?.categoryEn;
      const description = [transaction.merchant || transaction.title, category]
        .filter(Boolean)
        .join(' · ');
      const body = [description, labels?.accountName]
        .filter(Boolean)
        .join('\n')
        .slice(0, 240);
      // The native encrypted receipt deduplicates this same durable notice
      // across sessions, retries and application restarts.
      await native.presentCaptureConfirmation(
        ownerId,
        item.notificationId,
        title,
        body
      );
      presented.add(transaction.id);
    }
    return (
      currentOwner() &&
      (!ordinary ||
        presented.size ===
          new Set(accepted.map((item) => item.transactionId!)).size)
    );
  };
  if (ordinary) {
    // An owned posted ledger result confirms the save. Unrelated local sync failures
    // must not block new captures; the regular finance runtime keeps its own retry state.
    void refreshFinance().catch(() => undefined);
    return presentVerifiedSaves();
  }
  // The owned ledger lookup verifies the save; whole-finance synchronization
  // must still finish before acknowledgement, but must not delay its notice.
  const results = await Promise.allSettled([
    refreshFinance(),
    presentVerifiedSaves()
  ]);
  for (const result of results)
    if (result.status === 'rejected') throw result.reason;
  return results.every(
    (result) => result.status === 'fulfilled' && result.value
  );
}

// Already scheduled push callbacks must not present a second notification.
export async function presentTrackingConfirmation(
  ownerId: string,
  _notificationId: string
): Promise<boolean> {
  return useAppShellStore.getState().session?.userId === ownerId;
}
