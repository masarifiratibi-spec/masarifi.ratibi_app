import { AiRepository } from '../../../src/ai/ai.repository';
import { PoolService } from '../../../src/platform/database/pool.service';

// This connection must be a local login with SET permission for API only, never Worker.
const databaseUrl = process.env.TEST_AI_ROLE_DATABASE_URL;
const describeRoleDatabase = databaseUrl ? describe : describe.skip;

describeRoleDatabase('AI availability with a restricted API connection', () => {
  let pool: PoolService;

  beforeAll(() => {
    if (!databaseUrl || !['127.0.0.1', 'localhost'].includes(new URL(databaseUrl).hostname))
      throw new Error('LOCAL_ROLE_DATABASE_REQUIRED');
    pool = new PoolService({
      get: (key: string) => {
        if (key === 'DATABASE_URL') return databaseUrl;
        if (key === 'MASARIFI_DATABASE_POOL_MAX') return 1;
        if (key === 'MASARIFI_PROCESS_KIND') return 'api';
        throw new Error(`UNEXPECTED_CONFIG_KEY:${key}`);
      },
    } as never);
  });

  afterAll(() => pool.onModuleDestroy());

  it('cannot assume the Worker role', async () => {
    await expect(pool.query('set role masarifi_worker')).rejects.toMatchObject({ code: '42501' });
  });

  it.each([
    ['voice_transcription', true],
    ['financial_assistant', true],
    ['disabled_workload', false],
  ])('reads %s eligibility through its permitted function', async (workload, expected) => {
    await expect(new AiRepository(pool).workloadAvailable(workload)).resolves.toBe(expected);
  });
});
