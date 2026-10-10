import { randomUUID } from 'node:crypto';
import { AiRepository } from '../../../src/ai/ai.repository';
import { PoolService } from '../../../src/platform/database/pool.service';
import { createLivePool } from '../../live-database';

// This connection must be a local login with SET permission for API only, never Worker.
const databaseUrl = process.env.TEST_AI_ROLE_DATABASE_URL;
const describeRoleDatabase = databaseUrl ? describe : describe.skip;

describeRoleDatabase('AI availability with a restricted API connection', () => {
  let pool: PoolService | undefined;
  let fixturePool: PoolService | undefined;
  let prepared = false;
  let routes: { id: string; enabled: boolean }[] = [];
  let prompts: {
    id: string; status: string; evaluation_passed: boolean;
    approved_by: string | null; published_at: Date | null;
  }[] = [];
  const workloads = ['voice_transcription', 'financial_assistant'];
  const promptIds = ['99030000-0000-4000-8000-000000000001', '99030000-0000-4000-8000-000000000003'];
  const adminId = `ai_role_fixture_${randomUUID()}`;

  function restrictedPool(): PoolService {
    if (!pool) throw new Error('RESTRICTED_POOL_NOT_INITIALIZED');
    return pool;
  }

  beforeAll(async () => {
    if (!databaseUrl || !['127.0.0.1', 'localhost'].includes(new URL(databaseUrl).hostname))
      throw new Error('LOCAL_ROLE_DATABASE_REQUIRED');
    const restricted = new URL(databaseUrl);
    const administrative = new URL(process.env.DATABASE_URL ?? '');
    if (process.env.NODE_ENV !== 'test' || process.env.MASARIFI_LIVE_DATABASE_TESTS !== '1' ||
        process.env.CROSS_FEATURE_DISPOSABLE_DATABASE_NAME !== 'postgres' ||
        administrative.hostname !== restricted.hostname || administrative.port !== restricted.port ||
        administrative.pathname !== '/postgres' || restricted.pathname !== '/postgres')
      throw new Error('DISPOSABLE_ROLE_FIXTURE_REQUIRED');
    pool = new PoolService({
      get: (key: string) => {
        if (key === 'DATABASE_URL') return databaseUrl;
        if (key === 'MASARIFI_DATABASE_POOL_MAX') return 1;
        if (key === 'MASARIFI_PROCESS_KIND') return 'api';
        throw new Error(`UNEXPECTED_CONFIG_KEY:${key}`);
      },
    } as never);
    fixturePool = createLivePool();
    await fixturePool.withClient(async client => {
      await client.query('begin');
      try {
        routes = (await client.query<{ id: string; enabled: boolean }>(
          'select id,enabled from private.ai_feature_routes where workload=any($1::text[])', [workloads],
        )).rows;
        prompts = (await client.query<(typeof prompts)[number]>(
          'select id,status,evaluation_passed,approved_by,published_at from private.ai_prompt_versions where workload=any($1::text[])', [workloads],
        )).rows;
        await client.query("insert into public.profiles(id,status) values($1,'active')", [adminId]);
        await client.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [adminId]);
        await client.query("update private.ai_prompt_versions set status='retired' where workload=any($1::text[]) and status='approved'", [workloads]);
        await client.query("update private.ai_prompt_versions set status='approved',evaluation_passed=true,approved_by=$1,published_at=clock_timestamp() where id=any($2::uuid[])", [adminId, promptIds]);
        await client.query('update private.ai_feature_routes set enabled=true where workload=any($1::text[])', [workloads]);
        await client.query('commit');
        prepared = true;
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });
  });

  afterAll(async () => {
    try {
      if (prepared && fixturePool) await fixturePool.withClient(async client => {
        await client.query('begin');
        try {
          await client.query('update private.ai_feature_routes set enabled=false where workload=any($1::text[])', [workloads]);
          await client.query("update private.ai_prompt_versions set status='draft',evaluation_passed=false,approved_by=null,published_at=null where id=any($1::uuid[])", [promptIds]);
          for (const prompt of prompts) await client.query(
            'update private.ai_prompt_versions set status=$2,evaluation_passed=$3,approved_by=$4,published_at=$5 where id=$1',
            [prompt.id, prompt.status, prompt.evaluation_passed, prompt.approved_by, prompt.published_at],
          );
          for (const route of routes) await client.query(
            'update private.ai_feature_routes set enabled=$2 where id=$1', [route.id, route.enabled],
          );
          // Profile insertion seeds dependent preferences/Tracking rows. Keep the
          // synthetic identity until this disposable CI database is reset.
          await client.query('commit');
        } catch (error) {
          await client.query('rollback');
          throw error;
        }
      });
    } finally {
      await pool?.onModuleDestroy();
      await fixturePool?.onModuleDestroy();
    }
  });

  it('cannot assume the Worker role', async () => {
    await expect(restrictedPool().query('set role masarifi_worker')).rejects.toMatchObject({ code: '42501' });
  });

  it.each([
    ['voice_transcription', true],
    ['financial_assistant', true],
    ['disabled_workload', false],
  ])('reads %s eligibility through its permitted function', async (workload, expected) => {
    await expect(new AiRepository(restrictedPool()).workloadAvailable(workload)).resolves.toBe(expected);
  });
});
