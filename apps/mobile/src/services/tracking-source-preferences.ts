import AsyncStorage from '@react-native-async-storage/async-storage';

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
  constructor(private readonly storage: StorageLike = AsyncStorage) {}

  async load(): Promise<TrackingSourceState> {
    try {
      const value = JSON.parse(
        (await this.storage.getItem(storageKey)) ?? 'null'
      );
      return {
        smsEnabled: value?.smsEnabled === true,
        notificationEnabled: value?.notificationEnabled === true
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
    const next = {
      ...current,
      [source === 'sms' ? 'smsEnabled' : 'notificationEnabled']: enabled
    };
    await this.storage.setItem(storageKey, JSON.stringify(next));
    // Consent changes invalidate all queued native work; the next authenticated pass installs a new generation.
    await disableTrackingBackground(next.notificationEnabled);
    return next;
  }

  clear(): Promise<void> {
    return this.storage.removeItem(storageKey);
  }
}

export const trackingSourcePreferences = new TrackingSourcePreferences();

registerRuntimeUserDataReset(() => trackingSourcePreferences.clear());
