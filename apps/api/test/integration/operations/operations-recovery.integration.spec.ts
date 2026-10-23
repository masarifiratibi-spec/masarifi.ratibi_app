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
    await pool.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
      actor,
    ]);
    await pool.query(
      "insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason) select $1,id,$1,'Operations recovery tests' from public.roles where key='super-admin'",
      [actor],
    );
  });
  afterAll(async () => pool.onModuleDestroy());
  async function fixture(action: (client: PoolClient) => Promise<void>) {
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ sub: actor, role: 'authenticated' }),
        ]);
        await action(client);
      } finally {
        await client.query('rollback');
      }
    });
  }
  it.each(['unknown', 'stale'])(
    'does not label six %s providers fully operational',
    async (condition) => {
      await fixture(async (client) => {
        await client.query('delete from private.provider_health_checks');
        await client.query(
          `insert into private.provider_health_checks(provider_key,check_type,status,latency_ms,checked_at)
        select provider,'shallow',$1,0,clock_timestamp()-$2::interval from unnest(array['database','storage','identity','ai','email','push']) provider`,
          [
            condition === 'unknown' ? 'unknown' : 'up',
            condition === 'stale' ? '1 hour' : '0 seconds',
          ],
        );
        await client.query(
          "update private.maintenance_windows set status='completed' where status='active'",
        );
        await client.query('set local role masarifi_api');
        const response = await client.query<{
          value: { status: string; partial: boolean; services: Array<{ status: string }> };
        }>("select private.read_operations('health','{}') value");
        expect(response.rows[0]?.value).toMatchObject({ status: 'unknown', partial: true });
        expect(
          response.rows[0]?.value.services.every(
            (service: { status: string }) => service.status === 'unknown',
          ),
        ).toBe(true);
      });
    },
  );
  it('finds current maintenance beyond one hundred newer historical windows', async () => {
    await fixture(async (client) => {
      await client.query('delete from private.maintenance_windows');
      await client.query(
        `insert into private.maintenance_windows(starts_at,ends_at,scope,public_message,status,created_by_admin_id,updated_by_admin_id)
        select clock_timestamp()+n*interval '1 day',clock_timestamp()+n*interval '1 day'+interval '1 hour',array['api'],'{"ar":"History","en":"History"}','completed',$1,$1 from generate_series(1,101) n`,
        [actor],
      );
      const current = await client.query<{ id: string }>(
        `insert into private.maintenance_windows(starts_at,ends_at,scope,public_message,status,created_by_admin_id,updated_by_admin_id)
        values(clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',array['api'],'{"ar":"Current","en":"Current"}','active',$1,$1) returning id`,
        [actor],
      );
      await client.query('set local role masarifi_api');
      const response = await client.query<{ value: { items: unknown[] } }>(
        `select private.read_operations('maintenance','{"current":true,"limit":1}') value`,
      );
      expect(response.rows[0]?.value.items).toEqual([
        expect.objectContaining({ id: current.rows[0]?.id, status: 'active' }),
      ]);
    });
  });
  it('filters incident details by id on the server', async () => {
    await fixture(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `insert into private.system_incidents(title,severity,started_at,created_by_admin_id)
        values('First incident','warning',clock_timestamp(),$1),('Second incident','warning',clock_timestamp()-interval '1 minute',$1) returning id`,
        [actor],
      );
      await client.query('set local role masarifi_api');
      const response = await client.query<{ value: unknown }>(
        "select private.read_operations('incidents',$1) value",
        [JSON.stringify({ id: inserted.rows[1]?.id, limit: 1 })],
      );
      expect(response.rows[0]?.value).toMatchObject({
        items: [expect.objectContaining({ id: inserted.rows[1]?.id })],
        nextCursor: null,
      });
    });
  });
  it.each(['scheduled-jobs', 'job-runs'])(
    'reaches every %s row past the first 25 without duplicates',
    async (kind) => {
      await fixture(async (client) => {
        const prefix = `recovery.${randomUUID()}`;
        if (kind === 'scheduled-jobs') {
          await client.query(
            `insert into private.scheduled_jobs(job_key,owner_spec,job_type,timeout_seconds,max_attempts)
          select $1||'.'||lpad(n::text,2,'0'),13,'recovery',30,3 from generate_series(1,26) n`,
            [prefix],
          );
        } else {
          await client.query(
            `insert into private.job_runs(job_key,job_type,owner_spec,queued_at,correlation_id)
          select $1,'recovery',13,clock_timestamp()-n*interval '1 second',$1||n from generate_series(1,26) n`,
            [prefix],
          );
        }
        await client.query('set local role masarifi_api');
        const ids = new Set<string>();
        let cursor: string | null = null;
        let pages = 0;
        do {
          const response: { items: Array<{ id: string; key: string }>; nextCursor: string | null } =
            (
              await client.query<{
                value: { items: Array<{ id: string; key: string }>; nextCursor: string | null };
              }>('select private.read_operations($1,$2) value', [
                kind,
                JSON.stringify({
                  limit: 25,
                  ...(kind === 'job-runs' ? { jobKey: prefix } : {}),
                  ...(cursor ? { cursor } : {}),
                }),
              ])
            ).rows[0]?.value ?? { items: [], nextCursor: null };
          for (const row of response.items) {
            expect(ids.has(row.id)).toBe(false);
            if (kind === 'job-runs' || row.key.startsWith(prefix)) ids.add(row.id);
          }
          cursor = response.nextCursor;
          pages += 1;
        } while (cursor && pages < 100);
        expect(ids.size).toBe(26);
        expect(pages).toBeGreaterThan(1);
        expect(cursor).toBeNull();
      });
    },
  );
});
