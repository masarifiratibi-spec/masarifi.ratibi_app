import Constants from 'expo-constants';
import { AppRegistry, Platform } from 'react-native';
import { registerTrackingNotificationTask } from './platform/tracking-notification-task';
import type { TokenCache } from '@clerk/expo';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { trackingNativeRuntime } from './platform/tracking-native-runtime.android';
import { resolveClientRuntime, isBenchmarkReadOnly } from '@/config/client-runtime';
import { configureDatabaseOwner } from '@/storage/database';
import {
  registerRuntimeIdentityReset,
  registerRuntimeUserDataReset
} from '@/storage/runtime-user-data-reset';
import {
  captureLiveClerkIdentity,
  registerLiveClerkBridge
} from './live/auth-service';
import { useAppShellStore } from '@/state/app-shell';
import { currentLogoutAdmissionRevision } from '@/storage/app-shell-storage';
import {
  admitTrackingOwner,
  beginTrackingAdmission,
  useTrackingAdmission,
  assertTrackingAvailable,
  captureTrackingAdmission,
  isolateTrackingForOwner
} from '@/state/tracking-admission';
import {
  trackingSourcePreferences,
  invalidateTrackingConsent,
  trackingConsentEpoch
} from './tracking-source-preferences';
import type { SmsRuleSnapshot } from '@/storage/sms-import-queue';
import { compileFinancialDiscoveryPolicy } from '@masarifi/transaction-parser';

