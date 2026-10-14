import { automaticTrackingService } from './automatic-tracking-service';
import { synchronizeLiveCoreFinance } from './live/core-finance-service';
import { useAppShellStore } from '@/state/app-shell';
import { publishTrackingSave } from './tracking-save-events';
import { ensureTrackingSyncDevice } from './tracking-sync-device';

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
  return true;
}

// Retain the entry point for already scheduled background pushes. Successful
// Tracking saves are reconciled through the ledger and remain visually quiet.
export async function presentTrackingConfirmation(
  ownerId: string,
  _notificationId: string
): Promise<boolean> {
  return useAppShellStore.getState().session?.userId === ownerId;
}
