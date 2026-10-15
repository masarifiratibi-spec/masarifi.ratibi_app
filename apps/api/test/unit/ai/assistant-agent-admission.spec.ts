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

function service(enabled = true) {
  const writes: Record<string, unknown>[] = [];
  const repository = {
    workloadAvailable: () => Promise.resolve(true),
    recentConversationTurns: () => Promise.resolve([]),
    enqueueMessage: (_principal: unknown, _id: string, input: Record<string, unknown>) => {
      writes.push(input);
      return Promise.resolve({ resource: { id: conversation, workStatus: 'queued' } });
    },
    saveDeterministicMessage: () =>
      Promise.resolve({ resource: { id: conversation, workStatus: 'completed' } }),
  };
  const config = {
    get: (key: string) =>
      (
        ({
          MASARIFI_ASSISTANT_AGENT_ENABLED: enabled,
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
    { resolve: () => Promise.resolve({ answer: 'fixed', context: {}, evidence: [] }) } as never,
    config as never,
  );
  return { instance, writes };
}

it.each(['إيه آخر معاملة؟', 'عايز أعرف رصيدي', 'صرفت كام النهارده ودخلي كام؟'])(
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
