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
  );
  return {
    worker,
    effects,
    repository,
    engine,
    disable: () => {
      enabled = false;
    },
  };
}
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
