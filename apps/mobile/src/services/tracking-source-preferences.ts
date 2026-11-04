import AsyncStorage from '@react-native-async-storage/async-storage';
import { MasarifiSmsInbox } from '../../modules/masarifi-sms-inbox';
import { z } from 'zod';

import { registerRuntimeUserDataReset } from '@/storage/runtime-user-data-reset';
import { disableTrackingBackground } from './tracking-background-runtime';

import {
  assertTrackingAvailable,
  captureTrackingAdmission,
  useTrackingAdmission
} from '@/state/tracking-admission';
import { readLogoutSessionAnchor } from './live/auth-service';
import {
  productionTrackingConsent,
  type TrackingSourceConsentPort
} from './tracking-installation-consent';

const storageKey = 'masarifi.tracking.sources.v1';
let consentEpoch = 0;
let sourceMutation: Promise<unknown> = Promise.resolve();
function serializeSources<T>(action: () => Promise<T>): Promise<T> {
  const operation = sourceMutation.then(action, action);
  sourceMutation = operation.catch(() => undefined);
  return operation;
}
export const trackingConsentEpoch = () => consentEpoch;
export const invalidateTrackingConsent = () => {
  consentEpoch++;
};

export interface TrackingSourceState {
  smsEnabled: boolean;
  notificationEnabled: boolean;
  smsActivatedAt?: number;
  notificationActivatedAt?: number;
  smsActivationId?: string;
  notificationAccountId?: string;
}

interface StorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const disabled: TrackingSourceState = {
  smsEnabled: false,
  notificationEnabled: false
};

const sourcesSchema = z
  .object({
    smsEnabled: z.boolean(),
    notificationEnabled: z.boolean(),
    smsActivatedAt: z.number().int().nonnegative().optional(),
    notificationActivatedAt: z.number().int().nonnegative().optional(),
    smsActivationId: z.string().regex(/^\d+$/).optional(),
    notificationAccountId: z.string().uuid().optional()
  })
  .strict()
  .refine(
    (sources) =>
      !sources.smsEnabled ||
      (sources.smsActivatedAt !== undefined &&
        sources.smsActivatedAt > 0 &&
        sources.smsActivationId !== undefined),
    'SMS activation boundary required'
  )
  .refine(
    (sources) =>
      !sources.notificationEnabled ||
      (sources.notificationActivatedAt !== undefined &&
        sources.notificationActivatedAt > 0),
    'Notification activation boundary required'
  );
const envelopeSchema = z
  .object({
    version: z.literal(3),
    ownerId: z.string().min(1),
    revision: z.number().int().nonnegative(),
    sources: sourcesSchema
  })
  .strict();

function sourceScope() {
  const assertCurrent = captureTrackingAdmission();
  const admission = useTrackingAdmission.getState();
  const ownerId = admission.nativeLease ? admission.admittedOwnerId : null;
  if (admission.nativeLease && (!ownerId || !admission.sessionAnchor))
    throw new Error('tracking_source_owner_unavailable');
  return {
    ownerId,
    key: admission.nativeLease
      ? `masarifi.tracking.sources.v3.${admission.nativeLease.ownerDigest}`
      : storageKey,
    async check(requireSession = true) {
      assertCurrent();
      if (useTrackingAdmission.getState().nativeLease !== admission.nativeLease)
        throw new Error('tracking_source_owner_unavailable');
      if (
        ownerId &&
        requireSession &&
        (await readLogoutSessionAnchor(ownerId)) !== admission.sessionAnchor
      )
        throw new Error('tracking_source_owner_unavailable');
      assertCurrent();
    }
  };
}

export class TrackingSourcePreferences {
  constructor(
    private readonly storage: StorageLike = AsyncStorage,
    private readonly smsBoundary = async () => {
      if (MasarifiSmsInbox && !MasarifiSmsInbox.smsActivationBoundary)
        throw new Error('tracking_native_upgrade_required');
      return (
        MasarifiSmsInbox?.smsActivationBoundary?.() ?? {
          activatedAt: Date.now(),
          afterId: '0'
        }
      );
    },
    private readonly consent: TrackingSourceConsentPort = productionTrackingConsent
  ) {}

