import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { parseVoiceWorkerOutput } from '../../../src/ai/ai.schemas';
import { normalizeVertexVoiceOutput } from '../../../src/ai/voice-provider-schema';
import { AiGateway, type EffectiveAiRoute } from '../../../src/ai/ai.gateway';
import { VOICE_OUTPUT_SCHEMA } from '../../../src/ai/ai.schemas';

type Complete = (
  request: typeof input,
) => Promise<{ value: ReturnType<typeof parseVoiceWorkerOutput> }>;
const contract = createRequire(__filename)(
  resolve(process.cwd(), '../../scripts/voice-canary-contract.cjs'),
) as {
  completeCanary: (
    complete: Complete,
    request: typeof input,
    refs: typeof references,
    evidence: Record<string, unknown>,
    readRaw?: () => unknown,
  ) => ReturnType<Complete>;
  categoryEvidence: (
    value: unknown,
    raw: unknown,
    refs: typeof references,
  ) => Record<string, string | boolean>;
  receiptEvidence: (receipt: Record<string, unknown>) => Record<string, unknown>;
  saveCanaryResult: (
    save: () => Promise<void>,
    args: unknown[],
    evidence: Record<string, unknown>,
  ) => Promise<void>;
  assertCanaryEvidence: (evidence: Record<string, unknown>) => void;
};
const food = '04000000-0000-4000-8000-000000000002';
const shopping = '04000000-0000-4000-8000-000000000006';
const references = [
  {
    alias: 'CATEGORY-2',
    id: food,
    kind: 'category',
    version: 1,
    data: { kind: 'expense', labelEn: 'Food', labelAr: 'الطعام' },
  },
  {
    alias: 'CATEGORY-6',
    id: shopping,
    kind: 'category',
    version: 1,
    data: { kind: 'expense', labelEn: 'Shopping', labelAr: 'التسوق' },
  },
  {
    alias: 'ACCOUNT-1',
    id: 'cash',
    kind: 'account',
    version: 1,
    data: { type: 'cash', currency: 'SAR' },
  },
];
const context = {
  capture: { referenceLocalDate: '2026-10-03' },
  references: references.map(({ alias, kind, version, data }) => ({ alias, kind, version, data })),
};
const raw = {
  outcome: 'supported',
  transcript: 'I spent fifteen riyals on groceries using cash',
  language: 'en',
  confidence: 0.9,
  unsupportedReason: '',
  amountMinor: '1500',
  currency: 'SAR',
  accountId: 'ACCOUNT-1',
  categoryId: 'CATEGORY-2',
  date: '2026-10-03',
  merchant: '',
  note: '',
  proposalConfidence: 0.9,
};
const input = { userContent: [{ text: JSON.stringify(context) }], parse: parseVoiceWorkerOutput };

