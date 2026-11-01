import {
  AssistantAgent,
  ASSISTANT_AGENT_SCHEMA,
  renderAssistantAnswer,
} from '../../../src/ai/assistant-agent';
import type { AssistantDataQuery } from '../../../src/ai/assistant-agent-data';
import { AiGateway, type EffectiveAiRoute } from '../../../src/ai/ai.gateway';
import Ajv from 'ajv';

const claim = {
  id: 'job',
  userId: 'owner',
  claimToken: 'token',
  attempt: 1,
  operationId: 'operation',
  content: 'إيه آخر معاملة؟',
  timezone: 'Asia/Riyadh',
  contextScope: ['recent_transactions'],
  context: {},
  history: [],
};
const sample = {
  observedAt: '2026-10-15T21:00:00Z',
  ledgerVersion: 22,
  data: {
    latest: {
      kind: 'expense',
      amountMinor: '300',
      currency: 'SAR',
      occurredAt: '2026-10-15T20:26:57Z',
    },
  },
  aliases: [],
};
const route: EffectiveAiRoute = {
  workload: 'financial_assistant',
  primary: { modelId: 'model', provider: 'provider' },
  fallbacks: [],
  providerAllowlist: ['provider'],
  zdrRequired: true,
  maxPrice: { prompt: '1', completion: '1' },
  limits: { inputTokens: 32000, outputTokens: 4096, timeoutMs: 60000 },
  prompt: { template: 'Never use tools.', schemaVersion: 1 },
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
    { key: 'actions', type: 'action_allowlist', configuration: {} },
    { key: 'evidence', type: 'evidence_limit', configuration: {} },
  ],
};

it.each([
  {
    question: 'اعرض آخر ثلاث عمليات مؤكدة فقط.',
    kind: 'مصروف',
    currency: 'ريال',
    date: '٠١‏/١١‏/٢٠٢٦، ١:٣٠ ص',
  },
  {
    question: 'Show my latest three confirmed transactions in English.',
    kind: 'Expense',
    currency: 'SAR',
    date: '1 Nov 2026, 01:30',
  },
])(
  'grounds three complete transaction lines in the requested language: $question',
  async ({ question, kind, currency, date }) => {
    const rows = [
      { title: 'متجر النهارده 24', amountMinor: '250', currency: 'SAR' },
      { title: 'ACCOUNT-متجر 24', amountMinor: '-12345', currency: 'KWD' },
      { title: 'المكتبة', amountMinor: '1000', currency: 'JPY' },
    ].map((row) => ({
      ...row,
      kind: 'expense',
      status: 'confirmed',
      occurredAt: '2026-10-31T22:30:00Z',
    }));
    const gateway = new AiGateway({
      apiKey: 'synthetic-complete-record-key',
      fetcher: (_url, init) => {
        if (typeof init?.body !== 'string') throw Error('Expected request JSON');
        const body = JSON.parse(init.body) as { messages: Array<{ content: string }> };
        const view = JSON.parse(body.messages[1]?.content ?? '{}') as {
          dataAlreadyRead: Array<{
            data: {
              transactions: { items: Array<{ display?: ModelCell; amountMinor: ModelCell }> };
            };
          }>;
        };
        const items = view.dataAlreadyRead[0]?.data.transactions.items;
        if (!items) throw Error('Expected transaction evidence');
        expect(items).toHaveLength(3);
        const parts = items.flatMap((row, index) => {
          expect(row.amountMinor.ref).toMatch(/^\{\{F\d+\}\}$/u);
          return [
            ...(index ? [{ text: '\n', fact: null }] : []),
            { text: '', fact: (row.display ?? row.amountMinor).ref.replace(/[{}]/gu, '') },
          ];
        });
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'synthetic-complete-record',
              model: 'model',
              choices: [
                {
                  finish_reason: 'stop',
                  message: {
                    content: JSON.stringify({
                      status: 'answer',
                      answerParts: parts,
                      queries: [],
                      responseType: 'fact',
                      scope: 'all_history',
                    }),
                  },
                },
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0 },
            }),
            { headers: { 'content-type': 'application/json' } },
          ),
        );
      },
    });
    const result = await new AssistantAgent(
      {
        read: () =>
          Promise.resolve({
            ...sample,
            data: { transactions: { items: rows, count: 3, offset: 0, hasMore: false } },
          }),
      } as never,
      gateway,
      async () => {},
    ).run({ ...claim, content: question }, route, new AbortController().signal);
    expect(result.content).toBe(
      [
        `${kind} — متجر النهارده 24 — 2.5 ${currency} — ${date}`,
        `${kind} — ACCOUNT-متجر 24 — -12.345 KWD — ${date}`,
        `${kind} — المكتبة — 1,000 JPY — ${date}`,
      ].join('\n'),
    );
  },
);

it.each([
  { amountMinor: null },
  { currency: null },
  { occurredAt: 'unavailable' },
  { status: 'pending' },
])('does not invent a complete confirmed line with unavailable fields: %j', async (missing) => {
  const complete = (input: { userContent: string; parse: (value: unknown) => unknown }) => {
    const view = JSON.parse(input.userContent) as {
      dataAlreadyRead: Array<{ data: { transactions: { items: Array<{ display?: ModelCell }> } } }>;
    };
    expect(view.dataAlreadyRead[0]?.data.transactions.items[0]?.display).toBeUndefined();
    return Promise.resolve({
      value: input.parse({
        status: 'answer',
        answerParts: [{ text: 'ما أقدر أؤكد تفاصيل العملية من البيانات المتاحة.', fact: null }],
        queries: [],
        responseType: 'missing',
        scope: 'all_history',
      }),
      model: 'model',
      provider: 'provider',
    });
  };
  const row = {
    kind: 'expense',
    status: 'confirmed',
    title: 'متجر',
    amountMinor: '250',
    currency: 'SAR',
    occurredAt: '2026-10-31T22:30:00Z',
    ...missing,
  };
  const result = await new AssistantAgent(
    {
      read: () => Promise.resolve({ ...sample, data: { transactions: { items: [row] } } }),
    } as never,
    { complete } as never,
    async () => {},
  ).run(claim, route, new AbortController().signal);
  expect(result.metadata.responseType).toBe('missing');
});

it('preserves organized requested comparison lines without changing grounded monetary values', () => {
  expect(
    renderAssistantAnswer('أكتوبر: {{F1}}\nسبتمبر: {{F2}}\nالزيادة: {{F3}}', [
      {
        key: 'F1',
        value: '133.50 ريال',
        path: 'reads[0].data.summaries[0].amountMinor',
        currency: 'SAR',
      },
      {
        key: 'F2',
        value: '3.75 ريال',
        path: 'reads[1].data.summaries[0].amountMinor',
        currency: 'SAR',
      },
      {
        key: 'F3',
        value: '129.75 ريال',
        path: 'reads[2].data.items[0].differenceMinor',
        currency: 'SAR',
      },
    ]),
  ).toBe('أكتوبر: 133.50 ريال\nسبتمبر: 3.75 ريال\nالزيادة: 129.75 ريال');
});

