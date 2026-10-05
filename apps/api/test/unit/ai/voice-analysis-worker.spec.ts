import { AiWorker } from '../../../src/ai/ai.worker';

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
      get: () => true,
      getRequired: (key: string) => (key === 'MASARIFI_AI_PROVIDER_ENABLED' ? true : 1),
    } as never,
  );
  await worker.runOnce();
  expect(reached).toEqual(['analysis', 'purge']);
  await expect(worker.runJob('voice.finalize')).rejects.toThrow('VOICE_ANALYSIS_JOB_FORBIDDEN');
});
