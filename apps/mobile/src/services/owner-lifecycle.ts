import type { AuthenticationSession } from '@/domain/app-shell';
import type { AuthService } from '@/services/contracts/app-shell-service';
import { resolveClientMode } from '@/config/client-runtime';
import { isMobileAutomationEnabled } from '@/config/mobile-automation';
import { useAppShellStore } from '@/state/app-shell';
import { HttpError } from '@/services/live/http-client';
import { bankNotificationService } from '@/services/platform/bank-notification-service';
import {
  disableTrackingBackground,
  restoreTrackingBackground,
  purgeDeletedOwnerTracking
} from '@/services/tracking-background-runtime';
import {
  cacheLocalOwnerAccess,
  purgeAppShellOwnerData,
  loadLogoutDisposition,
  markLogoutCleanupReady,
  completeLogoutDisposition,
  createAppShellStorage,
  clearAppShellStorageOwner,
  type LogoutDisposition
} from '@/storage/app-shell-storage';
import { isDeletionOwnerFenced } from '@/storage/deletion-completion-journal';
import { purgeAccountDatabase, configureDatabaseOwner, clearDatabaseOwner } from '@/storage/database';
import { resetRuntimeIdentityData } from '@/storage/runtime-user-data-reset';
import { preserveLegacySmsImportQueue } from '@/storage/sms-import-queue';
import { readLogoutSessionAnchor, terminatePinnedLogout } from '@/services/live/auth-service';
import {
  pendingOwnerWork,
  ownerVoiceAudioReferences
} from '@/storage/pending-owner-work';
import { synchronizeLiveCoreFinance } from '@/services/live/core-finance-service';
import { syncAutomaticTracking } from '@/services/automatic-tracking-coordinator';
import { voiceRecorderService } from '@/services/platform/voice-recorder-service';
import { syncFirstLogout } from '@/services/sync-first-logout';
import { settleTransactionDraftWrites } from '@/storage/transaction-draft-snapshots';
export {
  isLogoutOwnerFenced,
  currentLogoutAdmissionRevision
} from '@/storage/app-shell-storage';
let activeLogout: { ownerId: string; promise: Promise<boolean | void> } | null = null;
function runLogoutOperation(ownerId: string, action: () => Promise<boolean | void>): Promise<boolean | void> {
  if (activeLogout) {
    if (activeLogout.ownerId !== ownerId) return Promise.reject(new HttpError('session_expired', 401, 'LOGOUT_OWNER_CHANGED'));
    return activeLogout.promise;
  }
  const operation = { ownerId, promise: Promise.resolve().then(action) };
  activeLogout = operation;
  useAppShellStore.setState({ logoutInProgressOwnerId: ownerId });
  operation.promise = operation.promise.finally(() => {
    if (activeLogout === operation) activeLogout = null;
    if (useAppShellStore.getState().logoutInProgressOwnerId === ownerId)
      useAppShellStore.setState({ logoutInProgressOwnerId: null });
  });
  return operation.promise;
}

export async function rememberAuthenticatedOwner(
  session: AuthenticationSession,
  isCurrent: () => boolean
): Promise<void> {
  if (
    resolveClientMode() !== 'live' ||
    session.status !== 'authenticated' ||
    !session.userId ||
    /^(?:mock|demo|fixture|test)(?:[-_]|$)/i.test(session.userId)
  )
    return;
  await cacheLocalOwnerAccess(session, isCurrent);
}

export async function signOutAppShellSession(
  authService: AuthService,
  scope: 'local' | 'all',
  options: { confirmRemoval?: (count: number | null) => Promise<boolean> } = {}
): Promise<boolean | void> {
  const ownerId = useAppShellStore.getState().session?.userId;
  if (!ownerId) return performSignOutAppShellSession(authService, scope, options);
  return runLogoutOperation(ownerId, () => {
    if (useAppShellStore.getState().session?.userId !== ownerId)
      throw new HttpError('session_expired', 401, 'LOGOUT_OWNER_CHANGED');
    return performSignOutAppShellSession(authService, scope, options);
  });
}

async function performSignOutAppShellSession(
  authService: AuthService,
  scope: 'local' | 'all',
  options: { confirmRemoval?: (count: number | null) => Promise<boolean> }
): Promise<boolean | void> {
  const ownerId = useAppShellStore.getState().session?.userId;
  if (
    resolveClientMode() === 'live' &&
    ownerId &&
    !(await isDeletionOwnerFenced(ownerId))
  ) {
    let audio: string[] = [];
    let audioKnown = false;
    const assertCurrent = () => {
      const current = useAppShellStore.getState().session?.userId;
      if (current && current !== ownerId)
        throw new HttpError('session_expired', 401);
    };
    return syncFirstLogout({
      logout: { ownerId, scope, sessionId: await readLogoutSessionAnchor(ownerId), dataDisposition: options.confirmRemoval ? 'remove' : 'preserve' },
      synchronize: async () => {
        let nothingPending = false;
        try {
          const [pending, native] = await Promise.all([
            pendingOwnerWork(ownerId),
            bankNotificationService.readRecent(100)
          ]);
          nothingPending = pending === 0 && native.length === 0;
        } catch { /* Unknown pending work retains the existing sync-first path. */ }
        assertCurrent();
        // The quiesced check below still catches work arriving after this fast path.
        if (nothingPending) return;
        await Promise.allSettled([
          synchronizeLiveCoreFinance(),
          syncAutomaticTracking()
        ]);
      },
      quiesce: async () => {
        assertCurrent();
        useAppShellStore.setState({ logoutQuiescingOwnerId: ownerId });
        await disableTrackingBackground(true);
        await settleTransactionDraftWrites();
        assertCurrent();
      },
      resume: async () => {
        if (useAppShellStore.getState().logoutQuiescingOwnerId === ownerId) useAppShellStore.setState({ logoutQuiescingOwnerId: null });
        if (useAppShellStore.getState().session?.userId !== ownerId) return;
        await restoreTrackingBackground(ownerId);
        await syncAutomaticTracking().catch(() => undefined);
      },
      pending: async () => {
        audio = await ownerVoiceAudioReferences(ownerId);
        audioKnown = true;
        const count = await pendingOwnerWork(ownerId);
        const native = await bankNotificationService.readRecent(100);
        assertCurrent();
        if (native.length >= 100)
          throw new Error('pending native count exceeds page');
        return count + native.length;
      },
      confirmRemoval: options.confirmRemoval ?? (async () => false),
      assertCurrent,
      signOut: async (record) => {
        if (record.dataDisposition === 'remove' && !audioKnown) {
          audio = await ownerVoiceAudioReferences(ownerId);
          audioKnown = true;
        }
        assertCurrent();
        await terminatePinnedLogout(record);
      },
      purge: record => purgeLogoutOwner(record, audio)
    });
  }
  if (isMobileAutomationEnabled()) {
    await authService.signOut(scope);
    await useAppShellStore.getState().signOut();
    return;
  }
  let failure: unknown;
  try {
    await authService.signOut(scope);
  } catch (error) {
    failure = error;
  } finally {
    try {
      await useAppShellStore.getState().signOut();
    } catch (error) {
      failure ??= error;
    }
  }
  if (failure !== undefined) throw failure;
}