it.each(
  ['كم صرفت هالشهر؟', 'جاوب بالإنجليزي: كم صرفت هالشهر؟'].flatMap((question) =>
    ['fact', 'suggestion'].map((responseType) => ({ question, responseType })),
  ),
)(
  'presents grounded spending with $responseType without another model dispatch: $question',
  async ({ question, responseType }) => {
    const read = jest.fn((_job, _token, query: AssistantDataQuery) =>
      Promise.resolve({
        observedAt: '2026-10-31T12:00:00Z',
        ledgerVersion: 22,
        aliases: [],
        data: {
          status: 'ok',
          period:
            query.tool === 'overview'
              ? { startDate: '2026-10-01', endDate: '2026-10-31' }
              : { startDate: query.startDate, endDate: query.endDate },
          summaries: [
            {
              kind: 'expense',
              status: 'confirmed',
              currency: 'SAR',
              amountMinor: query.tool === 'overview' ? '240000' : '210000',
              count: 3,
            },
          ],
          topExpenseCategories: [
            {
              category: 'CATEGORY-1',
              labelAr: 'المطاعم',
              labelEn: 'Restaurants',
              currency: 'SAR',
              amountMinor: query.tool === 'overview' ? '60000' : '40000',
            },
          ],
        },
      }),
    );
    const complete = jest.fn((input: { userContent: string; parse: (v: unknown) => unknown }) => {
      const payload = JSON.parse(input.userContent) as {
        dataAlreadyRead: Array<{ data: { summaries: Array<{ amountMinor: { ref: string } }> } }>;
      };
      const amountCell = payload.dataAlreadyRead[0]?.data.summaries[0]?.amountMinor;
      if (!amountCell) throw Error('Expected model fact');
      return Promise.resolve({
        value: input.parse({
          status: 'answer',
          answerParts: [
            {
              text: '',
              fact: amountCell.ref.replace(/[{}]/gu, ''),
            },
          ],
          queries: [],
          responseType,
          scope: 'selected_period',
        }),
        model: 'model',
        provider: 'provider',
      });
    });
    const result = await new AssistantAgent({ read } as never, { complete } as never, () =>
      Promise.resolve(),
    ).run({ ...claim, content: question }, route, new AbortController().signal);
    expect(result.metadata.spendingSummary).toMatchObject({
      version: 1,
      cards: [
        {
          amount: question.includes('بالإنجليزي') ? '2,400 SAR' : '2,400 ريال',
          comparison: { difference: question.includes('بالإنجليزي') ? '300 SAR' : '300 ريال' },
          saving: { target: question.includes('بالإنجليزي') ? '200 SAR' : '200 ريال' },
        },
      ],
    });
    expect(result.content).toBe(question.includes('بالإنجليزي') ? '2,400 SAR' : '2,400 ريال');
    expect(result.metadata.responseType).toBe(responseType);
    expect(read.mock.calls[1]?.[2]).toMatchObject({
      tool: 'summary',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(result.evidence).toHaveLength(2);
  },
);

it.each(['ECONNRESET', '42501', '40001'])(
  'keeps only recoverable optional baseline failures partial: %s',
  async (code) => {
    const read = jest.fn((_job, _token, query: AssistantDataQuery) =>
      query.tool === 'summary'
        ? Promise.reject(Object.assign(new Error('source failure'), { code }))
        : Promise.resolve({
            observedAt: '2026-10-31T12:00:00Z',
            ledgerVersion: 1,
            aliases: [],
            data: {
              status: 'ok',
              period: { startDate: '2026-10-01', endDate: '2026-10-31', timezone: 'Asia/Riyadh' },
              summaries: [
                {
                  currency: 'SAR',
                  kind: 'expense',
                  status: 'confirmed',
                  amountMinor: '10000',
                  count: 1,
                },
              ],
              topExpenseCategories: { items: [], count: 0, limit: 10, offset: 0, hasMore: false },
            },
          }),
    );
    const complete = jest.fn((input: { parse: (v: unknown) => unknown; userContent: string }) => {
      const payload = JSON.parse(input.userContent) as {
        dataAlreadyRead: Array<{ data: { summaries: Array<{ amountMinor: { ref: string } }> } }>;
      };
      const cell = payload.dataAlreadyRead[0]?.data.summaries[0]?.amountMinor;
      if (!cell) throw Error('Missing test fact');
      return Promise.resolve({
        value: input.parse({
          status: 'answer',
          answerParts: [{ text: '', fact: cell.ref.replace(/[{}]/gu, '') }],
          queries: [],
          responseType: 'fact',
          scope: 'selected_period',
        }),
        model: 'model',
        provider: 'provider',
      });
    });
    const operation = new AssistantAgent({ read } as never, { complete } as never, () =>
      Promise.resolve(),
    ).run({ ...claim, content: 'كم صرفت هالشهر؟' }, route, new AbortController().signal);
    if (code === 'ECONNRESET') {
      const result = await operation;
      expect(result.content).toBe('100 ريال');
      const presentation = result.metadata.spendingSummary as {
        cards: Array<{ comparison: null; comparisonNotice: string }>;
      };
      expect(presentation.cards[0]?.comparison).toBeNull();
      expect(presentation.cards[0]?.comparisonNotice).toContain('مو متاحة');
      expect(result.evidence).toHaveLength(1);
    } else await expect(operation).rejects.toMatchObject({ code });
  },
);

it('reuses a successful baseline with timezone instead of querying it again', async () => {
  const read = jest.fn((_job, _token, query: AssistantDataQuery) =>
    Promise.resolve({
      observedAt: '2026-10-31T12:00:00Z',
      ledgerVersion: 1,
      aliases: [],
      data: {
        status: 'ok',
        period: {
          startDate: query.startDate ?? '2026-10-01',
          endDate: query.endDate ?? '2026-10-31',
          timezone: 'Asia/Riyadh',
        },
        summaries: [
          {
            currency: 'SAR',
            kind: 'expense',
            status: 'confirmed',
            amountMinor: query.tool === 'overview' ? '240000' : '210000',
            count: 3,
          },
        ],
        topExpenseCategories: {
          items: [
            {
              currency: 'SAR',
              category: 'CATEGORY-1',
              labelAr: 'المطاعم',
              amountMinor: query.tool === 'overview' ? '60000' : '40000',
            },
          ],
          count: 1,
          limit: 10,
          offset: 0,
          hasMore: false,
        },
      },
    }),
  );
  let calls = 0;
  const complete = jest.fn((input: { parse: (v: unknown) => unknown; userContent: string }) => {
    const payload = JSON.parse(input.userContent) as {
      dataAlreadyRead: Array<{ data: { summaries: Array<{ amountMinor: { ref: string } }> } }>;
    };
    const cell = payload.dataAlreadyRead[0]?.data.summaries[0]?.amountMinor;
    if (!cell) throw Error('Missing test fact');
    return Promise.resolve({
      value: input.parse(
        calls++ === 0
          ? {
              status: 'query',
              answerParts: [],
              queries: [{ tool: 'summary', startDate: '2026-09-01', endDate: '2026-09-30' }],
              responseType: 'fact',
              scope: 'multiple_periods',
            }
          : {
              status: 'answer',
              answerParts: [{ text: '', fact: cell.ref.replace(/[{}]/gu, '') }],
              queries: [],
              responseType: 'fact',
              scope: 'selected_period',
            },
      ),
      model: 'model',
      provider: 'provider',
    });
  });
  const result = await new AssistantAgent({ read } as never, { complete } as never, () =>
    Promise.resolve(),
  ).run({ ...claim, content: 'قارن مصاريفي' }, route, new AbortController().signal);
  expect(read).toHaveBeenCalledTimes(2);
  expect(result.metadata.spendingSummary).toMatchObject({
    cards: [{ comparison: { difference: '300 ريال' }, saving: { target: '200 ريال' } }],
  });
});

it.each(['وش آخر معاملة؟', 'صرفت كام النهارده؟', 'Show my latest transaction in English'])(
  'sends the Saudi style policy at the provider boundary for %s without rewriting facts',
  async (content) => {
    const agent = new AssistantAgent(
      { read: () => Promise.resolve(sample) } as never,
      {
        complete: (input: {
          route: EffectiveAiRoute;
          currentQuestion: string;
          parse: (value: unknown) => unknown;
        }) => {
          expect(input.currentQuestion).toBe(content);
          expect(input.route.prompt.template).toContain(
            'Use neutral, natural Saudi/Gulf Arabic for all Arabic conversational prose',
          );
          expect(input.route.prompt.template).toContain('Understand Arabic input in any dialect');
          expect(input.route.prompt.template).toContain(
            'Do not append transaction counts, category breakdowns, explanations, percentages or saving advice unless the user explicitly asks',
          );
          expect(input.route.prompt.template).toContain(
            'Keep English when selected or explicitly requested',
          );
          expect(input.route.prompt.template).toContain(
            'Never rewrite supplied fact values, merchant names or quoted text to change dialect',
          );
          return Promise.resolve({
            value: input.parse({
              status: 'answer',
              answerParts: [{ text: 'خلّنا نراجع الفترة اللي تقصدها.', fact: null }],
              queries: [],
              responseType: 'missing',
              scope: 'current_state',
            }),
            model: 'model',
            provider: 'provider',
          });
        },
      } as never,
      () => Promise.resolve(),
    );
    await agent.run({ ...claim, content }, route, new AbortController().signal);
    expect(
      renderAssistantAnswer('المتجر {{F1}}، والمبلغ {{F2}}.', [
        { key: 'F1', value: 'متجر النهارده 24', path: 'latest.merchant' },
        { key: 'F2', value: '-12.50 USD', path: 'latest.amountMinor' },
      ]),
    ).toBe('المتجر متجر النهارده 24، والمبلغ -12.50 USD.');
  },
);

it.each(
  ['Asia/Riyadh', 'Pacific/Honolulu'].flatMap((timezone) => [
    {
      timezone,
      locale: 'ar',
      question: 'اعرض تواريخ فترة التقرير',
      expected: 'الفترة من 1 أكتوبر 2026 إلى 31 أكتوبر 2026.',
    },
    {
      timezone,
      locale: 'en',
      question: 'Show the report period dates',
      expected: 'Period from 1 October 2026 to 31 October 2026.',
    },
  ]),
)(
  'localizes typed calendar-only report dates in $locale without timezone shifts ($timezone)',
  async ({ timezone, locale, question, expected }) => {
    let referenceValue: string | undefined;
    const model = {
      complete: (input: { parse: (value: unknown) => unknown; userContent: string }) => {
        const payload = JSON.parse(input.userContent) as {
          dataAlreadyRead: Array<{
            data: {
              period: { startDate: { ref: string }; endDate: { ref: string } };
              reference: { value: string };
            };
          }>;
        };
        const data = payload.dataAlreadyRead[0]?.data;
        if (!data) throw new Error('Expected calendar facts');
        referenceValue = data.reference.value;
        return Promise.resolve({
          value: input.parse({
            status: 'answer',
            responseType: 'fact',
            scope: 'selected_period',
            queries: [],
            answer:
              locale === 'ar'
                ? `الفترة من ${data.period.startDate.ref} إلى ${data.period.endDate.ref}.`
                : `Period from ${data.period.startDate.ref} to ${data.period.endDate.ref}.`,
          }),
          model: 'model',
          provider: 'provider',
          generationId: 'calendar-facts',
          usage: { inputTokens: 1, outputTokens: 1, cost: 0 },
          latencyMs: 1,
          fallbackUsed: false,
        });
      },
    };
    const agent = new AssistantAgent(
      {
        read: () =>
          Promise.resolve({
            ...sample,
            data: {
              period: { startDate: '2026-10-01', endDate: '2026-10-31' },
              reference: '2026-10-16',
            },
          }),
      } as never,
      model as never,
      () => Promise.resolve(),
    );
    const answer = await agent.run(
      { ...claim, timezone, content: question },
      route,
      new AbortController().signal,
    );
    expect(answer.content).toBe(expected);
    expect(referenceValue).toBe('2026-10-16');
  },
);

it.each([
  ['PRIVATE ACCOUNT-', 'internal_selector'],
  ['PRIVATE 49287 SAR', 'unbound_number'],
  ['PRIVATE {{F999}}', 'unknown_reference'],
  ['PRIVATE 〔F?〕', 'invalid_reference'],
] as const)('classifies rejected answers safely (%s)', (answer, reason) => {
  let failure: unknown;
  try {
    renderAssistantAnswer(answer, []);
  } catch (error) {
    failure = error;
  }
  expect(failure).toMatchObject({
    code: 'AI_UNGROUNDED_ANSWER',
    retryable: false,
    diagnostic: { failureStage: 'grounding', rejectedKeywords: [reason] },
  });
});

it('renders model object markers around known facts as plain text', () => {
  expect(
    renderAssistantAnswer('Expenses were \uFFFC{{F1}}.', [
      { key: 'F1', path: 'reads[0].data.amountMinor', value: '867.24 SAR' },
    ]),
  ).toBe('Expenses were 867.24 SAR.');
});

it('selects typed facts in the 19 October constrained-decoding and omitted-amount regression', async () => {
  const gateway = new AiGateway({
    apiKey: 'synthetic-answer-parts-key',
    fetcher: (_url, init) => {
      if (typeof init?.body !== 'string') throw Error('FIXTURE_REQUEST_BODY_MISSING');
      const request = JSON.parse(init.body) as {
        messages: Array<{ content: string }>;
        response_format: { json_schema: { schema: Record<string, unknown> } };
      };
      const decision = {
        status: 'answer',
        responseType: 'fact',
        scope: 'selected_period',
        queries: [],
        answerParts: [
          { text: 'Confirmed expenses: ', fact: null },
          { text: '', fact: 'F1' },
          { text: '.', fact: null },
        ],
      };
      // Model fixtures must obey the same constrained schema as the provider.
      const validate = new Ajv({ strict: false }).compile(
        request.response_format.json_schema.schema,
      );
      expect(validate(decision)).toBe(true);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'synthetic-answer-parts',
            model: 'model',
            choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(decision) } }],
            usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0 },
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
      );
    },
  });
  const agent = new AssistantAgent(
    {
      read: () => Promise.resolve({ ...sample, data: { currency: 'SAR', amountMinor: '12345' } }),
    } as never,
    gateway,
    () => Promise.resolve(),
  );
  await expect(
    agent.run(
      { ...claim, content: 'Show the synthetic confirmed amount.' },
      route,
      new AbortController().signal,
    ),
  ).resolves.toMatchObject({ content: 'Confirmed expenses: 123.45 SAR.' });
});

