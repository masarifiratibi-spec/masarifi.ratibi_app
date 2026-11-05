import {
  assertTrackingAvailable,
  captureTrackingAdmission,
  beginTrackingAdmission,
  useTrackingAdmission
} from '@/state/tracking-admission';
import type { AuthenticationSession } from '@/domain/app-shell';
import type { AuthService } from '@/services/contracts/app-shell-service';
import { resolveClientMode } from '@/config/client-runtime';
import { supportsTrackingOwnerPartitions } from './tracking-owner-context';
import { isMobileAutomationEnabled } from '@/config/mobile-automation';
import { useAppShellStore } from '@/state/app-shell';
import { HttpError } from '@/services/live/http-client';
import { bankNotificationService } from '@/services/platform/bank-notification-service';
import {
  disableTrackingBackground,
  restoreTrackingBackground,
  commitTrackingOwnerAdmission,
  purgeDeletedOwnerTracking
} from '@/services/tracking-background-runtime';
import {
  cacheLocalOwnerAccess,
  purgeAppShellOwnerData,
  loadLogoutDisposition,
  markLogoutCleanupReady,
  markLogoutDatabasePurgeReady,
  completeLogoutDisposition,
  createAppShellStorage,
  clearAppShellStorageOwner,
  currentLogoutAdmissionRevision,
  type LogoutDisposition
} from '@/storage/app-shell-storage';
import { isDeletionOwnerFenced } from '@/storage/deletion-completion-journal';
import {
  purgeAccountDatabase,
  configureDatabaseOwner,
  clearDatabaseOwner
} from '@/storage/database';
import { resetRuntimeIdentityData } from '@/storage/runtime-user-data-reset';
import { preserveLegacySmsImportQueue } from '@/storage/sms-import-queue';
import {
  readLogoutSessionAnchor,
  terminatePinnedLogout
} from '@/services/live/auth-service';
import {
  pendingOwnerWork,
  ownerVoiceAudioReferences
} from '@/storage/pending-owner-work';
import { synchronizeLiveCoreFinance } from '@/services/live/core-finance-service';
import { syncAutomaticTracking } from '@/services/automatic-tracking-coordinator';
import { voiceRecorderService } from '@/services/platform/voice-recorder-service';
import { syncFirstLogout } from '@/services/sync-first-logout';
import { settleTransactionDraftWrites } from '@/storage/transaction-draft-snapshots';
import {
  trackingSourcePreferences,
  settleTrackingSourceMutations
} from './tracking-source-preferences';
export {
  isLogoutOwnerFenced,
  currentLogoutAdmissionRevision
} from '@/storage/app-shell-storage';
let activeLogout: { ownerId: string; promise: Promise<boolean | void> } | null =
  null;
