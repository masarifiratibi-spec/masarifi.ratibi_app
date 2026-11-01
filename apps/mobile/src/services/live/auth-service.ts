import { assertBenchmarkRead } from '@/config/client-runtime';
import { privacyExportStatusSchema } from '@/domain/settings';
import { resolveEffectiveTimeZone } from '@/domain/effective-time-zone';
import { z } from 'zod';
import { measurePerformance } from '@/services/platform/performance-timing';
import { useAppShellStore } from '@/state/app-shell';
import { isLogoutOwnerFenced, loadLogoutDisposition, type LogoutDisposition } from '@/storage/app-shell-storage';

import {
  onboardingSteps,
  type AuthenticationSession,
  type OnboardingProgress
} from '@/domain/app-shell';
import { supportedCurrencies } from '@/domain/currencies';
import type {
  OwnerOnboardingProgress,
  OwnerPreferences,
  PrivacyRequest,
  ProfileSetupInput,
  ProfileSetupSnapshot,
  RepresentativeSession,
  UserProfile,
  UserProfileInput
} from '@/domain/settings';
import {
  authServiceCapability,
  type AuthResult,
  type AuthService,
  type OnboardingService,
  type PhoneInput,
  type PhoneVerificationAttempt,
  type ReverificationInput,
  type VerificationInput
} from '@/services/contracts/app-shell-service';
import {
  settingsServiceCapability,
  type SettingsService
} from '@/services/contracts/assistant-notifications-service';
import type { CapabilityProviderHandle } from '@/services/contracts/capability-contract';
import { TrackingError } from '@/services/contracts/automatic-tracking-service';
import { resetLocalUserData } from '@/storage/local-data-reset';
import { isDevPrivacyDeletionEnabled } from '@/config/client-runtime';
import { isMobileAutomationEnabled } from '@/config/mobile-automation';
import { getDeviceRegistration } from '@/services/platform/phone-notification-service';
import { usePreferenceStore } from '@/state/preferences';
import { isDeletionOwnerFenced } from '@/storage/deletion-completion-journal';
import {
  configureMobileApiTokenProvider,
  HttpError,
  requestJson
} from './http-client';
import { configureAutomaticTrackingTokenProvider } from './automatic-tracking-service';
import { configureAssistantApiTokenProvider } from './assistant-api-service';
import {
  configureVoiceApiOwnerProvider,
  configureVoiceApiTokenProvider
} from './voice-api-service';

type ClerkSession = {
  id: string;
  userId: string;
  method: 'phone' | 'google';
  issuedAt: number;
  expiresAt: number;
};

export interface LiveClerkBridge {
  getSession(): Promise<ClerkSession | null>;
  getToken(options: { skipCache: boolean }): Promise<string | null>;
  startPhone(input: PhoneInput): Promise<PhoneVerificationAttempt>;
  verifyPhone(input: VerificationInput): Promise<AuthResult>;
  resendPhone(sessionId: string): Promise<PhoneVerificationAttempt>;
  signInWithGoogle(): Promise<ClerkSession | null>;
  reverifyConflict(input: ReverificationInput): Promise<ClerkSession | null>;
  signOut(options: {
    scope: 'current' | 'all';
    sessionId?: string;
  }): Promise<void>;
}

type IdentityRequest = (
  path: string,
  options?: Omit<RequestInit, 'body'> & { body?: unknown; emptyValue?: unknown }
) => Promise<unknown>;

const profileSchema = z
  .object({
    id: z.string().min(1),
    displayName: z.string().min(1).max(100).nullable(),
    primaryEmailMasked: z.string().nullable(),
    phoneMasked: z.string().nullable(),
    locale: z.enum(['ar', 'en']),
    timezone: z.string().min(1).max(64),
    status: z.literal('active'),
    version: z.number().int().positive()
  })
  .strict();
const preferencesSchema = z
  .object({
    currencySelectionRequired: z.boolean().optional(),
    defaultCurrency: z.string().regex(/^[A-Z]{3}$/),
    language: z.enum(['ar', 'en']),
    theme: z.enum(['light', 'dark', 'system']),
    calendar: z.enum(['gregorian', 'hijri']),
    weekStart: z.number().int().min(0).max(6),
    privacySettings: z.record(z.boolean()),
    version: z.number().int().positive()
  })
  .strict();
const ownerOnboardingSteps = ['welcome', ...onboardingSteps] as const;
const onboardingSchema = z
  .object({
    step: z.enum(ownerOnboardingSteps),
    completedSteps: z.array(z.enum(ownerOnboardingSteps)).max(12),
    completedAt: z.string().datetime().nullable(),
    version: z.number().int().positive()
  })
  .strict();
const deviceSchema = z
  .object({
    id: z.string().uuid(),
    platform: z.enum(['android', 'ios', 'web']),
    appVersion: z.string().min(1).max(32),
    deviceName: z.string().min(1).max(80).nullable(),
    trusted: z.boolean(),
    lastSeenAt: z.string().datetime(),
    current: z.boolean(),
    revokedAt: z.string().datetime().nullable(),
    version: z.number().int().positive()
  })
  .strict();
