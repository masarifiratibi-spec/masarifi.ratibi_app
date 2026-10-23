import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { createLivePool, describeLiveDatabase } from '../../live-database';
import type { AdminReportCounts } from '../../../src/reports/reports.admin-types';
type Measurements = Omit<Required<AdminReportCounts>, 'versions'> & {
  versions: { deviceCount: number }[];
};

describeLiveDatabase('admin measured activity and exact support ranges', () => {
  const pool = createLivePool();
  const admin = `reports_admin_${randomUUID()}`;
  const user = `reports_user_${randomUUID()}`;
  const other = `reports_other_${randomUUID()}`;
  const fingerprint = 'h1:' + 'a'.repeat(64);
  const actor = async (client: PoolClient, id: string, sid = 'native-session') => {
    await client.query('reset role');
    await client.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: id, sid }),
    ]);
    await client.query('set local role masarifi_api');
  };
  const scenario = (run: (client: PoolClient) => Promise<void>) =>
    pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query(
          "insert into public.profiles(id,status) values($1,'active'),($2,'active'),($3,'active')",
          [admin, user, other],
        );
        await client.query(
          "insert into public.admin_profiles(user_id,status) values($1,'active')",
          [admin],
        );
        await client.query(
          "insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason) select $1,id,$1,'Reports measurement regression' from public.roles where key='super-admin'",
          [admin],
        );
        await client.query(
          "insert into public.user_devices(user_id,device_fingerprint,clerk_session_id,platform,app_version) values($1,$2,'native-session','ios','1.2')",
          [user, fingerprint],
        );
        await run(client);
      } finally {
        await client.query('rollback');
      }
    });
  afterAll(() => pool.onModuleDestroy());
  it('collects only owned native sessions, deduplicates and never creates history', () =>
    scenario(async (client) => {
      await actor(client, user);
      await client.query('select private.record_mobile_activity($1)', ['ios']);
      await client.query('select private.record_mobile_activity($1)', ['ios']);
      await client.query('reset role');
      const rows = await client.query(
        'select * from private.mobile_activity_buckets where user_id=$1',
        [user],
      );
      expect(rows.rowCount).toBe(1);
      await actor(client, admin);
      const {
        rows: [row],
      } = await client.query<{ value: Measurements }>(
        "select private.read_admin_report_measurements('all',30) value",
      );
      if (!row) throw new Error('Expected measurement row');
      expect(row.value.activity.total).toBe(1);
      expect(
        row.value.activity.daily
          .filter((p: { value: number | null }) => p.value !== null)
          .every(
            (p: { timestamp: string }) =>
              Date.parse(p.timestamp) >= Date.parse(row.value.collectionStartedAt) - 86400000,
          ),
      ).toBe(true);
      expect(row.value.totalUsers).toBeGreaterThanOrEqual(3);
    }));
  it('denies unowned, browser and revoked device sessions', () =>
    scenario(async (client) => {
      await actor(client, other);
      await expect(
        client.query('select private.record_mobile_activity($1)', ['ios']),
      ).rejects.toMatchObject({ code: '42501' });
    }));
  it('denies reports without overview permission and financial reports without a grant', () =>
    scenario(async (client) => {
      await actor(client, user);
      await expect(
        client.query("select private.read_admin_report_measurements('all',30)"),
      ).rejects.toMatchObject({ code: '42501' });
    }));
  it('keeps financial support grants mandatory', () =>
    scenario(async (client) => {
      await actor(client, admin);
      await expect(
        client.query(
          "select private.read_supported_financial_report($1,'2026-10-01','2026-10-07')",
          [user],
        ),
      ).rejects.toMatchObject({ code: '42501' });
    }));
  it('distinguishes emitted deletion request/cancellation, completion and support decisions', () =>
    scenario(async (client) => {
      for (const action of [
        'security.create-my-deletion-request',
        'security.cancel-my-deletion-request',
        'security.decide-support-access-request',
        'security.assign-admin-role',
      ])
        await client.query(
          "select audit.append_event($1,'admin',$2,'test',$3,null,null,null,$3,'{}')",
          [admin, action, randomUUID()],
        );
      await client.query(
        "insert into private.account_deletion_requests(user_id,status,cooling_off_ends_at,completed_at) values($1,'completed',now(),now())",
        [user],
      );
      await actor(client, admin);
      const result = await client.query<{ event_type: string }>(
        "select * from private.read_admin_overview_activity('all',7,0,25)",
      );
      expect(result.rows.map((row) => row.event_type)).toEqual(
        expect.arrayContaining([
          'account-deletion-requested',
          'account-deletion-cancelled',
          'account-deletion-completed',
          'support-access-decision',
          'admin-role-change',
        ]),
      );
    }));
  it('counts reporting-day and rolling30 membership once across platforms and prunes expired observations', () =>
    scenario(async (client) => {
      await client.query(
        "update private.mobile_activity_collection set started_at=now()-interval '150 days'",
      );
      await client.query(
        "update private.system_settings set value='\"Asia/Dubai\"' where setting_key='reports.reporting_timezone'",
      );
      await client.query(
        `insert into private.mobile_activity_buckets(user_id,platform,bucket_at,observed_at) values
      ($1,'ios',date_trunc('day',now() at time zone 'Asia/Dubai') at time zone 'Asia/Dubai',date_trunc('day',now() at time zone 'Asia/Dubai') at time zone 'Asia/Dubai'),
      ($1,'android',date_trunc('day',now() at time zone 'Asia/Dubai') at time zone 'Asia/Dubai',date_trunc('day',now() at time zone 'Asia/Dubai') at time zone 'Asia/Dubai'),
      ($2,'ios',(date_trunc('day',now() at time zone 'Asia/Dubai')-interval '29 days') at time zone 'Asia/Dubai',(date_trunc('day',now() at time zone 'Asia/Dubai')-interval '29 days') at time zone 'Asia/Dubai'),
      ($3,'ios',now()-interval '31 days',now()-interval '31 days'),
      ($3,'ios',now()-interval '121 days',now()-interval '121 days')`,
        [user, other, admin],
      );
      await actor(client, admin);
      const {
        rows: [row],
      } = await client.query<{ value: Measurements }>(
        "select private.read_admin_report_measurements('all',7) value",
      );
      if (!row) throw new Error('Expected measurement row');
      expect(row.value.activity.daily.at(-1)?.value).toBe(1);
      expect(row.value.activity.monthly.at(-1)?.value).toBe(2);
      expect(row.value.activity.total).toBe(1);
      expect(row.value.timezone).toBe('Asia/Dubai');
      await client.query('reset role');
      await client.query('set local role masarifi_worker');
      await client.query('select private.prune_mobile_activity()');
      await client.query('reset role');
      const old = await client.query<{ count: number }>(
        "select count(*)::int count from private.mobile_activity_buckets where observed_at<now()-interval '120 days'",
      );
      expect(old.rows[0]?.count).toBe(0);
    }));
  it.each(['web', 'revoked', 'different-session'])('rejects %s device collection', (state) =>
    scenario(async (client) => {
      if (state === 'web')
        await client.query("update public.user_devices set platform='web' where user_id=$1", [
          user,
        ]);
      if (state === 'revoked')
        await client.query('update public.user_devices set revoked_at=now() where user_id=$1', [
          user,
        ]);
      await actor(
        client,
        user,
        state === 'different-session' ? 'browser-session' : 'native-session',
      );
      await expect(
        client.query("select private.record_mobile_activity('ios')"),
      ).rejects.toMatchObject({ code: '42501' });
    }),
  );
  it('exports only exact seven-day financial effects in the customer timezone', () =>
    scenario(async (client) => {
      await client.query("update public.profiles set timezone='Asia/Dubai' where id=$1", [user]);
      await client.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
        other,
      ]);
      const scope = JSON.stringify([{ resource: 'financial-report', actions: ['read-aggregate'] }]);
      const id = randomUUID();
      await client.query(
        `insert into private.support_access_requests(id,user_id,requested_by,assignee,support_ticket_id,purpose,scope,status,expires_at,approved_by,decided_at)
      values($1,$2,$3,$3,'report-test','Customer requested review',$4,'approved',now()+interval '1 hour',$5,now())`,
        [id, user, admin, scope, other],
      );
      await client.query(
        "insert into private.support_access_grants(request_id,admin_id,scope,starts_at,ends_at) values($1,$2,$3,now(),now()+interval '30 minutes')",
        [id, admin, scope],
      );
      await client.query("select set_config('masarifi.ledger_command','on',true)");
      for (const [at, amount] of [
        ['2026-09-30T19:59:59Z', 99999],
        ['2026-09-30T20:00:00Z', 1234],
        ['2026-10-07T19:59:59Z', 2000],
        ['2026-10-07T20:00:00Z', 99999],
      ])
        await client.query(
          "insert into public.transactions(id,user_id,kind,amount_minor,currency_code,title,occurred_at) values($1,$2,'income',$3,'USD','range test',$4)",
          [randomUUID(), user, amount, at],
        );
      await actor(client, admin);
      const {
        rows: [row],
      } = await client.query<{ value: unknown }>(
        "select private.read_supported_financial_report($1,'2026-10-01','2026-10-07') value",
        [user],
      );
      if (!row) throw new Error('Expected measurement row');
      expect(row.value).toMatchObject({
        currencyCode: 'USD',
        currencyMinorUnits: { USD: 2 },
        summaries: [{ currency_code: 'USD', income_minor: 3234, transaction_count: 2 }],
      });
    }));
  it('bounds version distributions without losing registered devices', () =>
    scenario(async (client) => {
      await client.query(
        `insert into public.user_devices(user_id,device_fingerprint,clerk_session_id,platform,app_version)
      select $1,'h1:'||lpad(to_hex(g),64,'0'),'native-session','ios','v'||g from generate_series(1,55) g`,
        [user],
      );
      await actor(client, admin);
      const {
        rows: [row],
      } = await client.query<{ value: Measurements }>(
        "select private.read_admin_report_measurements('ios',7) value",
      );
      if (!row) throw new Error('Expected measurement row');
      expect(row.value.versions.length).toBeLessThanOrEqual(50);
      expect(
        row.value.versions.reduce(
          (sum: number, item: { deviceCount: number }) => sum + item.deviceCount,
          0,
        ),
      ).toBe(row.value.iosDevices);
    }));
  it('deduplicates customers across multiple devices and keeps unknown-platform registrations', () =>
    scenario(async (client) => {
      await client.query(
        "insert into public.user_devices(user_id,device_fingerprint,clerk_session_id,platform,app_version) values($1,$2,'native-session','android','2.0'),($1,$3,'native-session','ios','1.2')",
        [user, 'h1:' + 'b'.repeat(64), 'h1:' + 'c'.repeat(64)],
      );
      await actor(client, admin);
      const {
        rows: [row],
      } = await client.query<{ value: Measurements }>(
        "select private.read_admin_report_measurements('ios',7) value",
      );
      if (!row) throw new Error('Expected measurement row');
      expect(row.value).toMatchObject({
        totalUsers: 1,
        iosUsers: 1,
        androidUsers: 1,
        bothUsers: 1,
        iosDevices: 2,
        androidDevices: 0,
      });
      const {
        rows: [all],
      } = await client.query<{ value: Measurements }>(
        "select private.read_admin_report_measurements('all',7) value",
      );
      if (!all) throw new Error('Expected measurement row');
      expect(all.value.totalUsers).toBe(
        all.value.iosUsers + all.value.androidUsers - all.value.bothUsers + all.value.unknownUsers,
      );
    }));
  it('does not expose raw observations to API or browser roles', () =>
    scenario(async (client) => {
      await actor(client, admin);
      await expect(
        client.query('select * from private.mobile_activity_buckets'),
      ).rejects.toMatchObject({ code: '42501' });
    }));
});
