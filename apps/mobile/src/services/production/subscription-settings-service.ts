import { createLiveIdentityService } from '../live/auth-service';
import { createSettingsStorage } from '@/storage/settings-storage';
import { createAppShellStorage } from '@/storage/app-shell-storage';
import { useAppShellStore } from '@/state/app-shell';
import {
  subscriptionServiceCapability,
  type SubscriptionService
} from '../contracts/assistant-notifications-service';
import type { CapabilityProviderHandle } from '../contracts/capability-contract';
const settings = createSettingsStorage();
const shell = createAppShellStorage();
export const settingsService = createLiveIdentityService({
  getOwnerId: () => useAppShellStore.getState().session?.userId ?? null,
  loadLocalProfile: settings.loadProfile,
  saveLocalProfile: settings.saveProfile,
  loadLocalOnboarding: shell.loadOnboarding,
  saveLocalOnboarding: shell.saveOnboarding
});
// TODO(report-8.2): Implement real subscription billing in the final closure phase; verify the intended Stripe integration against current Google Play Payments requirements and applicable regional programs before enabling purchases. Deferred, not resolved.
export const subscriptionService = new Proxy(
  {
    metadata: {
      id: 'unavailable-subscription',
      capability: subscriptionServiceCapability.capability,
      majorVersion: subscriptionServiceCapability.majorVersion,
      kind: 'live',
      availability: 'unavailable'
    }
  } as CapabilityProviderHandle<SubscriptionService>,
  {
    get(target, property) {
      if (property === 'metadata') return target.metadata;
      return async () => {
        throw new Error('subscriptions_unavailable');
      };
    }
  }
);
