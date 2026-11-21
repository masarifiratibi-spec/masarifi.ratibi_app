import {
  EngagementRepository,
  type NotificationDeliveryClaim,
} from '../../../src/engagement/engagement.repository';
import { EngagementWorker } from '../../../src/engagement/engagement.worker';
import type { PoolService } from '../../../src/platform/database/pool.service';
import type { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import type { ClerkClientService } from '../../../src/identity/clerk-client.service';
import type { SupportStorage } from '../../../src/engagement/support.storage';

const release = { version: '1.0.1', versionCode: 140 };
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Expected database statement was not executed');
  return value;
}
const audience = { platforms: ['android'], appUpdate: release };
const claim: NotificationDeliveryClaim = {
  id: '20000000-0000-4000-8000-000000000001',
  claim_token: '30000000-0000-4000-8000-000000000001',
  user_id: 'owner',
  channel: 'push',
  provider: 'push',
  attempt_count: 1,
  event_id: null,
  event_type: null,
  title: 'An update is available',
  body_safe: 'Update Masarifi when convenient.',
  data: { route: 'app_update', appUpdate: release },
  token_ciphertext: 'wrong-ios-ciphertext',
  token_device_id: 'latest-ios',
  token_provider: 'apns',
};

function configFor(published = true) {
  const values: Record<string, unknown> = {
    MASARIFI_ANDROID_UPDATE_PUBLISHED: published,
    MASARIFI_ANDROID_LATEST_VERSION: release.version,
    MASARIFI_ANDROID_LATEST_VERSION_CODE: release.versionCode,
    MASARIFI_NOTIFICATION_BATCH_SIZE: 100,
    MASARIFI_NOTIFICATION_MAX_ATTEMPTS: 5,
    MASARIFI_ENGAGEMENT_PROVIDER_MODE: 'deterministic',
  };
  const config = { get: (key: string) => values[key], getRequired: (key: string) => values[key] };
  return { values, config: config as unknown as PlatformConfigService };
}

function repositoryFor(rows: unknown[] = [], published = true) {
  const { config, values } = configFor(published);
  const lifecycle = {
    status: 'running',
    audience_definition:
      (rows[0] as { audience_definition?: unknown } | undefined)?.audience_definition ?? audience,
  };
  const query = jest.fn((sql: string, values?: unknown[]) => {
    void values;
    if (sql.includes('select c.status,c.audience_definition'))
      return Promise.resolve({ rows: [lifecycle] });
    return Promise.resolve({ rows: sql.includes('u.app_version') ? rows : [] });
  });
  const pool = {
    withClient: <T>(run: (client: { query: typeof query }) => Promise<T>) => run({ query }),
  };
  return {
    repository: new EngagementRepository(pool as unknown as PoolService, config),
    query,
    values,
    lifecycle,
  };
}

const device = (appVersion: string, id = 'old-android') => ({
  app_version: appVersion,
  token_ciphertext: `ciphertext-${id}`,
  token_device_id: id,
  token_provider: 'expo',
  audience_definition: audience,
  preference_enabled: true,
  quiet_hours: {},
});

it('reselects the most recent eligible Android token after claim instead of using the latest cross-platform token', async () => {
  const { repository, query } = repositoryFor([
    device('1.0.1+140', 'current-android'),
    device('1.0.1+139'),
    device('1.0.0', 'older'),
  ]);
  const result = await repository.prepareAndroidUpdateDelivery(claim, release);
  expect(result).toEqual({
    outcome: 'deliver',
    target: {
      token_ciphertext: 'ciphertext-old-android',
      token_device_id: 'old-android',
      token_provider: 'expo',
    },
  });
  const [sql, values] = required(query.mock.calls.find(([sql]) => sql.includes('u.app_version')));
  expect(values).toEqual([claim.id, claim.claim_token, 'owner']);
  expect(sql).toContain("u.platform='android'");
  expect(sql).toContain('u.user_id=p.user_id');
  expect(sql).toContain('u.id=p.device_id');
  expect(sql).toContain('u.revoked_at is null');
  expect(sql).toContain('p.revoked_at is null');
  expect(sql).toContain("owner.status='active'");
  expect(sql).toContain("c.status in ('running','completed')");
  expect(sql).toContain('order by p.updated_at desc,p.id desc');
});

it.each(
  [[], [device('1.0.1+140')], [device('1.0.1+141')], [device('malformed')]].map((rows) => ({
    rows,
  })),
)('suppresses when no eligible Android device is returned: %j', async ({ rows }) => {
  const { repository } = repositoryFor(rows);
  expect(await repository.prepareAndroidUpdateDelivery(claim, release)).toMatchObject({
    outcome: 'suppress',
  });
});

