import Constants from 'expo-constants';
import { AppRegistry, Platform } from 'react-native';
import { registerTrackingNotificationTask } from './platform/tracking-notification-task';
import type { TokenCache } from '@clerk/expo';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { trackingNativeRuntime } from './platform/tracking-native-runtime.android';
import {
  resolveClientRuntime,
  isBenchmarkReadOnly
} from '@/config/client-runtime';
import { configureDatabaseOwner } from '@/storage/database';
import {
  registerRuntimeIdentityReset,
  registerRuntimeUserDataReset
} from '@/storage/runtime-user-data-reset';
import {
  captureLiveClerkIdentity,
  registerLiveClerkBridge,
  readLogoutSessionAnchor,
  registeredLiveAuthService
} from './live/auth-service';
import { useAppShellStore } from '@/state/app-shell';
import {
  currentLogoutAdmissionRevision,
  loadLogoutDisposition,
  type LogoutDisposition
} from '@/storage/app-shell-storage';
import {
  admitTrackingOwner,
  beginTrackingAdmission,
  markTrackingOwnerPartitions,
  useTrackingAdmission,
  assertTrackingAvailable,
  captureTrackingAdmission,
  isolateTrackingForOwner,
  refreshTrackingNativeLease
} from '@/state/tracking-admission';
import {
  trackingSourcePreferences,
  invalidateTrackingConsent,
  trackingConsentEpoch,
  purgeTrackingSourcePreferences
} from './tracking-source-preferences';
import type { SmsRuleSnapshot } from '@/storage/sms-import-queue';
import {
  supportsTrackingOwnerPartitions,
  prepareTrackingOwnerContext,
  commitTrackingOwnerContext,
  readTrackingOwnerContext,
  type PreparedTrackingOwnerContext
} from './tracking-owner-context';
import { compileFinancialDiscoveryPolicy } from '@masarifi/transaction-parser';
import { captureTrackingNativeLease } from './tracking-native-lease';
import { laterSmsId } from './tracking-sms-cursor';
import { hasProductionTrackingConsent } from './tracking-installation-consent';

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
let partitionNeedsReconcile = false;
let preparedPartition: {
  context: PreparedTrackingOwnerContext;
  anchor: string | null;
  assertCurrent: () => Promise<void>;
} | null = null;
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