it.each([
  { name: 'unknown fact', parts: [{ text: '', fact: 'F999' }], code: 'AI_UNGROUNDED_ANSWER' },
  {
    name: 'mixed text and fact',
    parts: [{ text: 'Different ', fact: 'F1' }],
    code: 'AI_SCHEMA_INVALID',
  },
  { name: 'selector as fact', parts: [{ text: '', fact: 'ACCOUNT-1' }], code: 'AI_SCHEMA_INVALID' },
  {
    name: 'additional field',
    parts: [{ text: 'Private', fact: null, note: 'ignored' }],
    code: 'AI_SCHEMA_INVALID',
  },
  {
    name: 'unbounded parts',
    parts: Array.from({ length: 513 }, () => ({ text: 'x', fact: null })),
    code: 'AI_SCHEMA_INVALID',
  },
  {
    name: 'foreign numeric prose',
    parts: [{ text: '९९९ SAR', fact: null }],
    code: 'AI_UNGROUNDED_ANSWER',
  },
])('rejects malformed structured model output: $name', async ({ parts, code }) => {
  const gateway = new AiGateway({
    apiKey: 'synthetic-malformed-parts-key',
    fetcher: () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'synthetic-malformed-parts',
            model: 'model',
            choices: [
              {
                finish_reason: 'stop',
                message: {
                  content: JSON.stringify({
                    status: 'answer',
                    answerParts: parts,
                    queries: [],
                    responseType: 'fact',
                    scope: 'current_state',
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0 },
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
      ),
  });
  const agent = new AssistantAgent({ read: () => Promise.resolve(sample) } as never, gateway, () =>
    Promise.resolve(),
  );
  await expect(agent.run(claim, route, new AbortController().signal)).rejects.toThrow(code);
});

it.each([true, false])(
  'does not accept the 19 October incomplete spending reply as a verified fact (repair=%s)',
  async (repair) => {
    let requests = 0;
    const gateway = new AiGateway({
      apiKey: 'synthetic-incomplete-fact-key',
      fetcher: (_url, init) => {
        if (typeof init?.body !== 'string') throw new Error('EXPECTED_REQUEST_BODY');
        const body = JSON.parse(init.body) as { messages: Array<{ content: string }> };
        const view = JSON.parse(body.messages[1]?.content ?? '{}') as {
          dataAlreadyRead: Array<{ data: { amountMinor: { ref: string } } }>;
        };
        requests += 1;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: `synthetic-incomplete-${requests.toString()}`,
              model: 'model',
              choices: [
                {
                  finish_reason: 'stop',
                  message: {
                    content: JSON.stringify({
                      status: 'answer',
                      responseType: 'fact',
                      scope: 'selected_period',
                      queries: [],
                      answer:
                        repair && requests > 1
                          ? `Your total spending is ${view.dataAlreadyRead[0]?.data.amountMinor.ref ?? 'MISSING_TEST_REFERENCE'}.`
                          : 'Your total confirmed spending in SAR this month, from   ᐧ',
                    }),
                  },
                },
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0 },
            }),
            { headers: { 'content-type': 'application/json' } },
          ),
        );
      },
    });
    const agent = new AssistantAgent(
      {
        read: () =>
          Promise.resolve({
            ...sample,
            data: {
              currency: 'SAR',
              amountMinor: '86724',
              period: { startDate: '2026-10-01', endDate: '2026-10-19' },
            },
          }),
      } as never,
      gateway,
      () => Promise.resolve(),
    );
    const result = agent.run(
      { ...claim, content: 'What is my total spending this month in SAR?' },
      route,
      new AbortController().signal,
    );
    if (repair) {
      await expect(result).resolves.toMatchObject({
        content: 'Your total spending is 867.24 SAR.',
      });
      expect(requests).toBe(2);
    } else {
      await expect(result).rejects.toMatchObject({
        code: 'AI_UNGROUNDED_ANSWER',
        retryable: false,
        diagnostic: { failureStage: 'grounding', rejectedKeywords: ['missing_support'] },
      });
      expect(requests).toBe(3);
    }
  },
);

it.each([
  {
    name: 'supplied account name',
    answer: 'It was on Test.',
    type: 'fact',
    data: { name: 'Test' },
    accepted: true,
  },
  {
    name: 'supplied Arabic name',
    answer: 'على حساب التجربة.',
    type: 'fact',
    data: { name: 'التجربة' },
    accepted: true,
  },
  {
    name: 'name mentioned only in a note or question',
    answer: 'It was on Test.',
    type: 'fact',
    data: { note: 'Test' },
    accepted: false,
  },
  {
    name: 'partial customer name',
    answer: 'It was on Tester.',
    type: 'fact',
    data: { name: 'Test' },
    accepted: false,
  },
  {
    name: 'social acknowledgment',
    answer: 'You are welcome.',
    type: 'suggestion',
    data: {},
    accepted: true,
  },
  {
    name: 'explicitly unavailable data',
    answer: 'I cannot verify that amount from the available data.',
    type: 'missing',
    data: {},
    accepted: true,
  },
])(
  'checks non-numeric $name without inventing a verified fact',
  async ({ answer, type, data, accepted }) => {
    let requests = 0;
    const gateway = new AiGateway({
      apiKey: 'synthetic-named-fact-key',
      fetcher: () => {
        requests += 1;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: `synthetic-named-${requests.toString()}`,
              model: 'model',
              choices: [
                {
                  finish_reason: 'stop',
                  message: {
                    content: JSON.stringify({
                      status: 'answer',
                      responseType: type,
                      scope: 'current_state',
                      queries: [],
                      answer,
                    }),
                  },
                },
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0 },
            }),
            { headers: { 'content-type': 'application/json' } },
          ),
        );
      },
    });
    const agent = new AssistantAgent(
      { read: () => Promise.resolve({ ...sample, data }) } as never,
      gateway,
      () => Promise.resolve(),
    );
    const result = agent.run(
      { ...claim, content: 'Was it on Test?', history: [{ role: 'user', content: 'Test' }] },
      route,
      new AbortController().signal,
    );
    if (accepted) {
      await expect(result).resolves.toMatchObject({ content: answer });
      expect(requests).toBe(1);
    } else {
      await expect(result).rejects.toThrow('AI_UNGROUNDED_ANSWER');
      expect(requests).toBe(3);
    }
  },
);

