import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { defaultSnapshot, discoverNominalTrackingMessage } from '@masarifi/transaction-parser';
import { normalizeNormalizedImport } from '../../../src/tracking/tracking.dto';
import { TrackingRepository } from '../../../src/tracking/tracking.repository';
import { createLivePool, describeLiveDatabase, withFixtureImportWork } from '../../live-database';

type Sources = {
  smsEnabled: boolean;
  notificationEnabled: boolean;
  smsActivatedAt: string | null;
  smsActivationId: string | null;
  notificationActivatedAt: string | null;
};
type Configuration = {
  installation: {
    deviceId: string;
    version: number;
    generation: string;
    sessionBinding: string;
    sources: Sources;
    captureAllowed: boolean;
  };
  configurationAvailable: boolean;
  rolloutMode?: string;
  sourceAdmissionPolicy?: string;
  smsActivatedAt?: number;
  notificationActivatedAt?: number;
};

describeLiveDatabase('production installation explicit source consent', () => {
  const pool = createLivePool();
  const repository = new TrackingRepository(pool);
  let owner: string, deviceId: string, registered: string;
  const sessionId = 'synthetic-production-consent-session';
  const principal = () => ({ userId: owner, sessionId, factorAgeSeconds: 0 });
  const disabled = (): Sources => ({
    smsEnabled: false,
    notificationEnabled: false,
    smsActivatedAt: null,
    smsActivationId: null,
    notificationActivatedAt: null,
  });
  const enabled = (): Sources => ({
    ...disabled(),
    smsEnabled: true,
    smsActivatedAt: '2026-01-01T00:00:00.000Z',
    smsActivationId: '42',
  });
  const consent = async (sources = enabled(), expectedVersion = 0, device = registered) =>
    (await repository.updateInstallationConsent(principal(), {
      deviceId,
      notificationDeviceId: device,
      expectedVersion,
      sources,
    })) as unknown as Configuration;

  beforeEach(async () => {
    owner = `production_consent_${randomUUID()}`;
    deviceId = 'a' + randomUUID().slice(1);
    registered = randomUUID();
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [owner]);
    await pool.query(
      "insert into public.accounts(id,user_id,name,type,currency_code,is_default,automatic_tracking_enabled) values($1,$2,'Synthetic production consent account','cash','SAR',true,true)",
      [randomUUID(), owner],
    );
    await repository.getPreferences(principal());
    await pool.query(
      'update public.tracking_preferences set enabled=true,review_required=false where user_id=$1',
      [owner],
    );
    await pool.query(
      "insert into public.user_devices(id,user_id,device_fingerprint,clerk_session_id,platform,app_version) values($1,$2,$3,$4,'android','1.0.0')",
      [registered, owner, `h1:${createHash('sha256').update(registered).digest('hex')}`, sessionId],
    );
  });
  afterAll(async () => pool.onModuleDestroy());

  it('grants only explicit consent, clamps delayed activation to server acceptance and returns a stable retry receipt', async () => {
    const before = Date.now();
    const command = enabled();
    const first = await consent(command);
    expect(first).toMatchObject({
      configurationAvailable: true,
      sourceAdmissionPolicy: 'financial_content_v1',
      installation: {
        deviceId,
        version: 1,
        captureAllowed: true,
        sources: { smsEnabled: true, smsActivationId: '42', notificationEnabled: false },
      },
    });
    expect(first.installation.generation).toMatch(/^[a-f0-9-]{36}$/);
    expect(first.installation.sessionBinding).toBe(
      createHash('sha256')
        .update(`masarifi:tracking:session:v1:${owner}:${sessionId}`)
        .digest('hex'),
    );
    expect(Date.parse(first.installation.sources.smsActivatedAt ?? '')).toBeGreaterThanOrEqual(
      before,
    );
    expect(await consent(command)).toEqual(first);
  });
  it('keeps reads free of production enrollment', async () => {
    await repository.ruleSnapshot(principal(), deviceId);
    const count = await pool.query<{ n: number }>(
      'select count(*)::int n from private.tracking_installations where user_id=$1',
      [owner],
    );
    expect(count.rows[0]?.n).toBe(0);
  });
  it('returns only numeric enabled-source optional boundary fields in the public configuration', async () => {
    const config = await consent({
      ...disabled(),
      notificationEnabled: true,
      notificationActivatedAt: '2026-01-01T00:00:00Z',
    });
    expect(config).not.toHaveProperty('smsActivatedAt');
    expect(config.notificationActivatedAt).toEqual(expect.any(Number));
  });
  it('recognizes UUID case aliases without exposing legacy authority or changing stored IDs', async () => {
    const config = await consent();
    const off = await consent(disabled(), 1);
    const read = await repository.ruleSnapshot(principal(), deviceId.toUpperCase());
    expect(read).toHaveProperty('installation.version', off.installation.version);
    expect(read).toHaveProperty('installation.captureAllowed', false);
    const command = await captureCommand(config, { proof: false });
    const event = command.events[0];
    if (!event?.transport) throw new Error('Expected captured transport');
    event.transport.deviceId = deviceId.toUpperCase();
    await expect(submit(command)).rejects.toMatchObject({ status: 409 });
    expect(
      ((await repository.ruleSnapshot(principal(), deviceId)) as unknown as Configuration)
        .installation.deviceId,
    ).toBe(deviceId);
  });
  it('rejects a case-aliased legacy submission for a production-managed UUID', async () => {
    const config = await consent();
    await consent(disabled(), 1);
    const command = await captureCommand(config, { proof: false });
    const event = command.events[0];
    if (!event?.transport) throw new Error('Expected captured transport');
    event.transport.deviceId = deviceId.toUpperCase();
    await expect(submit(command)).rejects.toMatchObject({ status: 409 });
  });
  it('rotates on disable and re-enable while retaining the old accepted boundary in its retry receipt', async () => {
    const first = await consent();
    const off = await consent(disabled(), 1);
    expect(off.installation).toMatchObject({
      version: 2,
      captureAllowed: false,
      sources: disabled(),
    });
    expect(off.installation.generation).not.toBe(first.installation.generation);
    expect(await consent(disabled(), 1)).toEqual(off);
    const next = await consent(enabled(), 2);
    expect(next.installation.version).toBe(3);
    expect(next.installation.generation).not.toBe(off.installation.generation);
    expect(Date.parse(next.installation.sources.smsActivatedAt ?? '')).toBeGreaterThanOrEqual(
      Date.parse(first.installation.sources.smsActivatedAt ?? ''),
    );
    await expect(consent(enabled(), 0)).rejects.toMatchObject({ status: 409 });
  });
  it('captures in review-all while leaving automatic posting disabled', async () => {
    await pool.query(
      'update public.tracking_preferences set review_required=true where user_id=$1',
      [owner],
    );
    const result = await consent();
    expect(result).toMatchObject({ rolloutMode: 'review', installation: { captureAllowed: true } });
  });
  it('rejects enable while paused but still commits a disable', async () => {
    await consent();
    await pool.query('update public.tracking_preferences set enabled=false where user_id=$1', [
      owner,
    ]);
    await expect(consent(enabled(), 1)).rejects.toMatchObject({ status: 409 });
    const current = (await repository.ruleSnapshot(
      principal(),
      deviceId,
    )) as unknown as Configuration;
    expect(current.installation.captureAllowed).toBe(false);
    const result = await consent(disabled(), current.installation.version);
    expect(result.installation.captureAllowed).toBe(false);
  });
  it.each(['foreign', 'revoked', 'different-session', 'ios'] as const)(
    'rejects a %s registered device without creating consent',
    async (kind) => {
      if (kind === 'foreign') {
        const other = `production_foreign_${randomUUID()}`;
        await pool.query("insert into public.profiles(id,status) values($1,'active')", [other]);
        await pool.query('update public.user_devices set user_id=$2 where id=$1', [
          registered,
          other,
        ]);
      } else if (kind === 'revoked') {
        await pool.query(
          'update public.user_devices set revoked_at=clock_timestamp() where id=$1',
          [registered],
        );
      } else if (kind === 'different-session') {
        await pool.query(
          "update public.user_devices set clerk_session_id='foreign-session' where id=$1",
          [registered],
        );
      } else {
        await pool.query("update public.user_devices set platform='ios' where id=$1", [registered]);
      }
      await expect(consent()).rejects.toMatchObject({ status: 404 });
    },
  );
  it('serializes competing create commands instead of silently replacing consent', async () => {
    const results = await Promise.allSettled([consent(enabled()), consent(disabled())]);
    expect(results.filter((value) => value.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((value) => value.status === 'rejected');
    expect(failed).toMatchObject({ status: 'rejected', reason: { status: 409 } });
  });
  it('revokes permanently when the SDK device binding changes, even if the old binding later returns', async () => {
    const first = await consent();
    await pool.query(
      "update public.user_devices set clerk_session_id='new-sdk-session' where id=$1",
      [registered],
    );
    await pool.query('update public.user_devices set clerk_session_id=$2 where id=$1', [
      registered,
      sessionId,
    ]);
    const current = (await repository.ruleSnapshot(
      principal(),
      deviceId,
    )) as unknown as Configuration;
    expect(current.installation.captureAllowed).toBe(false);
    expect(current.installation.generation).not.toBe(first.installation.generation);
    const approved = await consent(enabled(), current.installation.version);
    expect(approved.installation.captureAllowed).toBe(true);
  });
  it('commits revocation with a metadata-only receipt when published rules are unavailable', async () => {
    await consent();
    const channel = (
      await pool.query<{
        environment: string;
        market: string;
        channel: string;
        release_id: string;
        version: string;
        mode: string;
        updated_at: Date;
      }>(
        "delete from public.tracking_rule_channels where environment='default' and market='global' and channel='all' returning *",
      )
    ).rows[0];
    if (!channel) throw new Error('Expected synthetic published channel');
    try {
      const off = await consent(disabled(), 1);
      expect(off).toMatchObject({
        configurationAvailable: false,
        installation: { version: 2, captureAllowed: false },
      });
      const retry = await consent(disabled(), 1);
      expect(retry).toEqual(off);
      await expect(consent(enabled(), 2)).rejects.toThrow('TRACKING_RULES_UNAVAILABLE');
    } finally {
      await pool.query(
        'insert into public.tracking_rule_channels(environment,market,channel,release_id,version,mode,updated_at) values($1,$2,$3,$4,$5,$6,$7)',
        [
          channel.environment,
          channel.market,
          channel.channel,
          channel.release_id,
          channel.version,
          channel.mode,
          channel.updated_at,
        ],
      );
    }
  });
  it('denies runtime roles direct metadata access', async () => {
    await consent();
    for (const role of ['masarifi_api', 'masarifi_worker', 'anon', 'authenticated']) {
      await pool.withClient(async (client: PoolClient) => {
        await client.query('begin');
        try {
          await client.query(`set local role ${role}`);
          await expect(
            client.query('select * from private.tracking_installations'),
          ).rejects.toMatchObject({ code: '42501' });
        } finally {
          await client.query('rollback');
        }
      });
    }
  });

  it('allows profile suspension and requires fresh consent after reactivation', async () => {
    await consent();
    await pool.query("update public.profiles set status='suspended' where id=$1", [owner]);
    await pool.query("update public.profiles set status='active' where id=$1", [owner]);
    const config = (await repository.ruleSnapshot(
      principal(),
      deviceId,
    )) as unknown as Configuration;
    expect(config.installation.captureAllowed).toBe(false);
  });

  async function captureCommand(
    config: Configuration,
    changes: {
      proof?: boolean;
      generation?: string;
      version?: number;
      channel?: 'android_sms' | 'android_notification';
      receivedAt?: number;
      native?: string;
    } = {},
  ) {
    const receivedAt = changes.receivedAt ?? Date.now();
    const channel = changes.channel ?? 'android_sms';
    const text = 'Paid SAR2 reference PRODUCTION12345';
    const sender = channel === 'android_sms' ? '+966500000099' : 'com.synthetic.payment';
    const parsed = discoverNominalTrackingMessage(
      { text, sender, channel, receivedAt },
      defaultSnapshot,
      [],
      [],
      { sourceAdmissionPolicy: 'financial_content_v1' },
    );
    const { providerReference, originalProviderReference, ...classification } =
      parsed.classification;
    void providerReference;
    void originalProviderReference;
    const current = await repository.ruleSnapshot(principal(), deviceId);
    const native = changes.native ?? randomUUID();
    return normalizeNormalizedImport({
      schemaVersion: 3,
      sourceType: channel === 'android_sms' ? 'sms' : 'provider',
      sourceChannel: channel,
      events: [
        {
          accountingPolicy: 'default_account_nominal_v1',
          sourceAmountDecimal: parsed.sourceAmountDecimal,
          activatedAt: config.installation.sources.smsActivatedAt,
          sourceItemKey: native,
          sender,
          receivedAt: new Date(receivedAt).toISOString(),
          classification,
          ...(classification.amountMinor === null
            ? {}
            : {
                amountMinor:
                  classification.direction === 'incoming'
                    ? classification.amountMinor
                    : -classification.amountMinor,
              }),
          ...(classification.currency ? { currency: classification.currency } : {}),
          transport: {
            deviceId,
            channel,
            nativeIdDigest: createHash('sha256').update(native).digest('hex'),
            revisionDigest: createHash('sha256').update(text).digest('hex'),
            ...(changes.proof === false
              ? {}
              : {
                  installationGeneration: changes.generation ?? config.installation.generation,
                  installationVersion: changes.version ?? config.installation.version,
                }),
          },
          metadata: {
            sourceAdmissionPolicy: 'financial_content_v1',
            ruleConfigurationRevision: current.configurationRevision,
            ...(channel === 'android_notification' ? { sourcePackage: sender } : {}),
          },
        },
      ],
    });
  }
  async function submit(command: Awaited<ReturnType<typeof captureCommand>>) {
    const result = await repository.createImport(principal(), command, {
      sourceName: null,
      key: randomUUID(),
      requestId: randomUUID(),
    });
    return (result.resource as { id: string }).id;
  }
  it.each(['missing', 'generation', 'version', 'disabled-source'] as const)(
    'rejects %s capture proof on a production-managed installation',
    async (kind) => {
      const config = await consent();
      const command = await captureCommand(config, {
        ...(kind === 'missing' ? { proof: false } : {}),
        ...(kind === 'generation' ? { generation: randomUUID() } : {}),
        ...(kind === 'version' ? { version: 999 } : {}),
        ...(kind === 'disabled-source' ? { channel: 'android_notification' as const } : {}),
      });
      await expect(submit(command)).rejects.toMatchObject({ status: 409 });
    },
  );
  it('authorizes fresh production content without inserting a DEV cohort', async () => {
    const config = await consent();
    const session = await submit(await captureCommand(config));
    const claims = await withFixtureImportWork(pool, owner, () =>
      repository.claimImports('production-synthetic-worker'),
    );
    const claim = claims.find((item) => item.id === session);
    if (!claim) throw new Error('Expected own import lease');
    await repository.prepareImport(session, claim.claim_token);
    const finalized = await repository.finalizeImport(session, claim.claim_token);
    expect(finalized.autoItems).toHaveLength(1);
    expect(
      (
        await pool.query<{ n: number }>(
          'select count(*)::int n from private.tracking_automatic_cohorts where user_id=$1',
          [owner],
        )
      ).rows[0]?.n,
    ).toBe(0);
  });
  it('collects review-all content as an actionable owned review', async () => {
    await pool.query(
      'update public.tracking_preferences set review_required=true where user_id=$1',
      [owner],
    );
    const config = await consent();
    const session = await submit(await captureCommand(config));
    const claim = (
      await withFixtureImportWork(pool, owner, () =>
        repository.claimImports('production-review-worker'),
      )
    ).find((item) => item.id === session);
    if (!claim) throw new Error('Expected own import lease');
    await repository.prepareImport(session, claim.claim_token);
    const finalized = await repository.finalizeImport(session, claim.claim_token);
    expect(finalized.autoItems).toEqual([]);
    expect(
      (
        await pool.query<{ n: number }>(
          "select count(*)::int n from public.review_items where user_id=$1 and status='pending'",
          [owner],
        )
      ).rows[0]?.n,
    ).toBe(1);
  });

  async function preparedCapture(config: Configuration, native?: string) {
    const session = await submit(await captureCommand(config, { native }));
    const claim = (
      await withFixtureImportWork(pool, owner, () =>
        repository.claimImports('production-proof-worker'),
      )
    ).find((value) => value.id === session);
    if (!claim) throw new Error('Expected owned session lease');
    await repository.prepareImport(session, claim.claim_token);
    const item = (
      await pool.query<{ id: string }>('select id from public.import_items where session_id=$1', [
        session,
      ])
    ).rows[0];
    if (!item) throw new Error('Expected owned captured item');
    return { session, token: claim.claim_token, item: item.id };
  }
  it('commits one real ledger effect and returns its accepted receipt after revocation', async () => {
    const config = await consent();
    const work = await preparedCapture(config);
    const saved = await repository.commitNominalCapture(work.item, work.token);
    expect(saved).toMatchObject({ status: 'accepted' });
    await consent(disabled(), 1);
    expect(await repository.commitNominalCapture(work.item, work.token)).toEqual(saved);
    expect(
      (
        await pool.query<{ n: number }>(
          'select count(*)::int n from public.transactions where user_id=$1',
          [owner],
        )
      ).rows[0]?.n,
    ).toBe(1);
  });
  it('retains stale claimed payloads without allowing a worker or finalizer to post them', async () => {
    const config = await consent();
    const work = await preparedCapture(config);
    await repository.finalizeImport(work.session, work.token);
    const before = (
      await pool.query('select status,normalized_payload from public.import_items where id=$1', [
        work.item,
      ])
    ).rows;
    await consent(disabled(), 1);
    await expect(repository.finalizeImport(work.session, work.token)).rejects.toMatchObject({
      status: 409,
    });
    await expect(repository.commitNominalCapture(work.item, work.token)).rejects.toMatchObject({
      status: 409,
    });
    expect(
      (
        await pool.query('select status,normalized_payload from public.import_items where id=$1', [
          work.item,
        ])
      ).rows,
    ).toEqual(before);
    expect(
      (
        await pool.query<{ n: number }>(
          'select count(*)::int n from public.transactions where user_id=$1',
          [owner],
        )
      ).rows[0]?.n,
    ).toBe(0);
  });
  it('keeps the stable SMS native identity across generations without a second ledger effect', async () => {
    const first = await consent();
    const native = randomUUID();
    const one = await preparedCapture(first, native);
    const saved = await repository.commitNominalCapture(one.item, one.token);
    await consent(disabled(), 1);
    const next = await consent(enabled(), 2);
    const two = await preparedCapture(next, native);
    const repeated = await repository.commitNominalCapture(two.item, two.token);
    expect(repeated).toEqual(saved);
    expect(
      (
        await pool.query<{ n: number }>(
          'select count(*)::int n from public.transactions where user_id=$1',
          [owner],
        )
      ).rows[0]?.n,
    ).toBe(1);
  });
  it('suppresses legacy DEV fallback while preserving the DEV installation and cohort bytes', async () => {
    await repository.enrollInstallation(principal(), {
      deviceId,
      notificationDeviceId: registered,
      smsActivationId: '42',
      foreground: false,
      remindersEnabled: false,
      reminderLocale: 'en',
      reminderTimeZone: 'Asia/Riyadh',
    });
    const retained = async () =>
      (
        await pool.query(
          'select to_jsonb(d) installation,to_jsonb(c) cohort from private.dev_mobile_installations d join private.tracking_automatic_cohorts c on c.user_id=d.user_id and c.device_id=d.tracking_device_id where d.user_id=$1',
          [owner],
        )
      ).rows;
    const before = await retained();
    await consent(disabled());
    expect(
      (
        await pool.query<{ n: number }>(
          'select count(*)::int n from private.tracking_content_cohort($1,$2)',
          [owner, deviceId],
        )
      ).rows[0]?.n,
    ).toBe(0);
    expect(await retained()).toEqual(before);
  });
  it('rejects a pre-consent message even when it carries the current generation', async () => {
    const config = await consent();
    const old = {
      ...config,
      installation: {
        ...config.installation,
        sources: { ...config.installation.sources, smsActivatedAt: '2026-01-01T00:00:00Z' },
      },
    };
    const command = await captureCommand(old, { receivedAt: Date.parse('2026-01-01T01:00:00Z') });
    await expect(submit(command)).rejects.toMatchObject({ status: 409 });
  });
  it.each(['consent', 'device', 'preferences'] as const)(
    'serializes %s revocation with an already admitted in-flight capture',
    async (kind) => {
      const config = await consent();
      const command = await captureCommand(config);
      await pool.withClient(async (client) => {
        await client.query('begin');
        let revoked: Promise<unknown> | undefined;
        let finished = false;
        try {
          await client.query("select set_config('request.jwt.claims',$1,true)", [
            JSON.stringify({ role: 'authenticated', sub: owner, sid: sessionId }),
          ]);
          await client.query('set local role masarifi_api');
          await client.query('select private.create_import_session($1,$2,null,3,$3,$4::jsonb)', [
            owner,
            'sms',
            createHash('sha256').update(randomUUID()).digest('hex'),
            JSON.stringify(command.events),
          ]);
          revoked = (
            kind === 'consent'
              ? consent(disabled(), 1)
              : pool.query(
                  kind === 'device'
                    ? 'update public.user_devices set revoked_at=clock_timestamp() where id=$1'
                    : 'update public.tracking_preferences set enabled=false where user_id=$1',
                  [kind === 'device' ? registered : owner],
                )
          ).then((value) => {
            finished = true;
            return value;
          });
          let waiting = false;
          for (let attempt = 0; attempt < 30 && !waiting; attempt++) {
            waiting =
              (
                await pool.query<{ waiting: boolean }>(
                  "select exists(select 1 from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and wait_event_type='Lock') waiting",
                )
              ).rows[0]?.waiting === true;
            if (!waiting) await new Promise((resolve) => setTimeout(resolve, 10));
          }
          expect(waiting).toBe(true);
          expect(finished).toBe(false);
          await client.query('commit');
          await revoked;
          const current = (await repository.ruleSnapshot(
            principal(),
            deviceId,
          )) as unknown as Configuration;
          expect(current.installation.captureAllowed).toBe(false);
        } finally {
          await client.query('rollback');
          if (revoked) await revoked;
        }
      });
    },
  );
});
