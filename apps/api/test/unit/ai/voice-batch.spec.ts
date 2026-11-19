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
      data: { currency: 'SAR', minorUnit: 2, type: 'cash' },
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
  spokenAmount: '25',
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
  w: '25',
  c: 'o:',
  b: 'o:',
  g: 'CATEGORY-1',
  d: 'o:',
  m: '',
  i: true,
  q: 1,
  ...patch,
});

describe('Voice expense Shopping fallback', () => {
  const shopping = {
    alias: 'CATEGORY-6',
    id: '04000000-0000-4000-8000-000000000006',
    kind: 'category',
    data: { kind: 'expense', labelAr: 'التسوق', labelEn: 'Shopping' },
  };
  const withShopping = { ...context, references: [...context.references, shopping] };

  it.each(['ar', 'en'])(
    'defaults unknown and omitted %s expense categories to the supplied Shopping ID',
    (language) => {
      const decisions = decideVoiceBatch(
        {
          ...batch([
            event({ categoryId: '' }),
            event({ occurrence: 2, categoryId: 'CATEGORY-UNKNOWN' }),
          ]),
          language,
        },
        withShopping,
      );
      expect(decisions).toEqual([
        expect.objectContaining({
          status: 'eligible',
          command: expect.objectContaining({
            categoryId: '04000000-0000-4000-8000-000000000006',
            amountMinor: 2500,
          }) as unknown,
        }),
        expect.objectContaining({
          status: 'eligible',
          command: expect.objectContaining({
            categoryId: '04000000-0000-4000-8000-000000000006',
            amountMinor: 2500,
          }) as unknown,
        }),
      ]);
    },
  );

  it('keeps a valid explicitly resolved category', () => {
    expect(decideVoiceBatch(batch([event()]), withShopping)[0]).toMatchObject({
      status: 'eligible',
      command: { categoryId: '22222222-2222-4222-8222-222222222222' },
    });
  });

  it.each([
    { references: [] },
    { references: [{ ...shopping, data: { ...shopping.data, available: false } }] },
    { references: [{ ...shopping, data: { ...shopping.data, kind: 'income' } }] },
  ])(
    'refuses expense posting when the supplied Shopping fallback is unavailable %#',
    ({ references }) => {
      expect(
        decideVoiceBatch(batch([event({ categoryId: '' })]), {
          ...context,
          references: [...context.references, ...references],
        }),
      ).toEqual([{ status: 'skipped', reason: 'invalid_category' }]);
    },
  );

  it('does not assign an expense category to income or relax account and amount validation', () => {
    expect(
      decideVoiceBatch(
        batch([
          event({ kind: 'income', amountMinor: '-50000', spokenAmount: '500', categoryId: '' }),
          event({
            occurrence: 2,
            kind: 'income',
            amountMinor: '-50000',
            spokenAmount: '500',
            categoryId: 'CATEGORY-UNKNOWN',
          }),
          event({ occurrence: 3, categoryId: '', accountSource: 'ambiguous' }),
          event({ occurrence: 4, categoryId: '', amountMinor: '' }),
          event({ occurrence: 5, categoryId: null }),
        ]),
        withShopping,
      ),
    ).toEqual([
      expect.objectContaining({
        status: 'eligible',
        command: expect.objectContaining({ kind: 'income', categoryId: null }) as unknown,
      }),
      { status: 'skipped', reason: 'invalid_category' },
      { status: 'skipped', reason: 'ambiguous_account' },
      { status: 'skipped', reason: 'missing_amount' },
      { status: 'skipped', reason: 'invalid_category' },
    ]);
  });

  it('deduplicates one occurrence even when its unknown category aliases differ', () => {
    expect(
      decideVoiceBatch(
        batch([event({ categoryId: '' }), event({ categoryId: 'CATEGORY-UNKNOWN' })]),
        withShopping,
      ),
    ).toEqual([
      expect.objectContaining({
        status: 'eligible',
        command: expect.objectContaining({
          categoryId: '04000000-0000-4000-8000-000000000006',
        }) as unknown,
      }),
      { status: 'skipped', reason: 'invalid_event' },
    ]);
  });
});