it('diagnoses parallel reads and grounding repair without exposing financial or conversation content', async () => {
  let clock = 1000;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
  const diagnostics: unknown[] = [];
  const pendingReads: Array<() => void> = [];
  let readsReady!: () => void;
  const bothReadsStarted = new Promise<void>((resolve) => {
    readsReady = resolve;
  });
  const query = {
    tool: 'transactions',
    kind: null,
    startDate: null,
    endDate: null,
    currency: null,
    minAmountMinor: null,
    maxAmountMinor: null,
    account: null,
    category: null,
    search: null,
    sort: 'latest',
    limit: 1,
    offset: 0,
    collection: null,
  };
  const decisions = [
    {
      status: 'query',
      answer: '',
      queries: [query, { ...query, sort: 'largest' }],
      responseType: 'fact',
      scope: 'all_history',
    },
    { status: 'answer', answer: '〔F?〕', queries: [], responseType: 'fact', scope: 'all_history' },
    {
      status: 'answer',
      answer: 'Latest {{F1}}.',
      queries: [],
      responseType: 'fact',
      scope: 'all_history',
    },
  ];
  const gateway = new AiGateway({
    apiKey: 'synthetic-test-key',
    fetcher: () => {
      clock += 20;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'private-provider-generation',
            model: 'model',
            choices: [
              { finish_reason: 'stop', message: { content: JSON.stringify(decisions.shift()) } },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0 },
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
      );
    },
  });
  const data = {
    read: (_id: string, _token: string, requested: AssistantDataQuery) => {
      if (requested.tool === 'overview') {
        clock += 10;
        return Promise.resolve(sample);
      }
      return new Promise<typeof sample>((resolve) => {
        pendingReads.push(() => {
          resolve(sample);
        });
        if (pendingReads.length === 2) readsReady();
      });
    },
  };
  const agent = new AssistantAgent(
    data as never,
    gateway,
    () => Promise.resolve(),
    undefined,
    undefined,
    (diagnostic) => diagnostics.push(diagnostic),
  );
  const running = agent.run(
    {
      ...claim,
      content: 'PRIVATE QUESTION',
      history: [{ role: 'user', content: 'PRIVATE HISTORY' }],
    },
    route,
    new AbortController().signal,
  );
  await bothReadsStarted;
  clock += 30;
  pendingReads[0]?.();
  await Promise.resolve();
  clock += 10;
  pendingReads[1]?.();
  const answer = await running;

  expect(answer.content).toBe('Latest 3 SAR.');
  expect(diagnostics).toEqual([
    { stage: 'overview_read', state: 'completed', round: 0, durationMs: 10, readCount: 1 },
    {
      stage: 'model',
      state: 'completed',
      round: 1,
      durationMs: 20,
      readCount: 1,
      decision: 'query',
    },
    { stage: 'data_reads', state: 'completed', round: 1, durationMs: 40, readCount: 2 },
    {
      stage: 'model',
      state: 'completed',
      round: 2,
      durationMs: 20,
      readCount: 3,
      decision: 'answer',
    },
    { stage: 'grounding', state: 'repair', round: 2, durationMs: 0, readCount: 3 },
    {
      stage: 'model',
      state: 'completed',
      round: 3,
      durationMs: 20,
      readCount: 3,
      decision: 'answer',
    },
    { stage: 'grounding', state: 'completed', round: 3, durationMs: 0, readCount: 3 },
  ]);
  expect(JSON.stringify(diagnostics)).not.toMatch(
    /PRIVATE|300|ريال|private-provider|owner|job|token|operation/u,
  );
});

it.each(['provider', 'cancelled', 'overview'] as const)(
  'reports the failed stage for %s without changing the failure or logging its contents',
  async (failure) => {
    const diagnostics: unknown[] = [];
    const controller = new AbortController();
    const gateway = new AiGateway({
      apiKey: 'synthetic-test-key',
      fetcher: () => {
        if (failure === 'cancelled') controller.abort();
        return Promise.reject(new Error('PRIVATE_PROVIDER_OUTPUT'));
      },
    });
    const agent = new AssistantAgent(
      {
        read: () =>
          failure === 'overview'
            ? Promise.reject(new Error('PRIVATE_DATA_ERROR'))
            : Promise.resolve(sample),
      } as never,
      gateway,
      () => Promise.resolve(),
      undefined,
      undefined,
      (diagnostic) => diagnostics.push(diagnostic),
    );
    await expect(agent.run(claim, route, controller.signal)).rejects.toThrow(
      failure === 'overview'
        ? 'PRIVATE_DATA_ERROR'
        : failure === 'cancelled'
          ? 'AI_WORK_CANCELLED'
          : 'AI_TEMPORARILY_UNAVAILABLE',
    );
    expect(diagnostics.at(-1)).toMatchObject({
      stage: failure === 'overview' ? 'overview_read' : 'model',
      state: failure === 'cancelled' ? 'cancelled' : 'failed',
      round: failure === 'overview' ? 0 : 1,
      readCount: 1,
      durationMs: expect.any(Number) as number,
    });
    expect(JSON.stringify(diagnostics)).not.toMatch(/PRIVATE|owner|job|token|operation/u);
  },
);

it('keeps a grounded answer when the diagnostic sink fails', async () => {
  const agent = new AssistantAgent(
    { read: () => Promise.resolve(sample) } as never,
    new AiGateway({
      apiKey: 'synthetic-test-key',
      fetcher: () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'synthetic-sink-failure',
              model: 'model',
              choices: [
                {
                  finish_reason: 'stop',
                  message: {
                    content: JSON.stringify({
                      status: 'answer',
                      answer: 'Latest {{F1}}.',
                      queries: [],
                      responseType: 'fact',
                      scope: 'all_history',
                    }),
                  },
                },
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0 },
            }),
            { headers: { 'content-type': 'application/json' } },
          ),
        ),
    }),
    () => Promise.resolve(),
    undefined,
    undefined,
    () => {
      throw new Error('PRIVATE_DIAGNOSTIC_FAILURE');
    },
  );
  const answer = await agent.run(claim, route, new AbortController().signal);
  expect(answer.content).toBe('Latest 3 ريال.');
});

it.each([
  { current: 'إيه آخر معاملة؟', previous: 'اكتب برنامج بايثون', outside: false },
  { current: 'ما عاصمة فرنسا؟', previous: 'إيه آخر معاملة؟', outside: true },
])(
  'sends the current question after historical context: $current',
  async ({ current, previous, outside }) => {
    let messages: Array<{ role: string; content: string }> = [];
    let reasoning: unknown;
    const gateway = new AiGateway({
      apiKey: 'synthetic-test-key',
      fetcher: (_url, init) => {
        if (typeof init?.body !== 'string') throw new Error('Expected JSON request body');
        const body = JSON.parse(init.body) as { messages: typeof messages; reasoning?: unknown };
        messages = body.messages;
        reasoning = body.reasoning;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'synthetic-current-question',
              model: 'openai/gpt-6-luna',
              choices: [
                {
                  finish_reason: 'stop',
                  message: {
                    content: JSON.stringify(
                      outside
                        ? {
                            status: 'out_of_scope',
                            answer: '',
                            queries: [],
                            responseType: 'missing',
                            scope: 'current_state',
                          }
                        : {
                            status: 'answer',
                            answer: 'آخر معاملة بقيمة {{F1}}.',
                            queries: [],
                            responseType: 'fact',
                            scope: 'all_history',
                          },
                    ),
                  },
                },
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0 },
            }),
            { headers: { 'content-type': 'application/json' } },
          ),
        );
      },
    });
    const agent = new AssistantAgent(
      { read: () => Promise.resolve(sample) } as never,
      gateway,
      () => Promise.resolve(),
    );
    const result = await agent.run(
      {
        ...claim,
        content: current,
        history: [
          { role: 'user', content: previous },
          { role: 'assistant', content: 'رد سابق' },
        ],
      },
      {
        ...route,
        primary: { modelId: 'openai/gpt-6-luna', provider: 'provider' },
      },
      new AbortController().signal,
    );
    expect(messages.at(-1)).toEqual({ role: 'user', content: current });
    expect(reasoning).toEqual({ effort: 'low' });
    const context = JSON.parse(messages[1]?.content ?? '{}') as { conversation: unknown[] };
    expect(context.conversation).toEqual([
      { role: 'user', content: previous },
      { role: 'assistant', content: 'رد سابق' },
    ]);
    expect(result.metadata.responseType).toBe(outside ? 'redirect' : 'fact');
    if (!outside) expect(result.content).toBe('آخر معاملة بقيمة 3 ريال.');
  },
);

it('preserves server-known Unicode numeric text through an exact canonical reference', () => {
  expect(
    renderAssistantAnswer('المتجر {{F1}}.', [
      { key: 'F1', value: 'فرع Ⅲ', path: 'latest.merchant' },
    ]),
  ).toBe('المتجر فرع Ⅲ.');
});

it.each(['ACCOUNT-', 'CATEGORY-', 'TRANSACTION-', 'OBLIGATION-', 'SALARY_RECEIPT-'])(
  'rejects a truncated internal selector in customer prose: %s',
  (alias) => {
    expect(() => renderAssistantAnswer(`It was on your Test account (${alias}).`, [])).toThrow(
      'AI_UNGROUNDED_ANSWER',
    );
  },
);

it.each(['alias', 'accounts[0]', 'category'])(
  'does not turn an internal selector into a customer fact through %s',
  (path) => {
    expect(() =>
      renderAssistantAnswer('Your account is {{F1}}.', [
        { key: 'F1', value: 'ACCOUNT-1', path: `reads[0].data.${path}` },
      ]),
    ).toThrow('AI_UNGROUNDED_ANSWER');
  },
);

it.each(['name', 'title', 'merchant', 'labelAr', 'labelEn'])(
  'preserves an actual customer-supplied %s that resembles an alias',
  (field) => {
    expect(
      renderAssistantAnswer('The name is {{F1}}.', [
        { key: 'F1', value: 'ACCOUNT-1', path: `reads[0].data.${field}` },
      ]),
    ).toBe('The name is ACCOUNT-1.');
  },
);

