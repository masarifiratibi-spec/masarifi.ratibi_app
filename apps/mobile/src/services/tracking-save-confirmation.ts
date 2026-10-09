import { automaticTrackingService } from './automatic-tracking-service';
import { synchronizeLiveCoreFinance } from './live/core-finance-service';
import { phoneNotificationService } from './platform/phone-notification-service';
import { useAppShellStore } from '@/state/app-shell';
import { usePreferenceStore } from '@/state/preferences';
import { trackingNativeRuntime } from './platform/tracking-native-runtime.android';
import { z } from 'zod';
import { requestJson } from './live/http-client';

import { publishTrackingSave } from './tracking-save-events';
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
  if (!accepted.length) return true;
  await synchronizeLiveCoreFinance();
  if (useAppShellStore.getState().session?.userId !== ownerId) return false;
  publishTrackingSave();
  let ready = true;
  for (const item of accepted) {
    if (!item.notificationId) {
      ready = false;
      continue;
    }
    ready =
      (await presentTrackingConfirmation(ownerId, item.notificationId)) &&
      ready;
  }
  return ready;
}
export async function presentTrackingConfirmation(
  ownerId: string,
  notificationId: string
): Promise<boolean> {
  if (useAppShellStore.getState().session?.userId !== ownerId) return false;
  const policy = await requestJson(
    `/api/v1/tracking/confirmations/${encodeURIComponent(notificationId)}`,
    z.object({
      notificationId: z.string().uuid().nullable(),
      ready: z.boolean(),
      allowed: z.boolean()
    })
  );
  if (!policy.ready) return false;
  if (
    !policy.allowed ||
    !trackingNativeRuntime?.presentCaptureConfirmation ||
    (await phoneNotificationService.getPermission()) !== 'granted'
  )
    return true;
  if (useAppShellStore.getState().session?.userId !== ownerId) return false;
  const arabic = usePreferenceStore.getState().locale === 'ar';
  // The Android implementation serializes presentation and uses the server id as the stable notification tag.
  await trackingNativeRuntime.presentCaptureConfirmation(
    ownerId,
    notificationId,
    arabic ? 'تم حفظ المعاملة' : 'Transaction saved',
    arabic
      ? 'تمت إضافة المعاملة إلى معاملاتك.'
      : 'The transaction was added to your transactions.'
  );
  return true;
}
