import { StagingVoiceWorker } from '../../../src/ai/staging-voice.worker';
import type { AiWorker } from '../../../src/ai/ai.worker';

it('retains the root database exception and stage without exposing query or owner contents', async () => {
  const f = fixture();
  const root = Object.assign(new Error('Query read timeout'), {
    code: '57014',
    query: 'SECRET_SQL',
  });
  Object.defineProperty(root, 'stack', {
    value:
      'Error: SECRET_AUDIO\n    at query (/app/dist/src/platform/database/pool.service.js:41:9)',
  });
  const error = new Error(
    'SECRET_OWNER SECRET_TRANSCRIPT postgres://user:SECRET_PASSWORD@host/db',
    { cause: root },
  );
  f.repository.claimVoiceEpochWork = () => Promise.reject(error);
  const lines: string[] = [];
  const output = jest.spyOn(process.stdout, 'write').mockImplementation((line) => {
    lines.push(String(line));
    return true;
  });
  try {
    await f.worker.tick();
    const record = lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((line) => line.message === 'VOICE_SCOPED_RUNTIME_FAILED');
    expect(record).toMatchObject({
      failureStage: 'claim',
      exception: {
        name: 'Error',
        code: '57014',
        reason: 'Query read timeout',
        frames: ['platform/database/pool.service.js:41:9'],
      },
    });
    expect(lines.join('')).not.toMatch(/SECRET_|postgres:\/\//);
    expect(f.effects).toEqual(['closed:runtime_failed']);
  } finally {
    output.mockRestore();
  }
});

it('reports a separate safe closure exception without replacing the original failure', async () => {
  const f = fixture();
  f.repository.claimVoiceEpochWork = () => Promise.reject(new Error('Query read timeout'));
  f.repository.closeVoiceEpoch = () =>
    Promise.reject(Object.assign(new Error('SECRET_CLOSURE'), { code: 'ECONNRESET' }));
  const lines: string[] = [];
  const output = jest.spyOn(process.stdout, 'write').mockImplementation((line) => {
    lines.push(String(line));
    return true;
  });
  try {
    await f.worker.tick();
    const records = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'VOICE_SCOPED_RUNTIME_FAILED',
          exception: expect.objectContaining({ reason: 'Query read timeout' }) as unknown,
        }),
        expect.objectContaining({
          message: 'VOICE_SCOPED_CLOSURE_FAILED',
          failureStage: 'close',
          exception: expect.objectContaining({
            code: 'ECONNRESET',
            reason: 'unclassified',
          }) as unknown,
        }),
      ]),
    );
    expect(lines.join('')).not.toContain('SECRET_CLOSURE');
  } finally {
    output.mockRestore();
  }
});

