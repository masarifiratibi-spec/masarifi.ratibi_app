import { StagingVoiceWorker } from '../../../src/ai/staging-voice.worker';

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
  const engine = {
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
