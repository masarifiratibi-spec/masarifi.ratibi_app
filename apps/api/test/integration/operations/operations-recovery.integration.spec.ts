import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { PoolService } from '../../../src/platform/database/pool.service';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('operations recovery truthful reads', () => {
  let pool: PoolService;
  const actor = `operations_recovery_${randomUUID()}`;
  beforeAll(async () => {
    pool = createLivePool();
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [actor]);
    await pool.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [actor]);
    await pool.query("insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason) select $1,id,$1,'Operations recovery tests' from public.roles where key='super-admin'", [actor]);
  });
  afterAll(async () => pool.onModuleDestroy());
  async function fixture(action: (client: PoolClient) => Promise<void>) {
    await pool.withClient(async client => {
      await client.query('begin');
      try {
        await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: actor, role: 'authenticated' })]);
        await action(client);
      } finally { await client.query('rollback'); }
    });
  }
  it.each(['unknown', 'stale'])('does not label six %s providers fully operational', async (condition) => {
    await fixture(async client => {
      await client.query('delete from private.provider_health_checks');
      await client.query(`insert into private.provider_health_checks(provider_key,check_type,status,latency_ms,checked_at)
        select provider,'shallow',$1,0,clock_timestamp()-$2::interval from unnest(array['database','storage','identity','ai','email','push']) provider`, [condition === 'unknown' ? 'unknown' : 'up', condition === 'stale' ? '1 hour' : '0 seconds']);
      await client.query("update private.maintenance_windows set status='completed' where status='active'");
      await client.query('set local role masarifi_api');
      const response = await client.query("select private.read_operations('health','{}') value");
      expect(response.rows[0].value).toMatchObject({ status: 'unknown', partial: true });
      expect(response.rows[0].value.services.every((service: { status: string }) => service.status === 'unknown')).toBe(true);
    });
  });
  it('finds current maintenance beyond one hundred newer historical windows', async () => {
    await fixture(async client => {
      await client.query('delete from private.maintenance_windows');
      await client.query(`insert into private.maintenance_windows(starts_at,ends_at,scope,public_message,status,created_by_admin_id,updated_by_admin_id)
        select clock_timestamp()+n*interval '1 day',clock_timestamp()+n*interval '1 day'+interval '1 hour',array['api'],'{"ar":"History","en":"History"}','completed',$1,$1 from generate_series(1,101) n`, [actor]);
      const current = await client.query(`insert into private.maintenance_windows(starts_at,ends_at,scope,public_message,status,created_by_admin_id,updated_by_admin_id)
        values(clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',array['api'],'{"ar":"Current","en":"Current"}','active',$1,$1) returning id`, [actor]);
      await client.query('set local role masarifi_api');
      const response = await client.query(`select private.read_operations('maintenance','{"current":true,"limit":1}') value`);
      expect(response.rows[0].value.items).toEqual([expect.objectContaining({ id: current.rows[0].id, status: 'active' })]);
    });
  });
});