it.each(['Account- Main', 'Goal- Savings'])(
  'preserves verified customer names without digits in ordinary prose: %s',
  (name) => {
    expect(
      renderAssistantAnswer(`It was on ${name}.`, [
        { key: 'F1', value: name, path: 'reads[0].data.name' },
      ]),
    ).toBe(`It was on ${name}.`);
  },
);

it('keeps a name that resembles a selector available to grounding without extra model calls', async () => {
  let dispatches = 0;
  const agent = new AssistantAgent(
    {
      read: () =>
        Promise.resolve({
          ...sample,
          data: { accounts: { items: [{ alias: 'ACCOUNT-1', name: 'Account- Main' }] } },
        }),
    } as never,
    new AiGateway({
      apiKey: 'synthetic-test-key',
      fetcher: () => {
        dispatches += 1;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'synthetic-verified-account-name',
              model: 'model',
              choices: [
                {
                  finish_reason: 'stop',
                  message: {
                    content: JSON.stringify({
                      status: 'answer',
                      answer: 'It was on Account- Main.',
                      queries: [],
                      responseType: 'fact',
                      scope: 'current_state',
                    }),
                  },
                },
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0 },
            }),
            { headers: { 'content-type': 'application/json' } },
          ),
        );
      },
    }),
    () => Promise.resolve(),
  );
  await expect(agent.run(claim, route, new AbortController().signal)).resolves.toMatchObject({
    content: 'It was on Account- Main.',
  });
  expect(dispatches).toBe(1);
});

it.each([true, false])(
  'repairs internal selector leakage without repeating data reads (corrected=%s)',
  async (corrected) => {
    const feedback: Array<string | null> = [];
    const read = jest.fn(() =>
      Promise.resolve({
        ...sample,
        data: { ...sample.data, accounts: { items: [{ name: 'Test' }] } },
      }),
    );
    const agent = new AssistantAgent(
      { read } as never,
      new AiGateway({
        apiKey: 'synthetic-test-key',
        fetcher: (_url, init) => {
          if (typeof init?.body !== 'string') throw new Error('EXPECTED_REQUEST_BODY');
          const request = JSON.parse(init.body) as {
            messages: Array<{ content: string }>;
          };
          const context = JSON.parse(request.messages[1]?.content ?? '{}') as {
            validationFeedback?: string;
          };
          feedback.push(context.validationFeedback ?? null);
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 'synthetic-selector-repair',
                model: 'model',
                choices: [
                  {
                    finish_reason: 'stop',
                    message: {
                      content: JSON.stringify({
                        status: 'answer',
                        answer:
                          corrected && feedback.length > 1
                            ? 'It was on your Test account.'
                            : 'It was on your Test account (ACCOUNT-).',
                        queries: [],
                        responseType: 'fact',
                        scope: 'all_history',
                      }),
                    },
                  },
                ],
                usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0 },
              }),
              { headers: { 'content-type': 'application/json' } },
            ),
          );
        },
      }),
      () => Promise.resolve(),
    );
    const result = agent.run(claim, route, new AbortController().signal);
    if (corrected) {
      await expect(result).resolves.toMatchObject({ content: 'It was on your Test account.' });
      expect(feedback).toHaveLength(2);
    } else {
      await expect(result).rejects.toThrow('AI_UNGROUNDED_ANSWER');
      expect(feedback).toHaveLength(3);
    }
    expect(feedback[1]).toContain('Internal aliases');
    expect(read).toHaveBeenCalledTimes(1);
  },
);

it('returns a server-owned scope notice when the model classifies an unrelated request', async () => {
  const agent = new AssistantAgent(
    { read: () => Promise.resolve(sample) } as never,
    {
      complete: (input: { parse: (value: unknown) => unknown }) =>
        Promise.resolve({
          value: input.parse({
            status: 'out_of_scope',
            answer: '',
            queries: [],
            responseType: 'missing',
            scope: 'current_state',
          }),
          model: 'model',
          provider: 'provider',
        }),
    } as never,
    () => Promise.resolve(),
  );
  const result = await agent.run(
    { ...claim, content: 'احكي لي حكاية' },
    route,
    new AbortController().signal,
  );
  expect(result.content).toMatch(/متخصص.*(?:مصروف|دخل)/u);
  expect(result.content.length).toBeLessThanOrEqual(180);
  expect(result.evidence).toEqual([]);
  expect(result.metadata).toMatchObject({
    responseType: 'redirect',
    reasons: ['outside_financial_scope'],
    currencies: [],
    scope: 'current_state',
  });
});

it.each([
  '```python\nprint("hello")\n```',
  'def greet(): return "hello"',
  'أقدر أساعدك تكتب كود، قولّي محتاج إيه',
])(
  'replaces a programming answer even if the provider incorrectly calls it financial: %s',
  async (answer) => {
    const agent = new AssistantAgent(
      { read: () => Promise.resolve(sample) } as never,
      {
        complete: (input: { parse: (value: unknown) => unknown }) =>
          Promise.resolve({
            value: input.parse({
              status: 'answer',
              answer,
              queries: [],
              responseType: 'fact',
              scope: 'current_state',
            }),
            model: 'model',
            provider: 'provider',
          }),
      } as never,
      () => Promise.resolve(),
    );
    const result = await agent.run(
      { ...claim, content: 'ممكن تساعدني؟' },
      route,
      new AbortController().signal,
    );
    expect(result.content).not.toBe(answer);
    expect(result.metadata.responseType).toBe('redirect');
    expect(result.evidence).toEqual([]);
  },
);

it.each([
  'I can help you build a savings plan based on your expenses.',
  'I can write a budget summary from your financial records.',
  'أقدر أكتب لك ملخص مصروفات اشتراك البرنامج.',
])(
  'preserves personal-finance explanations mentioning planning or software: %s',
  async (answer) => {
    const agent = new AssistantAgent(
      { read: () => Promise.resolve(sample) } as never,
      {
        complete: (input: { parse: (value: unknown) => unknown }) =>
          Promise.resolve({
            value: input.parse({
              status: 'answer',
              answer,
              queries: [],
              responseType: 'suggestion',
              scope: 'current_state',
            }),
            model: 'model',
            provider: 'provider',
          }),
      } as never,
      () => Promise.resolve(),
    );
    const result = await agent.run(claim, route, new AbortController().signal);
    expect(result.content).toBe(answer);
    expect(result.metadata.responseType).toBe('suggestion');
  },
);

it.each([
  { answer: 'Here is a Python program', queries: [] },
  { answer: '', queries: [{ tool: 'overview' }] },
])('rejects free text or tool requests disguised as an out-of-scope decision', async (invalid) => {
  const agent = new AssistantAgent(
    { read: () => Promise.resolve(sample) } as never,
    {
      complete: (input: { parse: (value: unknown) => unknown }) =>
        Promise.resolve({
          value: input.parse({
            status: 'out_of_scope',
            responseType: 'missing',
            scope: 'current_state',
            ...invalid,
          }),
          model: 'model',
          provider: 'provider',
        }),
    } as never,
    () => Promise.resolve(),
  );
  await expect(
    agent.run({ ...claim, content: 'احكي لي حكاية' }, route, new AbortController().signal),
  ).rejects.toThrow('AI_SCHEMA_INVALID');
});

it.each(['المصروفات 0 ريال', 'اليوم 2026-10-16', 'المصروفات ٠ ريال'])(
  'rejects unsupported literal numeric output during grounding: %s',
  (answer) => {
    expect(() => renderAssistantAnswer(answer, [])).toThrow('AI_UNGROUNDED_ANSWER');
  },
);
it.each(['', 'المصروفات {{F12}} والدخل {{F13}}.', 'On {{F1}}, you spent {{F2}}.'])(
  'allows query decisions and natural answers with exact references in the provider schema: %s',
  (answer) => {
    const validate = new Ajv({ strict: false }).compile(ASSISTANT_AGENT_SCHEMA.properties.answer);
    expect(validate(answer)).toBe(true);
  },
);

it('composes a real model answer with exact owner facts rather than the recent-transactions count', async () => {
  const model = {
    complete: (input: { parse: (value: unknown) => unknown; userContent: string }) => {
      const payload = JSON.parse(input.userContent) as {
        dataAlreadyRead: Array<{ data: { latest: { amountMinor: ModelCell } } }>;
      };
      const fact = payload.dataAlreadyRead[0]?.data.latest.amountMinor;
      if (!fact || fact.value !== '3 ريال') throw new Error('Expected amount fact');
      return Promise.resolve({
        value: input.parse({
          status: 'answer',
          responseType: 'fact',
          scope: 'all_history',
          answer: `آخر معاملة مصروف بقيمة ${fact.ref}.`,
          queries: [],
        }),
        model: 'model',
        provider: 'provider',
        generationId: 'generation',
        usage: { inputTokens: 1, outputTokens: 1, cost: 0 },
        latencyMs: 1,
        fallbackUsed: false,
      });
    },
  };
  const agent = new AssistantAgent(
    { read: () => Promise.resolve(sample) } as never,
    model as never,
    () => Promise.resolve(),
  );
  const answer = await agent.run(claim, route, new AbortController().signal);
  expect(answer.content).toBe('آخر معاملة مصروف بقيمة 3 ريال.');
  expect(answer.evidence).toEqual([expect.objectContaining({ kind: 'ledger', version: 22 })]);
});

