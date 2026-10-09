import { AiGateway, type EffectiveAiRoute } from '../../../src/ai/ai.gateway';
import {
  VOICE_BATCH_OUTPUT_SCHEMA,
  decideVoiceBatch,
  parseVoiceBatchProviderOutput,
} from '../../../src/ai/voice-batch';

// Synthetic boundary fixtures, not the unavailable output of session ff491825.
const route: EffectiveAiRoute = {
  workload: 'voice_transcription',
  primary: { modelId: 'google/gemini-3.5-flash-lite', provider: 'google-vertex' },
  fallbacks: [],
  providerAllowlist: ['google-vertex'],
  zdrRequired: true,
  maxPrice: { prompt: '0.000001', completion: '0.000003' },
  limits: { inputTokens: 128000, outputTokens: 1200, timeoutMs: 60000 },
  prompt: { template: 'Bounded synthetic diagnostic fixture.', schemaVersion: 3 },
  safetyRules: [
    {
      key: 'global.input',
      type: 'input_block',
      configuration: { denyControl: true, denyBidiControls: true, maxUtf8Bytes: 8192 },
    },
    {
      key: 'global.output',
      type: 'output_block',
      configuration: {
        forbiddenKeys: ['tool', 'tools', 'sql', 'url', 'callback', 'authorization', 'secret'],
      },
    },
  ],
};
const requestId = 'aa4eb56d-f835-46b7-b36e-0167436516da';

function completion(content: unknown, patch = {}) {
  return {
    id: 'synthetic-diagnostic-generation',
    model: route.primary.modelId,
    usage: { prompt_tokens: 0, completion_tokens: 0, cost: 0 },
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }],
    ...patch,
  };
}

async function invoke(envelope: unknown) {
  let dispatches = 0;
  const gateway = new AiGateway({
    apiKey: 'synthetic',
    fetcher: () => {
      dispatches++;
      return Promise.resolve(
        new Response(JSON.stringify(envelope), {
          headers: { 'content-type': 'application/json' },
        }),
      );
    },
  });
  try {
    return await gateway.complete({
      route,
      schema: VOICE_BATCH_OUTPUT_SCHEMA,
      voiceBatch: true,
      userContent: 'Synthetic fixture only',
      parse: parseVoiceBatchProviderOutput,
      requestId,
    });
  } finally {
    expect(dispatches).toBe(1);
  }
}

