import { randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { createLivePool, describeLiveDatabase } from '../../live-database';
import {
  EngagementRepository,
  type NotificationDeliveryClaim,
} from '../../../src/engagement/engagement.repository';
import type { PoolService } from '../../../src/platform/database/pool.service';
import type { PlatformConfigService } from '../../../src/platform/config/platform-config.service';

const release = { version: '1.0.1', versionCode: 140 };

describeLiveDatabase('Android update announcements under real database roles', () => {
  let pool: PoolService;
  beforeAll(() => {
    pool = createLivePool();
  });
  afterAll(async () => {
    await pool.onModuleDestroy();
  });

  async function fixture(run: (context: Awaited<ReturnType<typeof prepare>>) => Promise<void>) {
    // Keep historical CI work out of broad worker claims without changing any retained data.
    await pool.withClient(async (locker) => {
      await locker.query('begin');
      try {
        await locker.query('set local role masarifi_migration');
        await locker.query(
          "select id from public.notification_campaigns where status in ('scheduled','running') order by id for update",
        );
        await locker.query(
          "select id from private.notification_deliveries where status in ('queued','failed') order by id for update",
        );
        await pool.withClient(async (client) => {
          await client.query('begin');
          try {
            await client.query('set local role masarifi_migration');
            await run(await prepare(client));
          } finally {
            await client.query('rollback');
          }
        });
      } finally {
        await locker.query('rollback');
      }
    });
  }

  async function prepare(client: PoolClient) {
    const suffix = randomUUID();
    const names = [
      'old',
      'legacy',
      'current',
      'newer',
      'revokedDevice',
      'revokedToken',
      'ios',
      'malformed',
      'disabled',
    ] as const;
    const owners = Object.fromEntries(
      names.map((name) => [name, `00_update_${suffix}_${name}`]),
    ) as Record<(typeof names)[number], string>;
    const admin = `update_admin_${suffix}`,
      template = randomUUID(),
      key = `app.update.fixture.${suffix}`;
    await client.query(
      "insert into public.profiles(id,status,locale,timezone,last_seen_at) select unnest($1::text[]),'active','en','UTC',now()",
      [[admin, ...Object.values(owners)]],
    );
    await client.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
      admin,
    ]);
    await client.query(
      `insert into public.notification_templates(id,key,locale,channel,template_version,subject,body,status,published_at,created_by)
      values($1,$2,'en','push',1,'Update available','Open the app for current update information.','published',now(),$3)`,
      [template, key, admin],
    );
    const addDevice = async (
      owner: string,
      version: string,
      platform = 'android',
      revokedDevice = false,
      revokedToken = false,
      age = 10,
    ) => {
      const id = randomUUID();
      await client.query(
        `insert into public.user_devices(id,user_id,device_fingerprint,platform,app_version,revoked_at)
        values($1,$2,$3,$4,$5,case when $6 then now() end)`,
        [id, owner, `h1:${randomBytes(32).toString('hex')}`, platform, version, revokedDevice],
      );
      await client.query(
        `insert into public.push_tokens(user_id,device_id,token_hash,token_ciphertext,provider,revoked_at,updated_at)
        values($1,$2,$3,'v1.key.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA.AA',$4,case when $5 then now() end,now()-make_interval(mins=>$6))`,
        [
          owner,
          id,
          `h1:${randomBytes(32).toString('hex')}`,
          platform === 'ios' ? 'apns' : 'expo',
          revokedToken,
          age,
        ],
      );
      return id;
    };
    const oldDevice = await addDevice(owners.old, '1.0.1+139');
    await addDevice(owners.old, '1.0.1+140', 'android', false, false, 2);
    await addDevice(owners.old, '9.9.9+999', 'ios', false, false, 0);
    await addDevice(owners.legacy, '1.0.0');
    await addDevice(owners.current, '1.0.1+140');
    await addDevice(owners.newer, '1.0.0+141');
    await addDevice(owners.revokedDevice, '1.0.0', 'android', true);
    await addDevice(owners.revokedToken, '1.0.0', 'android', false, true);
    await addDevice(owners.ios, '1.0.0', 'ios');
    await addDevice(owners.malformed, 'not-a-version');
    await addDevice(owners.disabled, '1.0.0');
    await client.query(
      "insert into public.notification_preferences(user_id,channel,event_type,enabled) values($1,'push',$2,false)",
      [owners.disabled, key],
    );

    const values: Record<string, unknown> = {
      MASARIFI_ANDROID_UPDATE_PUBLISHED: true,
      MASARIFI_ANDROID_LATEST_VERSION: release.version,
      MASARIFI_ANDROID_LATEST_VERSION_CODE: release.versionCode,
    };
    let sequence = 0;
    // Repository transactions become savepoints so genuine role/RLS queries stay inside the rollback fixture.
    const fixturePool = {
      withClient: async <T>(action: (connection: PoolClient) => Promise<T>) => {
        const savepoint = `android_update_${String(++sequence)}`;
        const connection = {
          query: (sql: string, bindings?: unknown[]) => {
            if (sql === 'begin') return client.query(`savepoint ${savepoint}`);
            if (sql === 'commit') return client.query(`release savepoint ${savepoint}`);
            if (sql === 'rollback') return client.query(`rollback to savepoint ${savepoint}`);
            return client.query(sql, bindings);
          },
        } as unknown as PoolClient;
        try {
          return await action(connection);
        } finally {
          await client.query('set local role masarifi_migration');
        }
      },
    } as unknown as PoolService;
    const repository = new EngagementRepository(fixturePool, {
      get: (name: string) => values[name],
    } as unknown as PlatformConfigService);
    const campaign = async (audience: unknown = { platforms: ['android'], appUpdate: release }) => {
      const id = randomUUID();
      await client.query(
        `insert into public.notification_campaigns(id,name,audience_definition,template_id,status,created_by,approved_by)
        values($1,'Disposable update fixture',$2::jsonb,$3,'running',$4,$4)`,
        [id, JSON.stringify(audience), template, admin],
      );
      return id;
    };
    const expand = async (id: string) => {
      for (let batch = 0; batch < 100; batch += 1) {
        await repository.expandCampaigns(500);
        const state = (
          await client.query<{ status: string }>(
            'select status from public.notification_campaigns where id=$1',
            [id],
          )
        ).rows[0]?.status;
        if (state !== 'running') return;
      }
      throw new Error('UPDATE_FIXTURE_EXPANSION_BOUND_EXCEEDED');
    };
    const claimFor = async (owner: string): Promise<NotificationDeliveryClaim> => {
      for (let batch = 0; batch < 100; batch += 1) {
        const found = (
          await repository.claimNotificationDeliveries('android-update-fixture', 100)
        ).find((item) => item.user_id === owner);
        if (found) return found;
      }
      throw new Error('UPDATE_FIXTURE_CLAIM_MISSING');
    };
    return { client, owners, oldDevice, repository, values, campaign, expand, claimFor, key };
  }

  it('expands only older active Android installs and selects the old Android token despite newer iOS/current Android tokens', async () =>
    fixture(async (context) => {
      const { client, owners, repository, oldDevice } = context;
      const id = await context.campaign();
      await context.expand(id);
      const rows = await client.query<{ user_id: string; rendered_data: unknown }>(
        'select user_id,rendered_data from private.notification_deliveries where campaign_id=$1 and user_id=any($2::text[]) order by user_id',
        [id, Object.values(owners)],
      );
      expect(rows.rows.map((row) => row.user_id).sort()).toEqual(
        [owners.old, owners.legacy, owners.revokedToken].sort(),
      );
      expect(
        rows.rows.every(
          (row) =>
            JSON.stringify(row.rendered_data) === JSON.stringify(rows.rows[0]?.rendered_data),
        ),
      ).toBe(true);
      expect(rows.rows[0]?.rendered_data).toEqual({ route: 'app_update', appUpdate: release });
      const claim = await context.claimFor(owners.old);
      expect(claim.token_provider).toBe('apns');
      expect(await repository.prepareAndroidUpdateDelivery(claim, release)).toMatchObject({
        outcome: 'deliver',
        target: { token_device_id: oldDevice, token_provider: 'expo' },
      });
    }));

  it('suppresses a revoked token and a device that updated after expansion', async () =>
    fixture(async (context) => {
      const id = await context.campaign();
      await context.expand(id);
      const claim = await context.claimFor(context.owners.old);
      await context.client.query('update public.user_devices set app_version=$2 where id=$1', [
        context.oldDevice,
        '1.0.1+140',
      ]);
      expect(await context.repository.prepareAndroidUpdateDelivery(claim, release)).toMatchObject({
        outcome: 'suppress',
      });
      const revoked = (
        await context.client.query<NotificationDeliveryClaim>(
          `update private.notification_deliveries set status='sending',claim_token=extensions.gen_random_uuid(),claimed_by='android-update-fixture',lease_until=now()+interval '60 seconds'
      where campaign_id=$1 and user_id=$2 returning id,claim_token,user_id,channel`,
          [id, context.owners.revokedToken],
        )
      ).rows[0];
      if (!revoked) throw new Error('REVOKED_TOKEN_FIXTURE_MISSING');
      expect(await context.repository.prepareAndroidUpdateDelivery(revoked, release)).toMatchObject(
        { outcome: 'suppress' },
      );
    }));

  it('uses the existing owner push quiet hours for a custom template without its own preference row', async () =>
    fixture(async (context) => {
      const id = await context.campaign();
      await context.expand(id);
      const claim = await context.claimFor(context.owners.old);
      const now = new Date();
      const minute = now.getUTCHours() * 60 + now.getUTCMinutes();
      const clock = (minutes: number) =>
        `${String(Math.floor((minutes % 1440) / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      const quiet = {
        enabled: true,
        start: clock(minute),
        end: clock(minute + 2),
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        timeZone: 'UTC',
      };
      await context.client.query(
        `update public.notification_preferences set quiet_hours=$2::jsonb where user_id=$1 and channel='push'`,
        [context.owners.old, JSON.stringify(quiet)],
      );
      const custom = await context.client.query(
        'select id from public.notification_preferences where user_id=$1 and event_type=$2',
        [context.owners.old, context.key],
      );
      expect(custom.rows).toHaveLength(0);
      const decision = await context.repository.prepareAndroidUpdateDelivery(claim, release);
      expect(decision).toMatchObject({ outcome: 'defer' });
      if (decision.outcome !== 'defer') throw new Error('QUIET_UPDATE_NOT_DEFERRED');
      expect(decision.until).toBeInstanceOf(Date);
    }));

  it('preserves the same delivery through campaign pause, dispatch deferral and resume', async () =>
    fixture(async (context) => {
      const id = await context.campaign();
      await context.expand(id);
      await context.client.query(
        "update public.notification_campaigns set status='paused' where id=$1",
        [id],
      );
      const first = await context.claimFor(context.owners.old);
      const decision = await context.repository.prepareAndroidUpdateDelivery(first, release);
      expect(decision).toMatchObject({ outcome: 'defer' });
      if (decision.outcome !== 'defer') throw new Error('PAUSED_UPDATE_NOT_DEFERRED');
      await context.repository.deferNotificationDelivery(
        first.id,
        first.claim_token,
        decision.until,
      );
      const saved = (
        await context.client.query<{ status: string; attempt_count: number }>(
          'select status,attempt_count from private.notification_deliveries where id=$1',
          [first.id],
        )
      ).rows[0];
      expect(saved).toMatchObject({ status: 'queued', attempt_count: 0 });
      await context.client.query(
        "update public.notification_campaigns set status='running' where id=$1",
        [id],
      );
      // Advance this disposable delivery's due time rather than sleeping for the pause poll interval.
      await context.client.query(
        'update private.notification_deliveries set next_attempt_at=now() where id=$1',
        [first.id],
      );
      const resumed = await context.claimFor(context.owners.old);
      expect(resumed.id).toBe(first.id);
      expect(resumed.attempt_count).toBe(1);
      expect(await context.repository.prepareAndroidUpdateDelivery(resumed, release)).toMatchObject(
        { outcome: 'deliver' },
      );
    }));

  it('deduplicates the same release across separate campaigns and repeated expansion', async () =>
    fixture(async (context) => {
      const first = await context.campaign();
      await context.expand(first);
      const second = await context.campaign();
      await context.expand(second);
      await context.repository.expandCampaigns(500);
      const count = await context.client.query<{ count: string }>(
        `select count(*) from private.notification_deliveries
      where campaign_id=any($1::uuid[]) and user_id=$2 and rendered_data->>'route'='app_update'`,
        [[first, second], context.owners.old],
      );
      expect(count.rows[0]?.count).toBe('1');
    }));

  it('invalidates queued delivery after withdrawal and cancels mismatched campaign expansion', async () =>
    fixture(async (context) => {
      const id = await context.campaign();
      await context.expand(id);
      const claim = await context.claimFor(context.owners.old);
      context.values.MASARIFI_ANDROID_UPDATE_PUBLISHED = false;
      expect(await context.repository.prepareAndroidUpdateDelivery(claim, release)).toEqual({
        outcome: 'suppress',
        reason: 'APP_UPDATE_STALE',
      });
      context.values.MASARIFI_ANDROID_UPDATE_PUBLISHED = true;
      const stale = await context.campaign({
        platforms: ['android'],
        appUpdate: { ...release, versionCode: 139 },
      });
      await context.expand(stale);
      expect(
        (
          await context.client.query<{ status: string }>(
            'select status from public.notification_campaigns where id=$1',
            [stale],
          )
        ).rows[0]?.status,
      ).toBe('cancelled');
      expect(
        (
          await context.client.query(
            'select id from private.notification_deliveries where campaign_id=$1',
            [stale],
          )
        ).rows,
      ).toHaveLength(0);
    }));
});