it.each([
  'صرفت 999 ريال',
  'صرفت {{F999}}',
  'صرفت ٩٩٩ ريال',
  'مفيش ميزانيات (〖F₁₃₅〗).',
  'صرفت ３ ريال',
  'صرفت 𝟛 ريال',
  'صرفت Ⅲ ريال',
  'لأ، مفيش مصروفات مسجّلة النهارده (〔F?〕). إجمالي مصروفاتك النهارده 〔F?〕، حسب السجل المتاح.',
  'المصروفات [F?].',
  'المصروفات (F?).',
  'المصروفات 〖F؟〗.',
  'المصروفات 【Ｆ？】.',
  'المصروفات ｛｛Ｆ？｝｝.',
])('rejects unsupported numeric or nonexistent fact claims: %s', (answer) => {
  expect(() =>
    renderAssistantAnswer(answer, [{ key: 'F1', value: '3 ريال', path: 'latest.amountMinor' }]),
  ).toThrow('AI_UNGROUNDED_ANSWER');
});

it.each(
  ['〖F₁〗', '〔F?〕', '[F?]', '(F?)', '〖F؟〗', '【Ｆ？】', '｛｛Ｆ？｝｝'].flatMap((marker) =>
    [true, false].map((corrected) => ({ marker, corrected })),
  ),
)(
  'does not publish malformed fact marker $marker and attempts bounded repair: corrected=$corrected',
  async ({ marker, corrected }) => {
    const feedback: unknown[] = [];
    const gateway = new AiGateway({
      apiKey: 'synthetic-key',
      fetcher: (_url, init) => {
        if (typeof init?.body !== 'string') throw new Error('Expected JSON request body');
        const body = JSON.parse(init.body) as { messages: Array<{ content: string }> };
        const payload = JSON.parse(body.messages[1]?.content ?? '{}') as {
          validationFeedback: unknown;
        };
        feedback.push(payload.validationFeedback);
        const decision = {
          status: 'answer',
          responseType: 'fact',
          scope: 'all_history',
          answer:
            corrected && feedback.length > 1
              ? 'آخر معاملة بقيمة {{F1}}.'
              : `آخر معاملة بقيمة ${marker}.`,
          queries: [],
        };
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'synthetic-unicode-repair',
              model: route.primary.modelId,
              choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(decision) } }],
              usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0 },
            }),
            { headers: { 'content-type': 'application/json' } },
          ),
        );
      },
    });
    const agent = new AssistantAgent(
      { read: () => Promise.resolve(sample) } as never,
      gateway,
      () => Promise.resolve(),
    );
    const result = agent.run(claim, route, new AbortController().signal);
    if (corrected) {
      await expect(result).resolves.toMatchObject({ content: 'آخر معاملة بقيمة 3 ريال.' });
      expect(feedback).toHaveLength(2);
    } else {
      await expect(result).rejects.toThrow('AI_UNGROUNDED_ANSWER');
      expect(feedback).toHaveLength(3);
    }
    expect(feedback[0]).toBeNull();
    expect(typeof feedback[1]).toBe('string');
  },
);

it('preserves merchant and category prose containing F and question marks', () => {
  expect(renderAssistantAnswer('المتجر F? Store من فئة F&B (مطاعم)؛ هل تقصد المتجر؟', [])).toBe(
    'المتجر F? Store من فئة F&B (مطاعم)؛ هل تقصد المتجر؟',
  );
  expect(
    renderAssistantAnswer('المتجر {{F1}}.', [
      { key: 'F1', value: 'متجر [F?]', path: 'latest.merchant' },
    ]),
  ).toBe('المتجر متجر [F?].');
});

it.each(['〔{{F1}}〕', '〖{{F1}}〗'])(
  'removes decorative brackets immediately around a supplied canonical reference: %s',
  (reference) => {
    expect(
      renderAssistantAnswer(`مصروفات 〔المطاعم〕 ${reference} (مؤكدة).`, [
        { key: 'F1', value: '3 ريال', path: 'latest.amountMinor' },
      ]),
    ).toBe('مصروفات 〔المطاعم〕 3 ريال (مؤكدة).');
  },
);

it('preserves brackets around exact literal financial text and supplied merchant names', () => {
  expect(
    renderAssistantAnswer('مصروفات 〔3 ريال〕 في {{F2}}.', [
      { key: 'F1', value: '3 ريال', path: 'latest.amountMinor' },
      { key: 'F2', value: 'متجر 〔الأمانة〕', path: 'latest.merchant' },
    ]),
  ).toBe('مصروفات 〔3 ريال〕 في متجر 〔الأمانة〕.');
});

it('grounds exact literal amounts and ISO dates without requiring another provider call', () => {
  expect(
    renderAssistantAnswer('مصروفاتك 0 ريال بتاريخ 2026-10-16.', [
      { key: 'F1', value: '0 ريال', path: 'totals.confirmedMinor' },
      { key: 'F2', value: '2026-10-16', path: 'period.startDate' },
    ]),
  ).toBe('مصروفاتك 0 ريال بتاريخ 2026-10-16.');
});

it.each(['صرفت 13 ريال', 'صرفت 3 دولار', 'عندك 3 معاملات'])(
  'keeps unmatched numbers rejected even when other facts share digits: %s',
  (answer) => {
    expect(() =>
      renderAssistantAnswer(answer, [
        { key: 'F1', value: '3 ريال', path: 'totals.confirmedMinor' },
      ]),
    ).toThrow('AI_UNGROUNDED_ANSWER');
  },
);

it('runs a model-selected historical read before answering a follow-up', async () => {
  const reads: unknown[] = [];
  const providerReplies = [
    {
      status: 'query',
      responseType: 'fact',
      scope: 'selected_period',
      answer: '',
      queries: [
        {
          tool: 'transactions',
          startDate: '2026-09-01',
          endDate: '2026-09-30',
          currency: null,
          account: null,
          category: null,
          search: null,
          sort: 'latest',
          limit: 1,
          offset: 0,
        },
      ],
    },
    {
      status: 'answer',
      responseType: 'fact',
      scope: 'selected_period',
      answer: 'آخر معاملة في الفترة بقيمة {{F3}}.',
      queries: [],
    },
  ];
  const agent = new AssistantAgent(
    {
      read: (_id: string, _token: string, query: unknown) => {
        reads.push(query);
        return Promise.resolve(sample);
      },
    } as never,
    {
      complete: (input: { parse: (value: unknown) => unknown; userContent: string }) => {
        const decision = providerReplies.shift();
        if (decision?.status === 'answer') {
          const payload = JSON.parse(input.userContent) as {
            dataAlreadyRead: Array<{ data: { latest: { amountMinor: ModelCell } } }>;
          };
          const fact = payload.dataAlreadyRead[1]?.data.latest.amountMinor;
          if (!fact) throw Error('Expected amount from selected historical read');
          decision.answer = `آخر معاملة في الفترة بقيمة ${fact.ref}.`;
        }
        return Promise.resolve({
          value: input.parse(decision),
          model: 'model',
          provider: 'provider',
          generationId: 'g',
          usage: { inputTokens: 1, outputTokens: 1, cost: 0 },
          latencyMs: 1,
          fallbackUsed: false,
        });
      },
    } as never,
    () => Promise.resolve(),
  );
  const answer = await agent.run(
    {
      ...claim,
      content: 'طيب والشهر اللي فات؟',
      history: [{ role: 'user', content: 'إيه آخر معاملة؟' }],
    },
    route,
    new AbortController().signal,
  );
  expect(reads[1]).toMatchObject({
    tool: 'transactions',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    limit: 1,
  });
  expect(answer.content).toContain('3 ريال');
});

type ModelCell = { value: string; ref: string };
type PagePayload = {
  dataAlreadyRead: Array<{
    data: {
      transactions?: {
        items: Array<{ amountMinor: ModelCell; title: string }>;
        count: ModelCell;
        offset: ModelCell;
        hasMore: boolean;
        modelCoverage?: { omittedRows: ModelCell; nextOffset: ModelCell };
      };
    };
  }>;
};
const historyPage = (limit: number) => ({
  ...sample,
  data: {
    status: 'ok',
    tool: 'transactions',
    transactions: {
      count: 200,
      offset: 0,
      hasMore: true,
      items: Array.from({ length: limit }, (_, index) => ({
        alias: `TRANSACTION-${(index + 1).toString()}`,
        kind: 'expense',
        status: 'confirmed',
        amountMinor: String((index + 1) * 100),
        feeMinor: '0',
        currency: 'SAR',
        occurredAt: '2026-09-15T12:00:00Z',
        title: 'مطعم في الحي '.repeat(8).trim(),
        merchant: 'متجر صاحب الحساب '.repeat(5).trim(),
        categoryLabelAr: 'المطاعم',
        categoryLabelEn: 'Restaurants',
        accounts: ['ACCOUNT-1'],
      })),
    },
  },
});
const queryPage: AssistantDataQuery = {
  tool: 'transactions',
  limit: 50,
  offset: 0,
  sort: 'latest',
};
it('keeps completed financial reads and grounds the answer after two transport stalls', async () => {
  jest.useFakeTimers();
  try {
    const read = jest.fn(() => Promise.resolve(sample));
    const bodies: string[] = [];
    const gateway = new AiGateway({
      apiKey: 'synthetic',
      assistantRecovery: true,
      fetcher: (_url, init) => {
        if (typeof init?.body !== 'string') throw Error('Expected JSON request body');
        bodies.push(init.body);
        if (bodies.length === 2 || bodies.length === 3)
          return new Promise<Response>(() => undefined);
        const decision =
          bodies.length === 1
            ? {
                status: 'query',
                answer: '',
                queries: [queryPage],
                responseType: 'fact',
                scope: 'all_history',
              }
            : {
                status: 'answer',
                answer: 'Latest {{F1}}.',
                queries: [],
                responseType: 'fact',
                scope: 'all_history',
              };
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: `synthetic-${bodies.length.toString()}`,
              model: 'model',
              choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(decision) } }],
              usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0 },
            }),
            { headers: { 'content-type': 'application/json' } },
          ),
        );
      },
    });
    const agent = new AssistantAgent({ read } as never, gateway, () => Promise.resolve());
    const pending = agent.run(
      { ...claim, content: 'Latest expense?' },
      route,
      new AbortController().signal,
    );
    const result = expect(pending).resolves.toMatchObject({ content: 'Latest 3 SAR.' });
    await jest.advanceTimersByTimeAsync(40_001);
    await result;
    expect(read).toHaveBeenCalledTimes(2);
    expect(bodies).toHaveLength(4);
    expect(bodies[2]).toBe(bodies[1]);
    expect(bodies[3]).toBe(bodies[1]);
  } finally {
    jest.useRealTimers();
  }
});