const devicePageSchema = z
  .object({
    items: z.array(deviceSchema).max(100),
    nextCursor: z.string().nullable()
  })
  .strict();
const privacyExportSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum([
      'requested',
      'verified',
      'processing',
      'ready',
      'expired',
      'failed'
    ]),
    scope: z.array(z.string().min(1)).min(1).max(100),
    requestedAt: z.string().datetime(),
    expiresAt: z.string().datetime().nullable(),
    version: z.number().int().positive()
  })
  .strict();
export const deletionRequestSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum([
      'requested',
      'verified',
      'processing',
      'completed',
      'cancelled',
      'failed'
    ]),
    requestedAt: z.string().datetime(),
    coolingOffEndsAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    retainedCategories: z.array(z.string()).max(100),
    version: z.number().int().positive()
  })
  .strict();
const emptySchema = z.null();
const syntheticId = /^(?:mock|demo|fixture|test)(?:[-_]|$)/i;
let registeredBridge: LiveClerkBridge | null = null;

export async function readLogoutSessionAnchor(ownerId: string): Promise<string | null> {
  const session = await registeredBridge?.getSession();
  if (session && session.userId !== ownerId) throw new HttpError('session_expired', 401);
  return session?.id ?? null;
}

export async function terminatePinnedLogout(
  record: LogoutDisposition,
  retry = false
): Promise<void> {
  const bridge = registeredBridge;
  if (!bridge)
    throw new HttpError('session_expired', 401, 'LOGOUT_SESSION_UNVERIFIED');
  await assertPreparedLogout(bridge, record);
  if (retry && record.scope === 'all')
    throw new HttpError(
      'provider_unavailable',
      503,
      'LOGOUT_RETRY_UNAVAILABLE'
    );
  await signOutClerkSession(
    bridge,
    record.scope,
    defaultIdentityRequest,
    record
  );
}

async function assertPreparedLogout(
  bridge: LiveClerkBridge,
  record: LogoutDisposition
): Promise<void> {
  const stored = await loadLogoutDisposition(record.ownerId);
  const session = await bridge.getSession();
  const shellOwner = useAppShellStore.getState().session?.userId;
  if (
    registeredBridge !== bridge ||
    !record.sessionId ||
    stored?.id !== record.id ||
    stored.phase !== 'prepared' ||
    stored.sessionId !== record.sessionId ||
    stored.scope !== record.scope ||
    stored.dataDisposition !== record.dataDisposition ||
    session?.userId !== record.ownerId ||
    session.id !== record.sessionId ||
    (shellOwner && shellOwner !== record.ownerId)
  )
    throw new HttpError('session_expired', 401, 'LOGOUT_SESSION_UNVERIFIED');
}

async function signOutClerkSession(
  bridge: LiveClerkBridge,
  scope: 'local' | 'all',
  request: IdentityRequest,
  cleanup?: LogoutDisposition
): Promise<void> {
  const expectedOwner = useAppShellStore.getState().session?.userId;
  const currentSession = await bridge.getSession();
  if (
    expectedOwner &&
    currentSession &&
    expectedOwner !== currentSession.userId
  )
    throw new HttpError('session_expired', 401);
  const automation = isMobileAutomationEnabled();
  if (!automation && !cleanup) {
    await bridge.signOut({ scope: scope === 'all' ? 'all' : 'current' });
    return;
  }
  const session = cleanup ? currentSession : await bridge.getSession();
  const assertSession = async () => {
    if (cleanup) return assertPreparedLogout(bridge, cleanup);
    const current = await bridge.getSession();
    const owner = useAppShellStore.getState().session?.userId;
    if (
      current?.userId !== session?.userId ||
      current?.id !== session?.id ||
      (owner && owner !== session?.userId)
    )
      throw new HttpError('session_expired', 401);
  };
  if (cleanup) await assertSession();
  if (automation && session) {
    const deviceRegistration = await getDeviceRegistration();
    if (!deviceRegistration) throw new HttpError('provider_unavailable', 503);
    await assertSession();
    await usePreferenceStore
      .getState()
      .withdrawReturnRemindersForSession(session.userId);
    await assertSession();
    const path = '/api/v1/tracking/device/installations/sign-out';
    const options = { method: 'POST', body: { deviceRegistration } };
    if (request === defaultIdentityRequest) {
      let actor: {
        userId: string;
        token: string;
        assertCurrent(): Promise<void>;
      };
      if (cleanup) {
        const token = await requestClerkToken(
          bridge,
          { skipCache: true },
          cleanup
        );
        if (!token) throw new HttpError('session_expired', 401);
        actor = {
          userId: cleanup.ownerId,
          token,
          assertCurrent: assertSession
        };
      } else actor = await captureLiveClerkIdentity();
      if (actor.userId !== session.userId)
        throw new HttpError('session_expired', 401);
      await assertSession();
      await requestJson(path, z.unknown(), {
        ...options,
        token: actor.token,
        ...(cleanup
          ? {
              request: async (
                url: Parameters<typeof fetch>[0],
                init?: RequestInit
              ) => {
                await assertSession();
                const response = await fetch(url, init);
                await assertSession();
                return response;
              }
            }
          : {})
      });
      await actor.assertCurrent();
    } else await request(path, options);
    await assertSession();
  }
  if (cleanup) await assertSession();
  await bridge.signOut({
    scope: scope === 'all' ? 'all' : 'current',
    ...(session ? { sessionId: session.id } : {})
  });
}