it.each([
  { platforms: ['android'], appUpdate: { ...release, versionCode: 139 } },
  { platforms: ['android'], appUpdate: { ...release, arbitrary: true } },
  { platforms: ['ios'], appUpdate: release },
])('suppresses a mismatched or malformed stored campaign %j', async (stored) => {
  const { repository } = repositoryFor([{ ...device('1.0.0'), audience_definition: stored }]);
  expect(await repository.prepareAndroidUpdateDelivery(claim, release)).toEqual({
    outcome: 'suppress',
    reason: 'APP_UPDATE_STALE',
  });
});

it('suppresses withdrawal without reading or reusing a claimed token', async () => {
  const { repository, query } = repositoryFor([device('1.0.0')], false);
  expect(await repository.prepareAndroidUpdateDelivery(claim, release)).toEqual({
    outcome: 'suppress',
    reason: 'APP_UPDATE_STALE',
  });
  expect(query).not.toHaveBeenCalled();
});

it('respects disabled preferences and defers quiet hours instead of sending', async () => {
  const disabled = repositoryFor([{ ...device('1.0.0'), preference_enabled: false }]);
  expect(await disabled.repository.prepareAndroidUpdateDelivery(claim, release)).toEqual({
    outcome: 'suppress',
    reason: 'PREFERENCE_DISABLED',
  });
  jest.useFakeTimers().setSystemTime(new Date('2026-11-12T23:00:00Z'));
  const quiet = repositoryFor([
    {
      ...device('1.0.0'),
      quiet_hours: {
        enabled: true,
        start: '22:00',
        end: '07:00',
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        timeZone: 'UTC',
      },
    },
  ]);
  expect(await quiet.repository.prepareAndroidUpdateDelivery(claim, release)).toEqual({
    outcome: 'defer',
    until: new Date('2026-11-13T07:00:00Z'),
  });
});

it('queries shared owner push quiet hours when a custom update template has no matching preference', async () => {
  const { repository, query } = repositoryFor([device('1.0.0')]);
  await repository.prepareAndroidUpdateDelivery(claim, release);
  const [sql] = required(query.mock.calls.find(([sql]) => sql.includes('u.app_version')));
  expect(sql).toContain('coalesce(pref.quiet_hours,(select shared.quiet_hours');
  expect(sql).toContain("shared.user_id=d.user_id and shared.channel='push'");
  expect(sql).toContain("shared.quiet_hours->>'enabled'='true'");
  expect(sql).toContain('order by shared.updated_at desc,shared.id desc limit 1');
});

it('defers the original paused delivery and prepares it after resume instead of consuming its release slot', async () => {
  const { repository, lifecycle, query } = repositoryFor([device('1.0.0')]);
  lifecycle.status = 'paused';
  const paused = await repository.prepareAndroidUpdateDelivery(claim, release);
  expect(paused).toMatchObject({ outcome: 'defer' });
  if (paused.outcome !== 'defer') throw new Error('PAUSED_UPDATE_NOT_DEFERRED');
  expect(paused.until).toBeInstanceOf(Date);
  expect(query.mock.calls.some(([sql]) => sql.includes('u.app_version'))).toBe(false);
  lifecycle.status = 'running';
  expect(await repository.prepareAndroidUpdateDelivery(claim, release)).toMatchObject({
    outcome: 'deliver',
  });
});

it('terminally suppresses a cancelled campaign instead of deferring it', async () => {
  const { repository, lifecycle } = repositoryFor([device('1.0.0')]);
  lifecycle.status = 'cancelled';
  expect(await repository.prepareAndroidUpdateDelivery(claim, release)).toEqual({
    outcome: 'suppress',
    reason: 'APP_UPDATE_STALE',
  });
});

it('retains the claim token guard and does not consume a provider attempt when quiet hours defer', async () => {
  const { repository, query } = repositoryFor();
  await repository.deferNotificationDelivery(
    claim.id,
    claim.claim_token,
    new Date('2026-11-13T07:00:00Z'),
  );
  const call = required(query.mock.calls.find(([sql]) => sql.includes("status='queued'")));
  expect(call[0]).toContain('claim_token=$2');
  expect(call[0]).toContain('greatest(0,attempt_count-1)');
  expect(call[1]).toEqual([claim.id, claim.claim_token, new Date('2026-11-13T07:00:00Z')]);
});