  private async read(scope: ReturnType<typeof sourceScope>) {
    await scope.check();
    const raw = await this.storage.getItem(scope.key);
    await scope.check();
    if (scope.ownerId) {
      if (raw === null) return { sources: { ...disabled }, revision: 0 };
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error('tracking_source_owner_unavailable');
      }
      const result = envelopeSchema.safeParse(parsed);
      if (!result.success || result.data.ownerId !== scope.ownerId)
        throw new Error('tracking_source_owner_unavailable');
      const sources =
        (await this.consent.effectiveSources?.(result.data.sources)) ??
        result.data.sources;
      await scope.check();
      return { sources, revision: result.data.revision };
    }
    try {
      const value = JSON.parse(raw ?? 'null');
      return {
        revision: 0,
        sources: {
          smsEnabled: value?.smsEnabled === true,
          notificationEnabled: value?.notificationEnabled === true,
          ...(typeof value?.notificationAccountId === 'string' &&
          /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(
            value.notificationAccountId
          )
            ? { notificationAccountId: value.notificationAccountId }
            : {}),
          ...(typeof value?.smsActivationId === 'string' &&
          /^\d+$/.test(value.smsActivationId)
            ? { smsActivationId: value.smsActivationId }
            : {}),
          ...(Number.isSafeInteger(value?.smsActivatedAt) &&
          value.smsActivatedAt >= 0
            ? { smsActivatedAt: value.smsActivatedAt }
            : {}),
          ...(Number.isSafeInteger(value?.notificationActivatedAt) &&
          value.notificationActivatedAt >= 0
            ? { notificationActivatedAt: value.notificationActivatedAt }
            : {})
        }
      };
    } catch {
      return { sources: { ...disabled }, revision: 0 };
    }
  }

  async snapshot(): Promise<{
    sources: TrackingSourceState;
    revision: number;
  }> {
    return this.read(sourceScope());
  }

  async load(): Promise<TrackingSourceState> {
    return (await this.snapshot()).sources;
  }

  private async write(
    scope: ReturnType<typeof sourceScope>,
    sources: TrackingSourceState,
    revision: number
  ) {
    await scope.check();
    await this.storage.setItem(
      scope.key,
      JSON.stringify(
        scope.ownerId
          ? envelopeSchema.parse({
              version: 3,
              ownerId: scope.ownerId,
              revision: revision + 1,
              sources
            })
          : sources
      )
    );
    await scope.check();
  }

  async set(
    source: 'sms' | 'notification',
    enabled: boolean
  ): Promise<TrackingSourceState> {
    assertTrackingAvailable();
    const scope = sourceScope();
    consentEpoch++;
    return serializeSources(async () => {
      const { sources: current, revision } = await this.read(scope);
      const boundary =
        enabled && source === 'sms' && !current.smsEnabled
          ? await this.smsBoundary()
          : null;
      const next = {
        ...current,
        [source === 'sms' ? 'smsEnabled' : 'notificationEnabled']: enabled,
        ...(enabled &&
        !current[source === 'sms' ? 'smsEnabled' : 'notificationEnabled']
          ? {
              [source === 'sms' ? 'smsActivatedAt' : 'notificationActivatedAt']:
                boundary?.activatedAt ?? Date.now(),
              ...(boundary ? { smsActivationId: boundary.afterId } : {})
            }
          : {})
      };
      // Consent changes invalidate all queued native work; the next authenticated pass installs a new generation.
      await disableTrackingBackground(true);
      // A local disable is effective even while its durable server revocation is offline.
      if (!enabled) await this.write(scope, next, revision);
      const applied = await this.consent.apply(next);
      const accepted = applied?.sources ?? next;
      await scope.check();
      if (enabled || JSON.stringify(accepted) !== JSON.stringify(next))
        await this.write(scope, accepted, revision);
      if (applied) await this.consent.acknowledge(applied.commandId);
      return accepted;
    });
  }

  async hasPendingConsent(): Promise<boolean> {
    return (await this.consent.hasPending?.()) ?? false;
  }

  async retryPendingConsent(): Promise<boolean> {
    const scope = sourceScope();
    return serializeSources(async () => {
      if (this.consent.hasPending && !(await this.consent.hasPending()))
        return false;
      const { sources, revision } = await this.read(scope);
      consentEpoch++;
      await disableTrackingBackground(true);
      const applied = await this.consent.retry();
      if (!applied) return false;
      const accepted = {
        ...applied.sources,
        ...(sources.notificationAccountId
          ? { notificationAccountId: sources.notificationAccountId }
          : {})
      };
      await this.write(scope, accepted, revision);
      await this.consent.acknowledge(applied.commandId);
      return true;
    });
  }

  async setNotificationAccount(
    accountId: string | null
  ): Promise<TrackingSourceState> {
    assertTrackingAvailable();
    if (
      accountId !== null &&
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(accountId)
    )
      throw new Error('tracking_notification_account_invalid');
    const scope = sourceScope();
    consentEpoch++;
    return serializeSources(async () => {
      const { sources, revision } = await this.read(scope);
      const { notificationAccountId: _previous, ...current } = sources;
      const next = {
        ...current,
        ...(accountId ? { notificationAccountId: accountId } : {})
      };
      await disableTrackingBackground(true);
      await this.write(scope, next, revision);
      return next;
    });
  }

  async clear(): Promise<void> {
    const scope = sourceScope();
    consentEpoch++;
    return serializeSources(async () => {
      // Validate attribution before cleanup; malformed retained bytes require recovery.
      await this.read(scope);
      await scope.check(false);
      if (scope.ownerId) await disableTrackingBackground(true);
      await this.storage.removeItem(scope.key);
    });
  }
}

export const trackingSourcePreferences = new TrackingSourcePreferences();

/** Called only inside a pinned owner deletion/logout cleanup, whose guard survives SDK sign-out. */
export async function purgeTrackingSourcePreferences(
  ownerId: string,
  ownerDigest: string,
  assertCurrent: () => void
): Promise<void> {
  consentEpoch++;
  await serializeSources(async () => {
    assertCurrent();
    const key = `masarifi.tracking.sources.v3.${ownerDigest}`;
    const raw = await AsyncStorage.getItem(key);
    assertCurrent();
    if (raw !== null) {
      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch {
        throw new Error('tracking_source_owner_unavailable');
      }
      const parsed = envelopeSchema.safeParse(value);
      if (!parsed.success || parsed.data.ownerId !== ownerId)
        throw new Error('tracking_source_owner_unavailable');
      await AsyncStorage.removeItem(key);
      assertCurrent();
    }
  });
}

registerRuntimeUserDataReset(() => trackingSourcePreferences.clear());
