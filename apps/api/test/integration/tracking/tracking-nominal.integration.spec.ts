import { createHash, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { discoverNominalTrackingMessage, defaultSnapshot } from '@masarifi/transaction-parser';
import { LedgerRepository } from '../../../src/ledger/ledger.repository';
import { LedgerService } from '../../../src/ledger/ledger.service';
import { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import { SecurityRepository } from '../../../src/security/security.repository';
import { normalizeNormalizedImport } from '../../../src/tracking/tracking.dto';
import { TrackingRepository } from '../../../src/tracking/tracking.repository';
import { TrackingWorker } from '../../../src/tracking/tracking.worker';
import { EngagementRepository } from '../../../src/engagement/engagement.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('nominal default-account tracking', () => {
  const pool = createLivePool(),
    repository = new TrackingRepository(pool);
  const ledger = new LedgerService(
    new LedgerRepository(pool),
    new SecurityRepository(pool),
    new PlatformConfigService(new ConfigService() as never),
  );
  const worker = new TrackingWorker(repository, ledger, {} as never);
  const hash = (text: string) => createHash('sha256').update(text).digest('hex');
  let owner: string, account: string;
  const principal = () => ({ userId: owner, sessionId: 'nominal-fixture', factorAgeSeconds: 0 });
  beforeEach(async () => {
    owner = 'nominal_' + randomUUID();
    account = randomUUID();
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [owner]);
    await pool.query(
      "insert into public.accounts(id,user_id,name,type,currency_code,is_default,automatic_tracking_enabled) values($1,$2,'Existing default','cash','SAR',true,true)",
      [account, owner],
    );
    await repository.getPreferences(principal());
    await pool.query(
      'update public.tracking_preferences set enabled=true,review_required=false where user_id=$1',
      [owner],
    );
    await pool.query(
      "insert into public.user_sender_rules(user_id,sender_pattern,display_label,trusted,enabled) values($1,'FINANCE','Unknown institution name',true,true),($1,'com.finance.app','Unknown institution name',true,true)",
      [owner],
    );
    await pool.query(
      "insert into private.tracking_automatic_cohorts(user_id,device_id,release_id,engine_version,expires_at,reason) select $1,'nominal-device-000001',release_id,'2.0.0',clock_timestamp()+interval '1 hour','Disposable nominal fixture' from public.tracking_rule_channels where environment='default' and market='global' and channel='all'",
      [owner],
    );
  });
  afterAll(async () => {
    await worker.stop();
    await pool.onModuleDestroy();
  });
  async function capture(
    text: string,
    options: {
      native?: string;
      channel?: 'android_sms' | 'android_notification';
      reference?: string;
      device?: string;
      receivedAt?: string;
      component?: 'principal' | 'fee';
    } = {},
  ) {
    const native = options.native ?? randomUUID(),
      channel = options.channel ?? 'android_sms',
      sender = channel === 'android_sms' ? 'FINANCE' : 'com.finance.app';
    const configuration = await repository.ruleSnapshot(principal());
    const receivedAt = options.receivedAt ?? new Date().toISOString();
    const parsed = discoverNominalTrackingMessage(
      { text, sender, channel, receivedAt: Date.parse(receivedAt) },
      defaultSnapshot,
      [],
      [{ normalizedSender: sender, enabled: true, trusted: true }],
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
          activatedAt: new Date(Date.now() - 600000).toISOString(),
          sourceItemKey: hash(
            native + '|' + text + '|' + receivedAt + '|' + (options.component ?? 'single'),
          ),
          sender,
          receivedAt,
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
            deviceId: options.device ?? 'nominal-device-000001',
            channel,
            nativeIdDigest: hash(native),
            revisionDigest: hash(text),
          },
          metadata: {
            ruleConfigurationRevision: configuration.configurationRevision,
            ...(options.component ? { movementComponent: options.component } : {}),
            ...(channel === 'android_notification' ? { sourcePackage: sender } : {}),
            ...(options.reference ? { referenceScheme: 'plain-v2' } : {}),
          },
          ...(options.reference ? { providerReferenceDigest: hash(options.reference) } : {}),
        },
      ],
    });
    const response = await repository.createImport(principal(), command, {
      sourceName: null,
      key: 'nominal-' + randomUUID(),
      requestId: randomUUID(),
    });
    const id = String((response.resource as Record<string, unknown>).id);
    await worker.runJob('import.parse');
    return {
      id,
      items: (await repository.listOwner(principal(), 'items', null, 100, null, {
        sessionId: id,
      })) as Record<string, unknown>[],
    };
  }
  async function finances() {
    return (
      await pool.query(
        'select t.kind,t.amount_minor::text amount,btrim(t.currency_code) currency,t.category_id::text category,p.amount_minor::text effect,p.account_id::text account from public.transactions t join public.transaction_postings p on p.transaction_id=t.id where t.user_id=$1 order by t.created_at,t.id',
        [owner],
      )
    ).rows;
  }
  it('records 50 EGP as numerical 50 SAR on the existing cash default with Shopping', async () => {
    const result = await capture('تم دفع خمسين جنيه');
    expect(result.items[0]?.status).toBe('accepted');
    expect(
      (
        await pool.query('select accepted_count from public.import_sessions where id=$1', [
          result.id,
        ])
      ).rows[0]?.accepted_count,
    ).toBe(1);
    expect(await finances()).toEqual([
      {
        kind: 'expense',
        amount: '5000',
        currency: 'SAR',
        category: '04000000-0000-4000-8000-000000000006',
        effect: '-5000',
        account,
      },
    ]);
    expect(
      (
        await pool.query(
          'select confirmed_minor::text balance from public.account_balances where account_id=$1',
          [account],
        )
      ).rows[0]?.balance,
    ).toBe('-5000');
  });
  it('records currency-free debit amount without using the balance number', async () => {
    await capture('تم خصم 50، الرصيد 950');
    expect((await finances())[0]).toMatchObject({
      amount: '5000',
      effect: '-5000',
      currency: 'SAR',
    });
  });
  it.each(['Deposit EGP50', 'Cash withdrawal EGP50', 'Refund EGP50', 'Reversal EGP50'])(
    'uses simplified direction for %s without transfer or compensation postings',
    async (text) => {
      await capture(text);
      const incoming = !text.startsWith('Cash');
      const rows = await finances();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        kind: incoming ? 'income' : 'expense',
        effect: incoming ? '5000' : '-5000',
      });
      if (incoming) expect(rows[0]?.category).not.toBe('04000000-0000-4000-8000-000000000006');
    },
  );
  it('keeps independent equal SMS movements separate', async () => {
    await capture('Paid EGP50');
    await capture('Paid EGP50');
    expect(await finances()).toHaveLength(2);
    expect(
      (
        await pool.query('select count(*)::int n from public.review_items where user_id=$1', [
          owner,
        ])
      ).rows[0]?.n,
    ).toBe(0);
  });
  it('keeps opposite directions separate despite a shared reference', async () => {
    await capture('Paid EGP50', { reference: 'same-reference' });
    await capture('Deposit EGP50', { reference: 'same-reference' });
    expect(await finances()).toHaveLength(2);
  });
  it('replays one source identity without a second ledger effect', async () => {
    await capture('Paid EGP50', { native: 'one-source' });
    await capture('Paid EGP50', { native: 'one-source' });
    expect(await finances()).toHaveLength(1);
  });
  it('holds an updated notification with the same slot without a second financial effect', async () => {
    const timestamp = Date.now();
    await capture('Paid EGP50', {
      channel: 'android_notification',
      native: 'stable-slot',
      receivedAt: new Date(timestamp).toISOString(),
    });
    const second = await capture('Payment EGP50', {
      channel: 'android_notification',
      native: 'stable-slot',
      receivedAt: new Date(timestamp + 1000).toISOString(),
    });
    expect(await finances()).toHaveLength(1);
    expect(
      (
        await pool.query(
          "select normalized_payload->>'diagnosticReason' reason from public.import_items where session_id=$1",
          [second.id],
        )
      ).rows[0]?.reason,
    ).toBe('correlation_unresolved');
  });
  it('keeps later independent movements using the same notification slot separate', async () => {
    const timestamp = Date.now();
    await capture('Paid EGP50', {
      channel: 'android_notification',
      native: 'stable-slot',
      receivedAt: new Date(timestamp - 180000).toISOString(),
    });
    await capture('Paid EGP50', {
      channel: 'android_notification',
      native: 'stable-slot',
      receivedAt: new Date(timestamp).toISOString(),
    });
    expect(await finances()).toHaveLength(2);
  });
  it('holds identical reference-free SMS observed by another client without claiming a duplicate', async () => {
    await pool.query(
      "insert into private.tracking_automatic_cohorts(user_id,device_id,release_id,engine_version,expires_at,reason) select $1,'nominal-device-000002',release_id,'2.0.0',clock_timestamp()+interval '1 hour','Disposable second client' from public.tracking_rule_channels where environment='default' and market='global' and channel='all'",
      [owner],
    );
    const receivedAt = new Date().toISOString();
    await capture('Paid EGP50', { device: 'nominal-device-000001', receivedAt });
    await capture('Paid EGP50', { device: 'nominal-device-000002', receivedAt });
    expect(await finances()).toHaveLength(1);
  });
  it('commits one effect under concurrent submissions of the same verified reference', async () => {
    await Promise.all([
      capture('Paid EGP50', { reference: 'concurrent-movement' }),
      capture('Paid EGP50', { reference: 'concurrent-movement' }),
    ]);
    expect(await finances()).toHaveLength(1);
    expect(
      (
        await pool.query(
          'select confirmed_minor::text balance from public.account_balances where account_id=$1',
          [account],
        )
      ).rows[0]?.balance,
    ).toBe('-5000');
  });
  it('keeps pending receipts diagnostic without a review queue or posting', async () => {
    await capture('Payment EGP50 pending');
    expect(await finances()).toEqual([]);
    expect(
      (
        await pool.query('select count(*)::int n from public.review_items where user_id=$1', [
          owner,
        ])
      ).rows[0]?.n,
    ).toBe(0);
  });
  it('pins distinct principal and additional fee effects from one source observation', async () => {
    await capture('Paid EGP50', { native: 'principal-fee', component: 'principal' });
    await capture('Additional fee EGP2', { native: 'principal-fee', component: 'fee' });
    const before = await finances();
    expect(before).toHaveLength(2);
    expect(before.map((row) => String(row.effect)).sort()).toEqual(['-200', '-5000']);
    await capture('Additional fee EGP2', { native: 'principal-fee', component: 'fee' });
    expect(await finances()).toEqual(before);
  });
  it('recovers a committed ledger response loss without changing its immutable postings', async () => {
    const original = ledger.createTransaction.bind(ledger);
    const lostResponse = jest
      .spyOn(ledger, 'createTransaction')
      .mockImplementationOnce(async (command) => {
        await original(command);
        throw new Error('RESPONSE_LOST_AFTER_COMMIT');
      });
    let sessionId: string;
    try {
      sessionId = (await capture('Paid EGP50', { native: 'response-loss' })).id;
    } finally {
      lostResponse.mockRestore();
    }
    const before = await finances();
    expect(before).toHaveLength(1);
    await pool.query(
      'update public.import_sessions set next_attempt_at=clock_timestamp() where id=$1',
      [sessionId],
    );
    await worker.runJob('import.parse');
    expect(await finances()).toEqual(before);
    expect(
      (
        await pool.query('select accepted_count,status from public.import_sessions where id=$1', [
          sessionId,
        ])
      ).rows[0],
    ).toEqual({ accepted_count: 1, status: 'complete' });
  });
  it('keeps a deleted default disabled through seeding while preserving another users defaults', async () => {
    const row = (
      await pool.query(
        "select id,version from public.user_keyword_rules where user_id=$1 and origin='default' and keyword='دفع'",
        [owner],
      )
    ).rows[0];
    if (!row) throw new Error('DEFAULT_KEYWORD_EXPECTED');
    await pool.query('select private.delete_keyword_rule($1,$2,$3)', [owner, row.id, row.version]);
    await pool.query('select private.seed_default_keyword_rules($1)', [owner]);
    expect(
      (
        await pool.query(
          'select enabled,deleted_at is not null deleted from public.user_keyword_rules where id=$1',
          [row.id],
        )
      ).rows[0],
    ).toEqual({ enabled: false, deleted: true });
    expect(
      (await repository.listOwner(principal(), 'keywords', null, 100, null)).some(
        (r: unknown) => (r as { id: string }).id === row.id,
      ),
    ).toBe(false);
    const other = 'nominal_other_' + randomUUID();
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [other]);
    expect(
      (
        await pool.query(
          "select enabled from public.user_keyword_rules where user_id=$1 and keyword='دفع'",
          [other],
        )
      ).rows[0]?.enabled,
    ).toBe(true);
  });
  it('can explicitly re-add a deleted default without silently reseeding it', async () => {
    const row = (
      await pool.query(
        "select id,version from public.user_keyword_rules where user_id=$1 and origin='default' and keyword='دفع'",
        [owner],
      )
    ).rows[0];
    if (!row) throw new Error('DEFAULT_KEYWORD_EXPECTED');
    await pool.query('select private.delete_keyword_rule($1,$2,$3)', [owner, row.id, row.version]);
    await pool.query(
      "select private.upsert_keyword_rule($1,null,'دفع','financial','ar','contains',null,100,true,null)",
      [owner],
    );
    expect(
      (
        await pool.query(
          'select enabled,deleted_at is null visible from public.user_keyword_rules where id=$1',
          [row.id],
        )
      ).rows[0],
    ).toEqual({ enabled: true, visible: true });
  });
  it('creates no saved notifications through either engagement source collector', async () => {
    await capture('Paid EGP50');
    await pool.query(
      'update private.outbox_events set published_at=clock_timestamp() where aggregate_id in (select id from public.transactions where user_id=$1)',
      [owner],
    );
    const engagement = new EngagementRepository(
      pool,
      new PlatformConfigService(new ConfigService() as never),
    );
    const event = (
      await pool.query(
        "select o.id,t.id transaction from private.outbox_events o join public.transactions t on t.id=o.aggregate_id where t.user_id=$1 and o.event_type='transaction.created'",
        [owner],
      )
    ).rows[0];
    if (!event) throw new Error('TRANSACTION_EVENT_EXPECTED');
    const created = await engagement.createNotificationFromSource(
      {
        source_event_id: String(event.id),
        source_id: String(event.transaction),
        event_type: 'transaction.created',
        user_id: owner,
        locale: 'en',
        time_zone: 'Asia/Riyadh',
        occurred_at: new Date().toISOString(),
        expires_at: null,
      },
      [
        {
          channel: 'in_app',
          provider: 'database',
          title: 'Saved',
          body: 'Saved',
          status: 'queued',
          nextAttemptAt: null,
        },
      ],
    );
    expect(created).toBe(false);
    expect(
      (await engagement.claimTrackingSourceEvents(100)).filter((row) => row.user_id === owner),
    ).toEqual([]);
  });
  it('correlates SMS and notification references through a configured financial institution', async () => {
    await pool.query(
      'update public.user_sender_rules set institution_id=(select id from public.financial_institutions where active limit 1) where user_id=$1',
      [owner],
    );
    await capture('Paid EGP50', { reference: 'one-financial-movement' });
    await capture('Payment EGP50', {
      reference: 'one-financial-movement',
      channel: 'android_notification',
    });
    expect(await finances()).toHaveLength(1);
  });
  it('keeps an unavailable default internally retryable without a review item', async () => {
    await pool.query('update public.accounts set is_default=false where id=$1', [account]);
    const result = await capture('Paid EGP50');
    expect(await finances()).toEqual([]);
    expect(
      (await pool.query('select status from public.import_sessions where id=$1', [result.id]))
        .rows[0]?.status,
    ).toBe('received');
    expect(
      (
        await pool.query('select count(*)::int n from public.review_items where user_id=$1', [
          owner,
        ])
      ).rows[0]?.n,
    ).toBe(0);
    await pool.query('update public.accounts set is_default=true where id=$1', [account]);
    await pool.query(
      'update public.import_sessions set next_attempt_at=clock_timestamp() where id=$1',
      [result.id],
    );
    await worker.runJob('import.parse');
    expect(await finances()).toHaveLength(1);
  });
});
