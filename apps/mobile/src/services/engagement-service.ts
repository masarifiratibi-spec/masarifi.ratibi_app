import type {
  NotificationService,
  SupportService
} from './contracts/assistant-notifications-service';
import type { CapabilityProviderHandle } from './contracts/capability-contract';
import {
  notificationServiceCapability,
  supportServiceCapability
} from './contracts/assistant-notifications-service';
import { isFixtureModeEnabled } from '@/config/demo-mode';
import {
  createLiveNotificationService,
  createLiveSupportService
} from './live/engagement-service';
import { getLiveClerkToken } from './live/auth-service';

function unavailable<T>(
  capability:
    typeof notificationServiceCapability | typeof supportServiceCapability
): CapabilityProviderHandle<T> {
  return new Proxy(
    {
      metadata: {
        id: `unavailable-${capability.owner}`,
        capability: capability.capability,
        majorVersion: capability.majorVersion,
        kind: 'live' as const,
        availability: 'unavailable' as const
      }
    } as CapabilityProviderHandle<T>,
    {
      get(target, property) {
        if (property === 'metadata') return target.metadata;
        return async () => {
          throw new Error(capability.unavailableOutcome ?? 'unavailable');
        };
      }
    }
  );
}

const liveNotifications = createLiveNotificationService({
  token: getLiveClerkToken
});
const liveSupport = createLiveSupportService({ token: getLiveClerkToken });

export const notificationService: CapabilityProviderHandle<NotificationService> =
  isFixtureModeEnabled()
    ? (
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        require('./mocks/assistant-notifications-service') as typeof import('./mocks/assistant-notifications-service')
      ).assistantNotificationsService
    : liveNotifications.metadata.availability === 'available'
      ? liveNotifications
      : unavailable<NotificationService>(notificationServiceCapability);

export const supportService: CapabilityProviderHandle<SupportService> =
  isFixtureModeEnabled()
    ? (
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        require('./mocks/support-service') as typeof import('./mocks/support-service')
      ).supportService
    : liveSupport.metadata.availability === 'available'
      ? liveSupport
      : unavailable<SupportService>(supportServiceCapability);

export {
  configureEngagementApiTokenProvider,
  createEngagementApi,
  createLiveNotificationService,
  createLiveSupportService,
  EngagementApiError
} from './live/engagement-service';
