import { create } from 'zustand';

import type {
  AuthenticationSession,
  OnboardingProgress,
  PrivacyLockPreference,
  TrackingPreference
} from '@/domain/app-shell';
import type {
  ProfileSetupSnapshot,
  ProfileSetupStatus
} from '@/domain/settings';
import {
  applyOnboardingStep,
  type OnboardingStep,
  type StepResult
} from '@/features/onboarding/onboarding-progress';
import { isDemoModeEnabled } from '@/config/demo-mode';
import {
  isAppLockEnabled,
  isDevPrivacyDeletionEnabled,
  resolveClientMode
} from '@/config/client-runtime';
import { isDeletionOwnerFenced } from '@/storage/deletion-completion-journal';
import {
  createClientDemoSession,
  createCompletedDemoOnboarding
} from '@/domain/demo-session';
import {
  clearAppShellStorageOwner,
  configureAppShellStorageOwner,
  createAppShellStorage
} from '@/storage/app-shell-storage';
import {
  loadLocalOwnerAccess,
  clearLocalOwnerAccess,
  loadCachedLogoutDisposition,
  isLogoutOwnerFenced,
  currentLogoutAdmissionRevision
} from '@/storage/app-shell-storage';
import { synchronizeClientDemoLocale } from '@/services/mocks/client-demo-locale';
import { usePreferenceStore } from '@/state/preferences';
import {
  registerRuntimeUserDataReset,
  resetRuntimeIdentityData
} from '@/storage/runtime-user-data-reset';
import { clearDatabaseOwner, configureDatabaseOwner } from '@/storage/database';
import { clearLegacySmsImportQueue } from '@/storage/sms-import-queue';

interface AppShellState {
  logoutQuiescingOwnerId: string | null;
  logoutRecoveryOwnerId: string | null;
  fenceLogoutOwner: (ownerId: string) => void;
  bootstrapRevision: number;
  retryBootstrap: () => void;
  hydrated: boolean;
  session: AuthenticationSession | null;
  onboarding: OnboardingProgress | null;
  pendingDestination: string | null;
  privacyLock: PrivacyLockPreference | null;
  profilePromptDismissed: boolean;
  trackingHomeCardDismissed: boolean;
  profileSetupStatus: ProfileSetupStatus;
  profileSetupSnapshot: ProfileSetupSnapshot | null;
  hydrate: (now?: number) => Promise<void>;
  authenticate: (
    session: AuthenticationSession,
    isCurrent?: () => boolean
  ) => Promise<void>;
  expireSession: () => Promise<void>;
  signOut: (localDataRemoved?: boolean) => Promise<void>;
  releaseDeletedOwner: (ownerId: string) => void;
  suspendUnavailableRestoration: () => Promise<void>;
  setOnboarding: (progress: OnboardingProgress) => Promise<void>;
  advanceOnboarding: (
    steps: readonly OnboardingStep[],
    result: StepResult,
    now?: number
  ) => Promise<OnboardingProgress | null>;
  skipOnboarding: (now?: number) => Promise<void>;
  setTrackingPreference: (preference: TrackingPreference) => Promise<void>;
  setPendingDestination: (
    destination: string | null,
    isCurrent?: () => boolean
  ) => Promise<void>;
  setPrivacyLock: (lock: PrivacyLockPreference) => Promise<void>;
  lockNow: () => Promise<void>;
  setProfileSetup: (
    status: ProfileSetupStatus,
    snapshot?: ProfileSetupSnapshot | null
  ) => void;
  dismissProfilePrompt: () => Promise<void>;
  reopenProfilePrompt: () => Promise<void>;
  dismissTrackingHomeCard: () => Promise<void>;
  unlock: () => Promise<void>;
  reset: () => void;
}

const storage = createAppShellStorage();

const signedOutSession: AuthenticationSession = {
  status: 'signed_out',
  userId: null,
  method: null,
  issuedAt: null,
  expiresAt: null,
  restoration: 'idle'
};

const initialState = {
  logoutQuiescingOwnerId: null,
  logoutRecoveryOwnerId: null,
  hydrated: false,
  session: null,
  onboarding: null,
  pendingDestination: null,
  privacyLock: null,
  profilePromptDismissed: false,
  trackingHomeCardDismissed: false,
  profileSetupStatus: 'unknown' as ProfileSetupStatus,
  profileSetupSnapshot: null as ProfileSetupSnapshot | null
};