describe('Voice batch automatic or silent skip', () => {
  it.each(['ar', 'en'])(
    'preserves the immutable recording time for omitted and current-day %s dates on replay',
    (language) => {
      jest.setSystemTime(new Date('2026-10-08T18:00:00Z'));
      const recorded = { ...context, recordedAt: '2026-10-08T17:27:50.536Z' };
      for (const dateFields of [
        { date: '', dateSource: 'omitted' },
        { date: '2026-10-08', dateSource: 'explicit' },
        { date: '2026-10-08', dateSource: 'shared' },
      ]) {
        const input = { ...batch([event(dateFields)]), language };
        const decisions = decideVoiceBatch(input, recorded);
        expect(decisions[0]).toMatchObject({
          status: 'eligible',
          command: { occurredAt: recorded.recordedAt },
        });
        jest.setSystemTime(new Date('2026-10-10T10:00:00Z'));
        expect(decideVoiceBatch(input, recorded)).toEqual(decisions);
      }
    },
  );
  it('keeps an explicit historical date in the capture timezone', () => {
    expect(
      decideVoiceBatch(batch([event({ date: '2026-10-02', dateSource: 'explicit' })]), context)[0],
    ).toMatchObject({ status: 'eligible', command: { occurredAt: '2026-10-01T21:00:00.000Z' } });
  });
  it.each([
    { recordedAt: 'invalid' },
    { timezoneOffsetMinutes: NaN },
    { timezoneOffsetMinutes: 841 },
  ])('fails closed for invalid capture context %j', (patch) => {
    expect(decideVoiceBatch(batch([event()]), { ...context, ...patch })).toEqual([
      { status: 'skipped', reason: 'invalid_date' },
    ]);
  });
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
        batch([
          compactEvent({ s: 1 }),
          compactEvent({ s: 1, a: '3500', w: '35' }),
          compactEvent({ s: 2 }),
        ]),
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
        occurredAt: '2026-10-03T21:30:00.000Z',
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
          compactEvent({ k: 'i', a: '-500000', w: '5000', g: '' }),
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
          occurredAt: '2026-10-03T21:30:00.000Z',
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

describe('spoken amount evidence before ledger acceptance', () => {
  const decide = (w: unknown, a: string, minorUnit: unknown = 2, k = 'e', currency = 'SAR') =>
    decideVoiceBatch(
      parseVoiceBatchProviderOutput(
        batch([compactEvent({ w, a, k, g: k === 'i' ? '' : 'CATEGORY-1' })]),
      ),
      {
        ...context,
        references: context.references.map((ref) =>
          ref.kind === 'account' ? { ...ref, data: { ...ref.data, minorUnit, currency } } : ref,
        ),
      },
    )[0];
  it.each([
    ['سبعة عشر', '1700'],
    ['ثلاثمئة وسبعين', '37000'],
    ['ثلاثمائة', '30000'],
    ['ثلاثة ملايين', '300000000'],
    ['one million', '100000000'],
    ['ثلاثة ريالات وسبع عشرة هللة', '317'],
    ['3 ريالات و17 هللة', '317'],
    ['seventeen halalas', '17'],
    ['سبعة عشر هللة', '17'],
    ['ريال واحد', '100'],
    ['سبعة عشر ريالا', '1700'],
    ['سبعة عشر ريال سعودي', '1700'],
    ['سبعة عشر ريالًا سعوديًا', '1700'],
    ['ثلاثة ريالات ونص', '350'],
    ['سبع عشرة', '1700'],
    ['سبعتعش', '1700'],
    ['سبعين', '7000'],
    ['مئة وسبعين', '17000'],
    ['مية وسبعين', '17000'],
    ['seventeen', '1700'],
    ['seventy', '7000'],
    ['one hundred and seventy', '17000'],
    ['forty-two', '4200'],
    ['سبعة عشر ونص', '1750'],
    ['twenty and a quarter', '2025'],
    ['خمسة وعشرين', '2500'],
  ])('accepts literal %s as %s minor units', (words, minor) => {
    expect(decide(words, minor)).toMatchObject({
      status: 'eligible',
      command: { amountMinor: Number(minor) },
    });
  });
  it.each([
    ['سبعة عشر', '17000'],
    ['سبعة عشر ريالًا سعوديًا', '17000'],
    ['سبعة عشر ريال قطري', '1700'],
    ['مئة وسبعين', '1700'],
    ['سبعين', '1700'],
    ['seventeen or seventy', '1700'],
    ['حوالي سبعة عشر', '1700'],
    ['', '1700'],
    ['1,700', '17000'],
    ['one hundred hundred', '10000'],
    ['seventeen', '-1700'],
  ])('skips contradictory or ambiguous evidence %s / %s', (words, minor) => {
    expect(decide(words, minor)).toEqual({ status: 'skipped', reason: 'missing_amount' });
  });
  it('validates signed income, database currency precision and exact decimal minor units', () => {
    expect(decide('سبعة عشر', '-1700', 2, 'i')).toMatchObject({
      status: 'eligible',
      command: { kind: 'income', amountMinor: 1700 },
    });
    expect(decide('سبعة عشر', '1700', 2, 'i')).toMatchObject({ status: 'skipped' });
    expect(decide('١٧٫٠٠٥', '17005', 3)).toMatchObject({ status: 'eligible' });
    expect(decide('١٧٫٠٠٥', '1700', 2)).toMatchObject({ status: 'skipped' });
    expect(decide('seventeen point zero five', '1705', 2)).toMatchObject({ status: 'eligible' });
    expect(decide('seventeen', '17', 0)).toMatchObject({ status: 'eligible' });
    expect(decide('three dollars and fifty cents', '350', 2, 'e', 'USD')).toMatchObject({
      status: 'eligible',
    });
    expect(decide('three dinars and seventeen fils', '3017', 3, 'e', 'KWD')).toMatchObject({
      status: 'eligible',
    });
    expect(decide('seventeen cents', '17', 2, 'e', 'SAR')).toMatchObject({ status: 'skipped' });
    expect(decide('سبعة عشر هللة', '1700')).toMatchObject({ status: 'skipped' });
    expect(decide('three dollars and fifty cents', '3', 2, 'e', 'USD')).toMatchObject({
      status: 'skipped',
    });
    expect(decide('90071992547409.91', '9007199254740991')).toMatchObject({ status: 'eligible' });
    expect(decide('90071992547409.91', '9007199254740990')).toMatchObject({ status: 'skipped' });
    expect(decide('seventeen', '1700', null)).toMatchObject({ status: 'skipped' });
  });
});