const contextKey = 'masarifi.tracking.background-context.v2';
const clerkSessionCache: TokenCache = {
  getToken: (key) => SecureStore.getItemAsync(`masarifi.clerk.${key}`),
  saveToken: (key, value) =>
    SecureStore.setItemAsync(`masarifi.clerk.${key}`, value),
  clearToken: (key) => SecureStore.deleteItemAsync(`masarifi.clerk.${key}`)
};
let nativeMutation: Promise<void> = Promise.resolve();
let nativeGeneration = 0;
let restorationBlocked = false;
class ForeignTrackingOwnerIsolated extends Error {
  constructor() {
    super('tracking_owner_isolated');
  }
}
function serializeNative(change: () => Promise<void>): Promise<void> {
  const operation = nativeMutation.then(change, change);
  nativeMutation = operation.catch(() => undefined);
  return operation;
}
export async function scheduleTrackingFollowUp(ownerId: string): Promise<void> {
  if (isBenchmarkReadOnly()) return;
  const runtime = resolveClientRuntime();
  const native = trackingNativeRuntime;
  if (
    Platform.OS !== 'android' ||
    runtime.mode !== 'live' ||
    (runtime.apiUrl !== 'https://api.staging.masarifiratibi.com' &&
      !(
        process.env.EXPO_PUBLIC_RELEASE_CHANNEL === 'production' &&
        runtime.apiUrl
      )) ||
    !native?.scheduleTrackingFollowUp
  )
    return;
  const expectedEpoch = trackingConsentEpoch();
  const expectedGeneration = nativeGeneration;
  return serializeNative(async () => {
    const current = () =>
      !restorationBlocked &&
      expectedGeneration === nativeGeneration &&
      expectedEpoch === trackingConsentEpoch() &&
      useAppShellStore.getState().session?.status === 'authenticated' &&
      useAppShellStore.getState().session?.userId === ownerId;
    if (!current()) return;
    const raw = await SecureStore.getItemAsync(contextKey);
    if (!raw || !current()) return;
    const context = JSON.parse(raw) as {
      ownerId?: unknown;
      generation?: unknown;
    } | null;
    if (
      context?.ownerId !== ownerId ||
      typeof context.generation !== 'string' ||
      context.generation.length < 16 ||
      context.generation.length > 80
    )
      return;
    const ownerDigest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      ownerId
    );
    if ((await SecureStore.getItemAsync(contextKey)) !== raw || !current())
      return;
    await native.scheduleTrackingFollowUp!(ownerDigest, context.generation);
  });
}
export async function configureTrackingBackground(
  ownerId: string,
  rules: SmsRuleSnapshot,
  mode?: string,
  expectedEpoch = trackingConsentEpoch()
): Promise<void> {
  if (isBenchmarkReadOnly()) return;
  const expectedGeneration = nativeGeneration;
  return serializeNative(async () => {
    const current = () =>
      !restorationBlocked &&
      expectedGeneration === nativeGeneration &&
      expectedEpoch === trackingConsentEpoch() &&
      useAppShellStore.getState().session?.userId === ownerId;
    if (!current()) return;
    if (
      Platform.OS !== 'android' ||
      !trackingNativeRuntime?.configureTrackingOwner
    )
      return;
    if (
      rules.sourceAdmissionPolicy &&
      (!trackingNativeRuntime.financialContentAdmissionSupported ||
        !(await trackingNativeRuntime.financialContentAdmissionSupported()))
    ) {
      if (current()) await trackingNativeRuntime.suspendTrackingOwner();
      throw new Error('tracking_native_upgrade_required');
    }
    if (!current()) return;
    const sources = await trackingSourcePreferences.load();
    const raw = await SecureStore.getItemAsync(contextKey);
    const stored = raw
      ? (JSON.parse(raw) as { ownerId: string; generation: string })
      : null;
    const generation =
      stored?.ownerId === ownerId ? stored.generation : Crypto.randomUUID();
    const ownerDigest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      ownerId
    );
    const packages = rules.senders
      .filter(
        (s) =>
          s.enabled &&
          s.trusted &&
          /^[a-zA-Z][\w]*(?:\.[\w]+)+$/.test(s.normalizedSender)
      )
      .map((s) => s.normalizedSender);
    if (!current()) return;
    await SecureStore.setItemAsync(
      contextKey,
      JSON.stringify({ ownerId, generation })
    );
    if (
      rules.accountingPolicy &&
      !trackingNativeRuntime.configureTrackingOwnerV3
    ) {
      await trackingNativeRuntime.suspendTrackingOwner();
      throw new Error('tracking_native_upgrade_required');
    }
    const args = [
      ownerDigest,
      generation,
      !rules.requiresRefresh && mode !== 'paused' && sources.smsEnabled,
      !rules.requiresRefresh &&
        mode !== 'paused' &&
        sources.notificationEnabled,
      packages,
      rules.senders
        .filter(
          (s) =>
            !s.enabled && /^[a-zA-Z][\w]*(?:\.[\w]+)+$/.test(s.normalizedSender)
        )
        .map((s) => s.normalizedSender),
      rules.snapshot
        ? JSON.stringify({
            ...compileFinancialDiscoveryPolicy(rules.snapshot, rules.keywords),
            ...(rules.accountingPolicy ? { nominal: true } : {}),
            ...(rules.sourceAdmissionPolicy
              ? { sourceAdmissionPolicy: rules.sourceAdmissionPolicy }
              : {})
          })
        : null
    ] as const;
    if (rules.accountingPolicy)
      await trackingNativeRuntime.configureTrackingOwnerV3!(
        ...args,
        JSON.stringify({
          smsActivatedAt:
            rules.activation?.smsActivatedAt ??
            sources.smsActivatedAt ??
            Date.now(),
          notificationActivatedAt:
            rules.activation?.notificationActivatedAt ??
            sources.notificationActivatedAt ??
            Date.now()
        })
      );
    else await trackingNativeRuntime.configureTrackingOwner(...args);
    if (!current()) {
      await trackingNativeRuntime.suspendTrackingOwner();
      return;
    }
    // DEV bank-message intake and follow-ups use native WorkManager.
    // Visible return-reminder pushes do not require a background tracking task.
    const localOnlyDev =
      Constants.expoConfig?.android?.package === 'com.masarifi.mobile.dev' &&
      resolveClientRuntime().mode === 'live' &&
      resolveClientRuntime().apiUrl ===
        'https://api.staging.masarifiratibi.com';
    if (!localOnlyDev)
      await registerTrackingNotificationTask(
        'masarifi-tracking-confirmation-v2'
      );
  });
}
export async function disableTrackingBackground(
  preserveNotifications = false
): Promise<void> {
  const assertCurrent = preserveNotifications ? () => undefined : captureTrackingAdmission();
  nativeGeneration++;
  return serializeNative(async () => {
    assertCurrent();
    if (preserveNotifications && trackingNativeRuntime?.suspendTrackingOwner)
      await trackingNativeRuntime.suspendTrackingOwner();
    else {
      await trackingNativeRuntime?.clearTrackingOwner?.();
      assertCurrent();
      await SecureStore.deleteItemAsync(contextKey);
    }
  });
}

export async function purgeDeletedOwnerTracking(
  ownerId: string
): Promise<void> {
  const assertCurrent = captureTrackingAdmission(ownerId);
  if (Platform.OS !== 'android') return;
  const native = trackingNativeRuntime;
  if (!native?.purgeTrackingOwnerData)
    throw new Error('tracking_native_upgrade_required');
  return serializeNative(async () => {
    const raw = await SecureStore.getItemAsync(contextKey);
    const context = raw ? (JSON.parse(raw) as { ownerId?: string }) : null;
    const ownerDigest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      ownerId
    );
    assertCurrent();
    await native.purgeTrackingOwnerData!(ownerDigest);
    if (
      context?.ownerId === ownerId &&
      (await SecureStore.getItemAsync(contextKey)) === raw
    ) {
      assertCurrent();
      await SecureStore.deleteItemAsync(contextKey);
      if ((await SecureStore.getItemAsync(contextKey)) !== null)
        throw new Error('tracking owner context remains');
    }
  });
}
type RetainedTrackingContext = { ownerId: string; generation: string };

