import { smsInboxService } from './sms-inbox-service.android';

export const deletionRecoveryNetwork = {
  available: smsInboxService.available,
  isOnline: () => smsInboxService.isNetworkAvailable()
};
