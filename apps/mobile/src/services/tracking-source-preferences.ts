import AsyncStorage from '@react-native-async-storage/async-storage';
import { MasarifiSmsInbox } from '../../modules/masarifi-sms-inbox';

import { registerRuntimeUserDataReset } from '@/storage/runtime-user-data-reset';
import { disableTrackingBackground } from './tracking-background-runtime';

const storageKey = 'masarifi.tracking.sources.v1';
let consentEpoch = 0;
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
    }
  ) {}

  async load(): Promise<TrackingSourceState> {
    try {
      const value = JSON.parse(
        (await this.storage.getItem(storageKey)) ?? 'null'
      );
      return {
        smsEnabled: value?.smsEnabled === true,
        notificationEnabled: value?.notificationEnabled === true,
        ...(typeof value?.notificationAccountId === 'string' &&
        /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value.notificationAccountId)
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
      };
    } catch {
      return { ...disabled };
    }
  }

  async set(
    source: 'sms' | 'notification',
    enabled: boolean
  ): Promise<TrackingSourceState> {
    consentEpoch++;
    const current = await this.load();
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
    await this.storage.setItem(storageKey, JSON.stringify(next));
    // Consent changes invalidate all queued native work; the next authenticated pass installs a new generation.
    await disableTrackingBackground(true);
    return next;
  }

  async setNotificationAccount(accountId: string | null): Promise<TrackingSourceState> {
    if (accountId !== null && !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(accountId))
      throw new Error('tracking_notification_account_invalid');
    consentEpoch++;
    const { notificationAccountId: _previous, ...current } = await this.load();
    const next = { ...current, ...(accountId ? { notificationAccountId: accountId } : {}) };
    await this.storage.setItem(storageKey, JSON.stringify(next));
    return next;
  }

  clear(): Promise<void> {
    return this.storage.removeItem(storageKey);
  }
}

export const trackingSourcePreferences = new TrackingSourcePreferences();

registerRuntimeUserDataReset(() => trackingSourcePreferences.clear());