describe('operational Voice canary contract', () => {
  it('passes the actual final harness gate after successful persistence without completeWork', async () => {
    const evidence = {
      dispatches: 1,
      claimed: 1,
      envelope: { model: 'google/gemini-3.5-flash-lite', finishReason: 'stop' },
      receipt: { fallbackUsed: false },
    };
    const complete: Complete = (request) =>
      Promise.resolve({ value: request.parse(normalizeVertexVoiceOutput(raw)) });
    await contract.completeCanary(complete, input, references, evidence, () => raw.categoryId);
    await contract.saveCanaryResult(() => Promise.resolve(), [], evidence);
    expect(() => {
      contract.assertCanaryEvidence(evidence);
    }).not.toThrow();
    expect(evidence).toMatchObject({
      persistence: true,
      workStatus: 'proposed',
      failureCode: null,
    });
  });
  it('never records persistence success when SQL save fails', async () => {
    const evidence = {};
    await expect(
      contract.saveCanaryResult(() => Promise.reject(new Error('SQL_REJECTED')), [], evidence),
    ).rejects.toThrow('SQL_REJECTED');
    expect(evidence).toMatchObject({ resolution: true, persistence: false });
    expect(evidence).not.toHaveProperty('proposalPersisted');
  });
  it('does not expose arbitrary provider receipt strings even before a routing rejection', () => {
    const result = contract.receiptEvidence({
      generationId: 'private transcript bearer token',
      model: 'owner@example.com',
      provider: 'customer label',
      fallbackUsed: false,
      usage: { inputTokens: 1, outputTokens: 1, cost: 0.00001 },
      latencyMs: 10,
    });
    expect(result).toMatchObject({ generationId: null, model: null, requestedProvider: null });
    expect(JSON.stringify(result)).not.toMatch(/private|bearer|token|@|customer/);
  });
  it('keeps semantic failure outside the real gateway canonical-error catch', async () => {
    const route: EffectiveAiRoute = {
      workload: 'voice_transcription',
      primary: { modelId: 'google/gemini-3.5-flash-lite', provider: 'google-vertex' },
      fallbacks: [],
      providerAllowlist: ['google-vertex'],
      zdrRequired: true,
      maxPrice: { prompt: '0.000001', completion: '0.000003' },
      limits: { inputTokens: 128000, outputTokens: 1200, timeoutMs: 120000 },
      prompt: { template: 'Offline fixture', schemaVersion: 1 },
      safetyRules: [
        {
          key: 'input',
          type: 'input_block',
          configuration: { denyControl: true, denyBidiControls: true, maxUtf8Bytes: 8192 },
        },
        {
          key: 'output',
          type: 'output_block',
          configuration: {
            forbiddenKeys: ['tool', 'tools', 'sql', 'url', 'callback', 'authorization', 'secret'],
          },
        },
      ],
    };
    const fetcher = jest.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'gen-offline',
            model: route.primary.modelId,
            provider: 'Google Vertex',
            choices: [
              {
                finish_reason: 'stop',
                message: { content: JSON.stringify({ ...raw, categoryId: 'CATEGORY-6' }) },
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 10, cost: 0.00001 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    const gateway = new AiGateway({ apiKey: 'offline-placeholder', fetcher });
    const complete: Complete = (request) =>
      gateway.complete({ ...request, route, schema: VOICE_OUTPUT_SCHEMA, requestId: 'offline' });
    const evidence = {};
    await expect(
      contract.completeCanary(complete, input, references, evidence, () => 'CATEGORY-6'),
    ).rejects.toThrow('VOICE_CANARY_SEMANTIC_FAILED');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(evidence).toMatchObject({ canonicalValidation: true, semanticAccepted: false });
  });
  it('evaluates Food against the exact outgoing descriptors without changing the parser or result', async () => {
    const evidence = {};
    const complete = jest.fn((request: typeof input) =>
      Promise.resolve({
        value: request.parse(normalizeVertexVoiceOutput(raw)),
      }),
    );
    const result = await contract.completeCanary(
      complete,
      input,
      references,
      evidence,
      () => raw.categoryId,
    );
    expect(result.value).toMatchObject({ proposal: { categoryId: 'CATEGORY-2' } });
    expect(evidence).toMatchObject({
      canonicalValidation: true,
      normalization: true,
      semanticAccepted: true,
      category: { classification: 'food', identifierForm: 'alias', unchanged: true },
    });
    expect(complete).toHaveBeenCalledTimes(1);
  });
  it.each(['missing', 'duplicate', 'descriptor', 'alias', 'kind'])(
    'blocks %s reference failure before dispatch',
    async (mode) => {
      const refs = structuredClone(references);
      const outgoing = structuredClone(context);
      const first = refs[0],
        second = refs[1],
        firstDescriptor = outgoing.references[0];
      if (!first || !second || !firstDescriptor) throw new Error('fixture missing');
      if (mode === 'missing') refs.shift();
      if (mode === 'duplicate') refs.push(first);
      if (mode === 'descriptor') firstDescriptor.data.labelEn = 'Changed';
      if (mode === 'alias') second.alias = first.alias;
      if (mode === 'kind') first.kind = 'account';
      const complete = jest.fn();
      await expect(
        contract.completeCanary(
          complete,
          { ...input, userContent: [{ text: JSON.stringify(outgoing) }] },
          refs,
          {},
        ),
      ).rejects.toThrow('VOICE_CANARY_REFERENCE_INVALID');
      expect(complete).not.toHaveBeenCalled();
    },
  );
  it('reports semantic rejection after canonical parsing, not as AI_SCHEMA_INVALID', async () => {
    const evidence = {};
    const complete = jest.fn((request: typeof input) =>
      Promise.resolve({
        value: request.parse(normalizeVertexVoiceOutput({ ...raw, categoryId: 'CATEGORY-6' })),
      }),
    );
    await expect(
      contract.completeCanary(complete, input, references, evidence, () => 'CATEGORY-6'),
    ).rejects.toThrow('VOICE_CANARY_SEMANTIC_FAILED');
    expect(evidence).toMatchObject({
      canonicalValidation: true,
      semanticAccepted: false,
      category: { classification: 'shopping' },
    });
  });
  it('keeps canonical rejection distinct from semantic rejection', async () => {
    const evidence = {};
    const complete = (request: typeof input) =>
      Promise.resolve({
        value: request.parse({ unexpected: true }),
      });
    await expect(contract.completeCanary(complete, input, references, evidence)).rejects.toThrow();
    expect(evidence).toMatchObject({ normalization: true, canonicalValidation: false });
    expect(evidence).not.toHaveProperty('semanticAccepted');
  });
  it('allows only fixture classifications and identifier forms in diagnostics', () => {
    for (const value of [
      'CATEGORY-2',
      food,
      'CATEGORY-6',
      'ACCOUNT-1',
      null,
      '',
      'secret transcript bearer owner@example.com',
    ]) {
      const result = contract.categoryEvidence(value, value, references);
      expect([
        'food',
        'shopping',
        'other_supplied_expense',
        'unknown',
        'missing',
        'wrong_kind',
      ]).toContain(result.classification);
      expect(JSON.stringify(result)).not.toMatch(/04000000|CATEGORY-|secret|bearer|@|Food|التسوق/);
    }
  });
});