const reply = (input: { parse: (value: unknown) => unknown }, decision: unknown) =>
  Promise.resolve({
    value: input.parse(decision),
    model: 'model',
    provider: 'provider',
    generationId: 'g',
    usage: { inputTokens: 1, outputTokens: 1, cost: 0 },
    latencyMs: 1,
    fallbackUsed: false,
  });

it('answers from the last item of a legal fifty-transaction page without duplicating data beyond the context bound', async () => {
  const page = historyPage(50);
  expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThan(65536);
  let round = 0;
  const agent = new AssistantAgent(
    {
      read: (_id: string, _token: string, query: AssistantDataQuery) =>
        Promise.resolve(query.tool === 'overview' ? sample : page),
    } as never,
    {
      complete: (input: { parse: (value: unknown) => unknown; userContent: string }) => {
        expect(Buffer.byteLength(input.userContent)).toBeLessThanOrEqual(48000);
        if (round++ === 0)
          return reply(input, {
            status: 'query',
            responseType: 'fact',
            scope: 'all_history',
            answer: '',
            queries: [queryPage],
          });
        const payload = JSON.parse(input.userContent) as PagePayload;
        const collection = payload.dataAlreadyRead[1]?.data.transactions;
        expect(collection?.items).toHaveLength(50);
        const last = collection?.items.at(-1);
        if (!last) throw Error('Expected final requested transaction');
        expect(last.amountMinor.value).toBe('50 ريال');
        return reply(input, {
          status: 'answer',
          responseType: 'fact',
          scope: 'all_history',
          answer: `المعاملة المطلوبة بقيمة ${last.amountMinor.ref}.`,
          queries: [],
        });
      },
    } as never,
    () => Promise.resolve(),
  );
  await expect(agent.run(claim, route, new AbortController().signal)).resolves.toMatchObject({
    content: 'المعاملة المطلوبة بقيمة 50 ريال.',
  });
});

it('discloses omitted rows and the exact next offset for oversized independent pages while preserving each shown row', async () => {
  let round = 0;
  const page = historyPage(50);
  const agent = new AssistantAgent(
    {
      read: (_id: string, _token: string, query: AssistantDataQuery) =>
        Promise.resolve(query.tool === 'overview' ? sample : page),
    } as never,
    {
      complete: (input: { parse: (value: unknown) => unknown; userContent: string }) => {
        expect(Buffer.byteLength(input.userContent)).toBeLessThanOrEqual(48000);
        if (round++ === 0)
          return reply(input, {
            status: 'query',
            responseType: 'fact',
            scope: 'all_history',
            answer: '',
            queries: [queryPage, queryPage, queryPage, queryPage],
          });
        const payload = JSON.parse(input.userContent) as PagePayload;
        for (const read of payload.dataAlreadyRead.slice(1)) {
          const collection = read.data.transactions;
          if (!collection) throw Error('Expected collection coverage');
          expect(collection.items.length).toBeGreaterThan(0);
          expect(collection.items.length).toBeLessThan(50);
          expect(collection.items[0]?.title).toBe(page.data.transactions.items[0]?.title);
          expect(collection.count.value).toBe('200');
          expect(collection.modelCoverage?.omittedRows.value).toBe(
            String(50 - collection.items.length),
          );
          expect(collection.modelCoverage?.nextOffset.value).toBe(String(collection.items.length));
          expect(collection.hasMore).toBe(true);
        }
        return reply(input, {
          status: 'answer',
          responseType: 'missing',
          scope: 'all_history',
          answer: 'المتاح جزء من المعاملات؛ أحتاج استكمال الصفحات قبل الحكم على القائمة كاملة.',
          queries: [],
        });
      },
    } as never,
    () => Promise.resolve(),
  );
  const answer = await agent.run(claim, route, new AbortController().signal);
  expect(answer.content).toContain('استكمال الصفحات');
});

it('continues an oversized planning page from the requested offset when the collection omits its offset', async () => {
  const transactions = historyPage(50).data.transactions;
  const planningPage = {
    ...sample,
    data: {
      planning: {
        collections: {
          budget: { items: transactions.items, count: 200, hasMore: true },
        },
      },
    },
  };
  let round = 0;
  const planningQuery: AssistantDataQuery = { tool: 'planning', limit: 50, offset: 50 };
  const agent = new AssistantAgent(
    {
      read: (_id: string, _token: string, query: AssistantDataQuery) =>
        Promise.resolve(query.tool === 'overview' ? sample : planningPage),
    } as never,
    {
      complete: (input: { parse: (value: unknown) => unknown; userContent: string }) => {
        if (round++ === 0)
          return reply(input, {
            status: 'query',
            responseType: 'fact',
            scope: 'current_state',
            answer: '',
            queries: [planningQuery, planningQuery, planningQuery, planningQuery],
          });
        const payload = JSON.parse(input.userContent) as {
          dataAlreadyRead: Array<{
            data: {
              planning?: {
                collections: {
                  budget: {
                    items: unknown[];
                    modelCoverage?: { nextOffset: ModelCell };
                  };
                };
              };
            };
          }>;
        };
        for (const read of payload.dataAlreadyRead.slice(1)) {
          const budget = read.data.planning?.collections.budget;
          if (!budget) throw Error('Expected requested planning page');
          expect(budget.items.length).toBeGreaterThan(0);
          expect(budget.items.length).toBeLessThan(50);
          expect(budget.modelCoverage?.nextOffset.value).toBe(String(50 + budget.items.length));
        }
        return reply(input, {
          status: 'answer',
          responseType: 'missing',
          scope: 'current_state',
          answer: 'القائمة المعروضة جزئية وتحتاج استكمال.',
          queries: [],
        });
      },
    } as never,
    () => Promise.resolve(),
  );
  await expect(agent.run(claim, route, new AbortController().signal)).resolves.toMatchObject({
    content: 'القائمة المعروضة جزئية وتحتاج استكمال.',
  });
});

it('keeps the latest complete conversation turns within the context budget and discloses omitted older turns', async () => {
  const history = Array.from({ length: 16 }, (_, index) => ({
    role: 'user',
    content: `turn-${index.toString()} ${'تفاصيل '.repeat(400)}`,
  }));
  const agent = new AssistantAgent(
    { read: () => Promise.resolve(sample) } as never,
    {
      complete: (input: { parse: (value: unknown) => unknown; userContent: string }) => {
        expect(Buffer.byteLength(input.userContent)).toBeLessThanOrEqual(48000);
        const payload = JSON.parse(input.userContent) as {
          conversation: typeof history;
          conversationCoverage: { omittedOlderTurns: number };
        };
        expect(payload.conversation.length).toBeGreaterThan(0);
        expect(payload.conversation.at(-1)).toEqual(history.at(-1));
        expect(payload.conversationCoverage.omittedOlderTurns).toBe(
          history.length - payload.conversation.length,
        );
        return reply(input, {
          status: 'answer',
          responseType: 'missing',
          scope: 'all_history',
          answer: 'محتاج تحدد الفترة المقصودة.',
          queries: [],
        });
      },
    } as never,
    () => Promise.resolve(),
  );
  await expect(
    agent.run({ ...claim, history }, route, new AbortController().signal),
  ).resolves.toMatchObject({ content: 'محتاج تحدد الفترة المقصودة.' });
});

it('redacts personal identifiers from both model display cells and the rendered answer', async () => {
  const sensitive = 'customer@example.com +966501234567 123e4567-e89b-42d3-a456-426614174000';
  const privateSample = {
    ...sample,
    data: { latest: { ...sample.data.latest, title: sensitive } },
  };
  const agent = new AssistantAgent(
    { read: () => Promise.resolve(privateSample) } as never,
    {
      complete: (input: { parse: (value: unknown) => unknown; userContent: string }) => {
        expect(input.userContent).not.toContain('customer@example.com');
        expect(input.userContent).not.toContain('+966501234567');
        expect(input.userContent).not.toContain('123e4567-e89b-42d3-a456-426614174000');
        const payload = JSON.parse(input.userContent) as {
          dataAlreadyRead: Array<{ data: { latest: { title: string; amountMinor: ModelCell } } }>;
        };
        const latest = payload.dataAlreadyRead[0]?.data.latest;
        if (!latest) throw Error('Expected owner evidence');
        expect(latest.title).toContain('[redacted-email]');
        return reply(input, {
          status: 'answer',
          responseType: 'fact',
          scope: 'all_history',
          answer: `المعاملة بقيمة ${latest.amountMinor.ref}.`,
          queries: [],
        });
      },
    } as never,
    () => Promise.resolve(),
  );
  await expect(agent.run(claim, route, new AbortController().signal)).resolves.toMatchObject({
    content: 'المعاملة بقيمة 3 ريال.',
  });
});

