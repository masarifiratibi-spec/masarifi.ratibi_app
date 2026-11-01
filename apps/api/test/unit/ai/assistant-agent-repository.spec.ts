import { AssistantAgentRepository } from '../../../src/ai/assistant-agent.repository';
import type { AssistantAgentClaim, GroundedAssistantAnswer } from '../../../src/ai/assistant-agent';

const claim: AssistantAgentClaim = {
  id: 'job',
  claimToken: 'fence',
  userId: 'owner',
  attempt: 1,
  operationId: 'operation',
  content: 'آخر ثلاث عمليات؟',
  timezone: 'Asia/Riyadh',
  contextScope: [],
  context: {},
  history: [],
};
const answer = (content: string): GroundedAssistantAnswer => ({
  content,
  model: 'model',
  provider: 'provider',
  evidence: [],
  metadata: { scope: 'all_history' },
});

function databaseBoundary() {
  let submitted: unknown[] | undefined;
  const withClient = jest.fn((work: (client: unknown) => Promise<unknown>) =>
    work({
      query: (sql: string, args?: unknown[]) => {
        if (sql.includes('finish_assistant_agent_job')) submitted = args;
        return Promise.resolve({ rows: [{ result: true }] });
      },
    }),
  );
  return {
    repository: new AssistantAgentRepository({ withClient } as never),
    withClient,
    submitted: () => submitted,
  };
}

it('persists three grounded lines without violating the existing SQL control-character constraint (QA08)', async () => {
  const db = databaseBoundary();
  const original = answer(
    'مصروف — متجر 24 — 2.5 ريال\nمصروف — متجر — -12.345 KWD\nمصروف — كتب — 1,000 JPY',
  );
  await expect(db.repository.finish(claim, original)).resolves.toBe(true);
  const args = db.submitted();
  expect(args?.slice(0, 2)).toEqual(['job', 'fence']);
  if (typeof args?.[2] !== 'string') throw Error('Expected persisted answer JSON');
  const payload = JSON.parse(args[2]) as GroundedAssistantAnswer & { preview: null };
  expect(payload.content).toBe(
    'مصروف — متجر 24 — 2.5 ريال\u2028مصروف — متجر — -12.345 KWD\u2028مصروف — كتب — 1,000 JPY',
  );
  expect(payload.metadata).toEqual(original.metadata);
  expect(payload.preview).toBeNull();
  expect(original.content).toContain('\n');
});

it.each([
  { name: 'UTF8 expansion exceeds the stored byte limit', content: 'x'.repeat(16382) + '\n' },
  { name: 'an unsupported control character remains', content: 'answer\u0000tail' },
])('rejects the answer before a database attempt when $name', ({ content }) => {
  const db = databaseBoundary();
  expect(() => db.repository.finish(claim, answer(content))).toThrow('AI_SCHEMA_INVALID');
  expect(db.withClient).not.toHaveBeenCalled();
});
