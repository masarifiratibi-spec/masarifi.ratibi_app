import { decideVoiceBatch } from '../../../src/ai/voice-batch';

const context = {
  recordedAt: '2026-10-03T21:30:00.000Z',
  timezoneOffsetMinutes: -180,
  defaultAccountId: '11111111-1111-4111-8111-111111111111',
  references: [
    {
      alias: 'ACCOUNT-1',
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'account',
      data: { currency: 'SAR', type: 'cash' },
    },
    {
      alias: 'CATEGORY-1',
      id: '22222222-2222-4222-8222-222222222222',
      kind: 'category',
      data: { kind: 'expense' },
    },
  ],
};
const event = (patch = {}) => ({
  kind: 'expense',
  amountMinor: '2500',
  currency: '',
  currencySource: 'omitted',
  accountId: '',
  accountSource: 'omitted',
  categoryId: 'CATEGORY-1',
  date: '',
  dateSource: 'omitted',
  merchant: '',
  note: '',
  independent: true,
  confidence: 1,
  ...patch,
});
const batch = (events: unknown[]) => ({ complete: true, language: 'en', events });

describe('Voice batch automatic or silent skip', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-04T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());
  it('retains independent identical occurrences and defaults only omitted fields', () => {
    const decisions = decideVoiceBatch(batch([event(), event()]), context);
    expect(decisions).toHaveLength(2);
    expect(decisions.map((d) => d.status)).toEqual(['eligible', 'eligible']);
    expect(decisions[0]).toMatchObject({
      command: {
        kind: 'expense',
        amountMinor: 2500,
        currency: 'SAR',
        accountId: context.defaultAccountId,
        occurredAt: '2026-10-03T21:00:00.000Z',
      },
    });
  });
  it('keeps safe siblings while retaining only reason codes for unsafe events', () => {
    const decisions = decideVoiceBatch(
      batch([
        event(),
        event({ amountMinor: '', merchant: 'private shop' }),
        event({ accountSource: 'ambiguous', accountId: 'ACCOUNT-1' }),
        event({ kind: 'repayment' }),
      ]),
      context,
    );
    expect(decisions).toEqual([
      expect.objectContaining({ status: 'eligible' }),
      { status: 'skipped', reason: 'missing_amount' },
      { status: 'skipped', reason: 'ambiguous_account' },
      { status: 'skipped', reason: 'unsupported_event' },
    ]);
    expect(JSON.stringify(decisions)).not.toContain('private shop');
  });
  it('rejects incomplete and overflowing envelopes without accepting a prefix', () => {
    expect(() => decideVoiceBatch({ ...batch([event()]), complete: false }, context)).toThrow(
      'AI_SCHEMA_INVALID',
    );
    expect(() => decideVoiceBatch(batch(Array(6).fill(event())), context)).toThrow(
      'AI_SCHEMA_INVALID',
    );
    expect(() => decideVoiceBatch(batch(Array(10).fill(event())), context)).toThrow(
      'AI_SCHEMA_INVALID',
    );
  });
  it('never defaults contradictory omission or ambiguous currency evidence', () => {
    expect(
      decideVoiceBatch(
        batch([
          event({ currencySource: 'ambiguous' }),
          event({ dateSource: 'omitted', date: '2026-10-02' }),
          event({ currencySource: 'explicit', currency: '' }),
        ]),
        context,
      ),
    ).toEqual([
      { status: 'skipped', reason: 'currency_mismatch' },
      { status: 'skipped', reason: 'invalid_date' },
      { status: 'skipped', reason: 'currency_mismatch' },
    ]);
  });
  it('skips explicit ambiguous dates, wrong currencies and category kinds', () => {
    expect(
      decideVoiceBatch(
        batch([
          event({ dateSource: 'ambiguous' }),
          event({ currency: 'USD' }),
          event({ categoryId: 'CATEGORY-9' }),
        ]),
        context,
      ),
    ).toEqual([
      { status: 'skipped', reason: 'invalid_date' },
      { status: 'skipped', reason: 'currency_mismatch' },
      { status: 'skipped', reason: 'invalid_category' },
    ]);
  });
});