it.each([
  {
    question: 'صرفت كام النهارده ودخلي كام؟',
    invalid: 'دخل النهارده 999 ريال والمصاريف 999 ريال.',
  },
  {
    question: 'أكيد أنا صرفت ألف ريال النهارده، صح؟',
    invalid:
      'لأ، مفيش مصروفات مسجّلة النهارده (〔F?〕). إجمالي مصروفاتك النهارده 〔F?〕، حسب السجل المتاح.',
  },
])(
  'corrects an unsupported empty-day reply from the gateway using exact totals: $question',
  async ({ question, invalid }) => {
    const todayQuery: AssistantDataQuery = {
      tool: 'summary',
      startDate: '2026-10-16',
      endDate: '2026-10-16',
      currency: 'SAR',
    };
    const overview = {
      ...sample,
      data: {
        status: 'ok',
        accounts: { items: [{ currency: 'SAR' }, { currency: 'USD' }] },
        period: { startDate: '2026-10-01', endDate: '2026-10-16' },
        summaries: [
          { currency: 'USD', kind: 'expense', status: 'confirmed', amountMinor: '1000', count: 1 },
        ],
      },
    };
    const emptyDay = {
      ...sample,
      data: {
        status: 'ok',
        period: { startDate: '2026-10-16', endDate: '2026-10-16' },
        summaries: [],
      },
    };
    let round = 0;
    const gateway = new AiGateway({
      apiKey: 'synthetic-empty-day-key',
      fetcher: (_url, init) => {
        if (typeof init?.body !== 'string') throw new Error('Expected JSON request body');
        const body = JSON.parse(init.body) as { messages: Array<{ content: string }> };
        const respond = (decision: unknown) =>
          Promise.resolve(
            new Response(
              JSON.stringify({
                id: 'synthetic-empty-day-repair',
                model: route.primary.modelId,
                choices: [
                  { finish_reason: 'stop', message: { content: JSON.stringify(decision) } },
                ],
                usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0 },
              }),
              { headers: { 'content-type': 'application/json' } },
            ),
          );
        if (round++ === 0)
          return respond({
            status: 'query',
            responseType: 'fact',
            scope: 'selected_period',
            answer: '',
            queries: [todayQuery],
          });
        if (round === 2)
          return respond({
            status: 'answer',
            responseType: 'fact',
            scope: 'selected_period',
            answer: invalid,
            queries: [],
          });
        type Total = {
          readIndex: ModelCell;
          currency: string;
          kind: string;
          confirmedMinor: ModelCell;
        };
        const payload = JSON.parse(body.messages[1]?.content ?? '{}') as {
          validationFeedback: string;
          exactPeriodTotals: Total[] | { items: Total[] };
        };
        expect(payload.validationFeedback).toContain('Available zero references');
        const totals = Array.isArray(payload.exactPeriodTotals)
          ? payload.exactPeriodTotals
          : payload.exactPeriodTotals.items;
        const income = totals.find(
          (total) =>
            total.readIndex.value === '1' && total.currency === 'SAR' && total.kind === 'income',
        );
        const expense = totals.find(
          (total) =>
            total.readIndex.value === '1' && total.currency === 'SAR' && total.kind === 'expense',
        );
        if (!income || !expense)
          throw Error('Expected complete confirmed totals for the requested day');
        expect(income.confirmedMinor.value).toBe('0 ريال');
        expect(expense.confirmedMinor.value).toBe('0 ريال');
        return respond({
          status: 'answer',
          responseType: 'fact',
          scope: 'selected_period',
          answer: `دخل النهارده المؤكد ${income.confirmedMinor.ref} والمصروفات المؤكدة ${expense.confirmedMinor.ref}.`,
          queries: [],
        });
      },
    });
    const agent = new AssistantAgent(
      {
        read: (_id: string, _token: string, query: AssistantDataQuery) =>
          Promise.resolve(query.tool === 'overview' ? overview : emptyDay),
      } as never,
      gateway,
      () => Promise.resolve(),
    );
    const answer = await agent.run(
      { ...claim, content: question },
      route,
      new AbortController().signal,
    );
    expect(round).toBe(3);
    expect(answer.content).toBe('دخل النهارده المؤكد 0 ريال والمصروفات المؤكدة 0 ريال.');
    expect(answer.metadata.currencies).toEqual(['SAR']);
  },
);

it('reports the currency of an accepted exact monetary literal as well as explicit fact references', async () => {
  const agent = new AssistantAgent(
    { read: () => Promise.resolve(sample) } as never,
    {
      complete: (input: { parse: (value: unknown) => unknown }) =>
        reply(input, {
          status: 'answer',
          responseType: 'fact',
          scope: 'all_history',
          answer: 'آخر معاملة بقيمة 3 ريال.',
          queries: [],
        }),
    } as never,
    () => Promise.resolve(),
  );
  const answer = await agent.run(claim, route, new AbortController().signal);
  expect(answer.content).toBe('آخر معاملة بقيمة 3 ريال.');
  expect(answer.metadata.currencies).toEqual(['SAR']);
});

it.each(['-3 SAR', '−3 SAR'])('rejects a changed monetary sign in a literal: %s', (literal) => {
  expect(() =>
    renderAssistantAnswer(`Balance: ${literal}.`, [
      { key: 'F1', value: '3 SAR', path: 'account.confirmedMinor', currency: 'SAR' },
    ]),
  ).toThrow('AI_UNGROUNDED_ANSWER');
});

it.each([false, true])(
  'labels the period supporting the answer instead of a later unrelated read (literal=%s)',
  async (literal) => {
    let round = 0;
    const period = { startDate: '2026-10-01', endDate: '2026-10-16' };
    const agent = new AssistantAgent(
      {
        read: (_id: string, _token: string, query: AssistantDataQuery) =>
          Promise.resolve({
            ...sample,
            data:
              query.tool === 'summary'
                ? { period, amountMinor: '8200', currency: 'SAR' }
                : query.tool === 'transactions'
                  ? { period: { startDate: '2026-09-01', endDate: '2026-09-30' }, count: 2 }
                  : sample.data,
          }),
      } as never,
      {
        complete: (input: { parse: (value: unknown) => unknown; userContent: string }) => {
          if (round++ === 0)
            return reply(input, {
              status: 'query',
              answer: '',
              responseType: 'fact',
              scope: 'selected_period',
              queries: [
                { tool: 'summary', ...period },
                { tool: 'transactions', startDate: '2026-09-01', endDate: '2026-09-30' },
              ],
            });
          const payload = JSON.parse(input.userContent) as {
            dataAlreadyRead: Array<{ data: { amountMinor: ModelCell } }>;
          };
          return reply(input, {
            status: 'answer',
            answer: `مصروفات الفترة ${literal ? '82 ريال' : (payload.dataAlreadyRead[1]?.data.amountMinor.ref ?? 'MISSING_TEST_REFERENCE')}.`,
            queries: [],
            responseType: 'fact',
            scope: 'selected_period',
          });
        },
      } as never,
      () => Promise.resolve(),
    );
    const answer = await agent.run(claim, route, new AbortController().signal);
    expect(answer.content).toBe('مصروفات الفترة 82 ريال.');
    expect(answer.metadata).toMatchObject({ scope: 'selected_period', ...period });
  },
);

it('labels a current-period comparison fact with its originating period', async () => {
  let round = 0;
  const current = { startDate: '2026-10-01', endDate: '2026-10-16' };
  const previous = { startDate: '2026-09-01', endDate: '2026-09-16' };
  const agent = new AssistantAgent(
    {
      read: (_id: string, _token: string, query: AssistantDataQuery) =>
        Promise.resolve({
          ...sample,
          data: {
            status: 'ok',
            period: query.tool === 'overview' ? current : previous,
            summaries: [
              {
                currency: 'SAR',
                kind: 'expense',
                status: 'confirmed',
                amountMinor: query.tool === 'overview' ? '8200' : '6400',
                count: 1,
              },
            ],
          },
        }),
    } as never,
    {
      complete: (input: { parse: (value: unknown) => unknown; userContent: string }) => {
        if (round++ === 0)
          return reply(input, {
            status: 'query',
            answer: '',
            responseType: 'fact',
            scope: 'selected_period',
            queries: [{ tool: 'summary', ...previous }],
          });
        const payload = JSON.parse(input.userContent) as {
          exactComparisons: { items: Array<{ currentMinor: ModelCell }> };
        };
        return reply(input, {
          status: 'answer',
          answer: `مصروفات الشهر الحالي ${payload.exactComparisons.items[0]?.currentMinor.ref ?? 'MISSING_TEST_REFERENCE'}.`,
          queries: [],
          responseType: 'fact',
          scope: 'selected_period',
        });
      },
    } as never,
    () => Promise.resolve(),
  );
  const answer = await agent.run(claim, route, new AbortController().signal);
  expect(answer.metadata.spendingSummary).toMatchObject({ cards: [{ amount: '82 ريال' }] });
  expect(answer.content).toBe('مصروفات الشهر الحالي 82 ريال.');
  expect(answer.metadata).toMatchObject({ scope: 'selected_period', ...current });
});