function workerFor(
  delivery: NotificationDeliveryClaim = claim,
  decision: unknown = {
    outcome: 'deliver',
    target: {
      token_ciphertext: 'old-android-ciphertext',
      token_device_id: 'old-android',
      token_provider: 'expo',
    },
  },
) {
  const { config, values } = configFor();
  const repository = {
    claimNotificationDeliveries: jest.fn().mockResolvedValue([delivery]),
    prepareAndroidUpdateDelivery: jest.fn().mockResolvedValue(decision),
    finishNotificationDelivery: jest.fn().mockResolvedValue(true),
    deferNotificationDelivery: jest.fn().mockResolvedValue(undefined),
  };
  return {
    repository,
    values,
    worker: new EngagementWorker(
      repository as unknown as EngagementRepository,
      {} as SupportStorage,
      {} as ClerkClientService,
      config,
    ),
  };
}

it.each([
  { data: { route: 'app_update' } },
  { data: { route: 'app_update', appUpdate: { ...release, versionCode: 139 } } },
  { data: { route: 'app_update', appUpdate: { ...release, extra: true } } },
  { data: { route: 'notification_detail', appUpdate: release } },
  { channel: 'email' },
])('suppresses unsafe queued update data before provider dispatch: %j', async (overrides) => {
  const { worker, repository } = workerFor({ ...claim, ...overrides } as NotificationDeliveryClaim);
  await worker.runJob('notification.dispatch');
  expect(repository.finishNotificationDelivery).toHaveBeenCalledWith(
    claim.id,
    claim.claim_token,
    'suppressed',
    'APP_UPDATE_STALE',
  );
});

it('rechecks a withdrawn release on retry and never sends the stale campaign', async () => {
  const { worker, repository, values } = workerFor({ ...claim, attempt_count: 2 });
  values.MASARIFI_ANDROID_UPDATE_PUBLISHED = false;
  await worker.runJob('notification.dispatch');
  expect(repository.prepareAndroidUpdateDelivery).not.toHaveBeenCalled();
  expect(repository.finishNotificationDelivery).toHaveBeenCalledWith(
    claim.id,
    claim.claim_token,
    'suppressed',
    'APP_UPDATE_STALE',
  );
});

it('keeps quiet-hour deferral out of provider retry completion', async () => {
  const until = new Date('2026-11-13T07:00:00Z');
  const { worker, repository } = workerFor(claim, { outcome: 'defer', until });
  await worker.runJob('notification.dispatch');
  expect(repository.deferNotificationDelivery).toHaveBeenCalledWith(
    claim.id,
    claim.claim_token,
    until,
  );
  expect(repository.finishNotificationDelivery).not.toHaveBeenCalled();
});

it('uses the existing deterministic provider pipeline only after update eligibility is confirmed', async () => {
  const { worker, repository } = workerFor();
  await worker.runJob('notification.dispatch');
  expect(repository.prepareAndroidUpdateDelivery).toHaveBeenCalledWith(claim, release);
  expect(repository.finishNotificationDelivery).toHaveBeenCalledWith(
    claim.id,
    claim.claim_token,
    'delivered',
    undefined,
    expect.any(String),
  );
});

function campaignRepository(
  storedAudience: unknown = audience,
  published = true,
  channel = 'push',
) {
  const { config } = configFor(published);
  const statements: Array<{ sql: string; values?: unknown[] }> = [];
  const query = jest.fn((sql: string, values?: unknown[]) => {
    statements.push({ sql, values });
    if (sql.includes('claim_engagement_key'))
      return Promise.resolve({ rows: [{ outcome: 'new' }] });
    if (sql.includes('c.audience_definition from public.notification_campaigns c'))
      return Promise.resolve({
        rows: [
          {
            id: claim.id,
            channel,
            subject: 'Update',
            body: 'Visit Google Play.',
            audience_definition: storedAudience,
          },
        ],
      });
    if (sql.includes('select audience_definition'))
      return Promise.resolve({ rows: [{ audience_definition: storedAudience }] });
    if (sql.includes('select channel from public.notification_templates'))
      return Promise.resolve({ rows: [{ channel }] });
    if (sql.includes('execute_engagement_command'))
      return Promise.resolve({ rows: [{ value: { resourceId: claim.id, eligible: 99 } }] });
    if (sql.includes('count(*)')) return Promise.resolve({ rows: [{ eligible: '2' }] });
    if (sql.includes('insert into private.notification_deliveries'))
      return Promise.resolve({ rows: [], rowCount: 1 });
    return Promise.resolve({ rows: [] });
  });
  const pool = {
    withClient: <T>(run: (client: { query: typeof query }) => Promise<T>) => run({ query }),
  };
  return {
    repository: new EngagementRepository(pool as unknown as PoolService, config),
    statements,
  };
}