async function assertLogoutAdmission(ownerId: string, admitted = false): Promise<void> {
  if ((!admitted && useAppShellStore.getState().logoutQuiescingOwnerId === ownerId) || await isLogoutOwnerFenced(ownerId)) throw new HttpError('session_expired', 401, 'LOGOUT_PENDING');
}

export function registerLiveClerkBridge(bridge: LiveClerkBridge): void {
  registeredBridge = bridge;
  configureMobileApiTokenProvider(getLiveClerkToken);
  configureAssistantApiTokenProvider(getLiveClerkToken);
  configureVoiceApiTokenProvider(async (readOnly) =>
    readOnly
      ? (await captureLiveReadClerkIdentity()).token
      : getLiveClerkToken()
  );
  configureVoiceApiOwnerProvider(async () => {
    const session = await bridge.getSession();
    if (!session) throw new HttpError('session_expired', 401);
    return session.userId;
  });
  configureAutomaticTrackingTokenProvider(async (readOnly) => {
    const token = readOnly
      ? (await captureLiveReadClerkIdentity()).token
      : await requestClerkToken(bridge, { skipCache: true });
    if (!token) throw new TrackingError('permission_required');
    return token;
  });
}

async function requestClerkToken(
  bridge: LiveClerkBridge,
  options: { skipCache: boolean },
  logoutCleanup?: LogoutDisposition
) {
  const logoutOwner = await bridge.getSession();
  if (logoutCleanup) await assertPreparedLogout(bridge, logoutCleanup);
  else if (logoutOwner) await assertLogoutAdmission(logoutOwner.userId);
  if (useAppShellStore.getState().session?.restoration === 'local')
    throw new HttpError(
      'provider_unavailable',
      503,
      undefined,
      undefined,
      'network'
    );
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const token = await measurePerformance(
      options.skipCache ? 'identity.token.fresh' : 'identity.token.read',
      () =>
        Promise.race([
          bridge.getToken(options),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new HttpError(
                    'provider_unavailable',
                    503,
                    undefined,
                    undefined,
                    'timeout'
                  )
                ),
              10_000
            );
          })
        ])
    );
    if (logoutCleanup) await assertPreparedLogout(bridge, logoutCleanup);
    else if (logoutOwner) {
      await assertLogoutAdmission(logoutOwner.userId);
      const current = await bridge.getSession();
      if (current?.id !== logoutOwner.id || current.userId !== logoutOwner.userId) throw new HttpError('session_expired', 401);
    }
    return token;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'network_error'
    )
      throw new HttpError(
        'provider_unavailable',
        503,
        undefined,
        undefined,
        'network'
      );
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function getLiveClerkToken(): Promise<string> {
  if (!registeredBridge) throw new HttpError('session_expired', 401);
  const token = await requestClerkToken(registeredBridge, { skipCache: true });
  if (!token) throw new HttpError('session_expired', 401);
  return token;
}

export async function signOutDeletedClerkOwner(ownerId: string): Promise<void> {
  const bridge = registeredBridge;
  const session = await bridge?.getSession();
  if (session?.userId === ownerId && bridge)
    await bridge.signOut({ scope: 'current', sessionId: session.id });
}

export async function getLiveClerkOwnerId(): Promise<string | null> {
  return (await registeredBridge?.getSession())?.userId ?? null;
}

export async function captureLiveClerkOwner() {
  const local = useAppShellStore.getState();
  if (local.session?.restoration === 'local') {
    const session = local.session;
    if (session.userId) await assertLogoutAdmission(session.userId);
    const assertCurrent = async () => {
      if (session.userId) await assertLogoutAdmission(session.userId, true);
      const current = useAppShellStore.getState();
      if (
        current.session !== session ||
        !session.userId ||
        current.privacyLock?.appLockStatus !== 'unlocked'
      )
        throw new HttpError('session_expired', 401);
    };
    await assertCurrent();
    return { userId: session.userId!, assertCurrent };
  }
  const bridge = registeredBridge;
  const session = await bridge?.getSession();
  if (!bridge || !session) throw new HttpError('session_expired', 401);
  await assertLogoutAdmission(session.userId);
  const assertCurrent = async () => {
    await assertLogoutAdmission(session.userId, true);
    const currentBridge = registeredBridge;
    const current = await currentBridge?.getSession();
    if (
      registeredBridge !== currentBridge ||
      current?.id !== session.id ||
      current.userId !== session.userId
    )
      throw new HttpError('session_expired', 401);
  };
  await assertCurrent();
  return { userId: session.userId, assertCurrent };
}

