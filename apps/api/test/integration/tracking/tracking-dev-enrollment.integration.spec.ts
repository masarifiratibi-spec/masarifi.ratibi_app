import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { PlatformConfigModule } from '../../../src/platform/config/platform-config.module';
import { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import { TrackingModule } from '../../../src/tracking/tracking.module';
import { TrackingService } from '../../../src/tracking/tracking.service';
import { TrackingRepository } from '../../../src/tracking/tracking.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('permanent device installation enrollment', () => {
  const pool = createLivePool();
  const repository = new TrackingRepository(pool);
  let owner: string, device: string, registered: string;
  let originalMode: string;
  beforeAll(async () => {
    const channel = (
      await pool.query<{ mode: string }>(
        "select mode from public.tracking_rule_channels where environment='default' and market='global' and channel='all'",
      )
    ).rows[0];
    if (!channel) throw new Error('TRACKING_CHANNEL_EXPECTED');
    originalMode = channel.mode;
    await pool.query(
      "update public.tracking_rule_channels set mode='review' where environment='default' and market='global' and channel='all'",
    );
  });
  const principal = () => ({
    userId: owner,
    sessionId: 'dev-enrollment-session',
    factorAgeSeconds: 0,
  });
  const enroll = (
    foreground = true,
    smsActivationId = '42',
    notificationDeviceId = registered,
    remindersEnabled = true,
    reminderLocale: 'ar' | 'en' = 'en',
    reminderTimeZone = 'Asia/Riyadh',
  ) =>
    repository.enrollInstallation(principal(), {
      deviceId: device,
      notificationDeviceId,
      smsActivationId,
      foreground,
      remindersEnabled,
      reminderLocale,
      reminderTimeZone,
    });
  beforeEach(async () => {
    owner = `dev_enroll_${randomUUID()}`;
    device = randomUUID();
    registered = randomUUID();
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [owner]);
    await repository.getPreferences(principal());
    await pool.query(
      'update public.tracking_preferences set enabled=true,review_required=false where user_id=$1',
      [owner],
    );
    await pool.query(
      "insert into public.user_devices(id,user_id,device_fingerprint,clerk_session_id,platform,app_version) values($1,$2,$3,$4,'android','1.0.0')",
      [
        registered,
        owner,
        'h1:' + randomUUID().replace(/-/g, '').repeat(2),
        'dev-enrollment-session',
      ],
    );
  });
  afterAll(async () => {
    try {
      await pool.query(
        "update public.tracking_rule_channels set mode=$1 where environment='default' and market='global' and channel='all'",
        [originalMode],
      );
    } finally {
      await pool.onModuleDestroy();
    }
  });
  it('resolves production module dependencies and enrolls through authenticated device registration', async () => {
    const module = await Test.createTestingModule({
      imports: [PlatformConfigModule, TrackingModule],
    }).compile();
    const config = module.get(PlatformConfigService);
    const originalGet = config.get.bind(config);
    jest
      .spyOn(config, 'get')
      .mockImplementation((key) =>
        key === 'MASARIFI_MOBILE_AUTOMATION_ENABLED' ? true : originalGet(key),
      );
    try {
      const result = await module.get(TrackingService).deviceRuleSnapshot(principal(), {
        deviceId: device,
        smsActivationId: '42',
        deviceRegistration: {
          deviceFingerprint: randomUUID(),
          platform: 'android',
          appVersion: '1.0.0',
        },
        remindersEnabled: false,
        foreground: true,
        reminderLocale: 'en',
        reminderTimeZone: 'Asia/Riyadh',
      });
      expect(result).toMatchObject({ rolloutMode: 'automatic' });
      expect(result.configurationHash).toMatch(/^[a-f0-9]{64}$/);
      const mapping = (
        await pool.query(
          'select d.notification_device_id,u.device_fingerprint,u.clerk_session_id from private.dev_mobile_installations d join public.user_devices u on u.id=d.notification_device_id where d.user_id=$1',
          [owner],
        )
      ).rows[0];
      expect(mapping?.notification_device_id).not.toBe(device);
      expect(mapping?.device_fingerprint).toMatch(/^h1:[0-9a-f]{64}$/);
      expect(mapping?.clerk_session_id).toBe('dev-enrollment-session');
    } finally {
      await module.close();
    }
  });
  it('grants permanent capture only to the enrolled owned device, preserving activation boundary and foreground consent', async () => {
    const first = await enroll();
    expect(first).toMatchObject({
      accountingPolicy: 'default_account_nominal_v1',
      rolloutMode: 'automatic',
      sourceAdmissionPolicy: 'financial_content_v1',
      currencyAccountPolicy: 'source_currency_v1',
      policySmsActivationId: '42',
    });
    const state = async () => {
      const row = (
        await pool.query(
          'select c.capture_started_at,c.expires_at::text,c.installation_managed,c.sms_activation_id,d.last_foreground_at,d.reminders_enabled,d.reminder_locale,d.reminder_timezone from private.tracking_automatic_cohorts c join private.dev_mobile_installations d on d.user_id=c.user_id and d.tracking_device_id=c.device_id where c.user_id=$1',
          [owner],
        )
      ).rows[0];
      if (!row) throw new Error('DEV_COHORT_MISSING');
      return row;
    };
    const initial = await state();
    expect(initial).toMatchObject({
      installation_managed: true,
      expires_at: 'infinity',
      reminders_enabled: true,
      reminder_locale: 'en',
      reminder_timezone: 'Asia/Riyadh',
    });
    await enroll(false, '7', registered, false, 'ar', 'Europe/London');
    expect(await state()).toEqual({
      ...initial,
      reminders_enabled: false,
      reminder_locale: 'ar',
      reminder_timezone: 'Europe/London',
    });
    const ordinary = await repository.ruleSnapshot(principal());
    expect(ordinary.accountingPolicy).toBe('default_account_nominal_v1');
    expect(ordinary.rolloutMode).not.toBe('automatic');
    expect(
      (await repository.ruleSnapshot(principal(), randomUUID())).sourceAdmissionPolicy,
    ).toBeUndefined();
    await enroll(false, '100');
    expect((await state()).sms_activation_id).toBe('100');
    expect((await state()).capture_started_at).toEqual(initial.capture_started_at);
  });
  it('rejects another owners device, a revoked device, and a stale session', async () => {
    const other = `other_${randomUUID()}`,
      otherDevice = randomUUID();
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [other]);
    await pool.query(
      "insert into public.user_devices(id,user_id,device_fingerprint,platform,app_version) values($1,$2,$3,'android','1.0.0')",
      [otherDevice, other, 'h1:' + randomUUID().replace(/-/g, '').repeat(2)],
    );
    await expect(enroll(true, '42', otherDevice)).rejects.toMatchObject({
      status: 404,
      response: { code: 'DEVICE_NOT_FOUND' },
    });
    await pool.query('update public.user_devices set revoked_at=now() where id=$1', [registered]);
    await expect(enroll()).rejects.toMatchObject({
      status: 404,
      response: { code: 'DEVICE_NOT_FOUND' },
    });
    await pool.query(
      "update public.user_devices set revoked_at=null,clerk_session_id='different-session' where id=$1",
      [registered],
    );
    await expect(enroll()).rejects.toMatchObject({
      status: 404,
      response: { code: 'DEVICE_NOT_FOUND' },
    });
  });
  it('keeps ordinary cohorts bounded and denies direct runtime table access', async () => {
    await expect(
      pool.query(
        "insert into private.tracking_automatic_cohorts(user_id,device_id,release_id,engine_version,expires_at,reason) select $1,$2,release_id,'2.0.0','infinity','Synthetic ordinary safety' from public.tracking_rule_channels where environment='default' and market='global' and channel='all'",
        [owner, device],
      ),
    ).rejects.toThrow(/check constraint/);
    const grants = await pool.query(
      "select has_table_privilege('masarifi_api','private.dev_mobile_installations','SELECT') api,has_table_privilege('masarifi_worker','private.dev_mobile_installations','SELECT') worker",
    );
    expect(grants.rows[0]).toEqual({ api: false, worker: false });
  });
  it('preserves disabled installation and cohort kill switches across automatic refreshes', async () => {
    await enroll();
    await pool.query('update private.dev_mobile_installations set enabled=false where user_id=$1', [
      owner,
    ]);
    expect((await enroll()).sourceAdmissionPolicy).toBeUndefined();
    expect(
      (
        await pool.query('select enabled from private.dev_mobile_installations where user_id=$1', [
          owner,
        ])
      ).rows[0],
    ).toEqual({ enabled: false });
    await pool.query('update private.dev_mobile_installations set enabled=true where user_id=$1', [
      owner,
    ]);
    await pool.query(
      'update private.tracking_automatic_cohorts set enabled=false where user_id=$1',
      [owner],
    );
    expect((await enroll()).sourceAdmissionPolicy).toBeUndefined();
    expect(
      (
        await pool.query(
          'select enabled from private.tracking_automatic_cohorts where user_id=$1',
          [owner],
        )
      ).rows[0],
    ).toEqual({ enabled: false });
  });
  it('renews a legacy activation against the current published release without moving its boundary or enabling paused preferences', async () => {
    const staleRelease = randomUUID();
    await pool.query(
      "insert into public.tracking_rule_releases(id,schema_version,engine_version,snapshot,content_hash,created_by,reason) select $1::uuid,schema_version,engine_version,jsonb_set(snapshot,'{releaseId}',to_jsonb($1::uuid::text)),content_hash,'synthetic','Synthetic stale DEV release' from public.tracking_rule_releases where status='published' limit 1",
      [staleRelease],
    );
    await pool.query(
      "insert into private.tracking_automatic_cohorts(user_id,device_id,release_id,engine_version,expires_at,reason,source_admission_policy,capture_started_at,sms_activation_id,currency_account_policy) values($1,$2,$3,'2.0.0',now()+interval '1 hour','Synthetic legacy activation','financial_content_v1','2026-10-01T00:00:00Z','100','source_currency_v1')",
      [owner, device, staleRelease],
    );
    await pool.query('update public.tracking_preferences set enabled=false where user_id=$1', [
      owner,
    ]);
    const result = await enroll(false, '42');
    expect(result.sourceAdmissionPolicy).toBeUndefined();
    expect(result.rolloutMode).not.toBe('automatic');
    const cohort = (
      await pool.query(
        "select capture_started_at,sms_activation_id,installation_managed,release_id=(select release_id from public.tracking_rule_channels where environment='default' and market='global' and channel='all') current_release from private.tracking_automatic_cohorts where user_id=$1",
        [owner],
      )
    ).rows[0];
    expect(cohort).toMatchObject({
      capture_started_at: new Date('2026-10-01T00:00:00Z'),
      sms_activation_id: '100',
      installation_managed: true,
      current_release: true,
    });
    expect(
      (
        await pool.query(
          'select last_foreground_at from private.dev_mobile_installations where user_id=$1',
          [owner],
        )
      ).rows[0],
    ).toEqual({ last_foreground_at: null });
  });
});