const epoch = '11111111-1111-4111-8111-111111111111';
const claim = {
  kind: 'voice.transcribe_extract',
  id: '22222222-2222-4222-8222-222222222222',
  user_id: 'owner-a',
  claim_token: '33333333-3333-4333-8333-333333333333',
  attempt_count: 1,
};
function fixture(mode = 'canary') {
  const effects: string[] = [];
  const observations: Record<string, unknown>[] = [];
  let enabled = true;
  const repository = {
    voiceEpochHeartbeat: (id: string) => {
      if (id !== epoch) throw new Error('wrong epoch');
      return Promise.resolve({ enabled, mode });
    },
    claimVoiceEpochWork: (id: string, _worker: string, limit: number, lease: number) => {
      if (id !== epoch || limit !== 1 || lease !== 120) throw new Error('unbounded claim');
      effects.push('scoped-claim');
      return Promise.resolve([claim]);
    },
    finalizeVoiceEpoch: (id: string, limit: number) => {
      if (id !== epoch || limit !== 1) throw new Error('unbounded finalization');
      effects.push('scoped-finalize');
      return Promise.resolve(true);
    },
    claimVoiceEpochPurges: () => {
      effects.push('scoped-purge');
      return Promise.resolve([]);
    },
    closeVoiceEpoch: (_id: string, reason: string) => {
      enabled = false;
      effects.push('closed:' + reason);
      return Promise.resolve();
    },
    claimWork: () => {
      throw new Error('UNRELATED_WORK');
    },
    finalizeVoiceBatches: () => {
      throw new Error('GLOBAL_FINALIZATION');
    },
    claimPurges: () => {
      throw new Error('GLOBAL_PURGE');
    },
  };
  const engine: Pick<AiWorker, 'processVoiceClaim' | 'start' | 'runOnce'> = {
    processVoiceClaim: () => {
      effects.push('existing-extraction');
      return Promise.resolve(true);
    },
    start: () => {
      throw new Error('GENERAL_TIMER');
    },
    runOnce: () => {
      throw new Error('GENERAL_LOOP');
    },
  };
  const worker = new StagingVoiceWorker(
    repository as never,
    engine as never,
    {} as never,
    epoch,
    'scoped-worker',
    'a'.repeat(40),
    (state) => observations.push(state),
  );
  return {
    worker,
    effects,
    observations,
    repository,
    engine,
    disable: () => {
      enabled = false;
    },
  };
}
it('revalidates only the heartbeat once after a driver read timeout before claiming financial work', async () => {
  const f = fixture('operating');
  const heartbeat = jest
    .fn(f.repository.voiceEpochHeartbeat)
    .mockRejectedValueOnce(new Error('Query read timeout'));
  f.repository.voiceEpochHeartbeat = heartbeat;
  await f.worker.tick();
  expect(heartbeat).toHaveBeenCalledTimes(2);
  expect(heartbeat.mock.calls[0]).toEqual(heartbeat.mock.calls[1]);
  expect(f.effects).toEqual([
    'scoped-claim',
    'existing-extraction',
    'scoped-finalize',
    'scoped-purge',
  ]);
});

it('does not admit work until the single heartbeat revalidation is acknowledged', async () => {
  const f = fixture('operating');
  let finish!: (value: Awaited<ReturnType<typeof f.repository.voiceEpochHeartbeat>>) => void;
  const heartbeat = jest
    .fn(f.repository.voiceEpochHeartbeat)
    .mockRejectedValueOnce(new Error('Query read timeout'))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  f.repository.voiceEpochHeartbeat = heartbeat;
  const tick = f.worker.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
  expect(heartbeat).toHaveBeenCalledTimes(2);
  expect(f.effects).toEqual([]);
  finish({ enabled: false, mode: 'operating' });
  await tick;
  expect(f.effects).toEqual([]);
});

it('remains fail-closed after two heartbeat timeouts and never retries financial work', async () => {
  const f = fixture('operating');
  const heartbeat = jest
    .fn(f.repository.voiceEpochHeartbeat)
    .mockRejectedValue(new Error('Query read timeout'));
  f.repository.voiceEpochHeartbeat = heartbeat;
  await f.worker.tick();
  expect(heartbeat).toHaveBeenCalledTimes(2);
  expect(f.effects).toEqual(['closed:runtime_failed']);
  await f.worker.tick();
  expect(heartbeat).toHaveBeenCalledTimes(2);
  expect(f.effects).toEqual(['closed:runtime_failed']);
});

it('waits for heartbeat revalidation before finalizing extraction already in flight', async () => {
  jest.useFakeTimers();
  const f = fixture('operating');
  let finishHeartbeat!: (
    value: Awaited<ReturnType<typeof f.repository.voiceEpochHeartbeat>>,
  ) => void;
  let finishExtraction!: (value: boolean) => void;
  // The startup heartbeat succeeds; only the background pulse times out.
  const heartbeat = jest
    .fn(f.repository.voiceEpochHeartbeat)
    .mockImplementationOnce(() => Promise.resolve({ enabled: true, mode: 'operating' }))
    .mockRejectedValueOnce(new Error('Query read timeout'))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishHeartbeat = resolve;
        }),
    );
  f.repository.voiceEpochHeartbeat = heartbeat;
  f.engine.processVoiceClaim = () =>
    new Promise((resolve) => {
      finishExtraction = resolve;
    });
  try {
    f.worker.start();
    await jest.advanceTimersByTimeAsync(5000);
    expect(heartbeat).toHaveBeenCalledTimes(3);
    finishExtraction(true);
    await jest.advanceTimersByTimeAsync(0);
    expect(f.effects).toEqual(['scoped-claim']);
    finishHeartbeat({ enabled: true, mode: 'operating' });
    await jest.advanceTimersByTimeAsync(0);
    expect(f.effects).toEqual(['scoped-claim', 'scoped-finalize', 'scoped-purge']);
  } finally {
    finishExtraction(true);
    finishHeartbeat({ enabled: false, mode: 'operating' });
    await jest.advanceTimersByTimeAsync(0);
    await f.worker.stop();
    jest.useRealTimers();
  }
});

