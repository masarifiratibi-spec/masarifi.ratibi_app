import { VoiceCaptureError } from '@/services/contracts/voice-capture-service';

it('uses safe localized error codes instead of provider messages', () => {
  const error = new VoiceCaptureError('analysis_failed');
  expect(error.code).toBe('analysis_failed');
  expect(error.message).not.toContain('provider');
});
