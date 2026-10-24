import { AiWorker } from '../../../src/ai/ai.worker';
import { AiService } from '../../../src/ai/ai.service';

it('keeps granted consent separate from disabled provider admission and absent worker telemetry', async () => {
  const repository = {
    getAssistantAvailability: () =>
      Promise.resolve({
        status: 'disabled',
        limit: 5,
        used: 0,
        remaining: 5,
        resetsAt: '2026-09-16T00:00:00Z',
      }),
    getConsent: () => Promise.resolve({ granted: true }),
    workloadAvailable: () => Promise.resolve(false),
  };
  const service = new AiService(
    repository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { getRequired: () => true } as never,
  );
  await expect(
    service.getAssistantAvailability({
      userId: 'owner',
      sessionId: 'session',
      factorAgeSeconds: 0,
    }),
  ).resolves.toMatchObject({
    capabilities: { directRead: 'available', provider: 'disabled', actions: 'unknown' },
    worker: { status: 'unknown', lastSeenAt: null },
  });
});

it('keeps assistant-only polling away from Voice, finalization, purge and general reconciliation', async () => {
  const repository = {
    claimWork: jest.fn((...args: unknown[]) => {
      expect(args[0]).toBe('assistant.respond');
      return Promise.resolve([]);
    }),
    finalizeVoiceBatches: jest.fn(() => Promise.reject(new Error('UNRELATED'))),
    claimPurges: jest.fn(() => Promise.reject(new Error('UNRELATED'))),
  };
  const worker = new AiWorker(
    repository as never,
    {} as never,
    {} as never,
    { get: (key: string) => key === 'MASARIFI_AI_ASSISTANT_ONLY', getRequired: () => 1 } as never,
  );
  await worker.runOnce();
  expect(repository.claimWork).toHaveBeenCalledTimes(1);
  expect(repository.claimWork.mock.calls[0]?.[0]).toBe('assistant.respond');
  await expect(worker.runJob('voice.finalize')).rejects.toThrow('ASSISTANT_SCOPE_INVALID');
});