export async function captureLiveClerkIdentity() {
  const bridge = registeredBridge;
  const session = await bridge?.getSession();
  if (!bridge || !session) throw new HttpError('session_expired', 401);
  await assertLogoutAdmission(session.userId);
  const assertCurrent = async () => {
    await assertLogoutAdmission(session.userId, true);
    const currentBridge = registeredBridge;
    const current = await currentBridge?.getSession();
    if (
      registeredBridge !== currentBridge ||
      current?.id !== session.id ||
      current.userId !== session.userId
    )
      throw new HttpError('session_expired', 401);
  };
  const token = await requestClerkToken(bridge, { skipCache: true });
  if (!token) throw new HttpError('session_expired', 401);
  await assertCurrent();
  return { userId: session.userId, token, assertCurrent };
}

// Read-only calls share a pending SDK lookup; Clerk owns valid-token caching.
let assistantTokenFlight:
  | {
      bridge: LiveClerkBridge;
      sessionId: string;
      userId: string;
      startedAt: number;
      promise: Promise<string | null>;
    }
  | undefined;

async function captureCachedClerkIdentity(
  allowSameSessionBridgeRefresh: boolean,
  expectedOwnerId?: string
) {
  const bridge = registeredBridge;
  const session = await bridge?.getSession();
  if (
    !bridge ||
    !session ||
    (expectedOwnerId !== undefined && session.userId !== expectedOwnerId) ||
    (!allowSameSessionBridgeRefresh && registeredBridge !== bridge)
  )
    throw new HttpError('session_expired', 401);
  const assertCurrent = async () => {
    await assertLogoutAdmission(session.userId, true);
    const currentBridge = allowSameSessionBridgeRefresh
      ? registeredBridge
      : bridge;
    const current = await currentBridge?.getSession();
    if (
      registeredBridge !== currentBridge ||
      current?.id !== session.id ||
      current.userId !== session.userId
    )
      throw new HttpError('session_expired', 401);
  };
  if (
    assistantTokenFlight?.bridge !== bridge ||
    assistantTokenFlight.sessionId !== session.id ||
    assistantTokenFlight.userId !== session.userId ||
    Date.now() - assistantTokenFlight.startedAt >= 15000
  ) {
    assistantTokenFlight = {
      bridge,
      sessionId: session.id,
      userId: session.userId,
      startedAt: Date.now(),
      promise: requestClerkToken(bridge, { skipCache: false })
    };
  }
  const flight = assistantTokenFlight;
  try {
    const token = await flight.promise;
    if (!token) throw new HttpError('session_expired', 401);
    await assertCurrent();
    return { userId: session.userId, token, assertCurrent };
  } finally {
    if (assistantTokenFlight === flight) assistantTokenFlight = undefined;
  }
}

export async function captureLiveAssistantClerkIdentity() {
  return captureShellBoundReadIdentity(false);
}

export async function captureLiveReadClerkIdentity() {
  return captureShellBoundReadIdentity(true);
}

async function captureShellBoundReadIdentity(
  allowSameSessionBridgeRefresh: boolean
) {
  const shell = useAppShellStore.getState();
  if (shell.session?.restoration === 'local') {
    // The existing local-owner admission is valid for saved reads, never remote credentials.
    const owner = await captureLiveClerkOwner();
    await owner.assertCurrent();
    throw new HttpError('provider_unavailable', 503);
  }
  const expectedOwnerId =
    shell.session?.status === 'authenticated'
      ? (shell.session.userId ?? undefined)
      : undefined;
  const identity = await captureCachedClerkIdentity(
    allowSameSessionBridgeRefresh,
    expectedOwnerId
  );
  const assertOwner = () => {
    const current = useAppShellStore.getState().session;
    if (
      expectedOwnerId !== undefined &&
      (current?.status !== 'authenticated' ||
        current.userId !== expectedOwnerId)
    )
      throw new HttpError('session_expired', 401);
  };
  assertOwner();
  return {
    ...identity,
    assertCurrent: async () => {
      await identity.assertCurrent();
      assertOwner();
    }
  };
}

export function registeredLiveAuthService(): CapabilityProviderHandle<AuthService> | null {
  return registeredBridge ? createLiveAuthService(registeredBridge) : null;
}

