import { AiService } from '../../../src/ai/ai.service';

it.each([
  ['owner', 'staging-development', '3', false],
  ['owner', '', '3', true],
  ['other', 'staging-development', '3', true],
  ['owner', 'staging-development', '2', true],
  ['new-customer', '', '3', false, false],
  ['another-customer', 'staging-development', '3', false, false],
])(
  'applies configured posting policy for %s variant=%s contract=%s',
  async (userId, variant, contract, analysisOnly, configuredAnalysisOnly = true) => {
    let admitted: unknown;
    const repository = {
      workloadAvailable: () => Promise.resolve(true),
      createVoiceSession: (...args: unknown[]) => {
        admitted = args[4];
        return Promise.reject(new Error('ADMISSION_OBSERVED'));
      },
      createVoiceReviewSession: () => {
        admitted = { analysisOnly: true };
        return Promise.reject(new Error('ADMISSION_OBSERVED'));
      },
    };
    const config = {
      getRequired: (key: string) => (key === 'MASARIFI_AI_PROVIDER_ENABLED' ? true : 300),
      get: (key: string) =>
        (
          ({
            MASARIFI_VOICE_ANALYSIS_ONLY: configuredAnalysisOnly,
            MASARIFI_STAGING_VOICE_DEV_OWNER_ID: 'owner',
            SUPABASE_URL: 'https://qcffvfbpzvpwcwxwjyro.supabase.co',
          }) as Record<string, unknown>
        )[key],
    };
    const service = new AiService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      config as never,
    );
    await expect(
      service.createVoiceSession(
        { userId, sessionId: 'fixture', factorAgeSeconds: 0 },
        {
          locale: 'ar',
          durationMs: 1000,
          contentType: 'audio/mp4',
          sizeBytes: 64,
          contentHash: 'a'.repeat(64),
          recordedAt: new Date().toISOString(),
          timezoneOffsetMinutes: -180,
        },
        'fixture-create-idempotency-key',
        contract,
        variant,
      ),
    ).rejects.toThrow('ADMISSION_OBSERVED');
    expect(Boolean((admitted as { analysisOnly?: boolean }).analysisOnly)).toBe(analysisOnly);
  },
);
