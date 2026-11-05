import type { TrackingSourceState } from './tracking-source-preferences';
import { z } from 'zod';
import {
  randomUUID,
  digestStringAsync,
  CryptoDigestAlgorithm
} from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  captureTrackingAdmission,
  useTrackingAdmission
} from '@/state/tracking-admission';
import {
  captureLiveClerkIdentity,
  readLogoutSessionAnchor
} from './live/auth-service';
import { getDeviceRegistration } from './platform/phone-notification-service';
import { getTrackingDeviceId } from './tracking-device';
import { HttpError, requestJson } from './live/http-client';
import { Platform } from 'react-native';
import { isFixtureModeEnabled } from '@/config/demo-mode';
import { resolveClientRuntime } from '@/config/client-runtime';
import { isMobileAutomationEnabled } from '@/config/mobile-automation';
import { canonicalJson } from '@masarifi/transaction-parser';
import {
  trackingInstallationReceiptSchema,
  trackingInstallationSourcesSchema,
  type TrackingInstallationReceipt,
  type TrackingInstallationSources
} from '@/storage/tracking-installation-contract';

export interface TrackingConsentScope {
  ownerId: string;
  ownerDigest: string;
  deviceId: string;
  sessionBinding: string;
  assertCurrent(): Promise<void>;
}
export interface TrackingConsentPorts {
  storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
  };
  scope(): Promise<TrackingConsentScope>;
  registerDevice(scope: TrackingConsentScope): Promise<{
    deviceFingerprint: string;
    platform: 'android';
    appVersion: string;
  }>;
  readConfiguration(scope: TrackingConsentScope): Promise<unknown>;
  putConsent(scope: TrackingConsentScope, body: unknown): Promise<unknown>;
}
export interface AppliedTrackingConsent {
  commandId: string;
  sources: TrackingSourceState;
}
export function createLiveTrackingConsentPorts(
  options: {
    storage?: TrackingConsentPorts['storage'];
    request?: typeof fetch;
    baseUrl?: string;
  } = {}
): TrackingConsentPorts {
  const send = async (
    scope: TrackingConsentScope,
    method: string,
    path: string,
    body?: unknown
  ) => {
    await scope.assertCurrent();
    const identity = await captureLiveClerkIdentity();
    if (identity.userId !== scope.ownerId)
      throw new Error('tracking_consent_session_changed');
    await scope.assertCurrent();
    const value = await requestJson(path, z.unknown(), {
      method,
      body,
      token: identity.token,
      request: options.request,
      baseUrl: options.baseUrl,
      ...(method === 'POST'
        ? {
            headers: {
              'Idempotency-Key': `tracking-consent-device:${randomUUID()}`
            }
          }
        : {})
    });
    await scope.assertCurrent();
    return value;
  };
  const configuration = async (
    scope: TrackingConsentScope,
    method: string,
    path: string,
    body?: unknown
  ) => {
    const value = await send(scope, method, path, body);
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new HttpError('contract_mismatch', 502);
    const { configurationHash, ...content } = value as Record<string, unknown>;
    if (
      typeof configurationHash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(configurationHash) ||
      (await digestStringAsync(
        CryptoDigestAlgorithm.SHA256,
        canonicalJson(content)
      )) !== configurationHash
    )
      throw new HttpError('contract_mismatch', 502);
    await scope.assertCurrent();
    return content;
  };
  return {
    storage: options.storage ?? AsyncStorage,
    async scope() {
      const admission = useTrackingAdmission.getState();
      const assertAdmission = captureTrackingAdmission();
      const ownerId = admission.admittedOwnerId;
      const anchor = admission.sessionAnchor;
      if (!ownerId || !anchor)
        throw new Error('tracking_consent_session_changed');
      const ownerDigest = await digestStringAsync(
        CryptoDigestAlgorithm.SHA256,
        ownerId
      );
      if (
        !anchor ||
        admission.admittedOwnerId !== ownerId ||
        admission.nativeLease?.ownerDigest !== ownerDigest
      )
        throw new Error('tracking_consent_session_changed');
      const assertCurrent = async () => {
        assertAdmission();
        if ((await readLogoutSessionAnchor(ownerId)) !== anchor)
          throw new Error('tracking_consent_session_changed');
        assertAdmission();
      };
      await assertCurrent();
      const deviceId = await getTrackingDeviceId();
      const sessionBinding = await digestStringAsync(
        CryptoDigestAlgorithm.SHA256,
        `masarifi:tracking:session:v1:${ownerId}:${anchor}`
      );
      await assertCurrent();
      const scope = {
        ownerId,
        ownerDigest,
        deviceId,
        sessionBinding,
        assertCurrent
      };
      return scope;
    },
    async registerDevice(scope) {
      const registration = await getDeviceRegistration();
      if (!registration || registration.platform !== 'android')
        throw new HttpError('provider_unavailable', 503);
      const input = registrationSchema.parse(registration);
      const value = await send(
        scope,
        'POST',
        '/api/v1/me/devices/register',
        input
      );
      z.object({
        deviceId: z.string().uuid(),
        registeredAt: z.string().datetime({ offset: true }),
        version: z.number().int().positive()
      })
        .strict()
        .parse(value);
      return input;
    },
    readConfiguration: (scope) =>
      configuration(
        scope,
        'GET',
        `/api/v1/tracking/rule-snapshot?deviceId=${encodeURIComponent(scope.deviceId)}`
      ),
    putConsent: (scope, body) =>
      configuration(
        scope,
        'PUT',
        `/api/v1/tracking/installations/${encodeURIComponent(scope.deviceId)}`,
        body
      )
  };
}

