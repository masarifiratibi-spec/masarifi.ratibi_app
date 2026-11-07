import { readVoiceTimings, recordVoiceTiming } from './voice-timing';

const originalFlag = process.env.EXPO_PUBLIC_VOICE_TIMING_ENABLED;
const originalUrl = process.env.EXPO_PUBLIC_API_URL;
afterEach(() => {
  process.env.EXPO_PUBLIC_VOICE_TIMING_ENABLED = originalFlag;
  process.env.EXPO_PUBLIC_API_URL = originalUrl;
  jest.restoreAllMocks();
});

test('exports timing-only evidence for an explicitly instrumented Staging build', () => {
  process.env.EXPO_PUBLIC_VOICE_TIMING_ENABLED = 'true';
  process.env.EXPO_PUBLIC_API_URL = 'https://api.staging.masarifiratibi.com';
  const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  recordVoiceTiming('handoff_to_ready', 3.7);
  expect(log).toHaveBeenCalledWith('VOICE_TIMING', 'handoff_to_ready', 4);
});

test('does not export timing evidence when instrumentation is disabled or outside Staging', () => {
  const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  process.env.EXPO_PUBLIC_VOICE_TIMING_ENABLED = 'false';
  process.env.EXPO_PUBLIC_API_URL = 'https://api.staging.masarifiratibi.com';
  recordVoiceTiming('native_release', 5);
  process.env.EXPO_PUBLIC_VOICE_TIMING_ENABLED = 'true';
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  recordVoiceTiming('native_release', 6);
  expect(log).not.toHaveBeenCalled();
});

test('rejects invalid timings and retains only the latest twenty samples', () => {
  process.env.EXPO_PUBLIC_VOICE_TIMING_ENABLED = 'false';
  for (let n = 0; n < 25; n++) recordVoiceTiming('journal_handoff', n);
  recordVoiceTiming('journal_handoff', Number.NaN);
  recordVoiceTiming('journal_handoff', -1);
  expect(readVoiceTimings().journal_handoff).toEqual(
    Array.from({ length: 20 }, (_, n) => n + 5)
  );
});
