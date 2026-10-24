type VoiceTiming =
  | 'permission'
  | 'audio_mode'
  | 'native_prepare'
  | 'native_start'
  | 'native_stop'
  | 'native_completion'
  | 'native_release'
  | 'file_check'
  | 'journal_handoff'
  | 'tap_to_recording'
  | 'handoff_to_ready';
const timings: Partial<Record<VoiceTiming, number[]>> = {};
// Bounded timing-only instrumentation: no owner, audio, financial fields or identifiers.
export function recordVoiceTiming(
  stage: VoiceTiming,
  milliseconds: number
): void {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return;
  timings[stage] = [
    ...(timings[stage] ?? []).slice(-19),
    Math.round(milliseconds)
  ];
  if (
    process.env.EXPO_PUBLIC_VOICE_TIMING_ENABLED === 'true' &&
    process.env.EXPO_PUBLIC_API_URL ===
      'https://api.staging.masarifiratibi.com'
  )
    console.info('VOICE_TIMING', stage, Math.round(milliseconds));
}
export async function measureVoiceTiming<T>(
  stage: VoiceTiming,
  action: () => Promise<T>
): Promise<T> {
  const started = performance.now();
  try {
    return await action();
  } finally {
    recordVoiceTiming(stage, performance.now() - started);
  }
}
export function readVoiceTimings(): Readonly<
  Partial<Record<VoiceTiming, readonly number[]>>
> {
  return Object.fromEntries(
    Object.entries(timings).map(([stage, values]) => [stage, [...values]])
  );
}