const registrationSchema = z
  .object({
    deviceFingerprint: z.string().min(16).max(512),
    platform: z.literal('android'),
    appVersion: z.string().min(1).max(32)
  })
  .strict();
const bodySchema = z
  .object({
    expectedVersion: z.number().int().min(0).max(2147483646),
    deviceRegistration: registrationSchema,
    sources: trackingInstallationSourcesSchema
  })
  .strict();
const preparedCommandSchema = z
  .object({
    id: z.string().uuid(),
    sessionBinding: z.string().regex(/^[a-f0-9]{64}$/),
    body: bodySchema,
    receipt: trackingInstallationReceiptSchema.optional()
  })
  .strict();
const preparingCommandSchema = z
  .object({
    id: z.string().uuid(),
    sessionBinding: z.string().regex(/^[a-f0-9]{64}$/),
    preparing: z.literal(true),
    sources: trackingInstallationSourcesSchema
  })
  .strict();
// Existing v1 prepared commands remain readable, including ambiguous PUT receipts.
const pendingSchema = z.union([preparedCommandSchema, preparingCommandSchema]);
const journalSchema = z
  .object({
    version: z.literal(1),
    ownerId: z.string().min(1),
    receipt: trackingInstallationReceiptSchema.optional(),
    pending: pendingSchema.optional(),
    superseded: z.array(pendingSchema)
  })
  .strict();
type Journal = z.infer<typeof journalSchema>;
type Pending = z.infer<typeof pendingSchema>;

function serverSources(
  sources: TrackingSourceState
): TrackingInstallationSources {
  return trackingInstallationSourcesSchema.parse({
    smsEnabled: sources.smsEnabled,
    notificationEnabled: sources.notificationEnabled,
    smsActivatedAt:
      sources.smsEnabled && sources.smsActivatedAt !== undefined
        ? new Date(sources.smsActivatedAt).toISOString()
        : null,
    smsActivationId: sources.smsEnabled
      ? (sources.smsActivationId ?? null)
      : null,
    notificationActivatedAt:
      sources.notificationEnabled &&
      sources.notificationActivatedAt !== undefined
        ? new Date(sources.notificationActivatedAt).toISOString()
        : null
  });
}
function localSources(
  receipt: TrackingInstallationReceipt,
  previous: TrackingSourceState = {
    smsEnabled: false,
    notificationEnabled: false
  }
): TrackingSourceState {
  return {
    smsEnabled: receipt.sources.smsEnabled,
    notificationEnabled: receipt.sources.notificationEnabled,
    ...(receipt.sources.smsActivatedAt
      ? {
          smsActivatedAt: Date.parse(receipt.sources.smsActivatedAt),
          smsActivationId: receipt.sources.smsActivationId ?? undefined
        }
      : {}),
    ...(receipt.sources.notificationActivatedAt
      ? {
          notificationActivatedAt: Date.parse(
            receipt.sources.notificationActivatedAt
          )
        }
      : {}),
    ...(previous.notificationAccountId
      ? { notificationAccountId: previous.notificationAccountId }
      : {})
  };
}
function receivedReceipt(value: unknown): TrackingInstallationReceipt {
  if (
    !value ||
    typeof value !== 'object' ||
    !('installation' in value) ||
    !('configurationAvailable' in value) ||
    typeof value.configurationAvailable !== 'boolean'
  )
    throw new Error('tracking_consent_response_invalid');
  const parsed = trackingInstallationReceiptSchema.safeParse(
    value.installation
  );
  if (
    !parsed.success ||
    (parsed.data.captureAllowed && !value.configurationAvailable)
  )
    throw new Error('tracking_consent_response_invalid');
  return parsed.data;
}

