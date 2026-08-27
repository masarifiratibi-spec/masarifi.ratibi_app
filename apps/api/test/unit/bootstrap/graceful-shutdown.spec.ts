import { GracefulShutdown } from '../../../src/platform/observability/graceful-shutdown';

describe('GracefulShutdown', () => {
  it('rejects new work after shutdown starts and completes when idle', async () => {
    const coordinator = new GracefulShutdown(30_000);
    const stop = jest.fn();

    await expect(coordinator.shutdown(stop)).resolves.toEqual({
      timedOut: false,
    });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(coordinator.beginWork()).toBeNull();
  });

  it('waits for active work to finish', async () => {
    const coordinator = new GracefulShutdown(30_000);
    const finish = coordinator.beginWork();
    const shutdown = coordinator.shutdown(jest.fn());

    expect(finish).not.toBeNull();
    finish?.();
    await expect(shutdown).resolves.toEqual({ timedOut: false });
  });

  it('returns a forced result at the configured deadline', async () => {
    jest.useFakeTimers();
    const coordinator = new GracefulShutdown(30_000);
    coordinator.beginWork();
    const shutdown = coordinator.shutdown(jest.fn());

    await jest.advanceTimersByTimeAsync(30_000);
    await expect(shutdown).resolves.toEqual({ timedOut: true });
    jest.useRealTimers();
  });

  it('bounds a stop-accepting callback that never resolves', async () => {
    jest.useFakeTimers();
    const coordinator = new GracefulShutdown(1_000);
    const shutdown = coordinator.shutdown(() => new Promise(() => undefined));

    await jest.advanceTimersByTimeAsync(1_000);
    await expect(shutdown).resolves.toEqual({ timedOut: true });
    jest.useRealTimers();
  });
});