describe('Voice schema failure diagnostics without output retention', () => {
  // Incident ff491825: matched generation hash; actual Google upstream status 429,
  // gateway HTTP 200, zero native usage, null finish reason. Raw I/O was not retained.
  // These are documented wire-shape variants of that observed provider failure.
  it.each(['envelope', 'choice'])(
    'maps an embedded 429 %s to bounded provider recovery before event parsing',
    async (location) => {
      const error = {
        code: 429,
        message: 'Rate limit exceeded',
        metadata: { error_type: 'rate_limit_exceeded' },
      };
      const envelope = completion(
        null,
        location === 'envelope'
          ? { error, choices: [] }
          : { choices: [{ finish_reason: null, error, message: { content: null } }] },
      );
      await expect(invoke(envelope)).rejects.toMatchObject({
        code: 'AI_TEMPORARILY_UNAVAILABLE',
        retryable: true,
        diagnostic: { failureStage: 'provider_completion', httpStatus: 429 },
      });
    },
  );

  it('does not accept valid financial content alongside an unknown provider error', async () => {
    await expect(
      invoke(
        completion(
          { complete: true, language: 'ar', events: [] },
          {
            error: { code: 'unrecognized', message: 'private body must never be logged' },
          },
        ),
      ),
    ).rejects.toMatchObject({ code: 'AI_UNAVAILABLE', retryable: false });
  });

  it.each([
    { code: 429, expected: 'AI_TEMPORARILY_UNAVAILABLE', retryable: true },
    { code: 400, expected: 'AI_UNAVAILABLE', retryable: false },
  ])(
    'fails closed for an error-only response without fabricating usage ($code)',
    async ({ code, expected, retryable }) => {
      await expect(invoke({ error: { code } })).rejects.toMatchObject({
        code: expected,
        retryable,
      });
    },
  );

  it.each([
    {
      content: { complete: false, language: 'ar', events: [] },
      field: 'complete',
      keyword: 'const',
    },
    {
      content: { complete: true, language: 'mixed', events: [] },
      field: 'language',
      keyword: 'enum',
    },
    { content: { complete: true, language: 'ar', events: null }, field: 'events', keyword: 'type' },
    { content: { complete: true, language: 'ar' }, field: 'events', keyword: 'required' },
    {
      content: { complete: true, language: 'ar', events: [], secret: 'never log this value' },
      field: '$',
      keyword: 'additionalProperties',
    },
  ])(
    'identifies rejected $field / $keyword without relaxing the envelope',
    async ({ content, field, keyword }) => {
      await expect(invoke(completion(content))).rejects.toMatchObject({
        code: 'AI_SCHEMA_INVALID',
        retryable: false,
        diagnostic: {
          failureStage: 'provider_output',
          requestId,
          rejectedFields: [field],
          rejectedKeywords: [keyword],
        },
      });
    },
  );

  it('distinguishes a terminal provider completion error from invalid financial fields', async () => {
    await expect(
      invoke(
        completion(null, {
          choices: [{ finish_reason: 'error', message: { content: null } }],
        }),
      ),
    ).rejects.toMatchObject({
      code: 'AI_SCHEMA_INVALID',
      retryable: false,
      diagnostic: {
        failureStage: 'provider_completion',
        requestId,
        rejectedFields: ['choices.finish_reason'],
        rejectedKeywords: ['enum'],
      },
    });
  });

  it('distinguishes invalid content JSON without including its body in the error', async () => {
    const result = invoke(
      completion(null, {
        choices: [{ finish_reason: 'stop', message: { content: '{private financial text' } }],
      }),
    );
    await expect(result).rejects.toMatchObject({
      diagnostic: {
        failureStage: 'provider_content',
        rejectedFields: ['choices.message.content'],
        rejectedKeywords: ['json'],
      },
    });
  });

  it('does not change valid compact event mapping', async () => {
    const result = await invoke(
      completion({
        complete: true,
        language: 'ar',
        events: [
          {
            s: 1,
            k: 'i',
            a: '-100',
            c: 'e:SAR',
            b: 'e:ACCOUNT-1',
            g: 'CATEGORY-1',
            d: 'e:2026-10-08',
            m: '',
            i: true,
            q: 1,
          },
        ],
      }),
    );
    expect(result.value.events).toEqual([
      {
        occurrence: 1,
        kind: 'income',
        amountMinor: '-100',
        currency: 'SAR',
        currencySource: 'explicit',
        accountId: 'ACCOUNT-1',
        accountSource: 'explicit',
        categoryId: 'CATEGORY-1',
        date: '2026-10-08',
        dateSource: 'explicit',
        merchant: '',
        note: '',
        independent: true,
        confidence: 1,
      },
    ]);
    // User-confirmed utterance: استلمت ريالًا سعوديًا واحدًا كراتب في حساب Voice Staging Test اليوم
    // Expected provider shape, not a claimed recovery of the historical output or ASR test.
    const decisions = decideVoiceBatch(result.value, {
      recordedAt: '2026-10-08T10:17:48.493Z',
      timezoneOffsetMinutes: -180,
      defaultAccountId: null,
      references: [
        {
          alias: 'ACCOUNT-1',
          id: 'b5b794eb-3bc4-4a6b-9724-a41c5d30b869',
          kind: 'account',
          data: { currency: 'SAR', name: 'Voice Staging Test' },
        },
        {
          alias: 'CATEGORY-1',
          id: '04000000-0000-4000-8000-000000000016',
          kind: 'category',
          data: { kind: 'income', name: 'Salary' },
        },
      ],
    });
    expect(decisions).toHaveLength(1);
    const decision = decisions[0];
    expect(decision?.status).toBe('eligible');
    if (decision?.status !== 'eligible') throw new Error('EXPECTED_VALID_SALARY');
    expect(decision.command).toMatchObject({
      kind: 'income',
      amountMinor: 100,
      currency: 'SAR',
      accountId: 'b5b794eb-3bc4-4a6b-9724-a41c5d30b869',
      categoryId: '04000000-0000-4000-8000-000000000016',
      occurredAt: '2026-10-08T10:17:48.493Z',
      source: 'voice',
    });
  });
});
