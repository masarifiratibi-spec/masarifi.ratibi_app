import { OutboxWorkerService } from '../../../src/platform/outbox/outbox-worker.service';

describe('OutboxWorkerService shutdown', () => {
  it('stops new claims and waits for the active batch', async () => {
    let finishDispatch: (() => void) | undefined;
    const dispatch = new Promise<void>((resolve) => {
      finishDispatch = resolve;
    });
    const repository = {
      claim: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: '0198f79d-98f3-7bb4-a820-f43bb4d0e17f',
            createdAt: new Date(),
            aggregateType: 'account',
            aggregateId: null,
            eventType: 'account.changed',
            payload: {},
            attemptCount: 0,
          },
        ])
        .mockResolvedValue([]),
    };
    const dispatcher = { dispatch: jest.fn().mockReturnValue(dispatch) };
    const worker = new OutboxWorkerService(repository as never, dispatcher as never, {
      workerId: 'worker-1',
      batchSize: 50,
      leaseSeconds: 30,
      pollMs: 100,
    });

    worker.start();
    await Promise.resolve();
    const stopped = worker.stop();
    finishDispatch?.();
    await stopped;

    expect(repository.claim).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
  });

  it('rejects an oversized batch configuration', () => {
    expect(
      () =>
        new OutboxWorkerService({} as never, {} as never, {
          workerId: 'worker-1',
          batchSize: 101,
          leaseSeconds: 30,
          pollMs: 100,
        }),
    ).toThrow('OUTBOX_WORKER_CONFIG_INVALID');
  });
});