function consentStorageKey(ownerDigest: string): string {
  if (!/^[a-f0-9]{64}$/.test(ownerDigest))
    throw new Error('tracking_consent_storage_invalid');
  return `masarifi.tracking.installation-consent.v1.${ownerDigest}`;
}

/** Only a pinned owner cleanup supplies the guard; SDK sign-out may already be complete. */
export async function prepareTrackingInstallationConsentPurge(
  ownerId: string,
  ownerDigest: string,
  assertCurrent: () => void
): Promise<() => Promise<void>> {
  assertCurrent();
  const key = consentStorageKey(ownerDigest);
  const raw = await AsyncStorage.getItem(key);
  assertCurrent();
  if (raw !== null) {
    try {
      if (journalSchema.parse(JSON.parse(raw)).ownerId !== ownerId)
        throw new Error();
    } catch {
      throw new Error('tracking_consent_storage_invalid');
    }
  }
  return async () => {
    assertCurrent();
    const current = await AsyncStorage.getItem(key);
    assertCurrent();
    if (current !== raw) throw new Error('tracking_consent_storage_invalid');
    if (raw !== null) await AsyncStorage.removeItem(key);
    assertCurrent();
  };
}

export class TrackingInstallationConsentJournal {
  constructor(private readonly ports: TrackingConsentPorts) {}
  async effectiveSources(
    sources: TrackingSourceState
  ): Promise<TrackingSourceState> {
    const scope = await this.ports.scope();
    const journal = await this.read(scope);
    return !journal.pending &&
      journal.receipt?.captureAllowed &&
      journal.receipt.deviceId === scope.deviceId &&
      journal.receipt.sessionBinding === scope.sessionBinding
      ? sources
      : { ...sources, smsEnabled: false, notificationEnabled: false };
  }
  async hasPending(): Promise<boolean> {
    const scope = await this.ports.scope();
    return Boolean((await this.read(scope)).pending);
  }

