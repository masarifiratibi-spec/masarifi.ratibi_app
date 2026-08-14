import { VoiceCaptureError } from '@/services/contracts/voice-capture-service';
import { createMockVoiceAnalyzerService } from './voice-analyzer-service';

const service = createMockVoiceAnalyzerService();

it.each(['clear_ar', 'clear_en', 'income', 'transfer'] as const)(
  'returns a reviewable proposal for %s', async (scenario) => {
    const transcript = await service.transcribe('private://audio', scenario);
    const group = await service.analyze({
      transcript, scenario, sessionId: 's', recordedAt: Date.now(), timezoneOffsetMinutes: 0
    });
    expect(group.proposals).toHaveLength(1);
  }
);

it('separates multiple transactions and maps safe failures', async () => {
  const transcript = await service.transcribe('private://audio', 'multiple');
  const group = await service.analyze({
    transcript, scenario: 'multiple', sessionId: 's', recordedAt: Date.now(), timezoneOffsetMinutes: 0
  });
  expect(group.proposals).toHaveLength(2);
  await expect(service.transcribe('private://audio', 'no_speech')).rejects.toEqual(
    new VoiceCaptureError('no_speech')
  );
  await expect(service.transcribe('private://audio', 'background_noise')).rejects.toEqual(
    new VoiceCaptureError('background_noise')
  );
  await expect(service.transcribe('private://audio', 'offline')).rejects.toEqual(
    new VoiceCaptureError('offline')
  );
});