export const useAppShellStore = create<AppShellState>((set, get) => ({
  ...initialState,
  bootstrapRevision: 0,
  fenceLogoutOwner: (ownerId) => {
    const current = get().session?.userId;
    if (current && current !== ownerId) return;
    set({ ...initialState, hydrated: true, session: signedOutSession, logoutRecoveryOwnerId: ownerId });
  },
  retryBootstrap: () => {
    if (get().profileSetupStatus === 'loading') return;
    set({
      bootstrapRevision: get().bootstrapRevision + 1,
      profileSetupStatus: 'loading'
    });
  },

  hydrate: async (now = Date.now()) => {
    let hydrationOwnerId = get().session?.userId;
    const ownerIsCurrent = () => !get().session?.userId || get().session?.userId === hydrationOwnerId;
    try {
      const demoMode = isDemoModeEnabled();
      if (!demoMode && resolveClientMode() === 'live') {
        const admissionRevision = currentLogoutAdmissionRevision();
        const disposition = await loadCachedLogoutDisposition();
        if (!ownerIsCurrent()) return;
        if (disposition) { get().fenceLogoutOwner(disposition.ownerId); return; }
        const cached = await loadLocalOwnerAccess();
        if (!ownerIsCurrent()) return;
        hydrationOwnerId = cached?.userId ?? hydrationOwnerId;
        if (
          cached?.status === 'authenticated' &&
          cached.userId &&
          !(await isDeletionOwnerFenced(cached.userId))
        ) {
          await configureDatabaseOwner(cached.userId);
          if (!ownerIsCurrent()) return;
          await configureAppShellStorageOwner(cached.userId);
          if (!ownerIsCurrent()) return;
          const privacyLock = await storage.loadPrivacyLock();
          const launchLock = lockForLaunch(privacyLock);
          if (!ownerIsCurrent() || admissionRevision !== currentLogoutAdmissionRevision()) return;
          if (await isLogoutOwnerFenced(cached.userId)) {
            get().fenceLogoutOwner(cached.userId); return;
          }
          if (!ownerIsCurrent() || admissionRevision !== currentLogoutAdmissionRevision()) return;
          if (launchLock?.enabled || !isAppLockEnabled()) {
            set({
              ...initialState,
              hydrated: true,
              session: { ...cached, restoration: 'local' },
              privacyLock: launchLock,
              profileSetupStatus: 'complete'
            });
            return;
          }
        }
        if (!ownerIsCurrent()) return;
        await clearDatabaseOwner();
        if (!ownerIsCurrent()) return;
        clearAppShellStorageOwner();
        set({
          ...initialState,
          hydrated: true,
          session: {
            ...signedOutSession,
            status: 'restoring',
            restoration: 'pending'
          }
        });
        return;
      }
      if (demoMode && !usePreferenceStore.getState().hydrated)
        await usePreferenceStore.getState().hydrate();
      const locale = usePreferenceStore.getState().locale;
      const [
        storedSession,
        onboarding,
        pendingDestination,
        privacyLock,
        profilePromptDismissed,
        trackingHomeCardDismissed
      ] = await Promise.all([
        storage.loadSession(),
        storage.loadOnboarding(),
        storage.loadPendingDestination(),
        storage.loadPrivacyLock(),
        storage.loadProfilePromptDismissed(),
        storage.loadTrackingHomeCardDismissed(),
        demoMode
          ? synchronizeClientDemoLocale(locale, now).catch(() => false)
          : Promise.resolve(false)
      ]);
      const session =
        storedSession?.status === 'authenticated' &&
        storedSession.expiresAt !== null &&
        storedSession.expiresAt <= now
          ? { ...storedSession, status: 'expired' as const }
          : storedSession;
      if (demoMode) {
        const demoSession = createClientDemoSession(now);
        const demoOnboarding = createCompletedDemoOnboarding(now);
        await Promise.all([
          storage.saveSession(demoSession),
          storage.saveOnboarding(demoOnboarding),
          storage.savePendingDestination(null)
        ]);
        set({
          hydrated: true,
          session: demoSession,
          onboarding: demoOnboarding,
          pendingDestination: null,
          privacyLock: lockForLaunch(privacyLock),
          profilePromptDismissed,
          trackingHomeCardDismissed,
          profileSetupStatus: 'complete',
          profileSetupSnapshot: null
        });
        return;
      }
      set({
        hydrated: true,
        session,
        onboarding,
        pendingDestination,
        privacyLock: lockForLaunch(privacyLock),
        profilePromptDismissed,
        trackingHomeCardDismissed,
        profileSetupStatus: 'complete',
        profileSetupSnapshot: null
      });
    } catch {
      if (!ownerIsCurrent()) return;
      set({ ...initialState, hydrated: true, session: signedOutSession });
    }
  },

  authenticate: async (session, isCurrent = () => true) => {
    if (!isCurrent()) return;
    const admissionRevision = currentLogoutAdmissionRevision();
    if (session.userId && (get().logoutQuiescingOwnerId === session.userId || await isLogoutOwnerFenced(session.userId))) return;
    if (!isCurrent() || admissionRevision !== currentLogoutAdmissionRevision()) return;
    const liveMode = resolveClientMode() === 'live';
    if (
      liveMode &&
      session.status === 'authenticated' &&
      /^(?:mock|demo|fixture|test)(?:[-_]|$)/i.test(session.userId ?? '')
    )
      throw new Error('invalid live session');
    if (session.status === 'authenticated' && liveMode) {
      if (
        isDevPrivacyDeletionEnabled() &&
        (await isDeletionOwnerFenced(session.userId!))
      ) {
        if (
          isCurrent() &&
          (!get().session?.userId || get().session?.userId === session.userId)
        )
          set({ ...initialState, hydrated: true, session: signedOutSession });
        return;
      }
      set(initialState);
      await resetRuntimeIdentityData({ restoringOwnerId: session.userId! });
      if (!isCurrent()) return;
      if (
        isDevPrivacyDeletionEnabled() &&
        (await isDeletionOwnerFenced(session.userId!))
      )
        return;
      await configureDatabaseOwner(session.userId!);
      if (!isCurrent()) return;
      await configureAppShellStorageOwner(session.userId!);
      if (!isCurrent()) return;
      const [
        onboarding,
        pendingDestination,
        privacyLock,
        profilePromptDismissed,
        trackingHomeCardDismissed
      ] = await Promise.all([
        storage.loadOnboarding(),
        storage.loadPendingDestination(),
        storage.loadPrivacyLock(),
        storage.loadProfilePromptDismissed(),
        storage.loadTrackingHomeCardDismissed()
      ]);
      if (!isCurrent() || admissionRevision !== currentLogoutAdmissionRevision() || get().logoutQuiescingOwnerId === session.userId || await isLogoutOwnerFenced(session.userId!)) return;
      if (admissionRevision !== currentLogoutAdmissionRevision()) return;
      set({
        hydrated: true,
        session,
        onboarding,
        pendingDestination,
        privacyLock: lockForLaunch(privacyLock),
        profilePromptDismissed,
        trackingHomeCardDismissed
      });
      return;
    }
    await storage.saveSession(session);
    set({ hydrated: true, session });
  },

  expireSession: async () => {
    const session = get().session;
    if (!session || session.status !== 'authenticated') return;
    const expired = { ...session, status: 'expired' as const };
    await clearLocalOwnerAccess();
    await storage.saveSession(expired);
    set({ session: expired });
  },

  suspendUnavailableRestoration: async () => {
    await clearLocalOwnerAccess();
    set({ ...initialState, hydrated: true, session: signedOutSession });
    clearAppShellStorageOwner();
    await Promise.all([
      clearDatabaseOwner(),
      resetRuntimeIdentityData({ kind: 'restore-unavailable' })
    ]);
  },

  releaseDeletedOwner: (ownerId) => {
    if (get().session?.userId !== ownerId) return;
    clearAppShellStorageOwner();
    set({ ...initialState, hydrated: true, session: signedOutSession });
  },

  signOut: async (localDataRemoved = false) => {
    const ownerId = get().session?.userId;
    set({
      hydrated: true,
      session: signedOutSession,
      onboarding: null,
      pendingDestination: null,
      privacyLock: null,
          profilePromptDismissed: false,
      trackingHomeCardDismissed: false,
      profileSetupStatus: 'unknown',
      profileSetupSnapshot: null
    });
    await Promise.all([
      clearLocalOwnerAccess(),
      storage.clearSession(),
      (async () => {
        try {
          if (!localDataRemoved)
            await clearDatabaseOwner(
              ownerId && resolveClientMode() === 'live' ? ownerId : undefined
            );
        } finally {
          await clearLegacySmsImportQueue();
        }
      })(),
      resetRuntimeIdentityData()
    ]);
    clearAppShellStorageOwner();
  },

  setOnboarding: async (onboarding) => {
    await storage.saveOnboarding(onboarding);
    set({ onboarding });
  },

  advanceOnboarding: async (steps, result, now = Date.now()) => {
    let onboarding = get().onboarding;
    if (!onboarding) return null;
    for (const step of steps) {
      onboarding = applyOnboardingStep(onboarding, step, result, now);
    }
    await storage.saveOnboarding(onboarding);
    set({ onboarding });
    return onboarding;
  },

  skipOnboarding: async (now = Date.now()) => {
    const onboarding = get().onboarding;
    if (!onboarding) return;
    const skipped = {
      ...onboarding,
      status: 'skipped' as const,
      currentStep: null,
      updatedAt: now
    };
    await storage.saveOnboarding(skipped);
    set({ onboarding: skipped });
  },

  setTrackingPreference: async (trackingPreference) => {
    const onboarding = get().onboarding;
    await storage.saveTrackingPreference(trackingPreference);
    if (!onboarding) return;
    const updated = { ...onboarding, trackingPreference };
    await storage.saveOnboarding(updated);
    set({ onboarding: updated });
  },

  setPendingDestination: async (pendingDestination, isCurrent = () => true) => {
    if (!isCurrent()) return;
    await storage.savePendingDestination(pendingDestination);
    if (isCurrent()) set({ pendingDestination });
  },

  setPrivacyLock: async (privacyLock) => {
    const expectedSession = get().session;
    await storage.savePrivacyLock(privacyLock);
    if (get().session === expectedSession) set({ privacyLock });
  },

  lockNow: async () => {
    const privacyLock = get().privacyLock;
    if (!isAppLockEnabled() || !privacyLock?.enabled || privacyLock.appLockStatus === 'locked') return;
    const expectedSession = get().session;
    const locked = { ...privacyLock, appLockStatus: 'locked' as const };
    await storage.savePrivacyLock(locked);
    if (get().session === expectedSession) set({ privacyLock: locked });
  },

  setProfileSetup: (profileSetupStatus, profileSetupSnapshot = null) => {
    set({ profileSetupStatus, profileSetupSnapshot });
  },

  dismissProfilePrompt: async () => {
    await storage.saveProfilePromptDismissed(true);
    set({ profilePromptDismissed: true });
  },

  reopenProfilePrompt: async () => {
    await storage.saveProfilePromptDismissed(false);
    set({ profilePromptDismissed: false });
  },

  dismissTrackingHomeCard: async () => {
    await storage.saveTrackingHomeCardDismissed(true);
    set({ trackingHomeCardDismissed: true });
  },

  unlock: async () => {
    const privacyLock = get().privacyLock;
    if (!privacyLock?.enabled || !isAppLockEnabled()) return;
    const expectedSession = get().session;
    const admissionRevision = currentLogoutAdmissionRevision();
    const unlocked = {
      ...privacyLock,
      appLockStatus: 'unlocked' as const
    };
    await storage.savePrivacyLock(unlocked);
    if (get().session === expectedSession && admissionRevision === currentLogoutAdmissionRevision())
      set({ privacyLock: unlocked });
  },

  reset: () => {
    set(initialState);
  }
}));

function lockForLaunch(privacyLock: PrivacyLockPreference | null): PrivacyLockPreference | null {
  const enabledInBuild = isAppLockEnabled();
  if (!privacyLock) return enabledInBuild ? null : {
    enabled: false, autoLockDuration: 'immediate', appLockStatus: 'unlocked'
  };
  return { ...privacyLock, appLockStatus: privacyLock.enabled && enabledInBuild ? 'locked' : 'unlocked' };
}

registerRuntimeUserDataReset(() => {
  useAppShellStore.setState({
    ...initialState,
    hydrated: true,
    session: signedOutSession
  });
});
