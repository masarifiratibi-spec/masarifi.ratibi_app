import { decideVoiceBatch, parseVoiceBatchProviderOutput } from '../../../src/ai/voice-batch';

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
  occurrence: 1,
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
const compactEvent = (patch = {}) => ({
  s: 1,
  k: 'e',
  a: '2500',
  c: 'o:',
  b: 'o:',
  g: 'CATEGORY-1',
  d: 'o:',
  m: '',
  i: true,
  q: 1,
  ...patch,
});

describe('Voice batch automatic or silent skip', () => {
  it.each([
    ['ar', 'صرفت ٢٥ ريال سعودي على الطعام'],
    ['en', 'I spent 25 Saudi riyals on food'],
    ['ar', 'صرفت 25 Saudi riyals على food'],
  ])('does not execute duplicate extraction of one %s spoken occurrence (%s)', (language) => {
    const decisions = decideVoiceBatch(
      parseVoiceBatchProviderOutput({
        complete: true,
        language,
        events: [compactEvent({ s: 1 }), compactEvent({ s: 1, q: 0.95 })],
      }),
      context,
    );
    expect(decisions.filter((item) => item.status === 'eligible')).toHaveLength(1);
    expect(decisions[1]).toEqual({ status: 'skipped', reason: 'invalid_event' });
  });
  it.each(['ar', 'en'])('preserves identical %s statements actually spoken twice', (language) => {
    const decisions = decideVoiceBatch(
      parseVoiceBatchProviderOutput({
        complete: true,
        language,
        events: [compactEvent({ s: 1 }), compactEvent({ s: 2 })],
      }),
      context,
    );
    expect(decisions.map((item) => item.status)).toEqual(['eligible', 'eligible']);
  });
  it('does not guess between contradictory candidates for the same spoken occurrence', () => {
    const decisions = decideVoiceBatch(
      parseVoiceBatchProviderOutput(
        batch([compactEvent({ s: 1 }), compactEvent({ s: 1, a: '3500' }), compactEvent({ s: 2 })]),
      ),
      context,
    );
    expect(decisions.map((item) => item.status)).toEqual(['skipped', 'skipped', 'eligible']);
  });
  it('deduplicates the same financial effect despite different default/explicit aliases and merchant wording', () => {
    const decisions = decideVoiceBatch(
      parseVoiceBatchProviderOutput(
        batch([
          compactEvent({ s: 1, m: 'Food' }),
          compactEvent({ s: 1, c: 'e:SAR', b: 'e:ACCOUNT-1', d: 'e:2026-10-04', m: 'طعام' }),
        ]),
      ),
      context,
    );
    expect(decisions.map((item) => item.status)).toEqual(['eligible', 'skipped']);
  });
  it('vetoes an occurrence when one extraction marks its account ambiguous', () => {
    const decisions = decideVoiceBatch(
      parseVoiceBatchProviderOutput(
        batch([compactEvent({ s: 1 }), compactEvent({ s: 1, b: 'a:' })]),
      ),
      context,
    );
    expect(decisions.map((item) => item.status)).toEqual(['skipped', 'skipped']);
  });
  it.each([undefined, 0, 11, 1.5, '1'])('rejects ungrounded occurrence %s', (s) => {
    const decisions = decideVoiceBatch(
      parseVoiceBatchProviderOutput(batch([compactEvent({ s })])),
      context,
    );
    expect(decisions).toEqual([{ status: 'skipped', reason: 'invalid_event' }]);
  });
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-04T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());
  it('retains independent identical occurrences and defaults only omitted fields', () => {
    const decisions = decideVoiceBatch(batch([event(), event({ occurrence: 2 })]), context);
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
        event({ occurrence: 2, amountMinor: '', merchant: 'private shop' }),
        event({ occurrence: 3, accountSource: 'ambiguous', accountId: 'ACCOUNT-1' }),
        event({ occurrence: 4, kind: 'repayment' }),
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
    expect(() => decideVoiceBatch(batch(Array(11).fill(event())), context)).toThrow(
      'AI_SCHEMA_INVALID',
    );
  });
  it.each(['ar', 'en'])(
    'accepts ten independent %s occurrences including identical purchases',
    (language) => {
      const decisions = decideVoiceBatch(
        {
          ...batch(Array.from({ length: 10 }, (_, index) => event({ occurrence: index + 1 }))),
          language,
        },
        context,
      );
      expect(decisions).toHaveLength(10);
      expect(decisions.every((item) => item.status === 'eligible')).toBe(true);
    },
  );
  it.each(['ar', 'en'])(
    'normalizes ten compact %s events without losing per-item evidence',
    (language) => {
      const output = parseVoiceBatchProviderOutput({
        complete: true,
        language,
        events: [
          compactEvent(),
          compactEvent({ s: 2 }),
          compactEvent({ a: '' }),
          compactEvent({ b: 'a:' }),
          compactEvent({ d: 'a:' }),
          compactEvent({ k: 'r' }),
          compactEvent({ k: 't' }),
          compactEvent({ k: 'i', a: '-500000', g: '' }),
          compactEvent({ c: 'e:SAR', b: 'e:ACCOUNT-1', d: 'e:2026-10-04' }),
          compactEvent({ b: 'o:ACCOUNT-1' }),
        ].map((item, index) => ({ ...item, s: index + 1 })),
      });
      const decisions = decideVoiceBatch(output, context);
      expect(decisions.map((item) => item.status)).toEqual([
        'eligible',
        'eligible',
        'skipped',
        'skipped',
        'skipped',
        'skipped',
        'skipped',
        'eligible',
        'eligible',
        'skipped',
      ]);
      expect(decisions[0]).toEqual(decisions[1]);
      expect(decisions[7]).toMatchObject({
        command: { kind: 'income', amountMinor: 500000, categoryId: null },
      });
      expect(decisions[8]).toMatchObject({
        command: {
          amountMinor: 2500,
          accountId: context.defaultAccountId,
          occurredAt: '2026-10-03T21:00:00.000Z',
        },
      });
      expect(
        decisions
          .filter((item) => item.status === 'skipped')
          .every((item) => Object.keys(item).length === 2),
      ).toBe(true);
    },
  );
  it('keeps malformed compact items isolated and rejects overflowing/incomplete provider envelopes', () => {
    const malformed = [
      compactEvent({ b: 'ACCOUNT-1' }),
      { ...compactEvent(), reasoning: 'untrusted' },
      { k: 'expense' },
    ];
    const decisions = decideVoiceBatch(
      parseVoiceBatchProviderOutput(batch([...malformed, compactEvent()])),
      context,
    );
    expect(decisions).toEqual([
      { status: 'skipped', reason: 'invalid_event' },
      { status: 'skipped', reason: 'invalid_event' },
      { status: 'skipped', reason: 'invalid_event' },
      expect.objectContaining({ status: 'eligible' }),
    ]);
    expect(() => parseVoiceBatchProviderOutput(batch(Array(11).fill(compactEvent())))).toThrow(
      'AI_SCHEMA_INVALID',
    );
    expect(() =>
      parseVoiceBatchProviderOutput({ ...batch([compactEvent()]), complete: false }),
    ).toThrow('AI_SCHEMA_INVALID');
  });
  it('never defaults contradictory omission or ambiguous currency evidence', () => {
    expect(
      decideVoiceBatch(
        batch([
          event({ currencySource: 'ambiguous' }),
          event({ occurrence: 2, dateSource: 'omitted', date: '2026-10-02' }),
          event({ occurrence: 3, currencySource: 'explicit', currency: '' }),
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
          event({ occurrence: 2, currency: 'USD' }),
          event({ occurrence: 3, categoryId: 'CATEGORY-9' }),
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
