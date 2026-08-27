import { OutboxDispatcher } from '../../../src/platform/outbox/outbox-dispatcher';

const row = {
  id: '0198f79d-98f3-7bb4-a820-f43bb4d0e17f',
  createdAt: new Date('2026-08-27T12:00:00.000Z'),
  aggregateType: 'account',
  aggregateId: null,
  eventType: 'account.changed',
  payload: {},
  attemptCount: 0,
};

describe('OutboxDispatcher', () => {
  it('emits published only after queue acceptance and lease completion', async () => {
    const repository = {
      complete: jest.fn().mockResolvedValue(true),
      fail: jest.fn(),
    };
    const publisher = { publish: jest.fn().mockResolvedValue(undefined) };
    const signal = jest.fn();
    const dispatcher = new OutboxDispatcher(
      repository as never,
      publisher as never,
      signal,
      () => 0,
    );

    await dispatcher.dispatch(row, 'worker-1', 'req-1');

    expect(signal).toHaveBeenCalledWith(
      'outbox.published',
      expect.objectContaining({ eventId: row.id }),
    );
    expect(repository.fail).not.toHaveBeenCalled();
  });

  it('emits no success when completion loses its lease', async () => {
    const repository = {
      complete: jest.fn().mockResolvedValue(false),
      fail: jest.fn(),
    };
    const publisher = { publish: jest.fn().mockResolvedValue(undefined) };
    const signal = jest.fn();
    const dispatcher = new OutboxDispatcher(
      repository as never,
      publisher as never,
      signal,
      () => 0,
    );

    await dispatcher.dispatch(row, 'worker-1', 'req-1');

    expect(signal).not.toHaveBeenCalled();
  });

  it('schedules a safe retry and retains the source row on queue failure', async () => {
    const repository = {
      complete: jest.fn(),
      fail: jest.fn().mockResolvedValue(true),
    };
    const publisher = {
      publish: jest.fn().mockRejectedValue(new Error('provider secret')),
    };
    const signal = jest.fn();
    const dispatcher = new OutboxDispatcher(
      repository as never,
      publisher as never,
      signal,
      () => 0,
    );

    await dispatcher.dispatch(row, 'worker-1', 'req-1');

    expect(repository.fail).toHaveBeenCalledWith(
      row.id,
      'worker-1',
      1,
      'QUEUE_PUBLISH_FAILED',
      expect.any(Date),
    );
    expect(JSON.stringify(repository.fail.mock.calls)).not.toContain('provider secret');
  });

  it('retains the accepted source unchanged when completion crashes', async () => {
    const repository = {
      complete: jest.fn().mockRejectedValue(new Error('database unavailable')),
      fail: jest.fn(),
      delete: jest.fn(),
    };
    const publisher = { publish: jest.fn().mockResolvedValue(undefined) };
    const signal = jest.fn();
    const dispatcher = new OutboxDispatcher(
      repository as never,
      publisher as never,
      signal,
      () => 0,
    );

    await dispatcher.dispatch(row, 'worker-1', 'req-1');

    expect(repository.fail).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
    expect(signal).not.toHaveBeenCalled();
  });

  it('retains terminal failures and emits only bounded operational fields', async () => {
    const terminalRow = { ...row, attemptCount: 9 };
    const repository = {
      complete: jest.fn(),
      fail: jest.fn().mockResolvedValue(true),
      delete: jest.fn(),
    };
    const publisher = {
      publish: jest.fn().mockRejectedValue(new Error('provider secret')),
    };
    const signal = jest.fn();
    const dispatcher = new OutboxDispatcher(
      repository as never,
      publisher as never,
      signal,
      () => 0,
    );

    await dispatcher.dispatch(terminalRow, 'worker-1', 'req-1');

    expect(repository.fail).toHaveBeenCalledWith(
      row.id,
      'worker-1',
      10,
      'OUTBOX_DELIVERY_EXHAUSTED',
      expect.any(Date),
    );
    expect(repository.delete).not.toHaveBeenCalled();
    expect(signal).toHaveBeenCalledWith('outbox.delivery_failed', {
      eventId: row.id,
      eventType: row.eventType,
      attempt: 10,
      code: 'OUTBOX_DELIVERY_EXHAUSTED',
    });
    expect(JSON.stringify(signal.mock.calls)).not.toContain('provider secret');
  });
});
