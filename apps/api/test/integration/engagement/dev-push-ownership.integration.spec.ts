import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { createLivePool, describeLiveDatabase } from '../../live-database';
import { IdentityRepository } from '../../../src/identity/identity.repository';
import { PushTokenCrypto } from '../../../src/identity/push-token.crypto';
import type { PoolService } from '../../../src/platform/database/pool.service';

describeLiveDatabase('DEV push owner handoff', () => {
  let pool: PoolService;
  const crypto = new PushTokenCrypto(Buffer.alloc(32, 1), [
    { id: 'key', key: Buffer.alloc(32, 2) },
  ]);
  beforeAll(() => {
    pool = createLivePool();
  });
  afterAll(async () => {
    await pool.onModuleDestroy();
  });
  async function fixture(
    action: (c: PoolClient, a: string, b: string, device: string, tokenId: string) => Promise<void>,
    scoped = true,
  ) {
    const a = 'dev-push-a-' + randomUUID(),
      b = 'dev-push-b-' + randomUUID(),
      device = randomUUID();
    const rawToken = 'ExponentPushToken[dev-owner-fixture]';
    await pool.withClient(async (c) => {
      await c.query('begin');
      await c.query('set local role masarifi_migration');
      await c.query(`insert into public.profiles(id,status) values($1,'active'),($2,'active')`, [
        a,
        b,
      ]);
      await c.query(
        `insert into public.user_devices(id,user_id,device_fingerprint,clerk_session_id,platform,app_version) values($1,$2,$3,'session-a','android','1.0')`,
        [device, a, crypto.fingerprint('dev-fingerprint-1111111')],
      );
      const inserted = await c.query<{ id: string }>(
        `insert into public.push_tokens(user_id,device_id,token_hash,token_ciphertext,provider) values($1,$2,$3,$4,'expo') returning id`,
        [
          a,
          device,
          crypto.tokenHash(rawToken),
          crypto.encrypt(rawToken, { provider: 'expo', userId: a, deviceId: device }),
        ],
      );
      const tokenId = inserted.rows[0]?.id;
      if (!tokenId) throw new Error('FIXTURE_TOKEN_MISSING');
      const ordinaryDevice = randomUUID(),
        ordinaryToken = 'ExponentPushToken[ordinary-owner-fixture]';
      await c.query(
        `insert into public.user_devices(id,user_id,device_fingerprint,clerk_session_id,platform,app_version) values($1,$2,$3,'ordinary-session','android','1.0')`,
        [ordinaryDevice, a, crypto.fingerprint('ordinary-fingerprint-2222')],
      );
      await c.query(
        `insert into public.push_tokens(user_id,device_id,token_hash,token_ciphertext,provider) values($1,$2,$3,$4,'expo')`,
        [
          a,
          ordinaryDevice,
          crypto.tokenHash(ordinaryToken),
          crypto.encrypt(ordinaryToken, { provider: 'expo', userId: a, deviceId: ordinaryDevice }),
        ],
      );
      if (scoped)
        await c.query(
          `insert into private.dev_mobile_installations(user_id,tracking_device_id,notification_device_id,reminders_enabled,reminder_locale,reminder_timezone) values($1,$2,$3,true,'en','Asia/Riyadh')`,
          [a, randomUUID(), device],
        );
      await c.query('commit');
      try {
        await action(c, a, b, device, tokenId);
      } finally {
        await c.query('rollback');
        await c.query('begin');
        await c.query('set local role masarifi_migration');
        for (const table of [
          'private.dev_reminder_deliveries',
          'public.notification_events',
          'private.dev_mobile_installations',
          'public.push_tokens',
          'public.user_devices',
          'public.notification_preferences',
        ])
          await c.query(`delete from ${table} where user_id=any($1)`, [[a, b]]);
        await c.query(`delete from private.outbox_events where payload->>'userId'=any($1)`, [
          [a, b],
        ]);
        await c.query('delete from public.profiles where id=any($1)', [[a, b]]);
        await c.query('commit');
      }
    });
  }
  it('releases only a same-installation DEV token and creates a newly encrypted owner row with consent off', async () =>
    fixture(async (c, a, b, device, oldToken) => {
      const repository = new IdentityRepository(pool, crypto),
        tracking = randomUUID();
      const registered = await repository.registerDevice(
        { userId: b, sessionId: 'session-b', factorAgeSeconds: 0 },
        {
          deviceFingerprint: 'dev-fingerprint-1111111',
          platform: 'android',
          appVersion: '1.0',
          pushProvider: 'expo',
          pushToken: 'ExponentPushToken[dev-owner-fixture]',
        },
        tracking,
      );
      await c.query('begin');
      await c.query('set local role masarifi_migration');
      expect(
        (await c.query('select 1 from public.push_tokens where id=$1', [oldToken])).rows,
      ).toHaveLength(0);
      const token = (
        await c.query<{ id: string; token_ciphertext: string; revoked_at: unknown }>(
          'select id,token_ciphertext,revoked_at from public.push_tokens where user_id=$1',
          [b],
        )
      ).rows[0];
      if (!token) throw new Error('HANDOFF_TOKEN_MISSING');
      expect(token.id).not.toBe(oldToken);
      expect(
        crypto.decrypt(token.token_ciphertext, {
          provider: 'expo',
          userId: b,
          deviceId: registered.device.id,
        }),
      ).toBe('ExponentPushToken[dev-owner-fixture]');
      expect(
        (
          await c.query<{ enabled: boolean; reminders_enabled: boolean }>(
            'select enabled,reminders_enabled from private.dev_mobile_installations where user_id=$1',
            [a],
          )
        ).rows[0],
      ).toEqual({ enabled: true, reminders_enabled: false });
      expect(
        (
          await c.query<{ reminders_enabled: boolean }>(
            'select reminders_enabled from private.dev_mobile_installations where user_id=$1',
            [b],
          )
        ).rows[0]?.reminders_enabled,
      ).toBe(false);
      const oldEvent = randomUUID();
      await c.query(
        `insert into public.notification_events(id,user_id,type,title,body_safe,data) values($1,$2,'reminder.app_inactive.3d','Reminder','Open Masarifi.','{"scope":"dev_reminder"}')`,
        [oldEvent, a],
      );
      await c.query(
        `insert into private.dev_reminder_deliveries(event_id,user_id,notification_device_id,tracking_device_id,cycle_baseline,event_type,status,attempt_count,token_id,token_hash,provider) select $1,user_id,notification_device_id,tracking_device_id,enrolled_at,'reminder.app_inactive.3d','accepted',1,$3,$4,'expo' from private.dev_mobile_installations where user_id=$2`,
        [oldEvent, a, oldToken, crypto.tokenHash('ExponentPushToken[dev-owner-fixture]')],
      );
      await c.query(`select private.finish_dev_reminder($1,'rejected',null,'TOKEN_INVALID')`, [
        oldEvent,
      ]);
      await c.query(`select set_config('request.jwt.claims',$1,true)`, [
        JSON.stringify({ role: 'authenticated', sub: a, sid: 'session-a' }),
      ]);
      await c.query('select private.sign_out_dev_installation($1,$2)', [
        a,
        crypto.fingerprint('dev-fingerprint-1111111'),
      ]);
      expect(
        (
          await c.query<{ revoked_at: unknown }>(
            'select revoked_at from public.push_tokens where user_id=$1',
            [b],
          )
        ).rows[0]?.revoked_at,
      ).toBeNull();
      expect(
        (await c.query('select 1 from public.user_devices where id=$1', [device])).rows,
      ).toHaveLength(1);
    }));
  it.each([
    ['wrong-fingerprint', true],
    ['ordinary-token', false],
  ] as const)('rejects %s without moving or revoking the prior token', async (reason, scoped) =>
    fixture(async (c, a, b, _device, oldToken) => {
      const repository = new IdentityRepository(pool, crypto);
      await expect(
        repository.registerDevice(
          { userId: b, sessionId: 'session-b', factorAgeSeconds: 0 },
          {
            deviceFingerprint:
              reason === 'wrong-fingerprint' ? 'other-fingerprint-2222' : 'dev-fingerprint-1111111',
            platform: 'android',
            appVersion: '1.0',
            pushProvider: 'expo',
            pushToken: 'ExponentPushToken[dev-owner-fixture]',
          },
          randomUUID(),
        ),
      ).rejects.toThrow('DEV_PUSH_HANDOFF_FORBIDDEN');
      await c.query('begin');
      await c.query('set local role masarifi_migration');
      expect(
        (
          await c.query<{ user_id: string; revoked_at: unknown }>(
            'select user_id,revoked_at from public.push_tokens where id=$1',
            [oldToken],
          )
        ).rows[0],
      ).toEqual({ user_id: a, revoked_at: null });
      expect(
        (await c.query('select 1 from public.user_devices where user_id=$1', [b])).rows,
      ).toHaveLength(0);
    }, scoped),
  );
  it('makes DEV signout idempotent, disables reminders and revokes only its scoped device', async () =>
    fixture(async (c, a, _b, device) => {
      const repository = new IdentityRepository(pool, crypto);
      const principal = { userId: a, sessionId: 'session-a', factorAgeSeconds: 0 };
      const registration = {
        deviceFingerprint: 'dev-fingerprint-1111111',
        platform: 'android' as const,
        appVersion: '1.0',
      };
      await repository.signOutDevInstallation(principal, registration);
      await repository.signOutDevInstallation(principal, registration);
      await c.query('begin');
      await c.query('set local role masarifi_migration');
      expect(
        (
          await c.query<{ enabled: boolean; reminders_enabled: boolean }>(
            'select enabled,reminders_enabled from private.dev_mobile_installations where user_id=$1',
            [a],
          )
        ).rows[0],
      ).toEqual({ enabled: true, reminders_enabled: false });
      expect(
        (
          await c.query<{ revoked_at: unknown }>(
            'select revoked_at from public.push_tokens where device_id=$1',
            [device],
          )
        ).rows[0]?.revoked_at,
      ).not.toBeNull();
      expect(
        (
          await c.query<{ revoked_at: unknown }>(
            'select revoked_at from public.push_tokens where user_id=$1 and device_id<>$2',
            [a, device],
          )
        ).rows[0]?.revoked_at,
      ).toBeNull();
      await c.query(`update public.profiles set status='deletion_pending' where id=$1`, [a]);
      await c.query('commit');
      await repository.signOutDevInstallation(principal, registration);
    }));

  it.each([false, true])(
    'A→B→A requires a fresh session and preserves operator pause=%s without restoring consent',
    async (paused) =>
      fixture(async (c, a, b, device) => {
        const repository = new IdentityRepository(pool, crypto),
          input = {
            deviceFingerprint: 'dev-fingerprint-1111111',
            platform: 'android' as const,
            appVersion: '1.0',
            pushProvider: 'expo' as const,
            pushToken: 'ExponentPushToken[dev-owner-fixture]',
          };
        await c.query('begin');
        await c.query('set local role masarifi_migration');
        if (paused)
          await c.query(
            'update private.dev_mobile_installations set enabled=false where user_id=$1',
            [a],
          );
        const tracking = (
          await c.query<{ tracking_device_id: string }>(
            'select tracking_device_id from private.dev_mobile_installations where user_id=$1',
            [a],
          )
        ).rows[0]?.tracking_device_id;
        if (!tracking) throw new Error('FIXTURE_TRACKING_MISSING');
        await c.query('commit');
        await repository.registerDevice(
          { userId: b, sessionId: 'session-b', factorAgeSeconds: 0 },
          input,
          randomUUID(),
        );
        await expect(
          repository.registerDevice(
            { userId: a, sessionId: 'session-a', factorAgeSeconds: 0 },
            input,
            tracking,
          ),
        ).rejects.toThrow('PUSH_TOKEN_CONFLICT');
        const returned = await repository.registerDevice(
          { userId: a, sessionId: 'session-a-fresh', factorAgeSeconds: 0 },
          input,
          tracking,
        );
        expect(returned.device.id).toBe(device);
        expect(returned.device.revokedAt).toBeNull();
        expect(returned.device.clerkSessionId).toBe('session-a-fresh');
        await c.query('begin');
        await c.query('set local role masarifi_migration');
        expect(
          (
            await c.query<{ enabled: boolean; reminders_enabled: boolean }>(
              'select enabled,reminders_enabled from private.dev_mobile_installations where user_id=$1',
              [a],
            )
          ).rows[0],
        ).toEqual({ enabled: !paused, reminders_enabled: false });
        expect(
          (
            await c.query<{ reminders_enabled: boolean }>(
              'select reminders_enabled from private.dev_mobile_installations where user_id=$1',
              [b],
            )
          ).rows[0]?.reminders_enabled,
        ).toBe(false);
      }),
  );

  it.each(['deletion_pending', 'deleted'])(
    'releases a scoped token from a %s old owner without mutating frozen payloads',
    async (status) =>
      fixture(async (c, a, b) => {
        await c.query('begin');
        await c.query('set local role masarifi_migration');
        await c.query(
          "update public.profiles set status=$2,deleted_at=case when $2='deleted' then clock_timestamp() end where id=$1",
          [a, status],
        );
        await c.query('commit');
        const repository = new IdentityRepository(pool, crypto);
        const registered = await repository.registerDevice(
          { userId: b, sessionId: 'session-b', factorAgeSeconds: 0 },
          {
            deviceFingerprint: 'dev-fingerprint-1111111',
            platform: 'android',
            appVersion: '1.0',
            pushProvider: 'expo',
            pushToken: 'ExponentPushToken[dev-owner-fixture]',
          },
          randomUUID(),
        );
        expect(registered.device.revokedAt).toBeNull();
        await c.query('begin');
        await c.query('set local role masarifi_migration');
        expect(
          (
            await c.query<{ reminders_enabled: boolean }>(
              'select reminders_enabled from private.dev_mobile_installations where user_id=$1',
              [a],
            )
          ).rows[0]?.reminders_enabled,
        ).toBe(true);
        expect(
          (
            await c.query('select 1 from public.push_tokens where user_id=$1 and device_id=$2', [
              b,
              registered.device.id,
            ])
          ).rows,
        ).toHaveLength(1);
      }),
  );
  it('treats signout before DEV enrollment as a no-op and leaves an ordinary token untouched', async () =>
    fixture(async (c, a, _b, device, tokenId) => {
      await new IdentityRepository(pool, crypto).signOutDevInstallation(
        { userId: a, sessionId: 'session-a', factorAgeSeconds: 0 },
        { deviceFingerprint: 'dev-fingerprint-1111111', platform: 'android', appVersion: '1.0' },
      );
      await c.query('begin');
      await c.query('set local role masarifi_migration');
      expect(
        (
          await c.query<{ revoked_at: unknown }>(
            'select revoked_at from public.push_tokens where id=$1',
            [tokenId],
          )
        ).rows[0]?.revoked_at,
      ).toBeNull();
      expect(
        (
          await c.query<{ revoked_at: unknown }>(
            'select revoked_at from public.user_devices where id=$1',
            [device],
          )
        ).rows[0]?.revoked_at,
      ).toBeNull();
    }, false));
});