it.each(['approve', 'schedule', 'send_now', 'resume'])(
  'blocks publication action %s for an unpublished update campaign',
  async (action) => {
    const { repository, statements } = campaignRepository(audience, false);
    await expect(
      repository.execute(
        { userId: 'admin', sessionId: 's', factorAgeSeconds: 0 },
        {
          operation: 'adminActOnNotificationCampaign',
          params: { campaignId: claim.id },
          body: { action, expectedVersion: 1 },
          idempotencyKey: 'update-campaign-action-1',
          requestId: 'r1',
        },
      ),
    ).rejects.toMatchObject({ response: { code: 'APP_UPDATE_UNAVAILABLE' }, status: 409 });
    expect(statements.some(({ sql }) => sql.includes('execute_engagement_command'))).toBe(false);
  },
);

it('allows cancellation after withdrawal through the existing campaign pipeline', async () => {
  const { repository, statements } = campaignRepository(audience, false);
  await repository.execute(
    { userId: 'admin', sessionId: 's', factorAgeSeconds: 0 },
    {
      operation: 'adminActOnNotificationCampaign',
      params: { campaignId: claim.id },
      body: { action: 'cancel', expectedVersion: 1 },
      idempotencyKey: 'update-campaign-cancel-1',
      requestId: 'r1',
    },
  );
  expect(statements.some(({ sql }) => sql.includes('execute_engagement_command'))).toBe(true);
});

it.each([
  { published: false, stored: audience },
  { published: true, stored: { ...audience, appUpdate: { ...release, versionCode: 139 } } },
  { published: true, stored: { ...audience, appUpdate: { ...release, extra: true } } },
])('cancels invalid expansion safely instead of enqueueing %j', async ({ published, stored }) => {
  const { repository, statements } = campaignRepository(stored, published);
  await expect(repository.expandCampaigns(10)).resolves.toBe(0);
  expect(statements.some(({ sql }) => sql.includes("status='cancelled'"))).toBe(true);
  expect(
    statements.some(({ sql }) => sql.includes('insert into private.notification_deliveries')),
  ).toBe(false);
});

it('binds expansion to the published release and preserves database replay/keyset guards', async () => {
  const { repository, statements } = campaignRepository();
  await expect(repository.expandCampaigns(10)).resolves.toBe(1);
  const insert = required(
    statements.find(({ sql }) => sql.includes('insert into private.notification_deliveries')),
  );
  expect(insert.values).toEqual(
    expect.arrayContaining([
      release.version,
      release.versionCode,
      JSON.stringify({ route: 'app_update', appUpdate: release }),
    ]),
  );
  expect(insert.sql).toContain('on conflict do nothing');
  expect(insert.sql).toContain('p.id>coalesce((select max(existing.user_id)');
  expect(insert.sql).toContain('not exists(select 1 from private.notification_deliveries');
  expect(insert.sql).toContain("u.platform='android'");
  expect(insert.sql).toContain('u.revoked_at is null');
  expect(insert.sql).toContain('app_version');
  expect(insert.sql).toContain("prior.rendered_data->'appUpdate'=($12::jsonb)->'appUpdate'");
  const lock = statements.findIndex(({ sql }) => sql.includes('pg_advisory_xact_lock'));
  expect(lock).toBeGreaterThan(-1);
  expect(lock).toBeLessThan(statements.indexOf(insert));
  expect(statements[lock]?.values).toEqual(['android-update:1.0.1:140']);
});

it('requires a published push template and preserves the aggregate preview without broadening device access', async () => {
  const bad = campaignRepository(audience, true, 'email');
  await expect(
    bad.repository.execute(
      { userId: 'admin', sessionId: 's', factorAgeSeconds: 0 },
      {
        operation: 'adminCreateNotificationCampaign',
        body: { audience, templateId: claim.id },
        idempotencyKey: 'update-campaign-create-1',
        requestId: 'r1',
      },
    ),
  ).rejects.toMatchObject({ response: { code: 'APP_UPDATE_PUSH_REQUIRED' }, status: 400 });
  const good = campaignRepository();
  const result = await good.repository.execute(
    { userId: 'admin', sessionId: 's', factorAgeSeconds: 0 },
    {
      operation: 'adminPreviewNotificationAudience',
      body: audience,
      idempotencyKey: 'update-campaign-preview-1',
      requestId: 'r1',
    },
  );
  expect(result).toMatchObject({ eligible: 99 });
  expect(good.statements.some(({ sql }) => sql.includes('from public.user_devices'))).toBe(false);
});