export function createLiveAuthService(
  bridge: LiveClerkBridge,
  request: IdentityRequest = defaultIdentityRequest
): CapabilityProviderHandle<AuthService> {
  return {
    metadata: {
      id: 'clerk-auth',
      capability: authServiceCapability.capability,
      majorVersion: authServiceCapability.majorVersion,
      kind: 'live',
      availability: 'available'
    },
    startPhone: (input) => bridge.startPhone(input),
    verifyPhone: (input) => bridge.verifyPhone(input),
    resendPhone: (sessionId) => bridge.resendPhone(sessionId),
    async signInWithGoogle() {
      const session = await bridge.signInWithGoogle();
      return session
        ? { status: 'authenticated', session: authenticated(session) }
        : { status: 'cancelled' };
    },
    async reverifyConflict(input) {
      const session = await bridge.reverifyConflict(input);
      return session
        ? { status: 'authenticated', session: authenticated(session) }
        : { status: 'failed', errorCode: 'verification_failed' };
    },
    async restoreSession() {
      const session = await bridge.getSession();
      if (
        session &&
        isDevPrivacyDeletionEnabled() &&
        (await isDeletionOwnerFenced(session.userId))
      )
        return signedOut();
      return session ? authenticated(session) : signedOut();
    },
    async touchActivity() {
      await parsedRequest(request, '/api/v1/me', profileSchema);
    },
    async signOut(scope) {
      await signOutClerkSession(bridge, scope, request);
    }
  };
}

