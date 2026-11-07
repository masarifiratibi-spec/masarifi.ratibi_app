import { withReadContext, assertReadActive } from './read-context';

it('bounds authentication and prevents a late transport after the deadline', async () => {
  jest.useFakeTimers();
  let release!: () => void;
  const authentication = new Promise<void>((resolve) => {
    release = resolve;
  });
  const transport = jest.fn();
  try {
    const result = withReadContext({ timeoutMs: 50 }, async (signal) => {
      await authentication;
      assertReadActive(signal);
      transport();
      return 'ready';
    }).catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(50);
    expect(await result).toMatchObject({
      code: 'provider_unavailable',
      failureSource: 'timeout'
    });
    release();
    await Promise.resolve();
    expect(transport).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

it('propagates caller cancellation and releases its deadline', async () => {
  const controller = new AbortController();
  const result = withReadContext(
    { signal: controller.signal },
    async (signal) =>
      new Promise<void>((resolve) =>
        signal.addEventListener('abort', () => resolve())
      )
  );
  controller.abort();
  await expect(result).rejects.toMatchObject({ code: 'provider_unavailable' });
});
