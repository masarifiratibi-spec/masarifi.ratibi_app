import type { PoolClient } from 'pg';
import { ConfigService } from '@nestjs/config';
import { createLivePool, describeLiveDatabase } from '../../live-database';
import { PoolService } from '../../../src/platform/database/pool.service';
import { renderNotification } from '../../../src/engagement/notification.renderer';
import { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import type { PlatformEnvironment } from '../../../src/platform/config/environment.types';
import { PushTokenCrypto } from '../../../src/identity/push-token.crypto';
import { DevRemindersWorker } from '../../../src/engagement/dev-reminders.worker';

describeLiveDatabase('DEV reminder lifecycle', () => {
  let pool: PoolService;
  const owner = 'dev-reminder-lifecycle-fixture';
  const device = 'b0990000-0000-4000-8000-000000000001';
  const ordinaryDevice = 'b0990000-0000-4000-8000-000000000002';
  const tracking = 'b0990000-0000-4000-8000-000000000003';
  beforeAll(() => {
    pool = createLivePool();
  });
  afterAll(async () => {
    await pool.onModuleDestroy();
  });

  async function fixture(action: (client: PoolClient) => Promise<void>) {
    await pool.withClient(async (client) => {
      await client.query<Record<string, unknown>>('begin');
      try {
        await client.query<Record<string, unknown>>('set local role masarifi_migration');
        await client.query<Record<string, unknown>>("set local statement_timeout='1500ms'");
        const zone = (
          await client.query<{ zone: string }>(
            `select name zone from pg_timezone_names where extract(hour from now() at time zone name)=12 order by name limit 1`,
          )
        ).rows[0]?.zone;
        await client.query<Record<string, unknown>>(
          `insert into public.profiles(id,locale,status,timezone,last_seen_at,created_at) values($1,'ar','active',$2,now(),now()-interval '20 days')`,
          [owner, zone],
        );
        await client.query<Record<string, unknown>>(
          `insert into public.user_devices(id,user_id,device_fingerprint,platform,app_version) values($2,$1,'h1:'||repeat('1',64),'android','1.0'),($3,$1,'h1:'||repeat('2',64),'android','1.0')`,
          [owner, device, ordinaryDevice],
        );
        await client.query<Record<string, unknown>>(
          `insert into public.push_tokens(user_id,device_id,token_hash,token_ciphertext,provider) values($1,$2,'h1:'||repeat('1',64),'v1.key.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA.AA','expo'),($1,$3,'h1:'||repeat('2',64),'v1.key.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA.AA','expo')`,
          [owner, device, ordinaryDevice],
        );
        await client.query<Record<string, unknown>>(
          `insert into private.dev_mobile_installations(user_id,tracking_device_id,notification_device_id,reminders_enabled,last_foreground_at,enrolled_at,reminder_locale,reminder_timezone) values($1,$2,$3,true,date_trunc('second',now())-interval '4 days'+interval '0.123456 seconds',now()-interval '10 days','ar',$4)`,
          [owner, tracking, device, zone],
        );
        await action(client);
      } finally {
        await client.query<Record<string, unknown>>('rollback');
      }
    });
  }

  async function enqueue(client: PoolClient): Promise<string> {
    await client.query<Record<string, unknown>>('select private.enqueue_dev_reminders(100)');
    const row = (
      await client.query<{ event_id: string }>(
        `select event_id from private.dev_reminder_deliveries where user_id=$1 order by created_at desc limit 1`,
        [owner],
      )
    ).rows[0];
    if (!row) throw new Error('DEV_REMINDER_FIXTURE_MISSING');
    return row.event_id;
  }

  it('selects onboarding first, preserves microseconds, creates exactly one DEV event and binds only its DEV device', async () =>
    fixture(async (client) => {
      const id = await enqueue(client);
      await client.query<Record<string, unknown>>('select private.enqueue_dev_reminders(100)');
      const events = await client.query<{ type: string; data: Record<string, string> }>(
        `select type,data from public.notification_events where user_id=$1`,
        [owner],
      );
      expect(events.rows).toHaveLength(1);
      expect(events.rows[0]?.type).toBe('reminder.onboarding_incomplete.1d');
      expect(events.rows[0]?.data.cycleBaseline).toMatch(/\.123456Z$/);
      expect(events.rows[0]?.data.scope).toBe('dev_reminder');
      const claim = (
        await client.query<{ value: { eventId: string; deviceId: string } }>(
          'select private.claim_dev_reminder() value',
        )
      ).rows[0]?.value;
      expect(claim).toMatchObject({ eventId: id, deviceId: device });
      const prepared = (
        await client.query<{
          value: { title: string; body: string; locale: 'ar'; eventType: string };
        }>('select private.prepare_dev_reminder($1) value', [id])
      ).rows[0]?.value;
      if (!prepared) throw new Error('PREPARED_FIXTURE_MISSING');
      expect(prepared.locale).toBe('ar');
      expect(() =>
        renderNotification(
          {
            key: prepared.eventType,
            locale: prepared.locale,
            channel: 'push',
            version: 1,
            title: prepared.title,
            body: prepared.body,
            allowedVariables: [],
          },
          {},
        ),
      ).not.toThrow();
      expect(
        (await client.query<Record<string, unknown>>('select private.claim_dev_reminder() value'))
          .rows[0]?.value,
      ).toBeNull();
    }));

  it.each(['foreground', 'consent', 'device', 'deletion', 'onboarding', 'token_rotation'] as const)(
    'cancels %s changes between evaluation and provider submission',
    async (kind) =>
      fixture(async (client) => {
        const id = await enqueue(client);
        await client.query<Record<string, unknown>>('select private.claim_dev_reminder()');
        if (kind === 'foreground')
          await client.query<Record<string, unknown>>(
            'update private.dev_mobile_installations set last_foreground_at=now() where user_id=$1',
            [owner],
          );
        if (kind === 'consent')
          await client.query<Record<string, unknown>>(
            'update private.dev_mobile_installations set reminders_enabled=false where user_id=$1',
            [owner],
          );
        if (kind === 'device')
          await client.query<Record<string, unknown>>(
            'update public.user_devices set revoked_at=now() where id=$1',
            [device],
          );
        if (kind === 'deletion')
          await client.query<Record<string, unknown>>(
            `update public.profiles set status='deletion_pending' where id=$1`,
            [owner],
          );
        if (kind === 'token_rotation')
          await client.query<Record<string, unknown>>(
            `update public.push_tokens set token_hash='h1:'||repeat('3',64) where device_id=$1`,
            [device],
          );
        if (kind === 'onboarding') await completeOnboarding(client);
        expect(
          (
            await client.query<Record<string, unknown>>(
              'select private.prepare_dev_reminder($1) value',
              [id],
            )
          ).rows[0]?.value,
        ).toBeNull();
      }),
  );

  it('uses current English locale at submission and never falls back to Arabic', async () =>
    fixture(async (client) => {
      const id = await enqueue(client);
      await client.query<Record<string, unknown>>('select private.claim_dev_reminder()');
      await client.query<Record<string, unknown>>(
        `update private.dev_mobile_installations set reminder_locale='en' where user_id=$1`,
        [owner],
      );
      const content = (
        await client.query<{ value: { locale: string; title: string } }>(
          'select private.prepare_dev_reminder($1) value',
          [id],
        )
      ).rows[0]?.value;
      expect(content).toMatchObject({ locale: 'en', title: 'Finish getting started' });
      await client.query<Record<string, unknown>>(
        `update public.notification_templates set status='retired' where key='dev.reminder.onboarding_incomplete.1d' and locale='en'`,
      );
      expect(
        (
          await client.query<Record<string, unknown>>(
            'select private.prepare_dev_reminder($1) value',
            [id],
          )
        ).rows[0]?.value,
      ).toBeNull();
    }));

  it('keeps provider acceptance separate, revokes exactly the submitted token after rotation, and prevents resend', async () =>
    fixture(async (client) => {
      const id = await enqueue(client);
      await client.query<Record<string, unknown>>('select private.claim_dev_reminder()');
      await client.query<Record<string, unknown>>(
        `select private.finish_dev_reminder($1,'accepted','expo-ticket',null)`,
        [id],
      );
      expect(
        (
          await client.query<Record<string, unknown>>(
            'select status from private.dev_reminder_deliveries where event_id=$1',
            [id],
          )
        ).rows[0]?.status,
      ).toBe('accepted');
      await client.query<Record<string, unknown>>(
        `update public.push_tokens set token_hash='h1:'||repeat('3',64) where device_id=$1`,
        [device],
      );
      await client.query<Record<string, unknown>>(
        `select private.finish_dev_reminder($1,'rejected',null,'TOKEN_INVALID')`,
        [id],
      );
      expect(
        (
          await client.query<Record<string, unknown>>(
            'select revoked_at from public.push_tokens where device_id=$1',
            [device],
          )
        ).rows[0]?.revoked_at,
      ).toBeNull();
      expect(
        (await client.query<Record<string, unknown>>('select private.claim_dev_reminder() value'))
          .rows[0]?.value,
      ).toBeNull();
      await client.query<Record<string, unknown>>(
        'delete from public.notification_events where id=$1',
        [id],
      );
      expect(
        (
          await client.query<Record<string, unknown>>(
            'select 1 from private.dev_reminder_deliveries where user_id=$1',
            [owner],
          )
        ).rows,
      ).toHaveLength(0);
    }));

  it.each(['sending', 'accepted'] as const)(
    'expires unresolved %s into unknown without resending',
    async (status) =>
      fixture(async (client) => {
        const id = await enqueue(client);
        await client.query<Record<string, unknown>>('select private.claim_dev_reminder()');
        if (status === 'accepted')
          await client.query<Record<string, unknown>>(
            `select private.finish_dev_reminder($1,'accepted','ticket',null)`,
            [id],
          );
        await client.query<Record<string, unknown>>(
          `update private.dev_reminder_deliveries set attempted_at=now()-interval '25 hours' where event_id=$1`,
          [id],
        );
        await client.query<Record<string, unknown>>(
          'select private.expire_dev_reminder_submissions()',
        );
        expect(
          (
            await client.query<{ status: string }>(
              'select status from private.dev_reminder_deliveries where event_id=$1',
              [id],
            )
          ).rows[0]?.status,
        ).toBe('unknown');
        expect(
          (await client.query<{ value: unknown }>('select private.claim_dev_reminder() value'))
            .rows[0]?.value,
        ).toBeNull();
        expect(
          (
            await client.query('select * from private.pending_dev_receipts() where event_id=$1', [
              id,
            ])
          ).rows,
        ).toHaveLength(0);
      }),
  );

  it('excludes DEV events even when a shared delivery is mistakenly created', async () =>
    fixture(async (client) => {
      const id = await enqueue(client);
      await client.query<Record<string, unknown>>(
        `insert into private.notification_deliveries(event_id,user_id,channel,provider) values($1,$2,'push','push')`,
        [id, owner],
      );
      await client.query<Record<string, unknown>>(
        `select set_config('request.jwt.claims','{"role":"worker"}',true)`,
      );
      expect(
        (
          await client.query<Record<string, unknown>>(
            `select * from private.claim_notification_deliveries('dev-fixture',100,60) where event_id=$1`,
            [id],
          )
        ).rows,
      ).toHaveLength(0);
    }));

  it.each([
    [0, false],
    [7, false],
    [8, true],
    [21, true],
    [22, false],
    [23, false],
  ])('at local hour %i eligibility is %s and still requires opt-in', async (hour, eligible) =>
    fixture(async (client) => {
      await client.query<Record<string, unknown>>(
        `update private.dev_mobile_installations set reminder_timezone=(select name from pg_timezone_names where extract(hour from now() at time zone name)=$2 order by name limit 1) where user_id=$1`,
        [owner, hour],
      );
      expect(
        (
          await client.query<Record<string, unknown>>(
            'select * from private.dev_reminder_candidate($1)',
            [owner],
          )
        ).rows,
      ).toHaveLength(eligible ? 1 : 0);
      expect(
        (
          await client.query<Record<string, unknown>>(
            'select * from private.dev_reminder_candidate($1,null,false)',
            [owner],
          )
        ).rows,
      ).toHaveLength(1);
      await client.query<Record<string, unknown>>(
        'update private.dev_mobile_installations set reminders_enabled=false where user_id=$1',
        [owner],
      );
      expect(
        (
          await client.query<Record<string, unknown>>(
            'select * from private.dev_reminder_candidate($1,null,false)',
            [owner],
          )
        ).rows,
      ).toHaveLength(0);
    }),
  );

  async function completeOnboarding(client: PoolClient) {
    await client.query<Record<string, unknown>>(
      `insert into public.onboarding_progress(user_id,step,completed_steps,completed_at,updated_at) values($1,'tracking_intro',array['welcome'],null,now()-interval '10 days')`,
      [owner],
    );
    await client.query(
      `insert into public.user_preferences(user_id,currency_selected,updated_at) values($1,true,now()-interval '10 days')`,
      [owner],
    );
  }

  async function financialActivity(client: PoolClient) {
    await client.query<Record<string, unknown>>(
      `select set_config('masarifi.ledger_command','on',true)`,
    );
    await client.query<Record<string, unknown>>(
      `insert into public.transactions(user_id,kind,amount_minor,currency_code,title,occurred_at,created_at) values($1,'expense',100,'SAR','Fixture',now()-interval '10 days',now()-interval '10 days')`,
      [owner],
    );
  }

  it('recognizes shipped welcome plus currency setup without completed_at and cancels first transaction after a saved transaction', async () =>
    fixture(async (client) => {
      await completeOnboarding(client);
      const id = await enqueue(client);
      expect(
        (
          await client.query<Record<string, unknown>>(
            'select type from public.notification_events where id=$1',
            [id],
          )
        ).rows[0]?.type,
      ).toBe('reminder.first_transaction.1d');
      await client.query<Record<string, unknown>>('select private.claim_dev_reminder()');
      await financialActivity(client);
      expect(
        (
          await client.query<Record<string, unknown>>(
            'select private.prepare_dev_reminder($1) value',
            [id],
          )
        ).rows[0]?.value,
      ).toBeNull();
    }));

  it.each([
    [4, false, 'reminder.app_inactive.3d'],
    [8, true, 'reminder.app_inactive.7d'],
    [1, true, 'reminder.financial_inactive.7d'],
    [0, true, null],
    [0, false, null],
  ])('uses foreground %i days ago with tracking %s to choose %s', async (days, enabled, type) =>
    fixture(async (client) => {
      await completeOnboarding(client);
      await financialActivity(client);
      await client.query<Record<string, unknown>>(
        'insert into public.tracking_preferences(user_id,enabled) values($1,$2)',
        [owner, enabled],
      );
      await client.query<Record<string, unknown>>(
        `update private.dev_mobile_installations set last_foreground_at=now()-make_interval(days=>$2) where user_id=$1`,
        [owner, days],
      );
      const candidates = await client.query<Record<string, unknown>>(
        'select * from private.dev_reminder_candidate($1)',
        [owner],
      );
      expect(candidates.rows[0]?.event_type ?? null).toBe(type);
    }),
  );

  it.each(['day', 'week', 'cycle'] as const)(
    'enforces the %s cap across all reminder types and resets a cycle only on foreground return',
    async (cap) =>
      fixture(async (client) => {
        const id = await enqueue(client);
        await client.query<Record<string, unknown>>('select private.claim_dev_reminder()');
        await client.query<Record<string, unknown>>(
          `select private.finish_dev_reminder($1,'accepted','ticket',null)`,
          [id],
        );
        await completeOnboarding(client);
        if (cap !== 'day') {
          await client.query<Record<string, unknown>>(
            `update private.dev_reminder_deliveries set attempted_at=now()-interval '2 days' where event_id=$1`,
            [id],
          );
          const e = (
            await client.query<{ id: string }>(
              `insert into public.notification_events(user_id,type,title,body_safe,data) values($1,'reminder.app_inactive.3d','Reminder','Open Masarifi.','{"scope":"dev_reminder"}') returning id`,
              [owner],
            )
          ).rows[0]?.id;
          await client.query<Record<string, unknown>>(
            `insert into private.dev_reminder_deliveries(event_id,user_id,notification_device_id,tracking_device_id,cycle_baseline,event_type,status,attempted_at) select $2,user_id,notification_device_id,tracking_device_id,cycle_baseline,'reminder.app_inactive.3d','accepted',now()-interval '1 day' from private.dev_reminder_deliveries where event_id=$1`,
            [id, e],
          );
          if (cap === 'cycle')
            await client.query<Record<string, unknown>>(
              `update private.dev_mobile_installations set last_foreground_at=now()-interval '20 days' where user_id=$1`,
              [owner],
            );
        }
        expect(
          (
            await client.query<Record<string, unknown>>(
              'select * from private.dev_reminder_candidate($1)',
              [owner],
            )
          ).rows,
        ).toHaveLength(0);
        if (cap === 'cycle') {
          await client.query<Record<string, unknown>>(
            `update private.dev_reminder_deliveries set attempted_at=now()-interval '10 days' where user_id=$1`,
            [owner],
          );
          expect(
            (
              await client.query<Record<string, unknown>>(
                'select * from private.dev_reminder_candidate($1)',
                [owner],
              )
            ).rows,
          ).toHaveLength(0);
          await client.query<Record<string, unknown>>(
            `update private.dev_mobile_installations set last_foreground_at=now()-interval '4 days' where user_id=$1`,
            [owner],
          );
          expect(
            (
              await client.query<Record<string, unknown>>(
                'select * from private.dev_reminder_candidate($1)',
                [owner],
              )
            ).rows,
          ).toHaveLength(1);
        }
      }),
  );

  it('revokes an unrotated invalid token while preserving an ordinary device token', async () =>
    fixture(async (client) => {
      const id = await enqueue(client);
      await client.query<Record<string, unknown>>('select private.claim_dev_reminder()');
      await client.query<Record<string, unknown>>(
        `select private.finish_dev_reminder($1,'rejected',null,'TOKEN_INVALID')`,
        [id],
      );
      expect(
        (
          await client.query<Record<string, unknown>>(
            'select revoked_at from public.push_tokens where device_id=$1',
            [device],
          )
        ).rows[0]?.revoked_at,
      ).not.toBeNull();
      expect(
        (
          await client.query<Record<string, unknown>>(
            'select revoked_at from public.push_tokens where device_id=$1',
            [ordinaryDevice],
          )
        ).rows[0]?.revoked_at,
      ).toBeNull();
    }));

  it('registers both DEV payload tables for owner erasure and denies direct worker reads', async () =>
    fixture(async (client) => {
      const definition = (
        await client.query<{ definition: string }>(
          `select pg_get_functiondef('private.erase_account_owner_payload(uuid,text)'::regprocedure) definition`,
        )
      ).rows[0]?.definition;
      expect(definition).toContain("('private','dev_reminder_deliveries')");
      expect(definition).toContain("('private','dev_mobile_installations')");
      await client.query<Record<string, unknown>>('savepoint forbidden_read');
      await client.query<Record<string, unknown>>('set local role masarifi_worker');
      await expect(
        client.query<Record<string, unknown>>('select * from private.dev_reminder_deliveries'),
      ).rejects.toThrow('permission denied');
      await client.query<Record<string, unknown>>('rollback to savepoint forbidden_read');
    }));

  it('keeps DEV template preferences out of ordinary profile defaults', async () =>
    fixture(async (client) => {
      expect(
        (
          await client.query(
            "select 1 from public.notification_preferences where user_id=$1 and event_type like 'dev.%'",
            [owner],
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await client.query(
            "select 1 from public.notification_preferences where user_id=$1 and event_type='transaction.created'",
            [owner],
          )
        ).rows.length,
      ).toBeGreaterThan(0);
    }));

  it('hides DEV rows from legacy list/unread/get while exposing authoritative DEV reads only within its owner transaction', async () =>
    fixture(async (client) => {
      const id = await enqueue(client);
      await client.query('select private.claim_dev_reminder()');
      await client.query('select private.prepare_dev_reminder($1)', [id]);
      await client.query(`select private.finish_dev_reminder($1,'accepted','ticket',null)`, [id]);
      await client.query('savepoint dev_read_scope');
      await client.query(`select set_config('request.jwt.claims',$1,true)`, [
        JSON.stringify({ role: 'authenticated', sub: owner }),
      ]);
      await client.query('set local role masarifi_api');
      const rows = () =>
        client.query('select id from public.notification_events where user_id=$1', [owner]);
      const unread = () =>
        client.query<{ count: string }>(
          'select count(*) count from public.notification_events where user_id=$1 and read_at is null',
          [owner],
        );
      expect((await rows()).rows).toHaveLength(0);
      expect((await unread()).rows[0]?.count).toBe('0');
      expect(
        (await client.query('select id from public.notification_events where id=$1', [id])).rows,
      ).toHaveLength(0);
      await client.query(`select set_config('masarifi.dev_reminders_access','on',true)`);
      expect((await rows()).rows).toHaveLength(1);
      expect((await unread()).rows[0]?.count).toBe('1');
      expect(
        (
          await client.query<{ id: string }>(
            'select id from public.notification_events where id=$1',
            [id],
          )
        ).rows[0]?.id,
      ).toBe(id);
      await client.query(
        `select set_config('request.jwt.claims','{"role":"authenticated","sub":"different-owner"}',true)`,
      );
      expect((await rows()).rows).toHaveLength(0);
      await client.query('rollback to savepoint dev_read_scope');
      expect(
        (
          await client.query<{ marker: string }>(
            `select current_setting('masarifi.dev_reminders_access',true) marker`,
          )
        ).rows[0]?.marker,
      ).not.toBe('on');
    }));

  it.each(['queued', 'suppressed', 'unknown'] as const)(
    'hides %s reminders from DEV inbox including canceled and unconfirmed submissions',
    async (status) =>
      fixture(async (client) => {
        const id = await enqueue(client);
        if (status === 'suppressed') {
          await client.query(
            'update private.dev_mobile_installations set last_foreground_at=now() where user_id=$1',
            [owner],
          );
          await client.query('select private.claim_dev_reminder()');
        }
        if (status === 'unknown') {
          await client.query('select private.claim_dev_reminder()');
          await client.query('select private.prepare_dev_reminder($1)', [id]);
          await client.query(
            `select private.finish_dev_reminder($1,'unknown',null,'PROVIDER_ACCEPTANCE_UNKNOWN')`,
            [id],
          );
        }
        expect(
          (
            await client.query<{ status: string }>(
              'select status from private.dev_reminder_deliveries where event_id=$1',
              [id],
            )
          ).rows[0]?.status,
        ).toBe(status);
        await client.query(`select set_config('request.jwt.claims',$1,true)`, [
          JSON.stringify({ role: 'authenticated', sub: owner }),
        ]);
        await client.query(`select set_config('masarifi.dev_reminders_access','on',true)`);
        await client.query('set local role masarifi_api');
        expect(
          (
            await client.query('select id from public.notification_events where user_id=$1', [
              owner,
            ])
          ).rows,
        ).toHaveLength(0);
      }),
  );

  it('creates idempotent AR/EN test events using only the opted-in DEV device without changing profile locale or financial state', async () =>
    fixture(async (client) => {
      const ids = [];
      for (const locale of ['ar', 'en']) {
        const id = (
          await client.query<{ id: string }>('select private.enqueue_dev_reminder_test($1,$2) id', [
            owner,
            locale,
          ])
        ).rows[0]?.id;
        ids.push(id);
        expect(
          (
            await client.query<Record<string, unknown>>(
              'select private.enqueue_dev_reminder_test($1,$2) id',
              [owner, locale],
            )
          ).rows[0]?.id,
        ).toBe(id);
        await client.query<Record<string, unknown>>('select private.claim_dev_reminder()');
        const prepared = (
          await client.query<{ value: { locale: string } }>(
            'select private.prepare_dev_reminder($1) value',
            [id],
          )
        ).rows[0]?.value;
        expect(prepared?.locale).toBe(locale);
        await client.query<Record<string, unknown>>(
          `select private.finish_dev_reminder($1,'accepted','test-ticket',null)`,
          [id],
        );
      }
      expect(new Set(ids).size).toBe(2);
      expect(
        (
          await client.query<Record<string, unknown>>(
            'select locale from public.profiles where id=$1',
            [owner],
          )
        ).rows[0]?.locale,
      ).toBe('ar');
      expect(
        (
          await client.query<Record<string, unknown>>(
            'select 1 from public.transactions where user_id=$1',
            [owner],
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await client.query<Record<string, unknown>>(
            'select * from private.dev_reminder_candidate($1)',
            [owner],
          )
        ).rows,
      ).toHaveLength(1);
      await client.query<Record<string, unknown>>(
        'update private.dev_mobile_installations set reminders_enabled=false where user_id=$1',
        [owner],
      );
      await expect(
        client.query<Record<string, unknown>>(`select private.enqueue_dev_reminder_test($1,'ar')`, [
          owner,
        ]),
      ).rejects.toThrow('DEV_REMINDER_CONSENT_DEVICE_REQUIRED');
    }));

  it.each(['accepted', 'ambiguous'] as const)(
    'two real workers submit once and persist %s across ticks',
    async (outcome) =>
      fixture(async (client) => {
        const hashKey = Buffer.alloc(32, 1),
          encryptionKey = Buffer.alloc(32, 2);
        const crypto = new PushTokenCrypto(hashKey, [{ id: 'key', key: encryptionKey }]);
        await client.query('update public.push_tokens set token_ciphertext=$1 where device_id=$2', [
          crypto.encrypt('ExponentPushToken[fixture]', {
            provider: 'expo',
            userId: owner,
            deviceId: device,
          }),
          device,
        ]);
        await client.query('commit');
        const config = new PlatformConfigService(
          new ConfigService<PlatformEnvironment, true>({
            DATABASE_URL: process.env.DATABASE_URL,
            MASARIFI_DATABASE_POOL_MAX: 3,
            MASARIFI_PROCESS_KIND: 'worker',
            MASARIFI_RETURN_REMINDERS_ENABLED: true,
            MASARIFI_ENGAGEMENT_PROVIDER_MODE: 'live',
            MASARIFI_PUSH_TOKEN_HASH_KEY: hashKey.toString('base64url'),
            MASARIFI_PUSH_TOKEN_ENCRYPTION_KEYS: 'key:' + encryptionKey.toString('base64url'),
          }),
        );
        const runtimePool = new PoolService(config);
        const transport = jest.spyOn(globalThis, 'fetch').mockImplementation(() => {
          if (outcome === 'ambiguous')
            return Promise.reject(new Error('NETWORK_ACCEPTANCE_UNKNOWN'));
          return Promise.resolve(
            new Response(JSON.stringify({ data: { status: 'ok', id: 'ticket' } }), {
              status: 200,
            }),
          );
        });
        try {
          const one = new DevRemindersWorker(runtimePool, config),
            two = new DevRemindersWorker(runtimePool, config);
          const workers = await Promise.allSettled([one.runOnce(), two.runOnce()]);
          for (const worker of workers) if (worker.status === 'rejected') throw worker.reason;
          await one.runOnce();
          expect(transport).toHaveBeenCalledTimes(1);
          const delivery = (
            await client.query<{ status: string; event_id: string }>(
              'select status,event_id from private.dev_reminder_deliveries where user_id=$1',
              [owner],
            )
          ).rows[0];
          if (!delivery) throw new Error('WORKER_DELIVERY_FIXTURE_MISSING');
          expect(delivery.status).toBe(outcome === 'accepted' ? 'accepted' : 'unknown');
          if (outcome === 'accepted') {
            await client.query('begin');
            await client.query('set local role masarifi_migration');
            await client.query(
              "update private.dev_reminder_deliveries set next_attempt_at=now()-interval '1 minute' where event_id=$1",
              [delivery.event_id],
            );
            await client.query('commit');
            transport.mockResolvedValue(
              new Response(JSON.stringify({ data: { ticket: { status: 'ok' } } }), { status: 200 }),
            );
            await one.runOnce();
            expect(transport).toHaveBeenCalledTimes(2);
            expect(
              (
                await client.query<{ status: string }>(
                  'select status from private.dev_reminder_deliveries where event_id=$1',
                  [delivery.event_id],
                )
              ).rows[0]?.status,
            ).toBe('confirmed');
          }
          expect(
            (
              await client.query<{ acted_at: unknown }>(
                'select acted_at from public.notification_events where id=$1',
                [delivery.event_id],
              )
            ).rows[0]?.acted_at,
          ).toBeNull();
        } finally {
          transport.mockRestore();
          await runtimePool.onModuleDestroy();
          await client.query('begin');
          await client.query('set local role masarifi_migration');
          for (const table of [
            'private.dev_reminder_deliveries',
            'public.notification_events',
            'private.dev_mobile_installations',
            'public.push_tokens',
            'public.user_devices',
            'public.notification_preferences',
          ])
            await client.query(`delete from ${table} where user_id=$1`, [owner]);
          await client.query('delete from public.profiles where id=$1', [owner]);
          await client.query('commit');
        }
      }),
  );
});