async function retainedNativeTrackingWork(): Promise<number> {
  if (bankNotificationService.retainedCount) {
    const count = await bankNotificationService.retainedCount();
    if (!Number.isSafeInteger(count) || count < 0)
      throw new Error('pending native count unavailable');
    return count;
  }
  const page = await bankNotificationService.readRecent(100);
  if (page.length >= 100) throw new Error('pending native count exceeds page');
  return page.length;
}
function runLogoutOperation(
  ownerId: string,
  action: () => Promise<boolean | void>
): Promise<boolean | void> {
  if (activeLogout) {
    if (activeLogout.ownerId !== ownerId)
      return Promise.reject(
        new HttpError('session_expired', 401, 'LOGOUT_OWNER_CHANGED')
      );
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
  assertTrackingAvailable();
  const ownerId = useAppShellStore.getState().session?.userId;
  if (!ownerId)
    return performSignOutAppShellSession(authService, scope, options);
  const assertTrackingCurrent = captureTrackingAdmission(ownerId);
  return runLogoutOperation(ownerId, () => {
    assertTrackingCurrent();
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
  const assertTrackingCurrent = captureTrackingAdmission();
  const ownerId = useAppShellStore.getState().session?.userId;
  if (
    resolveClientMode() === 'live' &&
    ownerId &&
    !(await isDeletionOwnerFenced(ownerId))
  ) {
    assertTrackingCurrent();
    let audio: string[] = [];
    let audioKnown = false;
    const assertCurrent = () => {
      const current = useAppShellStore.getState().session?.userId;
      if (current && current !== ownerId)
        throw new HttpError('session_expired', 401);
      assertTrackingCurrent();
    };
    return syncFirstLogout({
      logout: {
        ownerId,
        scope,
        sessionId: await readLogoutSessionAnchor(ownerId),
        dataDisposition: options.confirmRemoval ? 'remove' : 'preserve'
      },
      synchronize: async () => {
        let nothingPending = false;
        try {
          const [pending, native, consent] = await Promise.all([
            pendingOwnerWork(ownerId),
            retainedNativeTrackingWork(),
            trackingSourcePreferences.hasPendingConsent()
          ]);
          nothingPending = pending === 0 && native === 0 && !consent;
        } catch {
          /* Unknown pending work retains the existing sync-first path. */
        }
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
        await settleTrackingSourceMutations();
        await settleTransactionDraftWrites();
        assertCurrent();
      },
      resume: async () => {
        if (useAppShellStore.getState().logoutQuiescingOwnerId === ownerId)
          useAppShellStore.setState({ logoutQuiescingOwnerId: null });
        if (useAppShellStore.getState().session?.userId !== ownerId) return;
        await restoreTrackingBackground(ownerId);
        await commitTrackingOwnerAdmission(
          ownerId,
          () =>
            useAppShellStore.getState().session?.userId === ownerId &&
            useAppShellStore.getState().logoutQuiescingOwnerId !== ownerId
        );
        await syncAutomaticTracking().catch(() => undefined);
      },
      pending: async () => {
        audio = await ownerVoiceAudioReferences(ownerId);
        audioKnown = true;
        const count = await pendingOwnerWork(ownerId);
        const native = await retainedNativeTrackingWork();
        const consent = await trackingSourcePreferences.hasPendingConsent();
        assertCurrent();
        return count + native + (consent ? 1 : 0);
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
      purge: (record) => purgeLogoutOwner(record, audio)
    });
  }
  assertTrackingCurrent();
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

async function purgeLogoutOwner(
  initialRecord: LogoutDisposition,
  capturedAudio?: string[],
  recoveryGuard?: () => void
): Promise<void> {
  let record = initialRecord;
  if (record.dataDisposition === 'preserve') return releaseLogoutOwner(record);
  const ownerId = record.ownerId;
  const assertTrackingCurrent = recoveryGuard ?? captureTrackingAdmission();
  const assertOwner = async () => {
    assertTrackingCurrent();
    const current = useAppShellStore.getState().session?.userId;
    if (current && current !== ownerId)
      throw new HttpError('session_expired', 401, 'LOGOUT_OWNER_CHANGED');
    const anchor = await readLogoutSessionAnchor(ownerId);
    if (anchor !== null && anchor !== record.sessionId)
      throw new HttpError('session_expired', 401, 'LOGOUT_SESSION_UNVERIFIED');
    const after = useAppShellStore.getState().session?.userId;
    if (after && after !== ownerId)
      throw new HttpError('session_expired', 401, 'LOGOUT_OWNER_CHANGED');
    const stored = await loadLogoutDisposition(ownerId);
    if (
      record.phase !== 'cleanup-ready' ||
      JSON.stringify(stored) !== JSON.stringify(record)
    )
      throw new HttpError('session_expired', 401, 'LOGOUT_DISPOSITION_CHANGED');
    const latestAnchor = await readLogoutSessionAnchor(ownerId);
    if (latestAnchor !== null && latestAnchor !== record.sessionId)
      throw new HttpError('session_expired', 401, 'LOGOUT_SESSION_UNVERIFIED');
    const latest = useAppShellStore.getState().session?.userId;
    if (latest && latest !== ownerId)
      throw new HttpError('session_expired', 401, 'LOGOUT_OWNER_CHANGED');
    assertTrackingCurrent();
  };
  await assertOwner();
  await configureDatabaseOwner(ownerId);
  await assertOwner();
  if (record.localCleanupPhase !== 'database-purge-ready') {
    const audio = capturedAudio ?? (await ownerVoiceAudioReferences(ownerId));
    await assertOwner();
    await purgeDeletedOwnerTracking(
      ownerId,
      recoveryGuard ? { assertCurrent: recoveryGuard, assertOwner } : undefined
    );
    await assertOwner();
    for (const uri of audio) {
      await assertOwner();
      await voiceRecorderService.remove(uri);
    }
    await assertOwner();
    record = await markLogoutDatabasePurgeReady(record);
  }
  await assertOwner();
  await purgeAccountDatabase(ownerId);
  await assertOwner();
  await purgeAppShellOwnerData(ownerId);
  await assertOwner();
  useAppShellStore.getState().fenceLogoutOwner(ownerId);
  beginTrackingAdmission();
}

async function releaseLogoutOwner(record: LogoutDisposition): Promise<void> {
  const assertTrackingCurrent = captureTrackingAdmission();
  const assertOwner = async () => {
    assertTrackingCurrent();
    const current = useAppShellStore.getState().session?.userId;
    if (current && current !== record.ownerId)
      throw new HttpError('session_expired', 401, 'LOGOUT_OWNER_CHANGED');
    await readLogoutSessionAnchor(record.ownerId);
    const stored = await loadLogoutDisposition(record.ownerId);
    if (
      stored?.id !== record.id ||
      stored.phase !== 'cleanup-ready' ||
      stored.dataDisposition !== 'preserve'
    )
      throw new HttpError('session_expired', 401, 'LOGOUT_DISPOSITION_CHANGED');
    const latest = useAppShellStore.getState().session?.userId;
    if (latest && latest !== record.ownerId)
      throw new HttpError('session_expired', 401, 'LOGOUT_OWNER_CHANGED');
  };
  await assertOwner();
  await configureDatabaseOwner(record.ownerId);
  await assertOwner();
  await preserveLegacySmsImportQueue(record.ownerId);
  await assertOwner();
  await clearDatabaseOwner(record.ownerId, { preservePendingWork: true });
  await assertOwner();
  await resetRuntimeIdentityData({ kind: 'signed-out-preserve' });
  await assertOwner();
  await createAppShellStorage().clearSession();
  await assertOwner();
  clearAppShellStorageOwner();
  useAppShellStore.getState().fenceLogoutOwner(record.ownerId);
  beginTrackingAdmission();
}

export async function retryPendingLogout(ownerId: string): Promise<void> {
  if (useTrackingAdmission.getState().isolatedForOwnerId)
    throw new Error('tracking_owner_isolated');
  await runLogoutOperation(ownerId, async () => {
    const record = await loadLogoutDisposition(ownerId);
    if (!record) return;
    await readLogoutSessionAnchor(ownerId);
    const cold = !useTrackingAdmission.getState().ready;
    try {
      if (
        cold &&
        record.dataDisposition === 'remove' &&
        supportsTrackingOwnerPartitions()
      ) {
        const revision = useTrackingAdmission.getState().revision;
        const logoutRevision = currentLogoutAdmissionRevision();
        const assertRecovery = () => {
          const state = useTrackingAdmission.getState();
          if (
            state.ready ||
            state.isolatedForOwnerId ||
            state.revision !== revision ||
            currentLogoutAdmissionRevision() !== logoutRevision
          )
            throw new Error('tracking_admission_changed');
        };
        await retryLogoutDisposition(ownerId, assertRecovery, record);
        return;
      }
      if (cold) {
        await restoreTrackingBackground(ownerId, record);
        await commitTrackingOwnerAdmission(ownerId);
      }
      assertTrackingAvailable(ownerId);
      const latest = await loadLogoutDisposition(ownerId);
      if (JSON.stringify(latest) !== JSON.stringify(record))
        throw new HttpError(
          'session_expired',
          401,
          'LOGOUT_DISPOSITION_CHANGED'
        );
      await retryLogoutDisposition(ownerId);
    } finally {
      if (cold) beginTrackingAdmission();
    }
  });
}

async function retryLogoutDisposition(
  ownerId: string,
  recoveryGuard?: () => void,
  expectedRecord?: LogoutDisposition
): Promise<void> {
  const current = useAppShellStore.getState().session?.userId;
  if (current && current !== ownerId)
    throw new HttpError('session_expired', 401, 'LOGOUT_OWNER_CHANGED');
  const assertTrackingCurrent =
    recoveryGuard ?? captureTrackingAdmission(ownerId);
  let record = await loadLogoutDisposition(ownerId);
  assertTrackingCurrent();
  if (
    expectedRecord &&
    JSON.stringify(record) !== JSON.stringify(expectedRecord)
  )
    throw new HttpError('session_expired', 401, 'LOGOUT_DISPOSITION_CHANGED');
  if (!record) return;
  if (record.phase === 'prepared') {
    await terminatePinnedLogout(record, true);
    record = await markLogoutCleanupReady(record);
  }
  await purgeLogoutOwner(record, undefined, recoveryGuard);
  await completeLogoutDisposition(record);
  if (useAppShellStore.getState().logoutRecoveryOwnerId === ownerId)
    useAppShellStore.setState({ logoutRecoveryOwnerId: null });
}
