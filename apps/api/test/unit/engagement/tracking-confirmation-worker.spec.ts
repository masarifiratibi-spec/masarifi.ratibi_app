import type { ClerkClientService } from '../../../src/identity/clerk-client.service';
import type { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import type { EngagementRepository } from '../../../src/engagement/engagement.repository';
import { EngagementWorker } from '../../../src/engagement/engagement.worker';
import type { SupportStorage } from '../../../src/engagement/support.storage';

it('prepares tracking cohort confirmations without claiming historical events or sending a second push', async () => {
  const source = {
    source_event_id: 'event-1',
    source_id: 'transaction-1',
    event_type: 'transaction.created',
    user_id: 'owner',
    locale: 'en',
    time_zone: 'Asia/Riyadh',
    occurred_at: new Date().toISOString(),
    expires_at: null,
  };
  const repository = {
    claimTrackingSourceEvents: jest.fn().mockResolvedValue([source]),
    claimSourceEvents: jest.fn(),
    claimNotificationDeliveries: jest.fn(),
    loadSourceTemplates: jest
      .fn()
      .mockResolvedValue(
        ['in_app', 'push'].map((channel) => ({
          id: channel,
          key: 'transaction.created',
          locale: 'en',
          channel,
          template_version: 1,
          subject: 'Saved',
          body: 'Transaction saved',
          enabled: true,
          quiet_hours: {},
        })),
      ),
    createNotificationFromSource: jest.fn().mockResolvedValue(true),
  };
  const worker = new EngagementWorker(
    repository as unknown as EngagementRepository,
    {} as SupportStorage,
    {} as ClerkClientService,
    { getRequired: () => 10 } as unknown as PlatformConfigService,
  );
  await expect(worker.runJob('tracking.confirmation.prepare')).resolves.toBe(1);
  expect(repository.claimTrackingSourceEvents).toHaveBeenCalledWith(10);
  expect(repository.createNotificationFromSource).toHaveBeenCalledWith(
    source,
    expect.arrayContaining([expect.objectContaining({ channel: 'push', status: 'queued' })]),
  );
  expect(repository.claimSourceEvents).not.toHaveBeenCalled();
  expect(repository.claimNotificationDeliveries).not.toHaveBeenCalled();
});