  private key(scope: TrackingConsentScope) {
    if (
      !/^[a-f0-9]{64}$/.test(scope.ownerDigest) ||
      !/^[a-f0-9]{64}$/.test(scope.sessionBinding)
    )
      throw new Error('tracking_consent_storage_invalid');
    return consentStorageKey(scope.ownerDigest);
  }
  private async read(scope: TrackingConsentScope): Promise<Journal> {
    await scope.assertCurrent();
    const raw = await this.ports.storage.getItem(this.key(scope));
    await scope.assertCurrent();
    if (raw === null)
      return { version: 1, ownerId: scope.ownerId, superseded: [] };
    try {
      const parsed = journalSchema.parse(JSON.parse(raw));
      if (parsed.ownerId !== scope.ownerId) throw new Error();
      return parsed;
    } catch {
      throw new Error('tracking_consent_storage_invalid');
    }
  }
  private async write(scope: TrackingConsentScope, journal: Journal) {
    await scope.assertCurrent();
    await this.ports.storage.setItem(
      this.key(scope),
      JSON.stringify(journalSchema.parse(journal))
    );
    await scope.assertCurrent();
  }
  private async send(
    scope: TrackingConsentScope,
    journal: Journal,
    pending: Pending
  ): Promise<AppliedTrackingConsent> {
    if (pending.sessionBinding !== scope.sessionBinding)
      throw new Error('tracking_consent_session_changed');
    await scope.assertCurrent();
    if ('preparing' in pending) {
      // Registration can invalidate a previous binding and advance its version.
      const deviceRegistration = registrationSchema.parse(
        await this.ports.registerDevice(scope)
      );
      await scope.assertCurrent();
      const configuration = await this.ports.readConfiguration(scope);
      await scope.assertCurrent();
      const previous =
        configuration &&
        typeof configuration === 'object' &&
        'installation' in configuration
          ? receivedReceipt(configuration)
          : null;
      if (previous && previous.deviceId !== scope.deviceId)
        throw new Error('tracking_consent_response_invalid');
      const prepared = {
        id: pending.id,
        sessionBinding: pending.sessionBinding,
        body: {
          expectedVersion: previous?.version ?? 0,
          deviceRegistration,
          sources: pending.sources
        }
      };
      const next = { ...journal, pending: prepared };
      await this.write(scope, next);
      return this.send(scope, next, prepared);
    }
    const receipt =
      pending.receipt ??
      receivedReceipt(await this.ports.putConsent(scope, pending.body));
    await scope.assertCurrent();
    const requested = pending.body.sources;
    if (
      receipt.deviceId !== scope.deviceId ||
      receipt.version !== pending.body.expectedVersion + 1 ||
      receipt.sessionBinding !== scope.sessionBinding ||
      receipt.sources.smsEnabled !== requested.smsEnabled ||
      receipt.sources.notificationEnabled !== requested.notificationEnabled ||
      ((requested.smsEnabled || requested.notificationEnabled) &&
        !receipt.captureAllowed) ||
      (requested.smsEnabled &&
        BigInt(receipt.sources.smsActivationId ?? '0') <
          BigInt(requested.smsActivationId ?? '0')) ||
      (requested.smsEnabled &&
        Date.parse(receipt.sources.smsActivatedAt ?? '') <
          Date.parse(requested.smsActivatedAt ?? '')) ||
      (requested.notificationEnabled &&
        Date.parse(receipt.sources.notificationActivatedAt ?? '') <
          Date.parse(requested.notificationActivatedAt ?? ''))
    )
      throw new Error('tracking_consent_response_invalid');
    if (!pending.receipt)
      await this.write(scope, { ...journal, pending: { ...pending, receipt } });
    return { commandId: pending.id, sources: localSources(receipt) };
  }
  private async prepareIntent(sources: TrackingSourceState) {
    const scope = await this.ports.scope();
    const journal = await this.read(scope);
    const desired = serverSources(sources);
    if (
      journal.pending?.sessionBinding === scope.sessionBinding &&
      canonicalJson(
        'preparing' in journal.pending
          ? journal.pending.sources
          : journal.pending.body.sources
      ) === canonicalJson(desired)
    ) {
      return { scope, journal, pending: journal.pending };
    }
    // The newest explicit intent must fence older commands even when the very
    // first network operation fails. Retain superseded bytes as evidence.
    const pending: Pending = {
      id: randomUUID(),
      sessionBinding: scope.sessionBinding,
      preparing: true,
      sources: desired
    };
    const next: Journal = {
      ...journal,
      pending,
      superseded: [
        ...journal.superseded,
        ...(journal.pending ? [journal.pending] : [])
      ]
    };
    await this.write(scope, next);
    return { scope, journal: next, pending };
  }
  async stage(sources: TrackingSourceState): Promise<void> {
    await this.prepareIntent(sources);
  }
  async apply(sources: TrackingSourceState): Promise<AppliedTrackingConsent> {
    const { scope, journal, pending } = await this.prepareIntent(sources);
    const applied = await this.send(scope, journal, pending);
    return {
      ...applied,
      sources: {
        ...applied.sources,
        ...(sources.notificationAccountId
          ? { notificationAccountId: sources.notificationAccountId }
          : {})
      }
    };
  }
  async retry(): Promise<AppliedTrackingConsent | null> {
    const scope = await this.ports.scope();
    const journal = await this.read(scope);
    return journal.pending ? this.send(scope, journal, journal.pending) : null;
  }
  async acknowledge(commandId: string): Promise<void> {
    const scope = await this.ports.scope();
    const journal = await this.read(scope);
    if (
      journal.pending?.id !== commandId ||
      !('body' in journal.pending) ||
      !journal.pending.receipt
    )
      throw new Error('tracking_consent_response_invalid');
    if (journal.pending.sessionBinding !== scope.sessionBinding)
      throw new Error('tracking_consent_session_changed');
    const { pending, ...retained } = journal;
    await this.write(scope, { ...retained, receipt: pending.receipt });
  }
  async permits(
    value: unknown,
    sources: TrackingSourceState
  ): Promise<boolean> {
    const scope = await this.ports.scope();
    const journal = await this.read(scope);
    const candidate = trackingInstallationReceiptSchema.safeParse(value);
    if (!candidate.success || journal.pending || !journal.receipt) return false;
    const receipt = candidate.data;
    if (
      !receipt.captureAllowed ||
      receipt.deviceId !== scope.deviceId ||
      receipt.sessionBinding !== scope.sessionBinding ||
      canonicalJson(journal.receipt) !== canonicalJson(receipt)
    )
      return false;
    return (
      sources.smsEnabled === receipt.sources.smsEnabled &&
      sources.notificationEnabled === receipt.sources.notificationEnabled &&
      (!sources.smsEnabled ||
        (sources.smsActivatedAt !== undefined &&
          sources.smsActivatedAt >=
            Date.parse(receipt.sources.smsActivatedAt ?? '') &&
          sources.smsActivationId !== undefined &&
          BigInt(sources.smsActivationId) >=
            BigInt(receipt.sources.smsActivationId ?? '0'))) &&
      (!sources.notificationEnabled ||
        (sources.notificationActivatedAt !== undefined &&
          sources.notificationActivatedAt >=
            Date.parse(receipt.sources.notificationActivatedAt ?? '')))
    );
  }
}