export function createLiveIdentityService({
  getOwnerId = () => null,
  request = (path, options) =>
    defaultIdentityRequest(path, options, getOwnerId()),
  loadLocalProfile = async () => emptyProfile(),
  saveLocalProfile = async () => undefined,
  loadLocalOnboarding = async () => null,
  saveLocalOnboarding = async () => undefined
}: {
  getOwnerId?: () => string | null;
  request?: IdentityRequest;
  loadLocalProfile?: (ownerId?: string) => Promise<UserProfile | null>;
  saveLocalProfile?: (profile: UserProfile, ownerId?: string) => Promise<void>;
  loadLocalOnboarding?: () => Promise<OnboardingProgress | null>;
  saveLocalOnboarding?: (progress: OnboardingProgress) => Promise<void>;
} = {}): CapabilityProviderHandle<SettingsService & OnboardingService> {
  let onboardingVersion = 1;
  let profileSetupComplete = false;
  const sessions = new Map<string, RepresentativeSession>();

  async function getProfile(): Promise<UserProfile> {
    const ownerId = getOwnerId();
    const remote = await parsedRequest(request, '/api/v1/me', profileSchema);
    if (getOwnerId() !== ownerId) throw new HttpError('session_expired', 401);
    const [preferences, local] = await Promise.all([
      parsedRequest(request, '/api/v1/me/preferences', preferencesSchema),
      loadLocalProfile(ownerId ?? undefined)
    ]);
    if (getOwnerId() !== ownerId) throw new HttpError('session_expired', 401);
    const merged = mergeProfile(remote, preferences, local);
    await saveLocalProfile(merged, ownerId ?? undefined);
    return merged;
  }

  async function getProfileSetup(): Promise<ProfileSetupSnapshot> {
    const ownerId = getOwnerId();
    const local = await measurePerformance('identity.local.read', () =>
      loadLocalProfile(ownerId ?? undefined)
    );
    if (getOwnerId() !== ownerId) throw new HttpError('session_expired', 401);
    const remoteRequest = measurePerformance('identity.profile.remote', () =>
      parsedRequest(request, '/api/v1/me', profileSchema)
    );
    // A new owner still needs /me provisioning before dependent records exist.
    const provisioned = ownerId && local ? Promise.resolve() : remoteRequest;
    const details = provisioned.then(() => {
      if (getOwnerId() !== ownerId) throw new HttpError('session_expired', 401);
      return Promise.all([
        measurePerformance('identity.preferences', () =>
          parsedRequest(request, '/api/v1/me/preferences', preferencesSchema)
        ),
        measurePerformance('identity.onboarding', () =>
          parsedRequest(request, '/api/v1/me/onboarding', onboardingSchema)
        )
      ]);
    });
    const [remote, [preferences, onboarding]] = await Promise.all([
      remoteRequest,
      details
    ]);
    if (getOwnerId() !== ownerId) throw new HttpError('session_expired', 401);
    onboardingVersion = onboarding.version;
    profileSetupComplete =
      onboarding.completedSteps.includes('welcome') &&
      preferences.currencySelectionRequired === false;
    const profile = mergeProfile(
      remote,
      preferences,
      local,
      supportedCurrency(preferences.defaultCurrency)
    );
    await measurePerformance('identity.local.write', () =>
      saveLocalProfile(profile, ownerId ?? undefined)
    );
    return {
      profile,
      preferences: preferences as OwnerPreferences,
      onboarding: onboarding as OwnerOnboardingProgress,
      complete: profileSetupComplete
    };
  }

  async function loadProgress(): Promise<OnboardingProgress | null> {
    const [remote, local] = await Promise.all([
      parsedRequest(request, '/api/v1/me/onboarding', onboardingSchema),
      loadLocalOnboarding()
    ]);
    onboardingVersion = remote.version;
    profileSetupComplete = remote.completedSteps.includes('welcome');
    const completedSteps = remote.completedSteps.filter(isClientOnboardingStep);
    const currentStep = isClientOnboardingStep(remote.step)
      ? remote.step
      : 'tracking_intro';
    const merged: OnboardingProgress = {
      ...(local ?? emptyOnboarding()),
      status: remote.completedAt ? 'completed' : 'in_progress',
      completedSteps,
      currentStep: remote.completedAt ? null : currentStep
    };
    await saveLocalOnboarding(merged);
    return merged;
  }

  async function listSessions(): Promise<RepresentativeSession[]> {
    const devices: z.infer<typeof deviceSchema>[] = [];
    let cursor: string | null = null;
    do {
      const page: z.infer<typeof devicePageSchema> = await parsedRequest(
        request,
        `/api/v1/me/devices?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        devicePageSchema
      );
      devices.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    const mapped = devices.map(deviceSession);
    mapped.forEach((session) => sessions.set(session.id, session));
    return mapped;
  }

  return {
    metadata: {
      id: 'live-owner-identity',
      capability: settingsServiceCapability.capability,
      majorVersion: settingsServiceCapability.majorVersion,
      kind: 'live',
      availability: 'available'
    },
    getProfile,
    getProfileSetup,
    async saveProfile(
      input: UserProfileInput,
      expectedVersion: number,
      operationId: string
    ) {
      const ownerId = getOwnerId();
      const remote = await parsedRequest(request, '/api/v1/me', profileSchema, {
        method: 'PATCH',
        headers: { 'Idempotency-Key': operationId },
        body: {
          displayName: input.name,
          timezone: resolveEffectiveTimeZone(input.timeZone),
          expectedVersion
        }
      });
      if (getOwnerId() !== ownerId) throw new HttpError('session_expired', 401);
      const next = {
        ...input,
        name: remote.displayName,
        timeZone: remote.timezone,
        version: remote.version
      };
      await saveLocalProfile(next, ownerId ?? undefined);
      return mutation(next, ['settings.profile']);
    },
    async saveProfileSetup(
      input: ProfileSetupInput,
      snapshot: ProfileSetupSnapshot,
      operationId: string
    ) {
      const ownerId = getOwnerId();
      const name = input.name.trim();
      const currency = supportedCurrency(input.currency);
      if (!name) throw new HttpError('validation_error', 400);
      if (currency !== input.currency)
        throw new HttpError('validation_error', 400);
      const remoteProfile = await parsedRequest(
        request,
        '/api/v1/me',
        profileSchema,
        {
          method: 'PATCH',
          headers: { 'Idempotency-Key': `${operationId}-profile` },
          body: {
            displayName: name,
            expectedVersion: snapshot.profile.version
          }
        }
      );
      if (getOwnerId() !== ownerId) throw new HttpError('session_expired', 401);
      const remotePreferences = await parsedRequest(
        request,
        '/api/v1/me/preferences',
        preferencesSchema,
        {
          method: 'PUT',
          headers: { 'Idempotency-Key': `${operationId}-preferences` },
          body: {
            defaultCurrency: currency,
            currencySelectionConfirmed: true,
            language: snapshot.preferences.language,
            theme: snapshot.preferences.theme,
            calendar: snapshot.preferences.calendar,
            weekStart: snapshot.preferences.weekStart,
            privacySettings: snapshot.preferences.privacySettings,
            expectedVersion: snapshot.preferences.version
          }
        }
      );
      if (getOwnerId() !== ownerId) throw new HttpError('session_expired', 401);
      if (remotePreferences.currencySelectionRequired === undefined)
        throw new HttpError('contract_mismatch', 502);
      if (remotePreferences.currencySelectionRequired !== false)
        throw new HttpError('validation_error', 400);
      const step =
        snapshot.onboarding.step === 'welcome'
          ? 'tracking_intro'
          : snapshot.onboarding.step;
      const completedSteps = [
        'welcome',
        ...snapshot.onboarding.completedSteps.filter(
          (completed) => completed !== 'welcome'
        )
      ];
      const remoteOnboarding = await parsedRequest(
        request,
        '/api/v1/me/onboarding',
        onboardingSchema,
        {
          method: 'PUT',
          headers: { 'Idempotency-Key': `${operationId}-onboarding` },
          body: {
            step,
            completedSteps,
            complete: step === 'complete',
            expectedVersion: snapshot.onboarding.version
          }
        }
      );
      if (getOwnerId() !== ownerId) throw new HttpError('session_expired', 401);
      onboardingVersion = remoteOnboarding.version;
      profileSetupComplete =
        remoteOnboarding.completedSteps.includes('welcome');
      const profile = mergeProfile(
        remoteProfile,
        remotePreferences,
        snapshot.profile
      );
      await saveLocalProfile(profile, ownerId ?? undefined);
      return mutation(
        {
          profile,
          preferences: remotePreferences as OwnerPreferences,
          onboarding: remoteOnboarding as OwnerOnboardingProgress,
          complete: profileSetupComplete
        },
        ['settings.profile']
      );
    },
    listSessions,
    async revokeSession(sessionId: string, operationId: string) {
      await parsedRequest(
        request,
        `/api/v1/me/devices/${encodeURIComponent(sessionId)}`,
        emptySchema,
        {
          method: 'DELETE',
          headers: { 'Idempotency-Key': operationId },
          emptyValue: null
        }
      );
      const current = sessions.get(sessionId);
      if (!current) throw new HttpError('not_found', 404);
      const revoked = { ...current, status: 'revoked' as const };
      sessions.set(sessionId, revoked);
      return mutation(revoked, ['settings.sessions']);
    },
    async revokeAllSessions() {
      throw new HttpError('provider_unavailable', 503);
    },
    async listSecurityEvents(cursor) {
      const page = await parsedRequest(
        request,
        `/api/v1/me/security/events?${new URLSearchParams({ limit: '50', ...(cursor ? { cursor } : {}) })}`,
        z
          .object({
            items: z
              .array(
                z
                  .object({
                    id: z.string().uuid(),
                    eventType: z.string().max(80),
                    severity: z.enum([
                      'info',
                      'low',
                      'medium',
                      'high',
                      'critical'
                    ]),
                    occurredAt: z.string().datetime()
                  })
                  .strip()
              )
              .max(50),
            nextCursor: z.string().max(2048).nullable()
          })
          .strict()
      );
      return {
        items: page.items.map((event) => ({
          id: event.id,
          type: 'other' as const,
          eventType: event.eventType,
          deviceLabel: '—',
          platform: 'unknown' as const,
          occurredAt: Date.parse(event.occurredAt),
          status: 'succeeded' as const,
          recoveryDestination: {
            kind: 'settings' as const,
            key: 'privacy' as const
          }
        })),
        nextCursor: page.nextCursor,
        total: page.items.length
      };
    },
    async requestPrivacyAction(kind, operationId) {
      const serverRequest =
        kind === 'data_export'
          ? await parsedRequest(
              request,
              '/api/v1/me/privacy/exports',
              privacyExportSchema,
              {
                method: 'POST',
                headers: { 'Idempotency-Key': operationId },
                body: {}
              }
            )
          : await parsedRequest(
              request,
              '/api/v1/me/deletion-requests',
              deletionRequestSchema,
              {
                method: 'POST',
                headers: { 'Idempotency-Key': operationId },
                body: { confirmation: 'DELETE_MY_ACCOUNT' }
              }
            );
      return mutation(privacyRequest(kind, operationId, serverRequest), [
        `settings.privacy-request.${kind}`
      ]);
    },
    async getPrivacyExport(requestId) {
      return parsedRequest(
        request,
        `/api/v1/me/privacy/exports/${encodeURIComponent(requestId)}`,
        privacyExportStatusSchema
      );
    },
    async getAccountDeletion(requestId) {
      const deletion = await parsedRequest(
        request,
        `/api/v1/me/deletion-requests/${encodeURIComponent(requestId)}`,
        deletionRequestSchema
      );
      return privacyRequest('account_deletion', requestId, deletion);
    },
    async cancelAccountDeletion(requestId, operationId) {
      await parsedRequest(
        request,
        `/api/v1/me/deletion-requests/${encodeURIComponent(requestId)}`,
        emptySchema,
        {
          method: 'DELETE',
          headers: { 'Idempotency-Key': operationId },
          emptyValue: null
        }
      );
      return mutation(null, ['settings.privacy-request.account_deletion']);
    },
    async deleteLocalData(operationId: string) {
      const deleted = await resetLocalUserData(operationId);
      return mutation({ deletedRows: deleted.deletedRows }, [
        'settings.local-data'
      ]);
    },
    loadProgress,
    async saveProgress(progress) {
      const remote = await parsedRequest(
        request,
        '/api/v1/me/onboarding',
        onboardingSchema,
        {
          method: 'PUT',
          headers: { 'Idempotency-Key': `onboarding-${onboardingVersion}` },
          body: {
            step: progress.currentStep ?? 'complete',
            completedSteps: profileSetupComplete
              ? ['welcome', ...progress.completedSteps]
              : progress.completedSteps,
            complete: progress.status === 'completed',
            expectedVersion: onboardingVersion
          }
        }
      );
      onboardingVersion = remote.version;
      await saveLocalOnboarding(progress);
    },
    async resetProgress() {
      const progress = emptyOnboarding();
      await saveLocalOnboarding(progress);
    }
  };
}

async function defaultIdentityRequest(
  path: string,
  options: Omit<RequestInit, 'body'> & {
    body?: unknown;
    emptyValue?: unknown;
  } = {},
  expectedOwnerId?: string | null
): Promise<unknown> {
  assertBenchmarkRead(options.method);
  const read = (options.method ?? 'GET').toUpperCase() === 'GET';
  const actor = await (read
    ? captureLiveReadClerkIdentity()
    : captureLiveClerkIdentity());
  if (expectedOwnerId && actor.userId !== expectedOwnerId)
    throw new HttpError('session_expired', 401);
  const result = await requestJson(path, z.unknown(), {
    ...options,
    token: actor.token
  });
  await actor.assertCurrent();
  return result;
}

async function parsedRequest<T>(
  request: IdentityRequest,
  path: string,
  schema: z.ZodType<T>,
  options?: Omit<RequestInit, 'body'> & { body?: unknown; emptyValue?: unknown }
): Promise<T> {
  if (path === '/api/v1/me/preferences') {
    options = {
      ...options,
      headers: {
        ...(options?.headers as Record<string, string> | undefined),
        Accept: 'application/json; currency-onboarding=1'
      }
    };
  }
  const parsed = schema.safeParse(await request(path, options));
  if (!parsed.success) throw new HttpError('contract_mismatch', 502);
  return parsed.data;
}

function authenticated(session: ClerkSession): AuthenticationSession {
  if (
    syntheticId.test(session.id) ||
    syntheticId.test(session.userId) ||
    !session.id ||
    !session.userId ||
    session.expiresAt <= session.issuedAt
  )
    throw new HttpError('contract_mismatch', 502);
  return {
    status: 'authenticated',
    userId: session.userId,
    method: session.method,
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
    restoration: 'restored'
  };
}

function signedOut(): AuthenticationSession {
  return {
    status: 'signed_out',
    userId: null,
    method: null,
    issuedAt: null,
    expiresAt: null,
    restoration: 'missing'
  };
}

function deviceSession(
  device: z.infer<typeof deviceSchema>
): RepresentativeSession {
  const lastSeenAt = Date.parse(device.lastSeenAt);
  return {
    id: device.id,
    deviceLabel: device.deviceName ?? `${device.platform} device`,
    platform: device.platform,
    createdAt: lastSeenAt,
    lastActiveAt: lastSeenAt,
    isCurrentDevice: device.current,
    status: device.revokedAt ? 'revoked' : 'active'
  };
}

function privacyRequest(
  kind: PrivacyRequest['kind'],
  operationId: string,
  serverRequest:
    z.infer<typeof privacyExportSchema> | z.infer<typeof deletionRequestSchema>
): PrivacyRequest {
  const requestedAt = Date.parse(serverRequest.requestedAt);
  if (!Number.isSafeInteger(requestedAt) || requestedAt < 0)
    throw new HttpError('contract_mismatch', 502);
  return {
    id: serverRequest.id,
    operationId,
    kind,
    status:
      kind === 'account_deletion' && serverRequest.status === 'verified'
        ? 'review'
        : privacyStatus(serverRequest.status),
    requestedAt,
    updatedAt: requestedAt,
    safeFailure:
      serverRequest.status === 'expired'
        ? 'expired'
        : serverRequest.status === 'failed'
          ? 'representative_failure'
          : null,
    ...('coolingOffEndsAt' in serverRequest
      ? {
          serverStatus: serverRequest.status,
          coolingOffEndsAt: Date.parse(serverRequest.coolingOffEndsAt),
          completedAt:
            serverRequest.completedAt === null
              ? null
              : Date.parse(serverRequest.completedAt),
          retainedCategories: serverRequest.retainedCategories,
          version: serverRequest.version
        }
      : {})
  };
}

function privacyStatus(status: string): PrivacyRequest['status'] {
  if (status === 'requested') return 'review';
  if (status === 'processing') return 'pending';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'expired' || status === 'failed') return 'failed';
  if (status === 'verified' || status === 'ready' || status === 'completed')
    return 'accepted';
  throw new HttpError('contract_mismatch', 502);
}

function isClientOnboardingStep(
  value: string
): value is (typeof onboardingSteps)[number] {
  return (onboardingSteps as readonly string[]).includes(value);
}

function supportedCurrency(value: string): string {
  return supportedCurrencies.some(({ code }) => code === value) ? value : 'SAR';
}

function mergeProfile(
  remote: z.infer<typeof profileSchema>,
  preferences: z.infer<typeof preferencesSchema>,
  local: UserProfile | null,
  currency = preferences.defaultCurrency
): UserProfile {
  return {
    ...(local ?? emptyProfile()),
    name: remote.displayName,
    phone: remote.phoneMasked,
    googleAccount: remote.primaryEmailMasked,
    email: local?.email ?? null,
    currency,
    timeZone: remote.timezone,
    version: remote.version
  };
}

function emptyProfile(): UserProfile {
  return {
    name: null,
    avatar: 'default',
    phone: null,
    googleAccount: null,
    email: null,
    country: 'SA',
    currency: 'SAR',
    timeZone: 'Asia/Riyadh',
    completion: [],
    version: 1
  };
}

function emptyOnboarding(): OnboardingProgress {
  return {
    platformPath: 'conservative',
    status: 'not_started',
    completedSteps: [],
    skippedSteps: [],
    currentStep: 'tracking_intro',
    permissionEducationSeen: false,
    trackingPreference: null,
    updatedAt: 0
  };
}

function mutation<T>(value: T, affectedScopes: readonly string[]) {
  return { value, affectedScopes };
}
