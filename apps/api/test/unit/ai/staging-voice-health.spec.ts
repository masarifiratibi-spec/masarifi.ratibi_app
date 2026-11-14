import { healthyVoiceRuntime } from '../../../src/staging-voice-healthcheck';

it('requires fresh heartbeat, enabled admission and exact source/epoch', () => {
  const previous = { ...process.env };
  process.env.MASARIFI_RELEASE_VERSION = 'a'.repeat(40);
  process.env.MASARIFI_STAGING_VOICE_EPOCH_ID = '11111111-1111-4111-8111-111111111111';
  const state = {
    observedAt: 1000,
    sourceSha: process.env.MASARIFI_RELEASE_VERSION,
    epochId: process.env.MASARIFI_STAGING_VOICE_EPOCH_ID,
    enabled: true,
  };
  expect(healthyVoiceRuntime(state, 2000)).toBe(true);
  for (const [changed, now] of [
    [{}, 16001],
    [{ enabled: false }, 2000],
    [{ sourceSha: 'other' }, 2000],
    [{ epochId: 'other' }, 2000],
    [{ observedAt: 3000 }, 2000],
  ] as const) {
    expect(healthyVoiceRuntime({ ...state, ...changed }, now)).toBe(false);
  }
  process.env = previous;
});
