import { AiRepository } from '../../../src/ai/ai.repository';
import { logContext } from '../../../src/platform/observability/log-context';
import { PlatformLogger } from '../../../src/platform/observability/platform-logger';

it('records the API request and durable operation together only after commit', async () => {
  let committed = false;
  const captured: Record<string, unknown>[] = [];
  jest.spyOn(PlatformLogger.prototype, 'info').mockImplementation((message, fields) => {
    if (message === 'task.accepted') {
      expect(committed).toBe(true);
      captured.push({ ...logContext.getStore(), ...fields });
    }
  });
  const query = (sql: string) => {
    if (sql === 'commit') committed = true;
    if (sql.includes('claim_sync_idempotency_key'))
      return Promise.resolve({
        rows: [{ outcome: 'new', lease_token: '99000000-0000-4000-8000-000000000002' }],
      });
    if (sql.includes('reserve_ai_quota'))
      return Promise.resolve({ rows: [{ result: { allowed: true } }] });
    if (sql.includes('enqueue_assistant_message'))
      return Promise.resolve({
        rows: [{ result: { id: '99000000-0000-4000-8000-000000000001' } }],
      });
    return Promise.resolve({ rows: [] });
  };
  const repo = new AiRepository({
    withClient: async (callback: (client: unknown) => Promise<unknown>) => callback({ query }),
  } as never);
  const result = await logContext.run({ requestId: 'api-caller' }, () =>
    repo.enqueueMessage(
      { userId: 'owner', sessionId: 'fixture-session', factorAgeSeconds: 0 },
      '99000000-0000-4000-8000-000000000003',
      { content: 'fixture private words' },
      'correlation-fixture-key',
    ),
  );
  if (!('operationId' in result)) throw Error('Missing accepted operation');
  expect(captured).toEqual([
    expect.objectContaining({
      requestId: 'api-caller',
      resourceId: result.operationId,
      operation: 'ai.operation.accepted',
    }),
    expect.objectContaining({
      requestId: 'api-caller',
      resourceId: '99000000-0000-4000-8000-000000000001',
      operation: 'ai.resource.accepted',
    }),
  ]);
  expect(JSON.stringify(captured)).not.toContain('private words');
});
