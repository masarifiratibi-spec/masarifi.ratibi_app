import { createHash, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { defaultSnapshot, discoverNominalTrackingMessage } from '@masarifi/transaction-parser';
import { LedgerRepository } from '../../../src/ledger/ledger.repository';
import { LedgerService } from '../../../src/ledger/ledger.service';
import { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import { SecurityRepository } from '../../../src/security/security.repository';
import { normalizeNormalizedImport } from '../../../src/tracking/tracking.dto';
import { TrackingRepository } from '../../../src/tracking/tracking.repository';
import { TrackingWorker } from '../../../src/tracking/tracking.worker';
import { PoolService } from '../../../src/platform/database/pool.service';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('DEV financial content authority and correspondence', () => {
  const pool = createLivePool(),
    repository = new TrackingRepository(pool);
  const ledger = new LedgerService(
    new LedgerRepository(pool),
    new SecurityRepository(pool),
    new PlatformConfigService(new ConfigService() as never),
  );
  const worker = new TrackingWorker(repository, ledger, {} as never);
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  let owner: string, account: string, device: string, boundary: number;
  const principal = () => ({ userId: owner, sessionId: 'content-fixture', factorAgeSeconds: 0 });
  beforeEach(async () => {
    owner = 'content_' + randomUUID();
    account = randomUUID();
    device = randomUUID();
    boundary = Date.now() - 30000;
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [owner]);
    await pool.query(
      "insert into public.accounts(id,user_id,name,type,currency_code,is_default,automatic_tracking_enabled) values($1,$2,'Synthetic default','cash','SAR',true,true)",
      [account, owner],
    );
    await repository.getPreferences(principal());
    await pool.query(
      'update public.tracking_preferences set enabled=true,review_required=false where user_id=$1',
      [owner],
    );
    await pool.query(
      "insert into private.tracking_automatic_cohorts(user_id,device_id,release_id,engine_version,expires_at,reason) select $1,$2,release_id,'2.0.0',clock_timestamp()+interval '1 hour','Disposable content fixture' from public.tracking_rule_channels where environment='default' and market='global' and channel='all'",
      [owner, device],
    );
    // Before the additive migration, admission must still fail: this is the RED baseline.
    const installed = (
      await pool.query<{ installed: boolean }>(
        "select exists(select 1 from information_schema.columns where table_schema='private' and table_name='tracking_automatic_cohorts' and column_name='source_admission_policy') installed",
      )
    ).rows[0]?.installed;
    if (installed)
      await pool.query(
        "update private.tracking_automatic_cohorts set source_admission_policy='financial_content_v1',capture_started_at=to_timestamp($2::double precision/1000) where user_id=$1",
        [owner, boundary],
      );
  });
  afterAll(async () => {
    await worker.stop();
    await pool.onModuleDestroy();
  });
  async function capture(
    options: {
      text?: string;
      channel?: 'android_sms' | 'android_notification';
      sender?: string;
      device?: string;
      reference?: string;
      native?: string;
      receivedAt?: number;
      marker?: boolean;
    } = {},
    execution = worker,
  ) {
    const text = options.text ?? 'Paid SAR2 reference CONTENT12345',
      channel = options.channel ?? 'android_sms';
    const sender =
      options.sender ?? (channel === 'android_sms' ? '+966500000099' : 'com.synthetic.payment');
    const received = options.receivedAt ?? Date.now(),
      native = options.native ?? randomUUID();
    const config = await repository.ruleSnapshot(principal());
    const parsed = discoverNominalTrackingMessage(
      { text, sender, channel, receivedAt: received },
      defaultSnapshot,
      [],
      [],
      { sourceAdmissionPolicy: 'financial_content_v1' },
    );
    const { providerReference, originalProviderReference, ...classification } =
      parsed.classification;
    void providerReference;
    void originalProviderReference;
    const command = normalizeNormalizedImport({
      schemaVersion: 3,
      sourceType: channel === 'android_sms' ? 'sms' : 'provider',
      sourceChannel: channel,
      events: [
        {
          accountingPolicy: 'default_account_nominal_v1',
          sourceAmountDecimal: parsed.sourceAmountDecimal,
          activatedAt: new Date(boundary - 60000).toISOString(),
          sourceItemKey: hash(`${native}|${text}|${String(received)}`),
          sender,
          receivedAt: new Date(received).toISOString(),
          occurredAt: classification.occurredAt,
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
            deviceId: options.device ?? device,
            channel,
            nativeIdDigest: hash(native),
            revisionDigest: hash(text),
          },
          metadata: {
            ruleConfigurationRevision: config.configurationRevision,
            ...(options.marker === false ? {} : { sourceAdmissionPolicy: 'financial_content_v1' }),
            ...(channel === 'android_notification' ? { sourcePackage: sender } : {}),
            ...(options.reference ? { referenceScheme: 'plain-v2' } : {}),
          },
          ...(options.reference ? { providerReferenceDigest: hash(options.reference) } : {}),
        },
      ],
    });
    const response = await repository.createImport(principal(), command, {
      sourceName: null,
      key: randomUUID(),
      requestId: randomUUID(),
    });
    const id = String((response.resource as Record<string, unknown>).id);
    await execution.runJob('import.parse');
    return id;
  }
  async function effects() {
    return (
      await pool.query<{
        id: string;
        kind: string;
        amount: string;
        currency: string;
        category: string | null;
        effect: string;
        account: string;
      }>(
        'select t.id,t.kind,t.amount_minor::text amount,btrim(t.currency_code) currency,t.category_id::text category,p.amount_minor::text effect,p.account_id::text account from public.transactions t join public.transaction_postings p on p.transaction_id=t.id where t.user_id=$1 order by t.id',
        [owner],
      )
    ).rows;
  }
  it('posts personal SMS through the existing cash default and Shopping', async () => {
    await capture();
    expect(await effects()).toEqual([
      expect.objectContaining({
        kind: 'expense',
        amount: '200',
        effect: '-200',
        account,
        currency: 'SAR',
        category: '04000000-0000-4000-8000-000000000006',
      }),
    ]);
  });
  it.each([undefined, 100])(
    'preserves posting and recent-auth threshold %s with the real worker role',
    async (threshold) => {
      const login = 'tracking_worker_' + randomUUID().replaceAll('-', '');
      const password = randomUUID();
      const roleSql = (
        await pool.query(
          "select format('create role %I login noinherit password %L', $1::text,$2::text) sql",
          [login, password],
        )
      ).rows[0]?.sql as string;
      await pool.query(roleSql);
      await pool.query(`grant masarifi_worker to ${login} with set true,inherit false`);
      const runtimePool = new PoolService({
        get: (key: string) => {
          if (key === 'DATABASE_URL') {
            const url = new URL(String(process.env.DATABASE_URL));
            url.username = login;
            url.password = password;
            return url.toString();
          }
          if (key === 'MASARIFI_DATABASE_POOL_MAX') return 2;
          if (key === 'MASARIFI_PROCESS_KIND') return 'worker';
          throw new Error('UNEXPECTED_CONFIG_KEY');
        },
      } as never);
      const runtimeRepository = new TrackingRepository(runtimePool);
      const runtimeWorker = new TrackingWorker(
        runtimeRepository,
        new LedgerService(
          new LedgerRepository(runtimePool),
          new SecurityRepository(runtimePool),
          new PlatformConfigService(
            new ConfigService({
              MASARIFI_LEDGER_RECENT_AUTH_THRESHOLDS:
                threshold === undefined ? {} : { SAR: threshold },
            }) as never,
          ),
        ),
        {} as never,
      );
      try {
        await pool.query(
          'select private.post_opening_transaction($1,$2::uuid,70000,$3,$4::timestamptz,$5)',
          [owner, account, 'Synthetic opening', new Date().toISOString(), 'account-opening'],
        );
        const permissions = await runtimePool.query(
          "select pg_has_role(session_user,'masarifi_api','SET') can_api",
        );
        expect(permissions.rows[0]?.can_api).toBe(false);
        const id = await capture({ text: 'Paid SAR1 reference WORKER12345' }, runtimeWorker);
        await runtimeWorker.runJob('import.parse');
        if (threshold !== undefined) {
          expect((await effects()).filter((row) => row.kind === 'expense')).toEqual([]);
          expect(
            (
              await pool.query(
                'select confirmed_minor::text value from public.account_balances where account_id=$1',
                [account],
              )
            ).rows[0]?.value,
          ).toBe('70000');
          expect(
            (
              await pool.query(
                "select normalized_payload->>'diagnosticReason' reason from public.import_items where session_id=$1",
                [id],
              )
            ).rows[0]?.reason,
          ).toBe('recent_auth_required');
          return;
        }
        expect((await effects()).filter((row) => row.kind === 'expense')).toEqual([
          expect.objectContaining({ amount: '100', effect: '-100', account }),
        ]);
        expect(
          (
            await pool.query(
              'select confirmed_minor::text value from public.account_balances where account_id=$1',
              [account],
            )
          ).rows[0]?.value,
        ).toBe('69900');
        expect(
          (
            await pool.query(
              'select status,accepted_count from public.import_sessions where id=$1',
              [id],
            )
          ).rows[0],
        ).toMatchObject({ status: 'complete', accepted_count: 1 });
      } finally {
        await runtimeWorker.stop();
        await runtimePool.onModuleDestroy();
        await pool.query(`drop role ${login}`);
      }
    },
  );
  it('returns broader policy only for the exact active owner device', async () => {
    expect(await repository.ruleSnapshot(principal(), device)).toMatchObject({
      sourceAdmissionPolicy: 'financial_content_v1',
      policyActivatedAt: boundary,
    });
    expect(await repository.ruleSnapshot(principal(), randomUUID())).not.toHaveProperty(
      'sourceAdmissionPolicy',
    );
    expect(await repository.ruleSnapshot(principal())).not.toHaveProperty('sourceAdmissionPolicy');
    await pool.query(
      "update private.tracking_automatic_cohorts set expires_at=clock_timestamp()-interval '1 second' where user_id=$1",
      [owner],
    );
    expect(await repository.ruleSnapshot(principal(), device)).not.toHaveProperty(
      'sourceAdmissionPolicy',
    );
  });
  it.each([
    'other-device',
    'expired',
    'disabled',
    'missing-marker',
    'historical',
    'chat',
    'source-block',
  ])('rejects %s without creating ledger effects', async (scenario) => {
    if (scenario === 'expired')
      await pool.query(
        "update private.tracking_automatic_cohorts set expires_at=clock_timestamp()-interval '1 second' where user_id=$1",
        [owner],
      );
    if (scenario === 'disabled')
      await pool.query(
        'update private.tracking_automatic_cohorts set enabled=false where user_id=$1',
        [owner],
      );
    if (scenario === 'source-block')
      await pool.query(
        "insert into public.user_sender_rules(user_id,sender_pattern,display_label,enabled,trusted) values($1,'+966500000099','Explicit exclusion',false,false)",
        [owner],
      );
    await capture({
      ...(scenario === 'other-device' ? { device: randomUUID() } : {}),
      ...(scenario === 'missing-marker' ? { marker: false } : {}),
      ...(scenario === 'historical' ? { receivedAt: boundary - 1 } : {}),
      ...(scenario === 'chat' ? { channel: 'android_notification', sender: 'com.whatsapp' } : {}),
    });
    expect(await effects()).toEqual([]);
    expect(
      (
        await pool.query('select count(*)::int n from public.review_items where user_id=$1', [
          owner,
        ])
      ).rows[0]?.n,
    ).toBe(0);
  });
  it('posts notification income without assigning Shopping', async () => {
    await capture({ text: 'Deposit EGP3', channel: 'android_notification' });
    expect(await effects()).toEqual([
      expect.objectContaining({ kind: 'income', effect: '300', currency: 'SAR', category: null }),
    ]);
  });
  it('never replays a legacy trusted capture through a new content cohort', async () => {
    await pool.query(
      "insert into public.user_sender_rules(user_id,sender_pattern,display_label,enabled,trusted) values($1,'FINANCE','Existing source',true,true)",
      [owner],
    );
    await capture({ sender: 'FINANCE', receivedAt: boundary - 1, marker: false });
    await capture({ sender: 'FINANCE', marker: false });
    expect(await effects()).toEqual([]);
  });
  it.each(['org.thoughtcrime.securesms', 'com.viber.voip', 'com.Slack', 'com.microsoft.teams'])(
    'blocks financial wording from chat package %s',
    async (sender) => {
      await capture({ channel: 'android_notification', sender });
      expect(await effects()).toEqual([]);
    },
  );
  it('keeps local reference collisions from unrelated SMS sources separate', async () => {
    await capture({ sender: '+966500000001', reference: 'local123' });
    await capture({ sender: '+966500000002', reference: 'local123' });
    expect(await effects()).toHaveLength(2);
  });
  it.each(['android_sms', 'android_notification'] as const)(
    'links the saved %s and its opposite-channel receipt without another posting',
    async (firstChannel) => {
      const reference = 'one-content-movement';
      await capture({ channel: firstChannel, reference });
      const before = await effects();
      const second = await capture({
        channel: firstChannel === 'android_sms' ? 'android_notification' : 'android_sms',
        reference,
      });
      expect(await effects()).toEqual(before);
      expect(
        (
          await pool.query('select status,accepted_count from public.import_sessions where id=$1', [
            second,
          ])
        ).rows[0],
      ).toMatchObject({ status: 'complete', accepted_count: 1 });
      const items = (
        await pool.query<{
          status: string;
          transaction_id: string;
          canonical_identity_hash: string;
          correlation: Record<string, unknown> | null;
        }>(
          "select status,transaction_id,canonical_identity_hash,normalized_payload->'correlation' correlation from public.import_items where user_id=$1 order by created_at,id",
          [owner],
        )
      ).rows;
      expect(items.map((item) => item.status)).toEqual(['accepted', 'accepted']);
      expect(new Set(items.map((item) => item.transaction_id)).size).toBe(1);
      expect(items[1]?.canonical_identity_hash).not.toBe(items[0]?.canonical_identity_hash);
      expect(items[1]?.correlation).toMatchObject({
        scheme: 'content-reference-v1',
        transactionId: before[0]?.id,
      });
      const notices = (
        await pool.query<{ id: string; data: Record<string, unknown> }>(
          "select n.id,n.data from public.notification_events n where n.user_id=$1 and n.data->>'targetId'=$2",
          [owner, before[0]?.id],
        )
      ).rows;
      expect(notices).toHaveLength(1);
      expect(notices[0]?.data).toMatchObject({
        automaticCapture: true,
        targetKind: 'transaction',
        targetId: before[0]?.id,
      });
      expect(
        (
          await pool.query(
            'select count(*)::int n from private.notification_deliveries where user_id=$1',
            [owner],
          )
        ).rows[0]?.n,
      ).toBe(0);
    },
  );
  it('recovers an already deferred SMS while preserving its original reservation identity', async () => {
    boundary = Date.now() - 120000;
    await pool.query(
      'update private.tracking_automatic_cohorts set capture_started_at=to_timestamp($2::double precision/1000) where user_id=$1',
      [owner, boundary],
    );
    const receivedAt = Date.now();
    await capture({
      channel: 'android_notification',
      reference: 'retained-pair',
      receivedAt,
      text: 'تم دفع 2 ريال لدى متجر الاختبار، الرقم المرجعي CONTENT12345',
    });
    await capture({ reference: 'unrelated-pending', marker: false }, {
      runJob: () => Promise.resolve(0),
    } as never);
    const second = await capture(
      {
        reference: 'retained-pair',
        receivedAt: receivedAt - 40000,
        text: 'تم دفع 2 ريال، الرقم المرجعي CONTENT12345',
      },
      {
        runJob: () => Promise.resolve(0),
      } as never,
    );
    const claim = await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        // Claim only this fixture; unrelated pending imports must keep their
        // leases and ordering when the whole integration suite shares a DB.
        await client.query('select id from public.import_sessions where id<>$1 for update', [
          second,
        ]);
        return (await repository.claimImports('retained-fixture')).find(
          (entry) => entry.id === second,
        );
      } finally {
        await client.query('rollback');
      }
    });
    if (!claim) throw new Error('Retained fixture was not claimed');
    await repository.prepareImport(claim.id, claim.claim_token);
    const oldName = (
      await pool.query(
        "select case when to_regprocedure('private.finalize_import_session_before_content_reference(uuid,uuid)') is null then 'private.finalize_import_session' else 'private.finalize_import_session_before_content_reference' end name",
      )
    ).rows[0]?.name as string;
    await pool.query(`select ${oldName}($1::uuid,$2::uuid)`, [claim.id, claim.claim_token]);
    await repository.completeImport(
      claim.id,
      claim.claim_token,
      'failed',
      'TRACKING_CAPTURE_DEFERRED',
    );
    const original = (
      await pool.query(
        'select canonical_identity_hash,source_item_key from public.import_items where session_id=$1',
        [second],
      )
    ).rows[0];
    const before = await effects();
    await pool.query(
      'update public.import_sessions set next_attempt_at=clock_timestamp() where id=$1',
      [second],
    );
    await worker.runJob('import.parse');
    expect(await effects()).toEqual(before);
    expect(
      (
        await pool.query('select status,accepted_count from public.import_sessions where id=$1', [
          second,
        ])
      ).rows[0],
    ).toMatchObject({ status: 'complete', accepted_count: 1 });
    expect(
      (
        await pool.query(
          'select canonical_identity_hash,source_item_key from public.import_items where session_id=$1',
          [second],
        )
      ).rows[0],
    ).toEqual(original);
  });
  it('serializes concurrent unlinked channels to one effect and two accepted observations', async () => {
    const paused = { runJob: () => Promise.resolve(0) } as never;
    await capture({ reference: 'concurrent-content' }, paused);
    await capture({ reference: 'concurrent-content', channel: 'android_notification' }, paused);
    const other = new TrackingWorker(repository, ledger, {} as never);
    try {
      await Promise.all([worker.runJob('import.parse'), other.runJob('import.parse')]);
      await pool.query(
        "update public.import_sessions set next_attempt_at=clock_timestamp() where user_id=$1 and status='received'",
        [owner],
      );
      await worker.runJob('import.parse');
      expect(await effects()).toHaveLength(1);
      expect(
        (
          await pool.query(
            "select count(*)::int n from public.import_items where user_id=$1 and status='accepted'",
            [owner],
          )
        ).rows[0]?.n,
      ).toBe(2);
    } finally {
      await other.stop();
    }
  });
  it.each([
    ['Paid EGP2', 'Paid SAR2'],
    ['تم دفع 2 ريال لدى متجر ألف', 'تم دفع 2 ريال لدى متجر باء'],
  ])('holds contradictory source evidence: %s versus %s', async (first, second) => {
    await capture({
      channel: 'android_notification',
      text: first,
      reference: 'conflicting-evidence',
    });
    const before = await effects();
    expect(before).toHaveLength(1);
    const id = await capture({ text: second, reference: 'conflicting-evidence' });
    expect(await effects()).toEqual(before);
    expect(
      (
        await pool.query('select accepted_count,status from public.import_sessions where id=$1', [
          id,
        ])
      ).rows[0],
    ).toMatchObject({ accepted_count: 0, status: 'received' });
  });
  it('does not choose between two independent opposite-channel effects sharing a reference', async () => {
    await capture({
      channel: 'android_notification',
      sender: 'com.synthetic.first',
      reference: 'collision',
    });
    await capture({
      channel: 'android_notification',
      sender: 'com.synthetic.second',
      reference: 'collision',
    });
    const before = await effects();
    expect(before).toHaveLength(2);
    const id = await capture({ reference: 'collision' });
    expect(await effects()).toEqual(before);
    expect(
      (await pool.query('select accepted_count from public.import_sessions where id=$1', [id]))
        .rows[0]?.accepted_count,
    ).toBe(0);
  });
  it.each([
    'Payment SAR3 reference CONTENT12345',
    'Paid SAR2 reference CONTENT12345; Balance SAR999',
  ])('keeps a reference-bearing revision immutable: %s', async (text) => {
    const receivedAt = Date.now();
    await capture({
      channel: 'android_notification',
      reference: 'slot-ref',
      native: 'stable-slot',
      receivedAt,
    });
    const before = await effects();
    await capture({
      channel: 'android_notification',
      reference: 'slot-ref',
      native: 'stable-slot',
      receivedAt: receivedAt + 1,
      text,
    });
    expect(await effects()).toEqual(before);
  });
  it('commits once for concurrently linked SMS and notification observations', async () => {
    await pool.query(
      "insert into public.user_sender_rules(user_id,sender_pattern,display_label,trusted,enabled,institution_id) select $1,identity,'Synthetic proven institution',true,true,(select id from public.financial_institutions where active limit 1) from unnest(array['+966500000099','com.synthetic.payment']) identity",
      [owner],
    );
    await Promise.all([
      capture({ reference: 'one-movement' }),
      capture({ reference: 'one-movement', channel: 'android_notification' }),
    ]);
    // A secondary claimant may wait for the primary's ledger commit. Exercise
    // its scheduled retry without waiting for the fixture's wall-clock backoff.
    await pool.query(
      "update public.import_sessions set next_attempt_at=clock_timestamp() where user_id=$1 and status='received'",
      [owner],
    );
    await worker.runJob('import.parse');
    expect(await effects()).toHaveLength(1);
    expect(
      (
        await pool.query(
          "select count(*)::int n from public.import_items where user_id=$1 and status='accepted'",
          [owner],
        )
      ).rows[0]?.n,
    ).toBe(2);
    expect(
      (
        await pool.query(
          'select confirmed_minor::text balance from public.account_balances where account_id=$1',
          [account],
        )
      ).rows[0]?.balance,
    ).toBe('-200');
  });
  it('keeps independent equal events and opposite directions separate', async () => {
    await capture({ reference: 'ref-a' });
    await capture({ reference: 'ref-b' });
    await capture({ reference: 'ref-a', text: 'Deposit SAR2 reference CONTENT12345' });
    expect(await effects()).toHaveLength(3);
  });
  it('holds ambiguous opposite-channel correspondence internally', async () => {
    await capture();
    await capture({ channel: 'android_notification', text: 'Payment SAR2' });
    expect(await effects()).toHaveLength(1);
  });
  it('reuses immutable postings after a lost response', async () => {
    const paused = { runJob: () => Promise.resolve(0) } as never;
    await capture({ reference: 'independent-response' }, paused);
    const id = await capture({ reference: 'response-loss' }, paused);
    const item = (
      await pool.query<{ id: string }>('select id from public.import_items where session_id=$1', [
        id,
      ])
    ).rows[0];
    if (!item) throw new Error('Response-loss fixture was not created');
    const original = repository.commitNominalCapture.bind(repository);
    let responseLost = false;
    const lost = jest
      .spyOn(repository, 'commitNominalCapture')
      .mockImplementation(async (itemId, fence) => {
        const saved = await original(itemId, fence);
        if (itemId === item.id && !responseLost) {
          responseLost = true;
          throw new Error('FIXTURE_RESPONSE_LOST');
        }
        return saved;
      });
    try {
      await worker.runJob('import.parse');
    } finally {
      lost.mockRestore();
    }
    expect(responseLost).toBe(true);
    const before = await effects();
    expect(before).toHaveLength(2);
    expect(
      (await pool.query('select status from public.import_sessions where id=$1', [id])).rows[0]
        ?.status,
    ).toBe('received');
    await pool.query(
      'update public.import_sessions set next_attempt_at=clock_timestamp() where id=$1',
      [id],
    );
    await worker.runJob('import.parse');
    expect(await effects()).toEqual(before);
    expect(
      (
        await pool.query('select status,accepted_count from public.import_sessions where id=$1', [
          id,
        ])
      ).rows[0],
    ).toMatchObject({ status: 'complete', accepted_count: 1 });
  });
});
