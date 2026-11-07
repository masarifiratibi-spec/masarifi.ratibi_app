import { AiWorker } from '../../../src/ai/ai.worker';

it('bounds stalled assistant work before the lease expires and prevents a late financial result', async () => {
  jest.useFakeTimers();
  let release!: (value: unknown) => void;
  const repository = {
    claimWork: () =>
      Promise.resolve([
        {
          kind: 'assistant.respond',
          id: 'sample-job',
          user_id: 'owner',
          claim_token: 'fence',
          attempt_count: 1,
        },
      ]),
    workInput: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    getRoute: jest.fn(() => Promise.resolve({})),
    saveAssistantResult: jest.fn(),
    recordFailure: jest.fn(() => Promise.resolve(undefined)),
    completeWork: jest.fn(() => Promise.resolve(true)),
  };
  const worker = new AiWorker(
    repository as never,
    {} as never,
    {} as never,
    {
      get: (key: string) => key === 'MASARIFI_AI_ASSISTANT_ONLY',
      getRequired: (key: string) => (key === 'MASARIFI_AI_LEASE_SECONDS' ? 3 : 1),
    } as never,
  );
  try {
    const running = worker.runJob('assistant.respond');
    await jest.advanceTimersByTimeAsync(2100);
    await running;
    expect(repository.completeWork).toHaveBeenCalledWith(
      'assistant.respond',
      'sample-job',
      'fence',
      'failed',
      'AI_PROCESSING_FAILED',
    );
    release({ aliases: [], contextPayload: {}, content: 'sample' });
    await jest.advanceTimersByTimeAsync(0);
    expect(repository.getRoute).not.toHaveBeenCalled();
    expect(repository.saveAssistantResult).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});
