import {
  createLiveNotificationService,
  createLiveSupportService
} from '../live/engagement-service';
import { getLiveClerkToken } from '../live/auth-service';
export const notificationService = createLiveNotificationService({
  token: getLiveClerkToken
});
export const supportService = createLiveSupportService({
  token: getLiveClerkToken
});
export {
  configureEngagementApiTokenProvider,
  createEngagementApi,
  createLiveNotificationService,
  createLiveSupportService,
  EngagementApiError
} from '../live/engagement-service';
