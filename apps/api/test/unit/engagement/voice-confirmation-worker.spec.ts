import { EngagementObservability } from '../../../src/engagement/engagement.observability';
import { EngagementWorker } from '../../../src/engagement/engagement.worker';

it('uses only fresh operating Voice sources and scoped deliveries, never historical scheduler claims', async () => {
  const epoch = '11111111-1111-4111-8111-111111111111';
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
    claimVoiceSourceEvents: jest.fn().mockResolvedValue([source]),
    claimVoiceNotificationDeliveries: jest.fn().mockResolvedValue([]),
    claimSourceEvents: jest.fn(() => {
      throw Error('HISTORICAL_SOURCE_CLAIM');
    }),
    claimNotificationDeliveries: jest.fn(() => {
      throw Error('HISTORICAL_DELIVERY_CLAIM');
    }),
    loadSourceTemplatesBatch: jest.fn().mockResolvedValue([
      [
        {
          id: 'in-app',
          key: 'transaction.created',
          locale: 'en',
          channel: 'in_app',
          template_version: 1,
          subject: 'Saved',
          body: 'Transaction saved',
          enabled: true,
          quiet_hours: {},
        },
      ],
    ]),
    createNotificationsFromSources: jest.fn().mockResolvedValue(true),
  };
  const sink = jest.fn();
  const worker = new EngagementWorker(
    repository as never,
    {} as never,
    {} as never,
    {} as never,
    new EngagementObservability(sink),
  );
  await expect(worker.processVoiceConfirmations(epoch)).resolves.toBe(1);
  expect(sink).toHaveBeenCalledWith(
    'masarifi_engagement_job_total',
    1,
    expect.objectContaining({ job: 'voice.confirmation.delivery.wait', outcome: 'empty' }),
  );
  expect(sink).toHaveBeenCalledWith(
    'masarifi_engagement_job_duration_ms',
    expect.any(Number),
    expect.objectContaining({ job: 'voice.confirmation.source.wait', outcome: 'claimed' }),
  );
  expect(repository.claimVoiceSourceEvents).toHaveBeenCalledWith(epoch, 1);
  expect(repository.createNotificationsFromSources).toHaveBeenCalledWith([
    {
      source,
      deliveries: expect.arrayContaining([
        expect.objectContaining({ channel: 'in_app', status: 'queued' }),
      ]) as unknown,
    },
  ]);
  expect(repository.claimVoiceNotificationDeliveries).toHaveBeenCalledWith(
    epoch,
    expect.any(String),
    1,
  );
  expect(repository.claimSourceEvents).not.toHaveBeenCalled();
  expect(repository.claimNotificationDeliveries).not.toHaveBeenCalled();
});
