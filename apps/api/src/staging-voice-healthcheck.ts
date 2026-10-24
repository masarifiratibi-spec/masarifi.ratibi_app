import { readFileSync } from 'node:fs';

export function healthyVoiceRuntime(state: Record<string, unknown>, now = Date.now()): boolean {
  return (
    typeof state.sourceSha === 'string' &&
    /^[a-f0-9]{40}$/.test(state.sourceSha) &&
    typeof state.epochId === 'string' &&
    /^[a-f0-9-]{36}$/.test(state.epochId) &&
    typeof state.observedAt === 'number' &&
    now >= state.observedAt &&
    now - state.observedAt <= 15000 &&
    state.sourceSha === process.env.MASARIFI_RELEASE_VERSION &&
    state.epochId === process.env.MASARIFI_STAGING_VOICE_EPOCH_ID &&
    state.enabled === true
  );
}
if (require.main === module) {
  try {
    const state = JSON.parse(readFileSync('/tmp/staging-voice-health.json', 'utf8')) as Record<
      string,
      unknown
    >;
    process.exitCode = healthyVoiceRuntime(state) ? 0 : 1;
  } catch {
    process.exitCode = 1;
  }
}