async function assessRetainedTrackingContext(
  stored: RetainedTrackingContext,
  generation: number
): Promise<void> {
  if (Platform.OS !== 'android' || !trackingNativeRuntime?.restoreTrackingOwner)
    throw new Error('tracking_restore_unavailable');
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    stored.ownerId
  );
  if (generation !== nativeGeneration)
    throw new Error('tracking_restore_unavailable');
  // The native assessment only suspends intake and compares retained metadata.
  // It never authenticates this owner, enables work or reads queue plaintext.
  const outcome = await trackingNativeRuntime.restoreTrackingOwner(
    digest, stored.generation
  );
  if (outcome !== 'PRESERVED') throw new Error('tracking_restore_unavailable');
}

async function assertRestorationCurrent(
  ownerId: string,
  raw: string | null,
  generation: number,
  admissionRevision: number
): Promise<void> {
  if (
    (await SecureStore.getItemAsync(contextKey)) !== raw ||
    generation !== nativeGeneration ||
    admissionRevision !== currentLogoutAdmissionRevision()
  )
    throw new Error('tracking_restore_unavailable');
  const currentOwner = useAppShellStore.getState().session?.userId;
  if (currentOwner && currentOwner !== ownerId)
    throw new Error('tracking_restore_unavailable');
}

export async function restoreTrackingBackground(
  ownerId: string
): Promise<void> {
  if (isBenchmarkReadOnly()) return;
  const admissionRevision = currentLogoutAdmissionRevision();
  const generation = ++nativeGeneration;
  restorationBlocked = true;
  beginTrackingAdmission();
  return serializeNative(async () => {
    try {
      const raw = await SecureStore.getItemAsync(contextKey);
      let stored: RetainedTrackingContext | null = null;
      if (raw !== null) {
        const value: unknown = JSON.parse(raw);
        if (!value || typeof value !== 'object' || Array.isArray(value))
          throw new Error();
        const candidate = value as Record<string, unknown>;
        if (
          Object.keys(candidate).sort().join(',') !== 'generation,ownerId' ||
          typeof candidate.ownerId !== 'string' ||
          candidate.ownerId.length < 1 ||
          candidate.ownerId.length > 256 ||
          typeof candidate.generation !== 'string' ||
          candidate.generation.length < 16 ||
          candidate.generation.length > 80
        )
          throw new Error();
        stored = candidate as RetainedTrackingContext;
      }
      if (generation !== nativeGeneration) throw new Error();
      // Cold SDK restoration is not an explicit account switch or sign-out.
      // A different retained owner must stay dormant without losing its data.
      if (stored && stored.ownerId !== ownerId) {
        await assessRetainedTrackingContext(stored, generation);
        await assertRestorationCurrent(
          ownerId, raw, generation, admissionRevision
        );
        isolateTrackingForOwner(ownerId);
        throw new ForeignTrackingOwnerIsolated();
      }
      if (Platform.OS === 'android') {
        if (!trackingNativeRuntime?.restoreTrackingOwner) throw new Error();
        const ownerDigest = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          ownerId
        );
        if (generation !== nativeGeneration) throw new Error();
        const outcome = await trackingNativeRuntime.restoreTrackingOwner(
          ownerDigest,
          stored?.ownerId === ownerId ? stored.generation : null
        );
        if (!['PRESERVED', 'EMPTY'].includes(outcome)) throw new Error();
      }
      await assertRestorationCurrent(
        ownerId, raw, generation, admissionRevision
      );
      admitTrackingOwner(ownerId);
      restorationBlocked = false;
    } catch (error) {
      if (error instanceof ForeignTrackingOwnerIsolated) throw error;
      // An ambiguous restoration must not fall back to destructive sign-out.
      // Keep durable notifications and make native intake dormant instead.
      await trackingNativeRuntime?.suspendTrackingOwner?.();
      throw new Error('tracking_restore_unavailable');
    }
  });
}

export async function restoreTrackingOwnerAdmission(ownerId: string): Promise<void> {
  try {
    await restoreTrackingBackground(ownerId);
  } catch (error) {
    if (!(error instanceof ForeignTrackingOwnerIsolated)) throw error;
  }
}