async function configureOwnerPartition(
  ownerId: string,
  rules: SmsRuleSnapshot,
  mode: string | undefined,
  current: () => boolean
) {
  const state = useTrackingAdmission.getState();
  const assertAdmission = captureTrackingAdmission(ownerId);
  const anchor = state.sessionAnchor;
  if (!state.nativeLease || !anchor)
    throw new Error('tracking_restore_unavailable');
  const assertCurrent = async () => {
    assertAdmission();
    if (!current() || (await readLogoutSessionAnchor(ownerId)) !== anchor)
      throw new Error('tracking_restore_unavailable');
    assertAdmission();
    if (!current()) throw new Error('tracking_restore_unavailable');
  };
  await assertCurrent();
  const { sources, revision } = await trackingSourcePreferences.snapshot();
  const productionConsent = await hasProductionTrackingConsent(
    rules.installation,
    sources
  );
  await assertCurrent();
  const sourceAt = sources.smsActivatedAt ?? 0;
  const policyAt = rules.activation?.smsActivatedAt ?? 0;
  const sourceId = sources.smsActivationId ?? '0';
  const policyId = rules.activation?.smsActivationId ?? '0';
  const configuration = {
    sms:
      productionConsent &&
      !rules.requiresRefresh &&
      mode !== 'paused' &&
      sources.smsEnabled,
    notification:
      productionConsent &&
      !rules.requiresRefresh &&
      mode !== 'paused' &&
      sources.notificationEnabled,
    smsActivatedAt: Math.max(
      sources.smsActivatedAt ?? 0,
      rules.activation?.smsActivatedAt ?? 0
    ),
    smsActivationId:
      policyAt > sourceAt
        ? policyId
        : policyAt === sourceAt
          ? laterSmsId(policyId, sourceId)
          : sourceId,
    notificationActivatedAt: Math.max(
      sources.notificationActivatedAt ?? 0,
      rules.activation?.notificationActivatedAt ?? 0
    ),
    packages: rules.senders
      .filter(
        (s) =>
          s.enabled &&
          s.trusted &&
          /^[a-zA-Z][\w]*(?:\.[\w]+)+$/.test(s.normalizedSender)
      )
      .map((s) => s.normalizedSender),
    blockedPackages: rules.senders
      .filter(
        (s) =>
          !s.enabled && /^[a-zA-Z][\w]*(?:\.[\w]+)+$/.test(s.normalizedSender)
      )
      .map((s) => s.normalizedSender),
    discoveryPolicy: rules.snapshot
      ? JSON.stringify({
          ...compileFinancialDiscoveryPolicy(rules.snapshot, rules.keywords),
          ...(rules.accountingPolicy ? { nominal: true } : {}),
          ...(rules.sourceAdmissionPolicy
            ? { sourceAdmissionPolicy: rules.sourceAdmissionPolicy }
            : {})
        })
      : null
  };
  if (useAppShellStore.getState().logoutQuiescingOwnerId === ownerId) {
    configuration.sms = false;
    configuration.notification = false;
  }
  const configurationKey = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    JSON.stringify({
      revision,
      configuration,
      serverRevision: rules.configurationRevision ?? null,
      serverConsent: rules.installation
        ? {
            generation: rules.installation.generation,
            version: rules.installation.version
          }
        : null
    })
  );
  let saved = await readTrackingOwnerContext(ownerId);
  await assertCurrent();
  if (!saved) throw new Error('tracking_restore_unavailable');
  let lease = state.nativeLease;
  if (saved.phase !== 'committed' || saved.generation !== lease.generation) {
    if (
      !partitionNeedsReconcile ||
      (saved.generation !== lease.generation &&
        saved.previousGeneration !== lease.generation)
    )
      throw new Error('tracking_restore_unavailable');
    // Finish the durable disabled intent before creating a successor for newer consent.
    const intent = await prepareTrackingOwnerContext(ownerId, assertCurrent);
    lease = await commitTrackingOwnerContext(intent, assertCurrent);
    refreshTrackingNativeLease(ownerId, lease, anchor);
    saved = await readTrackingOwnerContext(ownerId);
    await assertCurrent();
    if (
      !saved ||
      saved.phase !== 'committed' ||
      saved.generation !== lease.generation
    )
      throw new Error('tracking_restore_unavailable');
    partitionNeedsReconcile = false;
  }
  if (partitionNeedsReconcile || saved.configurationKey !== configurationKey) {
    const prepared = await prepareTrackingOwnerContext(
      ownerId,
      assertCurrent,
      configurationKey
    );
    lease = await commitTrackingOwnerContext(prepared, assertCurrent);
    await assertCurrent();
    refreshTrackingNativeLease(ownerId, lease, anchor);
    partitionNeedsReconcile = false;
  }
  if (!trackingNativeRuntime?.configureTrackingOwnerV4)
    throw new Error('tracking_native_upgrade_required');
  await assertCurrent();
  await trackingNativeRuntime.configureTrackingOwnerV4(
    JSON.stringify({ ...lease, configuration })
  );
  await assertCurrent();
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
    if (supportsTrackingOwnerPartitions()) {
      const scope = await captureTrackingNativeLease(ownerId);
      if (!scope.lease || !current()) return;
      await native.scheduleTrackingFollowUp!(
        scope.lease.ownerDigest,
        scope.lease.generation
      );
      await scope.assertCurrent();
      return;
    }
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
    if (Platform.OS === 'android' && supportsTrackingOwnerPartitions()) {
      try {
        await configureOwnerPartition(ownerId, rules, mode, current);
        if (current())
          await registerTrackingNotificationTask(
            'masarifi-tracking-confirmation-v2'
          );
      } catch (error) {
        partitionNeedsReconcile = true;
        await trackingNativeRuntime!.suspendTrackingOwner();
        throw error;
      }
      return;
    }
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
  const state = useTrackingAdmission.getState();
  const assertCurrent =
    preserveNotifications && !state.ready
      ? () => undefined
      : captureTrackingAdmission();
  nativeGeneration++;
  const generation = nativeGeneration;
  return serializeNative(async () => {
    assertCurrent();
    if (Platform.OS === 'android' && supportsTrackingOwnerPartitions()) {
      const lease = state.nativeLease;
      if (!lease || !state.admittedOwnerId) {
        if (!preserveNotifications)
          throw new Error('tracking_restore_unavailable');
        await trackingNativeRuntime!.suspendTrackingOwner();
        return;
      }
      if (preserveNotifications) {
        if (!trackingNativeRuntime!.configureTrackingOwnerV4)
          throw new Error('tracking_native_upgrade_required');
        try {
          await trackingNativeRuntime!.configureTrackingOwnerV4(
            JSON.stringify({
              ...lease,
              configuration: { sms: false, notification: false }
            })
          );
        } catch {
          // An overtaken preparation can invalidate the old lease. Suspension only revokes;
          // it does not acknowledge that preparation or grant access to any partition.
          await trackingNativeRuntime!.suspendTrackingOwner();
          partitionNeedsReconcile = true;
        }
      } else {
        if (!trackingNativeRuntime!.clearTrackingOwnerV4)
          throw new Error('tracking_native_upgrade_required');
        await trackingNativeRuntime!.clearTrackingOwnerV4(
          lease.ownerDigest,
          lease.generation
        );
        const ownerId = state.admittedOwnerId;
        const anchor = state.sessionAnchor;
        // Explicit local clearing keeps the verified account usable with capture off.
        // A signed-out/uncertain identity stays suspended for pinned cleanup instead.
        if (
          anchor &&
          useAppShellStore.getState().session?.userId === ownerId &&
          useAppShellStore.getState().profileSetupStatus === 'complete'
        ) {
          const assertIdentity = async () => {
            assertCurrent();
            if (
              generation !== nativeGeneration ||
              (await readLogoutSessionAnchor(ownerId)) !== anchor
            )
              throw new Error('tracking_restore_unavailable');
            assertCurrent();
          };
          const prepared = await prepareTrackingOwnerContext(
            ownerId,
            assertIdentity
          );
          const restored = await commitTrackingOwnerContext(
            prepared,
            assertIdentity
          );
          refreshTrackingNativeLease(ownerId, restored, anchor);
          restorationBlocked = false;
          partitionNeedsReconcile = false;
        }
      }
      assertCurrent();
      return;
    }
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
  ownerId: string,
  recovery?: { assertCurrent(): void; assertOwner(): Promise<void> }
): Promise<void> {
  const assertCurrent =
    recovery?.assertCurrent ?? captureTrackingAdmission(ownerId);
  if (Platform.OS !== 'android') return;
  const native = trackingNativeRuntime;
  if (supportsTrackingOwnerPartitions()) {
    const state = useTrackingAdmission.getState();
    const context = recovery ? await readTrackingOwnerContext(ownerId) : null;
    assertCurrent();
    const ownerDigest = recovery
      ? await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          ownerId
        )
      : state.nativeLease?.ownerDigest;
    assertCurrent();
    const lease = recovery
      ? { ownerDigest, generation: context?.generation ?? null }
      : state.nativeLease;
    if (
      !lease?.ownerDigest ||
      (!recovery &&
        (state.admittedOwnerId !== ownerId ||
          !native?.purgeTrackingOwnerDataV4)) ||
      (recovery && !native?.resumeTrackingOwnerPurgeV4)
    )
      throw new Error('tracking_restore_unavailable');
    nativeGeneration++;
    return purgeTrackingSourcePreferences(
      ownerId,
      lease.ownerDigest,
      assertCurrent,
      (clearSources) =>
        serializeNative(async () => {
          assertCurrent();
          const context = await readTrackingOwnerContext(ownerId);
          if (context && context.generation !== lease.generation)
            throw new Error('tracking_restore_unavailable');
          assertCurrent();
          if (recovery) {
            await recovery.assertOwner();
            await native!.resumeTrackingOwnerPurgeV4!(
              lease.ownerDigest!,
              lease.generation
            );
            await recovery.assertOwner();
          } else
            await native!.purgeTrackingOwnerDataV4!(
              lease.ownerDigest!,
              lease.generation!
            );
          assertCurrent();
          await clearSources();
          if (context) {
            if ((await SecureStore.getItemAsync(context.key)) !== context.raw)
              throw new Error('tracking_restore_unavailable');
            assertCurrent();
            await SecureStore.deleteItemAsync(context.key);
          }
          assertCurrent();
        })
    );
  }
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
    digest,
    stored.generation
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
  ownerId: string,
  cleanup?: LogoutDisposition
): Promise<void> {
  if (isBenchmarkReadOnly()) return;
  const admissionRevision = currentLogoutAdmissionRevision();
  const generation = ++nativeGeneration;
  restorationBlocked = true;
  preparedPartition = null;
  beginTrackingAdmission();
  return serializeNative(async () => {
    try {
      if (Platform.OS === 'android' && supportsTrackingOwnerPartitions()) {
        markTrackingOwnerPartitions();
        const anchor = await readLogoutSessionAnchor(ownerId);
        if (!anchor && !cleanup)
          throw new Error('tracking_restore_unavailable');
        const assertCurrent = async () => {
          if (
            generation !== nativeGeneration ||
            admissionRevision !== currentLogoutAdmissionRevision()
          )
            throw new Error('tracking_restore_unavailable');
          const currentOwner = useAppShellStore.getState().session?.userId;
          if (
            (currentOwner && currentOwner !== ownerId) ||
            (await readLogoutSessionAnchor(ownerId)) !== anchor
          )
            throw new Error('tracking_restore_unavailable');
          if (
            cleanup &&
            (cleanup.ownerId !== ownerId ||
              (anchor !== null && anchor !== cleanup.sessionId) ||
              JSON.stringify(await loadLogoutDisposition(ownerId)) !==
                JSON.stringify(cleanup))
          )
            throw new Error('tracking_restore_unavailable');
          if (
            generation !== nativeGeneration ||
            admissionRevision !== currentLogoutAdmissionRevision()
          )
            throw new Error('tracking_restore_unavailable');
        };
        const context = await prepareTrackingOwnerContext(
          ownerId,
          assertCurrent
        );
        preparedPartition = { context, anchor, assertCurrent };
        return;
      }
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
          ownerId,
          raw,
          generation,
          admissionRevision
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
        ownerId,
        raw,
        generation,
        admissionRevision
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

export async function commitTrackingOwnerAdmission(
  ownerId: string,
  isCurrent: () => boolean = () => true
): Promise<void> {
  if (Platform.OS !== 'android' || !supportsTrackingOwnerPartitions()) return;
  const admitted = useTrackingAdmission.getState();
  if (
    admitted.ready &&
    admitted.admittedOwnerId === ownerId &&
    admitted.nativeLease &&
    admitted.sessionAnchor === (await readLogoutSessionAnchor(ownerId))
  )
    return;
  const prepared = preparedPartition;
  if (!prepared || prepared.context.ownerId !== ownerId)
    throw new Error('tracking_restore_unavailable');
  return serializeNative(async () => {
    const assertCurrent = async () => {
      await prepared.assertCurrent();
      if (preparedPartition !== prepared || !isCurrent())
        throw new Error('tracking_restore_unavailable');
    };
    try {
      const lease = await commitTrackingOwnerContext(
        prepared.context,
        assertCurrent
      );
      if (preparedPartition !== prepared || !isCurrent())
        throw new Error('tracking_restore_unavailable');
      admitTrackingOwner(ownerId, lease, prepared.anchor);
      restorationBlocked = false;
    } catch (error) {
      await trackingNativeRuntime!.suspendTrackingOwner();
      throw error;
    }
  });
}

export async function restoreTrackingOwnerAdmission(
  ownerId: string
): Promise<void> {
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
  if (
    context?.kind === 'restore-unavailable' ||
    context?.kind === 'signed-out-preserve'
  ) {
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

async function ensureHeadlessIdentity() {
  try {
    return await captureLiveClerkIdentity();
  } catch {
    const runtime = resolveClientRuntime();
    const { getClerkInstance } = await import('@clerk/expo');
    const clerk = getClerkInstance({
      publishableKey: runtime.clerkPublishableKey!,
      tokenCache: clerkSessionCache
    });
    if (!clerk.loaded) await clerk.load({ standardBrowser: false });
    const ownerId = clerk.session?.user.id;
    const sessionId = clerk.session?.id;
    if (
      !ownerId ||
      !sessionId ||
      !(await clerk.session?.getToken({ skipCache: true })) ||
      clerk.session?.id !== sessionId ||
      clerk.session.user.id !== ownerId
    )
      throw new Error('tracking_restore_unavailable');
    const shellOwner = useAppShellStore.getState().session?.userId;
    if (shellOwner && shellOwner !== ownerId)
      throw new Error('tracking_restore_unavailable');
    const interactive = async (): Promise<never> => {
      throw new Error('tracking_interactive_auth_unavailable');
    };
    registerLiveClerkBridge({
      async getSession() {
        const session = clerk.session;
        return session
          ? {
              id: session.id,
              userId: session.user.id,
              method: 'google',
              issuedAt: session.lastActiveAt.getTime(),
              expiresAt: session.expireAt.getTime()
            }
          : null;
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
    return captureLiveClerkIdentity();
  }
}

export async function currentTrackingBackgroundWork() {
  const identity = await ensureHeadlessIdentity();
  const context = await readTrackingOwnerContext(identity.userId);
  await identity.assertCurrent();
  if (!context || context.phase !== 'committed') return null;
  return {
    ownerId: identity.userId,
    ownerDigest: context.ownerDigest,
    generation: context.generation
  };
}

async function runPartitionBackground(input: {
  ownerDigest?: string;
  generation?: string;
}) {
  const identity = await ensureHeadlessIdentity();
  const context = await readTrackingOwnerContext(identity.userId);
  await identity.assertCurrent();
  if (
    !context ||
    context.phase !== 'committed' ||
    context.ownerDigest !== input.ownerDigest ||
    context.generation !== input.generation
  )
    return;
  const admitted = useTrackingAdmission.getState();
  if (
    !admitted.ready ||
    admitted.admittedOwnerId !== identity.userId ||
    admitted.nativeLease?.generation !== context.generation ||
    admitted.sessionAnchor !== (await readLogoutSessionAnchor(identity.userId))
  ) {
    const logoutRevision = currentLogoutAdmissionRevision();
    const auth = registeredLiveAuthService();
    if (!auth) throw new Error('tracking_restore_unavailable');
    const { restoreAppShellSession } =
      // Bundled locally; Expo DEV must not fetch a second controller module.
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      require('@/features/auth/session-controller') as typeof import('@/features/auth/session-controller');
    await restoreAppShellSession(
      auth,
      () =>
        logoutRevision === currentLogoutAdmissionRevision() &&
        (!useAppShellStore.getState().session?.userId ||
          useAppShellStore.getState().session?.userId === identity.userId)
    );
  }
  const scope = await captureTrackingNativeLease(identity.userId);
  if (
    scope.lease?.generation !== context.generation ||
    scope.lease.ownerDigest !== context.ownerDigest
  )
    return;
  await identity.assertCurrent();
  const { syncAutomaticTracking } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    require('./automatic-tracking-coordinator') as typeof import('./automatic-tracking-coordinator');
  const result = await syncAutomaticTracking();
  // The coordinator may intentionally rotate consent; identity remains pinned independently.
  await identity.assertCurrent();
  if (['processing', 'queued', 'error'].includes(result.status))
    throw new Error('tracking_background_retry');
}

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
  if (Platform.OS === 'android' && supportsTrackingOwnerPartitions())
    return runPartitionBackground(input);
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
