import { AiService } from '../../../src/ai/ai.service';
import type { ClerkPrincipal } from '../../../src/identity/clerk-auth.guard';

const owner = { userId: 'dev-owner', sessionId: 'session', factorAgeSeconds: 0 };
const conversation = '99000000-0000-4000-8000-000000000001';
const send = (
  instance: AiService,
  actor: ClerkPrincipal,
  id: string,
  body: unknown,
  key: string,
  variant: boolean,
) =>
  variant
    ? instance.createDevelopmentMessage(actor, id, body, key)
    : instance.createMessage(actor, id, body, key);

function service(enabled = true, publicAgent = false) {
  const writes: Record<string, unknown>[] = [];
  const notices: Record<string, unknown>[] = [];
  const checks: string[] = [];
  const resolve = jest.fn().mockResolvedValue({ answer: 'fixed', context: {}, evidence: [] });
  const repository = {
    workloadAvailable: () => {
      checks.push('availability');
      return Promise.resolve(true);
    },
    recentConversationTurns: () => Promise.resolve([]),
    enqueueMessage: (_principal: unknown, _id: string, input: Record<string, unknown>) => {
      writes.push(input);
      return Promise.resolve({ resource: { id: conversation, workStatus: 'queued' } });
    },
    saveDeterministicMessage: (_actor: unknown, _id: string, input: Record<string, unknown>) => {
      notices.push(input);
      return Promise.resolve({ resource: { id: conversation, workStatus: 'completed' } });
    },
  };
  const config = {
    get: (key: string) =>
      (
        ({
          MASARIFI_ASSISTANT_AGENT_ENABLED: enabled,
          MASARIFI_ASSISTANT_AGENT_PUBLIC_ENABLED: publicAgent,
          MASARIFI_ASSISTANT_AGENT_OWNER_ID: owner.userId,
          SUPABASE_URL: 'https://qcffvfbpzvpwcwxwjyro.supabase.co',
        }) as Record<string, unknown>
      )[key],
    getRequired: () => true,
  };
  const instance = new AiService(
    repository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { resolve } as never,
    config as never,
  );
  return { instance, writes, notices, checks, resolve };
}

it.each([
  'صرفتهم علي اي بظبط',
  'ازاي اوفر',
  'عايزك تفهمني اخر مصروفاتي',
  'And where did that money go?',
  'What do you mean by that?',
  'وش تفاصيل المعاملة اللي اسمها أضف مصروف؟',
  'Show transactions at Add transaction shop',
  'كيف أسجل مصروف؟',
  'create transaction script in Python',
])('uses semantic data access for an ordinary user asking %s', async (content) => {
  const { instance, writes, notices } = service(false, true);
  await instance.createMessage(
    { ...owner, userId: 'ordinary-owner' },
    conversation,
    { content, responseMode: 'async' },
    'ordinary-semantic-test-key-001',
  );
  expect(notices).toEqual([]);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ content, context: { assistantAgent: 1 } });
});

it('keeps explicit action previews outside the read-only semantic agent', async () => {
  const { instance, writes, notices } = service(false, true);
  await instance.createMessage(
    owner,
    conversation,
    { content: 'Add an expense', intent: 'create_transaction', responseMode: 'async' },
    'ordinary-semantic-test-key-002',
  );
  expect(writes).toEqual([]);
  expect(notices).toHaveLength(1);
});

it('preserves an explicit action UI intent when its record text resembles a programming request', async () => {
  const { instance, writes, resolve } = service(false, true);
  resolve.mockResolvedValue({ answer: null, context: { authoritative: true }, evidence: [] });
  await instance.createMessage(
    owner,
    conversation,
    {
      content: 'create expense app subscription',
      intent: 'create_transaction',
      responseMode: 'async',
    },
    'explicit-action-ui-compatibility-001',
  );
  expect(writes).toEqual([
    expect.objectContaining({ intent: 'create_transaction', context: { authoritative: true } }),
  ]);
});

it.each(
  [
    ['أضف مصروف 1 ريال', 'create_transaction'],
    ['عدل المعاملة الأخيرة', 'update_transaction'],
    ['عدل الميزانية', 'update_budget'],
    ['create saving goal', 'create_savings_goal'],
    ['record payment for obligation', 'record_obligation_payment'],
    ['اعتمد مراجعة التتبع', 'resolve_tracking_review'],
  ].flatMap(([content, intent]) => [
    { content, intent, development: false },
    { content, intent, development: true },
  ]),
)(
  'routes a plain-text $intent request through the existing reviewed action flow (DEV=$development)',
  async ({ content, intent, development }) => {
    const { instance, writes, notices, resolve } = service(true, true);
    resolve.mockResolvedValue({ answer: null, context: { authoritative: true }, evidence: [] });
    await send(
      instance,
      { ...owner, userId: 'ordinary-owner' },
      conversation,
      { content, responseMode: 'async' },
      'plain-text-financial-action-test-001',
      development,
    );
    expect(notices).toEqual([]);
    expect(resolve).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'ordinary-owner' }),
      intent,
      content,
      'plain-text-financial-action-test-001',
      expect.any(Array),
    );
    expect(writes).toEqual([expect.objectContaining({ intent, context: { authoritative: true } })]);
  },
);

