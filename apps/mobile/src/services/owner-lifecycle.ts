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
  purgeAppShellOwnerData
} from '@/storage/app-shell-storage';
import { isDeletionOwnerFenced } from '@/storage/deletion-completion-journal';
import { purgeAccountDatabase } from '@/storage/database';
import {
  pendingOwnerWork,
  ownerVoiceAudioReferences
} from '@/storage/pending-owner-work';
import { synchronizeLiveCoreFinance } from '@/services/live/core-finance-service';
import { syncAutomaticTracking } from '@/services/automatic-tracking-coordinator';
import { voiceRecorderService } from '@/services/platform/voice-recorder-service';
import { syncFirstLogout } from '@/services/sync-first-logout';

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
      synchronize: async () => {
        await Promise.allSettled([
          synchronizeLiveCoreFinance(),
          syncAutomaticTracking()
        ]);
      },
      quiesce: async () => {
        assertCurrent();
        await disableTrackingBackground(true);
        assertCurrent();
      },
      resume: async () => {
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
      signOut: async () => {
        if (!audioKnown) {
          audio = await ownerVoiceAudioReferences(ownerId);
          audioKnown = true;
        }
        assertCurrent();
        await authService.signOut(scope);
      },
      purge: async () => {
        await purgeDeletedOwnerTracking(ownerId);
        assertCurrent();
        for (const uri of audio) {
          assertCurrent();
          await voiceRecorderService.remove(uri);
        }
        assertCurrent();
        await purgeAccountDatabase(ownerId);
        assertCurrent();
        await purgeAppShellOwnerData(ownerId);
        assertCurrent();
        await useAppShellStore.getState().signOut(true);
      }
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