async function purgeLogoutOwner(record: LogoutDisposition, capturedAudio?: string[]): Promise<void> {
  if (record.dataDisposition === 'preserve') return releaseLogoutOwner(record);
  const ownerId = record.ownerId;
  const assertOwner = async () => {
    const current = useAppShellStore.getState().session?.userId;
    if (current && current !== ownerId) throw new HttpError('session_expired', 401, 'LOGOUT_OWNER_CHANGED');
    await readLogoutSessionAnchor(ownerId);
    const after = useAppShellStore.getState().session?.userId;
    if (after && after !== ownerId) throw new HttpError('session_expired', 401, 'LOGOUT_OWNER_CHANGED');
    const stored = await loadLogoutDisposition(ownerId);
    if (stored?.id !== record.id || stored.phase !== 'cleanup-ready' || stored.dataDisposition !== record.dataDisposition) throw new HttpError('session_expired', 401, 'LOGOUT_DISPOSITION_CHANGED');
    await readLogoutSessionAnchor(ownerId);
    const latest = useAppShellStore.getState().session?.userId;
    if (latest && latest !== ownerId) throw new HttpError('session_expired', 401, 'LOGOUT_OWNER_CHANGED');
  };
  await assertOwner();
  await configureDatabaseOwner(ownerId);
  await assertOwner();
  const audio = capturedAudio ?? await ownerVoiceAudioReferences(ownerId);
  await assertOwner();
  await purgeDeletedOwnerTracking(ownerId);
  await assertOwner();
  for (const uri of audio) { await assertOwner(); await voiceRecorderService.remove(uri); }
  await assertOwner(); await purgeAccountDatabase(ownerId);
  await assertOwner(); await purgeAppShellOwnerData(ownerId);
  await assertOwner();
  useAppShellStore.getState().fenceLogoutOwner(ownerId);
}

async function releaseLogoutOwner(record: LogoutDisposition): Promise<void> {
  const assertOwner = async () => {
    const current = useAppShellStore.getState().session?.userId;
    if (current && current !== record.ownerId) throw new HttpError('session_expired', 401, 'LOGOUT_OWNER_CHANGED');
    await readLogoutSessionAnchor(record.ownerId);
    const stored = await loadLogoutDisposition(record.ownerId);
    if (stored?.id !== record.id || stored.phase !== 'cleanup-ready' || stored.dataDisposition !== 'preserve') throw new HttpError('session_expired', 401, 'LOGOUT_DISPOSITION_CHANGED');
    const latest = useAppShellStore.getState().session?.userId;
    if (latest && latest !== record.ownerId) throw new HttpError('session_expired', 401, 'LOGOUT_OWNER_CHANGED');
  };
  await assertOwner();
  await configureDatabaseOwner(record.ownerId);
  await assertOwner();
  await preserveLegacySmsImportQueue(record.ownerId);
  await assertOwner();
  await clearDatabaseOwner(record.ownerId, {preservePendingWork: true});
  await assertOwner();
  await resetRuntimeIdentityData({kind: 'signed-out-preserve'});
  await assertOwner();
  await createAppShellStorage().clearSession();
  await assertOwner();
  clearAppShellStorageOwner();
  useAppShellStore.getState().fenceLogoutOwner(record.ownerId);
}

export async function retryPendingLogout(ownerId: string): Promise<void> {
  await runLogoutOperation(ownerId, () => retryLogoutDisposition(ownerId));
}

async function retryLogoutDisposition(ownerId: string): Promise<void> {
  const current = useAppShellStore.getState().session?.userId;
  if (current && current !== ownerId) throw new HttpError('session_expired', 401, 'LOGOUT_OWNER_CHANGED');
  let record = await loadLogoutDisposition(ownerId);
  if (!record) return;
  if (record.phase === 'prepared') {
    await terminatePinnedLogout(record, true);
    record = await markLogoutCleanupReady(record);
  }
  await purgeLogoutOwner(record);
  await completeLogoutDisposition(record);
  if (useAppShellStore.getState().logoutRecoveryOwnerId === ownerId)
    useAppShellStore.setState({ logoutRecoveryOwnerId: null });
}
