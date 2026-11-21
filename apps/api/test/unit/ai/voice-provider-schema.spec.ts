import { createHash } from 'node:crypto';
import { VOICE_OUTPUT_SCHEMA } from '../../../src/ai/ai.schemas';
import {
  normalizeVertexVoiceOutput,
  VERTEX_VOICE_OUTPUT_SCHEMA,
} from '../../../src/ai/voice-provider-schema';

const supported = {
  outcome: 'supported',
  transcript: 'Fictional groceries expense',
  language: 'en',
  confidence: 0.8,
  unsupportedReason: '',
  amountMinor: '1500',
  currency: 'SAR',
  accountId: 'ACCOUNT-1',
  categoryId: 'CATEGORY-1',
  date: '2026-10-03',
  merchant: 'Fictional shop',
  note: 'Fictional note',
  proposalConfidence: 0.7,
};
const unsupported = {
  ...supported,
  outcome: 'unsupported',
  unsupportedReason: 'transfer',
  amountMinor: '',
  currency: '',
  accountId: '',
  categoryId: '',
  date: '',
  merchant: '',
  note: '',
  proposalConfidence: 0,
};

describe('Vertex Voice transport boundary', () => {
  it('leaves the canonical schema unchanged and emits only the conservative typed surface', () => {
    expect(createHash('sha256').update(JSON.stringify(VOICE_OUTPUT_SCHEMA)).digest('hex')).toBe(
      'c716fc1a49dc2aa0689963a12a53f53f68857a4c3b3e407ae54800a03e50501a',
    );
    expect([...VERTEX_VOICE_OUTPUT_SCHEMA.required].sort()).toEqual(Object.keys(supported).sort());
    expect(VERTEX_VOICE_OUTPUT_SCHEMA.additionalProperties).toBe(false);
    for (const field of Object.values(VERTEX_VOICE_OUTPUT_SCHEMA.properties)) {
      expect(['string', 'number']).toContain(field.type);
      expect(Object.keys(field).every((key) => ['type', 'enum', 'description'].includes(key))).toBe(
        true,
      );
    }
  });

  it.each(['1500', '-1500'])(
    'preserves signed minor units %s and every reviewed financial value',
    (amountMinor) => {
      expect(normalizeVertexVoiceOutput({ ...supported, amountMinor })).toEqual({
        schemaVersion: 1,
        outcome: 'supported',
        transcript: supported.transcript,
        language: 'en',
        confidence: 0.8,
        proposal: {
          schemaVersion: 1,
          type: 'transaction.create',
          amountMinor,
          currency: 'SAR',
          accountId: 'ACCOUNT-1',
          categoryId: 'CATEGORY-1',
          date: '2026-10-03',
          merchant: 'Fictional shop',
          note: 'Fictional note',
          confidence: 0.7,
        },
      });
    },
  );

  it('maps only the three documented absent-value sentinels to null', () => {
    const value = normalizeVertexVoiceOutput({
      ...supported,
      categoryId: '',
      merchant: '',
      note: '',
    });
    expect(value).toMatchObject({ proposal: { categoryId: null, merchant: null, note: null } });
    expect(() => normalizeVertexVoiceOutput({ ...supported, accountId: '' })).toThrow(
      'AI_SCHEMA_INVALID',
    );
  });

  it.each(['transfer', 'multiple', 'obligation', 'unclear'])(
    'preserves unsupported %s without a proposal',
    (unsupportedReason) => {
      expect(normalizeVertexVoiceOutput({ ...unsupported, unsupportedReason })).toEqual({
        schemaVersion: 1,
        outcome: 'unsupported',
        transcript: supported.transcript,
        language: 'en',
        confidence: 0.8,
        unsupportedReason,
      });
    },
  );

  it.each([
    { amountMinor: 1500 },
    { amountMinor: '0' },
    { amountMinor: '01' },
    { amountMinor: '15.00' },
    { amountMinor: '+1500' },
    { amountMinor: ' 1500' },
    { amountMinor: '9007199254740992' },
    { amountMinor: '-9007199254740992' },
    { currency: 'sar' },
    { currency: 'USDD' },
    { accountId: null },
    { accountId: 'CATEGORY-1' },
    { categoryId: 'ACCOUNT-1' },
    { categoryId: null },
    { date: '2026-02-30' },
    { date: '2026-13-01' },
    { date: '' },
    { language: ['en'] },
    { language: 'fr' },
    { outcome: ['supported'] },
    { confidence: NaN },
    { confidence: Infinity },
    { confidence: -0.1 },
    { proposalConfidence: 1.01 },
    { merchant: null },
    { merchant: '\u0000' },
    { note: 'x'.repeat(501) },
    { transcript: 'م'.repeat(4097) },
    { unsupportedReason: 'transfer' },
    { schemaVersion: 99 },
    { type: 'transaction.delete' },
    { proposal: {} },
    { tool: 'sql' },
    { authorization: 'forbidden' },
    { __proto__: null, extra: true },
  ])('rejects malformed or adversarial supported output %#', (patch) => {
    expect(() => normalizeVertexVoiceOutput({ ...supported, ...patch })).toThrow(
      'AI_SCHEMA_INVALID',
    );
  });

  it.each(['amountMinor', 'currency', 'accountId', 'categoryId', 'date', 'merchant', 'note'])(
    'rejects hidden financial field %s in the unsupported branch',
    (field) => {
      expect(() => normalizeVertexVoiceOutput({ ...unsupported, [field]: 'hidden' })).toThrow(
        'AI_SCHEMA_INVALID',
      );
    },
  );

  it.each([
    { unsupportedReason: '' },
    { unsupportedReason: ['transfer'] },
    { proposalConfidence: 0.1 },
  ])('rejects malformed unsupported output %#', (patch) => {
    expect(() => normalizeVertexVoiceOutput({ ...unsupported, ...patch })).toThrow(
      'AI_SCHEMA_INVALID',
    );
  });

  it.each([null, [], 'json', 1])('rejects non-object output %#', (value) => {
    expect(() => normalizeVertexVoiceOutput(value)).toThrow('AI_SCHEMA_INVALID');
  });

  it('rejects missing own fields and prototype-key smuggling rather than discarding data', () => {
    const missing: Record<string, unknown> = { ...supported };
    delete missing.note;
    expect(() => normalizeVertexVoiceOutput(missing)).toThrow('AI_SCHEMA_INVALID');
    expect(() => normalizeVertexVoiceOutput(Object.create(supported) as unknown)).toThrow(
      'AI_SCHEMA_INVALID',
    );
    expect(() =>
      normalizeVertexVoiceOutput(
        JSON.parse(JSON.stringify(supported).slice(0, -1) + ',"__proto__":{}}') as unknown,
      ),
    ).toThrow('AI_SCHEMA_INVALID');
  });
});