it('does not begin a claim when stopped while the heartbeat is in flight', async () => {
  const f = fixture('operating');
  let finish!: (value: Awaited<ReturnType<typeof f.repository.voiceEpochHeartbeat>>) => void;
  f.repository.voiceEpochHeartbeat = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const tick = f.worker.tick();
  const stopped = f.worker.stop();
  finish({ enabled: true, mode: 'operating' });
  await tick;
  await stopped;
  expect(f.effects).toEqual([]);
  expect(f.observations).toEqual([]);
});

it('shares one revalidation between tick and timer without starting a second retry', async () => {
  jest.useFakeTimers();
  const f = fixture('operating');
  let finish!: (value: Awaited<ReturnType<typeof f.repository.voiceEpochHeartbeat>>) => void;
  const heartbeat = jest
    .fn(f.repository.voiceEpochHeartbeat)
    .mockRejectedValueOnce(new Error('Query read timeout'))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  f.repository.voiceEpochHeartbeat = heartbeat;
  try {
    f.worker.start();
    await jest.advanceTimersByTimeAsync(5000);
    expect(heartbeat).toHaveBeenCalledTimes(2);
    expect(f.effects).toEqual([]);
    finish({ enabled: false, mode: 'operating' });
    await jest.advanceTimersByTimeAsync(0);
    expect(f.effects).toEqual([]);
  } finally {
    finish({ enabled: false, mode: 'operating' });
    await jest.advanceTimersByTimeAsync(0);
    await f.worker.stop();
    jest.useRealTimers();
  }
});

it.each(['VOICE_SCOPE_INVALID', 'Connection terminated unexpectedly'])(
  'never retries a heartbeat rejection: %s',
  async (reason) => {
    const f = fixture('operating');
    const heartbeat = jest
      .fn(f.repository.voiceEpochHeartbeat)
      .mockRejectedValue(new Error(reason));
    f.repository.voiceEpochHeartbeat = heartbeat;
    await f.worker.tick();
    expect(heartbeat).toHaveBeenCalledTimes(1);
    expect(f.effects).toEqual(['closed:runtime_failed']);
  },
);

it('does not retry financial finalization after a query read timeout', async () => {
  const f = fixture('operating');
  const finalize = jest
    .fn(f.repository.finalizeVoiceEpoch)
    .mockRejectedValue(new Error('Query read timeout'));
  f.repository.finalizeVoiceEpoch = finalize;
  await f.worker.tick();
  expect(finalize).toHaveBeenCalledTimes(1);
  expect(f.effects).toEqual(['scoped-claim', 'existing-extraction', 'closed:runtime_failed']);
});

it('runs automatic extraction and finalization through only epoch-scoped capabilities', async () => {
  const f = fixture();
  await f.worker.tick();
  expect(f.effects).toEqual(['scoped-claim', 'existing-extraction', 'scoped-finalize']);
});
it('does not process financial work after admission has closed', async () => {
  const f = fixture();
  f.disable();
  await f.worker.tick();
  expect(f.effects).toEqual([]);
});
it('closes the canary after extraction failure without starting finalization or a second occurrence', async () => {
  const f = fixture();
  f.engine.processVoiceClaim = () => Promise.resolve(false);
  await f.worker.tick();
  await f.worker.tick();
  expect(f.effects).toEqual(['scoped-claim', 'closed:extraction_failed']);
});
it('allows ordinary extraction retries under existing engine policy without broadening claims', async () => {
  const f = fixture('operating');
  f.engine.processVoiceClaim = () => Promise.resolve(false);
  await f.worker.tick();
  expect(f.effects).toEqual(['scoped-claim', 'scoped-finalize', 'scoped-purge']);
});
it('does not overlap polls or finalize while an extraction is still in flight', async () => {
  const f = fixture();
  let finish!: (value: boolean) => void;
  f.engine.processVoiceClaim = () =>
    new Promise<boolean>((resolve) => {
      finish = resolve;
    });
  const first = f.worker.tick();
  await new Promise<void>((resolve) => setImmediate(resolve));
  await f.worker.tick();
  expect(f.effects).toEqual(['scoped-claim']);
  finish(true);
  await first;
  expect(f.effects).toEqual(['scoped-claim', 'scoped-finalize']);
});

