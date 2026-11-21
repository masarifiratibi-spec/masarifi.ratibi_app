import { smsInboxService } from './sms-inbox-service.android';

export const readRecoveryNetwork = {
  available: smsInboxService.available,
  isOnline: () => smsInboxService.isNetworkAvailable()
};