it.each([
  'اعرض آخر ثلاث معاملات مؤكدة فقط.',
  'قارن مصروفاتي هالشهر بالشهر اللي قبله.',
  'طيب وأغسطس؟',
  'Show my largest single expense and highest spending category in English.',
])('admits the ordinary DEV client through the existing public agent for %s', async (content) => {
  // 2026-10-31: DEV routing reached an API bound to another development owner.
  const { instance, writes, notices } = service(true, true);
  const actor = { ...owner, userId: 'ordinary-owner' };
  const result = await instance.createDevelopmentMessage(
    actor,
    conversation,
    { content, responseMode: 'async' },
    'ordinary-dev-public-semantic-test-001',
  );
  expect(result.status).toBe('queued');
  expect(notices).toEqual([]);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ content, context: { assistantAgent: 1 } });
});

it('does not let an intent hint replace semantic understanding of a financial read', async () => {
  const { instance, writes, notices } = service(false, true);
  await instance.createMessage(
    owner,
    conversation,
    {
      content: 'صرفتهم علي اي بظبط',
      intent: 'spending_summary',
      contextScope: ['recent_transactions'],
      responseMode: 'async',
    },
    'ordinary-semantic-test-key-003',
  );
  expect(notices).toEqual([]);
  expect(writes[0]).toMatchObject({
    context: { assistantAgent: 1 },
    contextScope: ['recent_transactions'],
  });
});

it.each([
  'تعرف تبرمج',
  'تعرف تبرمجاكتب برنامج ب باحثون',
  'اكتب برنامج بايثون يحلل مصاريفي',
  'write a budget app in Python',
  'create transaction script in Python',
  'ازيك',
  'السلام عليكم',
])(
  'declines the direct nonfinancial request %s before model admission or quota',
  async (content) => {
    const { instance, writes, notices, checks } = service();
    const result = await send(
      instance,
      owner,
      conversation,
      { content, intent: 'financial_advice', responseMode: 'async' },
      'assistant-scope-test-key-001',
      true,
    );
    expect(result.status).toBe('completed');
    expect(writes).toEqual([]);
    expect(checks).toEqual([]);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      intent: 'unrelated',
      contextScope: [],
      evidence: [],
      context: {
        assistantMetadata: { responseType: 'redirect', scope: 'current_state', currencies: [] },
      },
    });
    expect(String(notices[0]?.answer).length).toBeLessThanOrEqual(180);
  },
);

it.each([
  'إيه آخر معاملة؟',
  'عايز أعرف رصيدي',
  'صرفت كام النهارده ودخلي كام؟',
  'صرفت كام عند Python؟',
  'مصروفات فئة البرمجة',
  'ابحث عن معاملة كود',
  'السلام عليكم، صرفت كام؟',
  'طيب ونفس الكلام لأمبارح؟',
  'اعمل لي برنامج ادخار شهري',
  'اكتب برنامج لسداد ديوني',
  'تقدر تكتب برنامج ادخار شهري',
  'ابحث عن معاملة اسمها اكتب برنامج',
])(
  'sends DEV question %s to the model with authorized data access instead of a fixed answer',
  async (content) => {
    const { instance, writes } = service();
    const result = await send(
      instance,
      owner,
      conversation,
      { content, responseMode: 'async' },
      'assistant-agent-test-key-001',
      true,
    );
    expect(result.status).toBe('queued');
    expect(writes).toHaveLength(1);
    expect(writes[0]?.content).toBe(content);
    expect(writes[0]?.context).toEqual({ assistantAgent: 1, intentHint: null });
    expect(writes[0]?.contextScope).toEqual([
      'accounts_summary',
      'recent_transactions',
      'budgets',
      'obligations',
      'tracking_reviews',
    ]);
  },
);

it.each([
  [false, true, owner],
  [true, false, owner],
  [true, true, { ...owner, userId: 'other' }],
] as const)(
  'keeps ordinary, unconfigured and other-owner requests outside new DEV admission',
  async (enabled, variant, actor) => {
    const { instance, writes } = service(enabled);
    await send(
      instance,
      actor,
      conversation,
      { content: 'عايز أعرف رصيدي', responseMode: 'async' },
      'assistant-agent-test-key-002',
      variant,
    );
    expect(writes).toEqual([]);
  },
);

it('preserves an explicitly restricted data scope for the agent', async () => {
  const { instance, writes } = service();
  await send(
    instance,
    owner,
    conversation,
    { content: 'حلل بياناتي', contextScope: ['budgets'], responseMode: 'async' },
    'assistant-agent-test-key-003',
    true,
  );
  expect(writes[0]?.contextScope).toEqual(['budgets']);
});
