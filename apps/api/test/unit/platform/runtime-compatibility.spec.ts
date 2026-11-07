import { HealthController } from '../../../src/platform/health/health.controller';

it('exposes cross-feature protocol compatibility independently of a release image', () => {
  const controller = new HealthController({} as never);
  const response = (controller as HealthController & { compatibility(): unknown }).compatibility();
  expect(response).toEqual({
    schemaVersion: 1,
    contracts: {
      voiceSession: 2,
      voiceBatch: 3,
      voiceExtraction: 3,
      voiceWorker: 1,
      voiceConfirmation: 2,
      assistantDirect: 2,
      assistantProvider: 1,
      manualReceipt: 1,
    },
  });
});