it('graceful operating worker stop aborts in-flight extraction without closing persistent Posting', async () => {
  const f = fixture('operating');
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  f.engine.processVoiceClaim = (_claim: unknown, signal?: AbortSignal) =>
    new Promise<boolean>((resolve) => {
      if (!signal) throw new Error('VOICE_ABORT_SIGNAL_REQUIRED');
      signal.addEventListener(
        'abort',
        () => {
          resolve(false);
        },
        { once: true },
      );
      started();
    });
  const running = f.worker.tick();
  await ready;
  await f.worker.stop();
  await running;
  await f.worker.tick();
  expect(f.effects).toEqual(['scoped-claim']);
  const replacement = fixture('operating');
  await replacement.worker.tick();
  expect(replacement.effects).toEqual([
    'scoped-claim',
    'existing-extraction',
    'scoped-finalize',
    'scoped-purge',
  ]);
});

it('actual operating runtime failure closes only its financial generation', async () => {
  const f = fixture('operating');
  f.repository.claimVoiceEpochWork = () => Promise.reject(new Error('database unavailable'));
  await f.worker.tick();
  expect(f.effects).toEqual(['closed:runtime_failed']);
});

it.each(['heartbeat', 'claim'])('closes its epoch after a hostile %s rejection', async (stage) => {
  const f = fixture('operating');
  const hostile = new Proxy(new Error(), {
    getPrototypeOf() {
      throw new Error('SECRET_TRAP');
    },
  });
  const rejection = () => Promise.reject(hostile);
  if (stage === 'heartbeat') f.repository.voiceEpochHeartbeat = rejection;
  else f.repository.claimVoiceEpochWork = rejection;
  await expect(f.worker.tick()).resolves.toBeUndefined();
  expect(f.effects).toEqual(['closed:runtime_failed']);
});

it('contains a revoked proxy closure rejection after aborting financial work', async () => {
  const f = fixture('operating');
  const revoked = Proxy.revocable(new Error(), {});
  revoked.revoke();
  f.repository.claimVoiceEpochWork = () => Promise.reject(new Error('Query read timeout'));
  const close = jest.fn(() => Promise.reject(revoked.proxy));
  f.repository.closeVoiceEpoch = close;
  await expect(f.worker.tick()).resolves.toBeUndefined();
  expect(close).toHaveBeenCalledWith(epoch, 'runtime_failed');
  expect(f.effects).toEqual([]);
});

it('still closes its epoch when the diagnostic output itself fails', async () => {
  const f = fixture('operating');
  f.repository.claimVoiceEpochWork = () => Promise.reject(new Error('Query read timeout'));
  const output = jest.spyOn(process.stdout, 'write').mockImplementation(() => {
    throw new Error('OUTPUT_UNAVAILABLE');
  });
  try {
    await expect(f.worker.tick()).resolves.toBeUndefined();
    expect(f.effects).toEqual(['closed:runtime_failed']);
  } finally {
    output.mockRestore();
  }
});

it('never resumes financial claims or finalization after runtime failure when closure also fails', async () => {
  const f = fixture('operating');
  const claimWork = f.repository.claimVoiceEpochWork;
  f.repository.claimVoiceEpochWork = () => Promise.reject(new Error('Query read timeout'));
  f.repository.closeVoiceEpoch = () => Promise.reject(new Error('Connection terminated'));
  await f.worker.tick();
  // Database availability returning must not silently reopen a failed runtime.
  f.repository.claimVoiceEpochWork = claimWork;
  await f.worker.tick();
  expect(f.effects).toEqual([]);
});
