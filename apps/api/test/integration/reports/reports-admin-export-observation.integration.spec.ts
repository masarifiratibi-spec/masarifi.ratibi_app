import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { createLivePool, describeLiveDatabase } from '../../live-database';
import { ReportsRepository } from '../../../src/reports/reports.repository';
import { ReportsService } from '../../../src/reports/reports.service';

describeLiveDatabase('stable activity export observation', () => {
  const pool = createLivePool();
  const admin = `export_observation_${randomUUID()}`;
  const append = async () => {
    const result = await pool.query<{ id: string }>(
      "select audit.append_event(null,'system','security.assign-admin-role','test',$1,null,null,null,$1,'{}') id",
      [randomUUID()],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Expected appended event');
    return row.id;
  };
  beforeAll(async () => {
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [admin]);
    await pool.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
      admin,
    ]);
    await pool.query(
      "insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason) select $1,id,$1,'Activity export regression' from public.roles where key='support-agent'",
      [admin],
    );
  });
  afterAll(async () => {
    await pool.query('delete from public.admin_role_assignments where user_id=$1', [admin]);
    await pool.query('delete from public.admin_profiles where user_id=$1', [admin]);
    await pool.query('delete from public.profiles where id=$1', [admin]);
    // Audit evidence is immutable. Anonymous synthetic events stay in this isolated test DB.
    await pool.onModuleDestroy();
  });
  it('excludes a concurrent leading insert after the observation fetch and exports original IDs once', async () => {
    const original = await Promise.all(Array.from({ length: 26 }, append));
    let inserted: string | undefined;
    const boundaryPool = {
      withClient: <T>(action: (client: PoolClient) => Promise<T>) =>
        pool.withClient((client) =>
          action(
            new Proxy(client, {
              get(target, key, receiver) {
                if (key !== 'query') return Reflect.get(target, key, receiver) as unknown;
                return async (sql: string, values: unknown[] = []) => {
                  const result = await target.query(sql, values);
                  if (sql.includes('read_admin_report_measurements') && !inserted)
                    inserted = await append();
                  return result;
                };
              },
            }),
          ),
        ),
    };
    const repository = new ReportsRepository(boundaryPool as never);
    jest
      .spyOn(repository, 'captureAdminExport')
      .mockImplementation((_principal, _command, snapshot) => Promise.resolve({ ...snapshot }));
    const result = await new ReportsService(repository).createAdminExport(
      { userId: admin, sessionId: 'test-session', factorAgeSeconds: 0 },
      { exportType: 'activity', period: '7d', format: 'csv' },
      'export-observation-key',
      'request',
    );
    const rows = result.detailedRows as { id: string; occurredAt: string }[];
    expect(inserted).toBeDefined();
    expect(rows.map((row) => row.id)).not.toContain(inserted);
    expect(rows.filter((row) => original.includes(row.id))).toHaveLength(26);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    const summary = result.summary as { observation: { observedAt: string } };
    expect(
      rows.every((row) => Date.parse(row.occurredAt) <= Date.parse(summary.observation.observedAt)),
    ).toBe(true);
  });
});
