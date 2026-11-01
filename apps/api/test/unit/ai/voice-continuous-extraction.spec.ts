import { AiWorker } from '../../../src/ai/ai.worker';

it('retains the recording when database renewal fails during extraction', async () => {
  jest.useFakeTimers();
  const effects: string[] = [];
  let renewals = 0;
  const repository = {
    renewVoiceWork: () =>
      ++renewals === 1 ? Promise.resolve(true) : Promise.reject(new Error('Query read timeout')),
    workInput: () => new Promise(() => {}),
    recordFailure: () => {
      effects.push('failure');
      return Promise.resolve();
    },
    completeWork: () => {
      effects.push('terminal');
      return Promise.resolve();
    },
  };
  const worker = new AiWorker(
    repository as never,
    {} as never,
    {} as never,
    { getRequired: () => 120 } as never,
  );
  try {
    const work = worker.processVoiceClaim(
      {
        kind: 'voice.transcribe_extract',
        id: 'fixture',
        user_id: 'fixture',
        claim_token: 'fixture',
        attempt_count: 1,
      },
      undefined,
      true,
    );
    const check = expect(work).rejects.toThrow('Query read timeout');
    await jest.advanceTimersByTimeAsync(40000);
    await check;
    expect(effects).toEqual([]);
  } finally {
    jest.useRealTimers();
  }
});

it('retains a continuous claim after a database outage without marking the recording failed', async () => {
  const effects: string[] = [];
  const repository = {
    renewVoiceWork: () => Promise.reject(new Error('Query read timeout')),
    recordFailure: () => {
      effects.push('failure');
      return Promise.resolve();
    },
    completeWork: () => {
      effects.push('terminal');
      return Promise.resolve();
    },
  };
  const worker = new AiWorker(
    repository as never,
    {} as never,
    {} as never,
    { getRequired: () => 120 } as never,
  );
  await expect(
    worker.processVoiceClaim(
      {
        kind: 'voice.transcribe_extract',
        id: 'fixture',
        user_id: 'fixture',
        claim_token: 'fixture',
        attempt_count: 1,
      },
      undefined,
      true,
    ),
  ).rejects.toThrow('Query read timeout');
  expect(effects).toEqual([]);
});