export interface TrackingSourceConsentPort {
  stage?(sources: TrackingSourceState): Promise<void>;
  apply(sources: TrackingSourceState): Promise<AppliedTrackingConsent | null>;
  retry(): Promise<AppliedTrackingConsent | null>;
  acknowledge(commandId: string): Promise<void>;
  hasPending?(): Promise<boolean>;
  effectiveSources?(sources: TrackingSourceState): Promise<TrackingSourceState>;
}
const liveJournal = new TrackingInstallationConsentJournal(
  createLiveTrackingConsentPorts()
);
export function productionTrackingConsentRequired(): boolean {
  return (
    Platform.OS === 'android' &&
    !isFixtureModeEnabled() &&
    resolveClientRuntime().mode === 'live' &&
    !isMobileAutomationEnabled()
  );
}
export const productionTrackingConsent: TrackingSourceConsentPort = {
  stage: (sources) =>
    productionTrackingConsentRequired()
      ? liveJournal.stage(sources)
      : Promise.resolve(),
  apply: (sources) =>
    productionTrackingConsentRequired()
      ? liveJournal.apply(sources)
      : Promise.resolve(null),
  retry: () =>
    productionTrackingConsentRequired()
      ? liveJournal.retry()
      : Promise.resolve(null),
  acknowledge: (commandId) =>
    productionTrackingConsentRequired()
      ? liveJournal.acknowledge(commandId)
      : Promise.resolve(),
  hasPending: () =>
    productionTrackingConsentRequired()
      ? liveJournal.hasPending()
      : Promise.resolve(false),
  effectiveSources: (sources) =>
    productionTrackingConsentRequired()
      ? liveJournal.effectiveSources(sources)
      : Promise.resolve(sources)
};
export function hasProductionTrackingConsent(
  receipt: unknown,
  sources: TrackingSourceState
): Promise<boolean> {
  return productionTrackingConsentRequired()
    ? liveJournal.permits(receipt, sources)
    : Promise.resolve(true);
}
