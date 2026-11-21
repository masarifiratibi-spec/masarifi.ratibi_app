import { AiRepository } from '../../../src/ai/ai.repository';
import { AssistantAgentRepository } from '../../../src/ai/assistant-agent.repository';

it.each([
  ['masarifi_worker', 2],
  [undefined, 9],
] as const)(
  'polls both report queues on a %s pool with %i commands',
  async (runtimeRole, count) => {
    const query = jest.fn((sql: string) => {
      if (sql.includes('claim_next_assistant_agent_job'))
        return Promise.resolve({ rows: [{ result: null }] });
      if (sql.includes('claim_ai_work')) return Promise.resolve({ rows: [{ claims: [] }] });
      return Promise.resolve({ rows: [] });
    });
    const client = { query };
    const pool = {
      runtimeRole,
      withClient: (run: (connection: typeof client) => unknown) => run(client),
      query,
    } as never;
    await expect(new AssistantAgentRepository(pool).claimNext()).resolves.toBeNull();
    await expect(
      new AiRepository(pool).claimWork('assistant.respond', 'worker', 1, 180),
    ).resolves.toEqual([]);
    expect(query).toHaveBeenCalledTimes(count);
    if (runtimeRole === 'masarifi_worker') {
      expect(query.mock.calls[0]?.[0]).toContain(
        "from pg_catalog.set_config('request.jwt.claims','{}',true)",
      );
      expect(query.mock.calls[1]?.[0]).toContain('private.bind_financial_worker_generation');
    }
  },
);