registerRuntimeIdentityReset(async (context) => {
  if (isBenchmarkReadOnly()) return;
  invalidateTrackingConsent();
  if (context && 'restoringOwnerId' in context)
    return restoreTrackingOwnerAdmission(context.restoringOwnerId);
  restorationBlocked = true;
  if (context?.kind === 'restore-unavailable' || context?.kind === 'signed-out-preserve') {
    if (context.kind === 'restore-unavailable') beginTrackingAdmission();
    nativeGeneration++;
    return serializeNative(async () => {
      if (Platform.OS !== 'android') return;
      if (!trackingNativeRuntime?.suspendTrackingOwner)
        throw new Error('tracking_restore_unavailable');
      await trackingNativeRuntime.suspendTrackingOwner();
    });
  }
  return disableTrackingBackground();
});
registerRuntimeUserDataReset(() => {
  if (isBenchmarkReadOnly()) return;
  invalidateTrackingConsent();
  restorationBlocked = true;
  return disableTrackingBackground();
});

export async function runTrackingBackground(input: {
  ownerDigest?: string;
  generation?: string;
}): Promise<void> {
  if (isBenchmarkReadOnly()) return;
  if (restorationBlocked) return;
  let generation = nativeGeneration;
  const current = () => !restorationBlocked && generation === nativeGeneration;
  const runtime = resolveClientRuntime();
  if (runtime.mode !== 'live') return;
  const raw = await SecureStore.getItemAsync(contextKey);
  if (!raw || !current()) return;
  const context = JSON.parse(raw) as { ownerId: string; generation: string };
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    context.ownerId
  );
  if (input.generation !== context.generation || input.ownerDigest !== digest)
    return;
  try {
    const identity = await captureLiveClerkIdentity();
    if (identity.userId !== context.ownerId) return;
  } catch {
    if (!current()) return;
    const { getClerkInstance } = await import('@clerk/expo');
    const clerk = getClerkInstance({
      publishableKey: runtime.clerkPublishableKey!,
      tokenCache: clerkSessionCache
    });
    if (!clerk.loaded) await clerk.load({ standardBrowser: false });
    if (
      clerk.session?.user?.id !== context.ownerId ||
      !(await clerk.session?.getToken({ skipCache: true }))
    )
      return;
    if (
      (await SecureStore.getItemAsync(contextKey)) !== raw ||
      !current() ||
      (useAppShellStore.getState().session?.userId &&
        useAppShellStore.getState().session?.userId !== context.ownerId)
    )
      return;
    const interactive = async (): Promise<never> => {
      throw new Error('tracking_interactive_auth_unavailable');
    };
    registerLiveClerkBridge({
      async getSession() {
        const session = clerk.session;
        if (!session || session.user.id !== context.ownerId) return null;
        return {
          id: session.id,
          userId: session.user.id,
          method: 'google',
          issuedAt: session.lastActiveAt.getTime(),
          expiresAt: session.expireAt.getTime()
        };
      },
      getToken: (options) =>
        clerk.session?.getToken(options) ?? Promise.resolve(null),
      startPhone: interactive,
      verifyPhone: interactive,
      resendPhone: interactive,
      signInWithGoogle: interactive,
      reverifyConflict: interactive,
      signOut: interactive
    });
    if (!useTrackingAdmission.getState().ready) {
      await restoreTrackingBackground(context.ownerId);
      generation = nativeGeneration;
    }
    assertTrackingAvailable(context.ownerId);
    await configureDatabaseOwner(context.ownerId);
    if ((await SecureStore.getItemAsync(contextKey)) !== raw || !current())
      return;
    useAppShellStore.setState({
      session: {
        status: 'authenticated',
        userId: context.ownerId,
        method: 'google',
        issuedAt: clerk.session.lastActiveAt.getTime(),
        expiresAt: clerk.session.expireAt.getTime(),
        restoration: 'restored'
      }
    });
  }
  if ((await SecureStore.getItemAsync(contextKey)) !== raw || !current())
    return;
  if (!useTrackingAdmission.getState().ready) {
    await restoreTrackingBackground(context.ownerId);
    generation = nativeGeneration;
  }
  if ((await SecureStore.getItemAsync(contextKey)) !== raw || !current())
    return;
  assertTrackingAvailable(context.ownerId);
  const { syncAutomaticTracking } =
    // The coordinator is bundled locally; import() can refetch it in Expo DEV.
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('./automatic-tracking-coordinator') as typeof import('./automatic-tracking-coordinator');
  if (!current()) return;
  const result = await syncAutomaticTracking();
  if (['processing', 'queued', 'error'].includes(result.status))
    throw new Error('tracking_background_retry');
}
export function registerTrackingHeadlessTask(): void {
  if (isBenchmarkReadOnly()) return;
  AppRegistry.registerHeadlessTask('MasarifiTracking', () => async (input) => {
    try {
      await runTrackingBackground(input);
      await trackingNativeRuntime?.finishTrackingWork?.(input.workId, true);
    } catch {
      await trackingNativeRuntime?.finishTrackingWork?.(input.workId, false);
    }
  });
}
