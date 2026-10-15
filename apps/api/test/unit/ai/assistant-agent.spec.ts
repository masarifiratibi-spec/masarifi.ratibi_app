import { AssistantAgent, renderAssistantAnswer } from '../../../src/ai/assistant-agent';
import type { AssistantDataQuery } from '../../../src/ai/assistant-agent-data';

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
const route = {
  workload: 'financial_assistant',
  primary: { modelId: 'model', provider: 'provider' },
  fallbacks: [],
  providerAllowlist: ['provider'],
  zdrRequired: true,
  maxPrice: { prompt: '1', completion: '1' },
  limits: { inputTokens: 32000, outputTokens: 4096, timeoutMs: 60000 },
  prompt: { template: 'Never use tools.', schemaVersion: 1 },
  safetyRules: [],
};

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

it.each(['صرفت 999 ريال', 'صرفت {{F999}}', 'صرفت ٩٩٩ ريال'])(
  'rejects unsupported numeric or nonexistent fact claims: %s',
  (answer) => {
    expect(() =>
      renderAssistantAnswer(answer, [{ key: 'F1', value: '3 ريال', path: 'latest.amountMinor' }]),
    ).toThrow('AI_UNGROUNDED_ANSWER');
  },
);

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

it('corrects an unsupported numeric reply using exact totals for the requested empty day and reports only the currency used', async () => {
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
  const agent = new AssistantAgent(
    {
      read: (_id: string, _token: string, query: AssistantDataQuery) =>
        Promise.resolve(query.tool === 'overview' ? overview : emptyDay),
    } as never,
    {
      complete: (input: { parse: (value: unknown) => unknown; userContent: string }) => {
        if (round++ === 0)
          return reply(input, {
            status: 'query',
            responseType: 'fact',
            scope: 'selected_period',
            answer: '',
            queries: [todayQuery],
          });
        if (round === 2)
          return reply(input, {
            status: 'answer',
            responseType: 'fact',
            scope: 'selected_period',
            answer: 'دخل النهارده 999 ريال والمصاريف 999 ريال.',
            queries: [],
          });
        type Total = {
          readIndex: ModelCell;
          currency: string;
          kind: string;
          confirmedMinor: ModelCell;
        };
        const payload = JSON.parse(input.userContent) as {
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
        return reply(input, {
          status: 'answer',
          responseType: 'fact',
          scope: 'selected_period',
          answer: `دخل النهارده المؤكد ${income.confirmedMinor.ref} والمصروفات المؤكدة ${expense.confirmedMinor.ref}.`,
          queries: [],
        });
      },
    } as never,
    () => Promise.resolve(),
  );
  const answer = await agent.run(
    { ...claim, content: 'صرفت كام النهارده ودخلي كام؟' },
    route,
    new AbortController().signal,
  );
  expect(round).toBe(3);
  expect(answer.content).toBe('دخل النهارده المؤكد 0 ريال والمصروفات المؤكدة 0 ريال.');
  expect(answer.metadata.currencies).toEqual(['SAR']);
});

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
