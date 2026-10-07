import { AiWorker } from '../../../src/ai/ai.worker';

it.each(['MASARIFI_VOICE_ANALYSIS_ONLY', 'MASARIFI_AI_ASSISTANT_ONLY'])(
  'keeps a scoped %s process alive between empty polls',
  async (scopeFlag) => {
    const setTimer = global.setInterval;
    let scheduled: NodeJS.Timeout | undefined;
    jest.spyOn(global, 'setInterval').mockImplementation((callback, ms, ...args) => {
      scheduled = setTimer(callback, ms, ...args);
      return scheduled;
    });
    const worker = new AiWorker(
      { claimAnalysisPurges: () => Promise.resolve([]) } as never,
      {} as never,
      {} as never,
      {
        get: (key: string) => key === scopeFlag,
        getRequired: (key: string) =>
          key === 'MASARIFI_AI_PROVIDER_ENABLED'
            ? false
            : key === 'MASARIFI_AI_WORKER_POLL_MS'
              ? 10000
              : 1,
      } as never,
    );
    try {
      worker.start();
      expect(scheduled?.hasRef()).toBe(true);
    } finally {
      await worker.stop();
    }
  },
);

it('runs extraction and cleanup without reaching general work or financial finalization', async () => {
  const reached: string[] = [];
  const repository = {
    claimAnalysisWork: () => {
      reached.push('analysis');
      return Promise.resolve([]);
    },
    claimAnalysisPurges: () => {
      reached.push('purge');
      return Promise.resolve([]);
    },
    claimWork: () => {
      return Promise.reject(new Error('UNRELATED_WORK_CLAIMED'));
    },
    finalizeVoiceBatches: () => {
      return Promise.reject(new Error('FINANCIAL_FINALIZATION_REACHED'));
    },
    claimPurges: () => {
      return Promise.reject(new Error('UNSCOPED_PURGE_REACHED'));
    },
  };
  const worker = new AiWorker(
    repository as never,
    {} as never,
    {} as never,
    {
      get: (key: string) => key === 'MASARIFI_VOICE_ANALYSIS_ONLY',
      getRequired: (key: string) => (key === 'MASARIFI_AI_PROVIDER_ENABLED' ? true : 1),
    } as never,
  );
  await worker.runOnce();
  expect(reached).toEqual(['analysis', 'purge']);
  await expect(worker.runJob('voice.finalize')).rejects.toThrow('VOICE_ANALYSIS_JOB_FORBIDDEN');
});
