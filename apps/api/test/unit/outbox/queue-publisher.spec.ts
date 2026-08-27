import { QueuePublisher } from '../../../src/platform/outbox/queue-publisher';

describe('QueuePublisher', () => {
  const envelope = {
    schemaVersion: 1 as const,
    eventId: '0198f79d-98f3-7bb4-a820-f43bb4d0e17f',
    eventType: 'account.changed',
    occurredAt: '2026-08-27T12:00:00.000Z',
    producer: 'masarifi-api' as const,
    aggregate: { type: 'account', id: null },
    correlationId: 'req-1',
    attempt: 1,
    payload: {},
  };

  it('publishes only to the owned logged queue', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [{ message_id: 1 }] }),
    };
    const publisher = new QueuePublisher(database as never);

    await publisher.publish(envelope, 1_000);

    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('pgmq.send'),
      ['platform-events', JSON.stringify(envelope), 0],
      1_000,
    );
    expect(database.query).toHaveBeenCalledWith(
      expect.not.stringContaining('pgmq_public'),
      expect.any(Array),
      1_000,
    );
  });

  it('maps provider errors to a stable code', async () => {
    const database = {
      query: jest.fn().mockRejectedValue(new Error('postgresql://secret')),
    };
    const publisher = new QueuePublisher(database as never);

    await expect(publisher.publish(envelope, 1_000)).rejects.toThrow('QUEUE_PUBLISH_FAILED');
  });
});
