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
      accountId?: string;
      preferredAccountId?: string;
      sourceDisplayName?: string;
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
          ...(classification.merchant ? { merchant: classification.merchant } : {}),
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
            ...(options.preferredAccountId
              ? { preferredAccountId: options.preferredAccountId }
              : {}),
            ...(options.sourceDisplayName ? { sourceDisplayName: options.sourceDisplayName } : {}),
            ...(options.accountId ? { notificationAccountId: options.accountId } : {}),
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
    // Other retained fixtures must not consume this worker's bounded claim batch.
    await pool.withClient(async (locker) => {
      await locker.query('begin');
      try {
        await locker.query(
          "select id from public.import_sessions where user_id<>$1 and status in ('received','processing') for update",
          [owner],
        );
        await execution.runJob('import.parse');
      } finally {
        await locker.query('rollback');
      }
    });
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

  describe('source currency account routing', () => {
    beforeEach(async () => {
      const installed = (
        await pool.query<{ installed: boolean }>(
          "select exists(select 1 from information_schema.columns where table_schema='private' and table_name='tracking_automatic_cohorts' and column_name='currency_account_policy') installed",
        )
      ).rows[0]?.installed;
      if (installed)
        await pool.query(
          "update private.tracking_automatic_cohorts set currency_account_policy='source_currency_v1' where user_id=$1",
          [owner],
        );
    });

    const currencyCases = [
      ['EGP', 'تم خصم ٢٫٥٠ جنيه مصري', '250'],
      ['AED', 'تم دفع 2.50 درهم إماراتي', '250'],
      ['SAR', 'Paid SAR2.50', '250'],
      ['KWD', 'Paid KWD1.250', '1250'],
      ['JPY', 'Paid JPY250', '250'],
    ] as const;
    it.each(
      currencyCases.flatMap(([currency, text, amount]) =>
        (['android_sms', 'android_notification'] as const).map(
          (channel) => [currency, text, amount, channel] as const,
        ),
      ),
    )(
      'routes %s evidence %s to its currency account over %s/%s',
      async (currency, text, amount, channel) => {
        const destination = currency === 'SAR' ? account : randomUUID();
        if (destination !== account)
          await pool.query(
            "insert into public.accounts(id,user_id,name,type,currency_code,automatic_tracking_enabled) values($1,$2,'Synthetic currency account','wallet',$3,true)",
            [destination, owner, currency],
          );
        await capture({ text, channel });
        expect(await effects()).toEqual([
          expect.objectContaining({ currency, amount, effect: '-' + amount, account: destination }),
        ]);
      },
    );

    it.each(['missing', 'ambiguous', 'disabled', 'archived', 'unknown-currency'])(
      'retains %s routing evidence without converting it to the SAR default',
      async (scenario) => {
        if (scenario !== 'missing' && scenario !== 'unknown-currency') {
          await pool.query(
            "insert into public.accounts(user_id,name,type,currency_code,automatic_tracking_enabled,status,deleted_at) values($1,'Synthetic unavailable','wallet','EGP',$2,$3,case when $3='archived' then clock_timestamp() else null end)",
            [owner, scenario !== 'disabled', scenario === 'archived' ? 'archived' : 'active'],
          );
          if (scenario === 'ambiguous')
            await pool.query(
              "insert into public.accounts(user_id,name,type,currency_code,automatic_tracking_enabled) values($1,'Another currency account','wallet','EGP',true)",
              [owner],
            );
        }
        const id = await capture({
          text: scenario === 'unknown-currency' ? 'تم خصم مبلغ 2' : 'Paid EGP2',
        });
        expect(await effects()).toEqual([]);
        const item = (
          await pool.query<{ normalized_payload: { diagnosticReason?: string } }>(
            'select normalized_payload from public.import_items where session_id=$1',
            [id],
          )
        ).rows[0];
        expect(item?.normalized_payload.diagnosticReason).toMatch(/^source_currency_/);
      },
    );

    it('uses an explicitly selected matching-currency account among several accounts', async () => {
      const preferred = randomUUID();
      await pool.query(
        "insert into public.accounts(id,user_id,name,type,currency_code,automatic_tracking_enabled) values($1,$2,'Selected account','cash','SAR',true)",
        [preferred, owner],
      );
      await capture({ text: 'Paid SAR2', preferredAccountId: preferred });
      expect(await effects()).toEqual([
        expect.objectContaining({ currency: 'SAR', account: preferred }),
      ]);
    });

    it('posts the retained observation once when a matching currency account becomes available', async () => {
      const id = await capture({
        text: 'Paid EGP2',
        channel: 'android_notification',
        reference: 'wait-for-currency-account',
      });
      expect(await effects()).toEqual([]);
      const wallet = randomUUID();
      await pool.query(
        "insert into public.accounts(id,user_id,name,type,currency_code,automatic_tracking_enabled) values($1,$2,'Later EGP wallet','wallet','EGP',true)",
        [wallet, owner],
      );
      for (let attempt = 0; attempt < 2; attempt++) {
        await pool.query(
          'update public.import_sessions set next_attempt_at=clock_timestamp() where id=$1',
          [id],
        );
        await pool.withClient(async (locker) => {
          await locker.query('begin');
          try {
            await locker.query(
              "select id from public.import_sessions where user_id<>$1 and status in ('received','processing') for update",
              [owner],
            );
            await worker.runJob('import.parse');
          } finally {
            await locker.query('rollback');
          }
        });
      }
      expect(await effects()).toEqual([
        expect.objectContaining({ currency: 'EGP', account: wallet }),
      ]);
      expect(
        (
          await pool.query('select status,accepted_count from public.import_sessions where id=$1', [
            id,
          ])
        ).rows[0],
      ).toEqual({ status: 'complete', accepted_count: 1 });
    });

    it('keeps different explicit references as independent movements across selected accounts', async () => {
      const wallet = randomUUID();
      await pool.query(
        "insert into public.accounts(id,user_id,name,type,currency_code,automatic_tracking_enabled) values($1,$2,'Another SAR wallet','wallet','SAR',true)",
        [wallet, owner],
      );
      await capture({ reference: 'independent-one', preferredAccountId: account });
      await capture({
        channel: 'android_notification',
        reference: 'independent-two',
        preferredAccountId: wallet,
      });
      expect(await effects()).toHaveLength(2);
    });

    it('keeps a selected SAR account from redirecting an EGP notification', async () => {
      const wallet = randomUUID();
      await pool.query(
        "insert into public.accounts(id,user_id,name,type,currency_code,automatic_tracking_enabled) values($1,$2,'EGP wallet','wallet','EGP',true)",
        [wallet, owner],
      );
      await capture({
        text: 'Paid EGP2',
        preferredAccountId: account,
        channel: 'android_notification',
      });
      expect(await effects()).toEqual([
        expect.objectContaining({ currency: 'EGP', account: wallet }),
      ]);
    });

    it('uses a generic app source label for title and missing merchant', async () => {
      await capture({
        text: 'Paid SAR2',
        channel: 'android_notification',
        sourceDisplayName: 'Example Wallet',
      });
      expect(
        (
          await pool.query('select title,merchant from public.transactions where user_id=$1', [
            owner,
          ])
        ).rows,
      ).toEqual([{ title: 'Example Wallet', merchant: 'Example Wallet' }]);
    });

    it('keeps a parsed merchant when adding the bank source label', async () => {
      await capture({
        text: 'Paid SAR2 at COFFEE HOUSE',
        channel: 'android_notification',
        sourceDisplayName: 'Example Wallet',
      });
      expect(
        (
          await pool.query('select title,merchant from public.transactions where user_id=$1', [
            owner,
          ])
        ).rows,
      ).toEqual([{ title: 'Example Wallet', merchant: 'COFFEE HOUSE' }]);
    });

    it('keeps an admitted currency destination stable when another account is added before matching evidence arrives', async () => {
      const wallet = randomUUID();
      await pool.query(
        "insert into public.accounts(id,user_id,name,type,currency_code,automatic_tracking_enabled) values($1,$2,'Original EGP wallet','wallet','EGP',true)",
        [wallet, owner],
      );
      await capture({ text: 'Paid EGP2', reference: 'stable-currency-destination' });
      await pool.query(
        "insert into public.accounts(user_id,name,type,currency_code,automatic_tracking_enabled) values($1,'New EGP wallet','wallet','EGP',true)",
        [owner],
      );
      await capture({
        text: 'Paid EGP2',
        channel: 'android_notification',
        reference: 'stable-currency-destination',
        preferredAccountId: wallet,
      });
      expect(await effects()).toEqual([
        expect.objectContaining({ currency: 'EGP', account: wallet }),
      ]);
      expect(
        (
          await pool.query(
            "select count(*)::int n from public.import_items where user_id=$1 and status='accepted'",
            [owner],
          )
        ).rows[0]?.n,
      ).toBe(2);
    });

    it.each(['android_sms', 'android_notification'] as const)(
      'blocks duplicate source evidence after selecting another same-currency account: %s first',
      async (first) => {
        const wallet = randomUUID();
        await pool.query(
          "insert into public.accounts(id,user_id,name,type,currency_code,automatic_tracking_enabled) values($1,$2,'Second SAR wallet','wallet','SAR',true)",
          [wallet, owner],
        );
        await capture({
          channel: first,
          reference: 'same-money-different-destination',
          preferredAccountId: account,
        });
        const second = await capture({
          channel: first === 'android_sms' ? 'android_notification' : 'android_sms',
          reference: 'same-money-different-destination',
          preferredAccountId: wallet,
        });
        expect(await effects()).toEqual([expect.objectContaining({ account })]);
        expect(
          (
            await pool.query<{ normalized_payload: { diagnosticReason?: string } }>(
              'select normalized_payload from public.import_items where session_id=$1',
              [second],
            )
          ).rows[0]?.normalized_payload.diagnosticReason,
        ).toMatch(/^(notification_destination_conflict|correlation_unresolved)$/);
      },
    );

    it.each(
      (['android_sms', 'android_notification'] as const).flatMap((channel) =>
        ['active', 'disabled', 'archived'].map((status) => [channel, status] as const),
      ),
    )(
      'does not post a legacy wrong-currency duplicate after activation: %s first, prior account %s',
      async (first, status) => {
        await pool.query(
          "update private.tracking_automatic_cohorts set currency_account_policy='default_account_nominal_v1' where user_id=$1",
          [owner],
        );
        await capture({ text: 'Paid EGP2', channel: first, reference: 'before-currency-policy' });
        const prior = await effects();
        expect(prior).toEqual([expect.objectContaining({ currency: 'SAR', account })]);
        if (status === 'disabled')
          await pool.query(
            'update public.accounts set automatic_tracking_enabled=false where id=$1',
            [account],
          );
        if (status === 'archived')
          await pool.query(
            "update public.accounts set is_default=false,status='archived',deleted_at=clock_timestamp() where id=$1",
            [account],
          );
        await pool.query(
          "insert into public.accounts(user_id,name,type,currency_code,automatic_tracking_enabled) values($1,'New EGP wallet','wallet','EGP',true)",
          [owner],
        );
        await pool.query(
          "update private.tracking_automatic_cohorts set currency_account_policy='source_currency_v1' where user_id=$1",
          [owner],
        );
        await capture({
          text: 'Paid EGP2',
          channel: first === 'android_sms' ? 'android_notification' : 'android_sms',
          reference: 'before-currency-policy',
        });
        expect(await effects()).toEqual(prior);
      },
    );

    it.each(['https://example.test', 'Personal 1234567890', 'Bad\nName'])(
      'does not use unsafe source labels: %s',
      async (sourceDisplayName) => {
        await capture({ channel: 'android_notification', sourceDisplayName });
        expect(await effects()).toHaveLength(1);
        expect(
          (
            await pool.query('select title,merchant from public.transactions where user_id=$1', [
              owner,
            ])
          ).rows[0],
        ).not.toEqual({ title: sourceDisplayName, merchant: sourceDisplayName });
      },
    );

    it('rejects a preferred account belonging to another owner', async () => {
      const other = 'currency_foreign_' + randomUUID(),
        foreign = randomUUID();
      await pool.query("insert into public.profiles(id,status) values($1,'active')", [other]);
      await pool.query(
        "insert into public.accounts(id,user_id,name,type,currency_code,automatic_tracking_enabled) values($1,$2,'Foreign','cash','SAR',true)",
        [foreign, other],
      );
      const id = await capture({ preferredAccountId: foreign });
      expect(await effects()).toEqual([]);
      expect(
        (
          await pool.query<{ normalized_payload: { diagnosticReason?: string } }>(
            'select normalized_payload from public.import_items where session_id=$1',
            [id],
          )
        ).rows[0]?.normalized_payload.diagnosticReason,
      ).toBe('source_currency_account_invalid');
    });
  });
  it.each([
    ['You have received 1.00 EGP from someone@wallet', 'income', '100'],
    ['Paid EGP2 reference WALLET012345', 'expense', '-200'],
  ])('posts a notification into an explicitly selected wallet: %s', async (text, kind, effect) => {
    const wallet = randomUUID();
    await pool.query(
      "insert into public.accounts(id,user_id,name,type,currency_code,automatic_tracking_enabled) values($1,$2,'Synthetic notifications','wallet','EGP',true)",
      [wallet, owner],
    );
    await pool.query('update public.accounts set automatic_tracking_enabled=false where id=$1', [
      account,
    ]);
    await capture({ text, channel: 'android_notification', accountId: wallet });
    await worker.runJob('import.parse');
    expect(await effects()).toEqual([
      expect.objectContaining({ kind, effect, currency: 'EGP', account: wallet }),
    ]);
    expect(
      (
        await pool.query(
          'select is_default,automatic_tracking_enabled from public.accounts where id=$1',
          [account],
        )
      ).rows[0],
    ).toEqual({ is_default: true, automatic_tracking_enabled: false });
  });

  it.each(['other-owner', 'currency', 'disabled', 'malformed'])(
    'never falls back to the default for an unavailable notification destination: %s',
    async (failure) => {
      const wallet = randomUUID();
      const otherOwner = 'destination_' + randomUUID();
      await pool.query("insert into public.profiles(id,status) values($1,'active')", [otherOwner]);
      await pool.query(
        "insert into public.accounts(id,user_id,name,type,currency_code,automatic_tracking_enabled) values($1,$2,'Synthetic destination','wallet',$3,$4)",
        [
          wallet,
          failure === 'other-owner' ? otherOwner : owner,
          failure === 'currency' ? 'SAR' : 'EGP',
          failure !== 'disabled',
        ],
      );
      const id = await capture({
        text: 'You have received 1.00 EGP from someone@wallet',
        channel: 'android_notification',
        accountId: failure === 'malformed' ? 'bad' : wallet,
      });
      await worker.runJob('import.parse');
      expect(await effects()).toEqual([]);
      const item = (
        await pool.query<{ status: string; normalized_payload: { diagnosticReason?: string } }>(
          'select status,normalized_payload from public.import_items where session_id=$1',
          [id],
        )
      ).rows[0];
      expect(item).toBeDefined();
      expect(item?.normalized_payload.diagnosticReason).toBe(
        failure === 'malformed' ? 'notification_account_invalid' : 'account_tracking_blocked',
      );
    },
  );

  it('ignores a notification destination hint on SMS and preserves nominal SMS posting', async () => {
    await capture({ accountId: randomUUID() });
    expect(await effects()).toEqual([
      expect.objectContaining({ account, currency: 'SAR', effect: '-200' }),
    ]);
  });

  it.each(
    (['android_sms', 'android_notification'] as const).flatMap((channel) =>
      [true, false].map((hasReference) => [channel, hasReference] as const),
    ),
  )(
    'keeps one financial effect across different source display names: %s first, reference %s',
    async (first, hasReference) => {
      for (const channel of [
        first,
        first === 'android_sms' ? 'android_notification' : 'android_sms',
      ] as const) {
        await capture({
          text: 'Paid SAR2',
          channel,
          sender: channel === 'android_sms' ? 'SyntheticBank' : 'com.synthetic.wallet',
          sourceDisplayName: channel === 'android_sms' ? 'Synthetic Bank' : 'Example Wallet',
          ...(hasReference ? { reference: 'same-source-money' } : {}),
        });
      }
      expect(await effects()).toHaveLength(1);
      if (hasReference)
        expect(
          (
            await pool.query<{ n: number }>(
              "select count(*)::int n from public.import_items where user_id=$1 and status='accepted'",
              [owner],
            )
          ).rows[0]?.n,
        ).toBe(2);
    },
  );

  it.each([
    [true, true],
    [false, true],
    [true, false],
    [false, false],
  ])(
    'holds overlapping source evidence across different destination currencies, notification first: %s, reference present: %s',
    async (notificationFirst, withReference) => {
      const wallet = randomUUID(),
        receivedAt = Date.now();
      await pool.query(
        "insert into public.accounts(id,user_id,name,type,currency_code,automatic_tracking_enabled) values($1,$2,'Synthetic EGP wallet','wallet','EGP',true)",
        [wallet, owner],
      );
      const sms = {
        text: withReference ? 'Paid EGP2 reference SHARED12345' : 'Paid EGP2',
        reference: withReference ? 'SHARED12345' : undefined,
        receivedAt,
      };
      const notification = { ...sms, channel: 'android_notification' as const, accountId: wallet };
      await capture(notificationFirst ? notification : sms);
      const firstEffects = await effects();
      expect(firstEffects).toHaveLength(1);
      const second = await capture(notificationFirst ? sms : notification);
      await worker.runJob('import.parse');
      expect(await effects()).toEqual(firstEffects);
      expect(
        (
          await pool.query<{ normalized_payload: { diagnosticReason?: string } }>(
            'select normalized_payload from public.import_items where session_id=$1',
            [second],
          )
        ).rows[0]?.normalized_payload.diagnosticReason,
      ).toBe('notification_destination_conflict');
    },
  );

  it('preserves independent equal-value transactions with different explicit references', async () => {
    const wallet = randomUUID(),
      receivedAt = Date.now();
    await pool.query(
      "insert into public.accounts(id,user_id,name,type,currency_code,automatic_tracking_enabled) values($1,$2,'Independent EGP wallet','wallet','EGP',true)",
      [wallet, owner],
    );
    await capture({
      text: 'Paid EGP2 reference DISTINCT111',
      reference: 'DISTINCT111',
      receivedAt,
    });
    await capture({
      text: 'Paid EGP2 reference DISTINCT222',
      reference: 'DISTINCT222',
      receivedAt,
      channel: 'android_notification',
      accountId: wallet,
    });
    expect(await effects()).toHaveLength(2);
  });

  it('waits for the owner lock before locking a notification destination account', async () => {
    const wallet = randomUUID();
    await pool.query(
      "insert into public.accounts(id,user_id,name,type,currency_code,automatic_tracking_enabled) values($1,$2,'Lock fixture','wallet','EGP',true)",
      [wallet, owner],
    );
    const id = await capture(
      { text: 'You have received 1 EGP', channel: 'android_notification', accountId: wallet },
      { runJob: () => Promise.resolve(0) } as never,
    );
    const claim = (await repository.claimImports('notification-lock-fixture')).find(
      (candidate) => candidate.id === id,
    );
    if (!claim) throw new Error('Notification lock fixture not claimed');
    await repository.prepareImport(id, claim.claim_token);
    await pool.withClient(async (holder) =>
      pool.withClient(async (contender) => {
        await holder.query('begin');
        await contender.query('begin');
        await holder.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [owner]);
        const pid = (await contender.query<{ pid: number }>('select pg_backend_pid() pid')).rows[0]
          ?.pid;
        const finalize = contender
          .query('select private.finalize_import_session($1,$2)', [id, claim.claim_token])
          .then(
            () => null,
            (error: unknown) =>
              error instanceof Error ? error : new Error('Finalization rejected'),
          );
        let failure: Error | null = null;
        try {
          let waiting = false;
          const deadline = Date.now() + 3000;
          while (!waiting && Date.now() < deadline) {
            waiting =
              (
                await holder.query<{ waiting: boolean }>(
                  "select exists(select 1 from pg_locks where pid=$1 and locktype='advisory' and not granted) waiting",
                  [pid],
                )
              ).rows[0]?.waiting === true;
            if (!waiting) await new Promise((resolve) => setTimeout(resolve, 10));
          }
          expect(waiting).toBe(true);
          expect(
            (
              await holder.query('select id from public.accounts where id=$1 for update nowait', [
                wallet,
              ])
            ).rows,
          ).toHaveLength(1);
        } finally {
          await holder.query('rollback');
          failure = await finalize;
          await contender.query('rollback');
        }
        if (failure) throw failure;
      }),
    );
  });

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
        // Authenticated opening fixture is separate from the claim-free worker under test.
        await pool.withClient(async (client) => {
          await client.query('begin');
          try {
            await client.query("select set_config('request.jwt.claims',$1,true)", [
              JSON.stringify({ sub: owner }),
            ]);
            await client.query(
              'select private.post_opening_transaction($1,$2::uuid,70000,$3,$4::timestamptz,$5)',
              [owner, account, 'Synthetic opening', new Date().toISOString(), 'account-opening'],
            );
            await client.query('commit');
          } catch (error) {
            await client.query('rollback');
            throw error;
          }
        });
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
      const first = await capture({ channel: firstChannel, reference });
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
      for (const session of [first, second]) {
        const outcomes = await repository.listSessionItems(principal(), session, null, 100);
        expect(outcomes).toEqual([
          expect.objectContaining({
            status: 'accepted',
            transactionId: before[0]?.id,
            notificationId: notices[0]?.id,
          }),
        ]);
        expect(
          await repository.listSessionItems(
            { ...principal(), userId: 'other-owner' },
            session,
            null,
            100,
          ),
        ).toEqual([]);
      }
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
  it('restores the prior connection identity after fresh DEV tracking success and financial failure', async () => {
    const id = await capture({ reference: 'identity-restoration' }, {
      runJob: () => Promise.resolve(0),
    } as never);
    const claim = (await repository.claimImports('identity-fixture')).find(
      (value) => value.id === id,
    );
    if (!claim) throw new Error('Identity fixture was not claimed');
    await repository.prepareImport(id, claim.claim_token);
    const item = (await pool.query('select id from public.import_items where session_id=$1', [id]))
      .rows[0];
    if (!item) throw new Error('Identity fixture item was not prepared');
    const claims = JSON.stringify({ sub: 'unrelated-prior-principal', marker: 'preserve' });
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query(`create function pg_temp.reject_tracking_fixture() returns trigger language plpgsql as $$
          begin raise exception 'SYNTHETIC_FINANCIAL_FAILURE'; end $$`);
        await client.query(
          'create trigger reject_tracking_fixture before insert on public.transactions for each row execute function pg_temp.reject_tracking_fixture()',
        );
        await client.query("select set_config('request.jwt.claims',$1,true)", [claims]);
        await client.query('set local role masarifi_worker');
        await client.query('savepoint attempted');
        await expect(
          client.query('select private.commit_tracking_nominal_capture($1,$2)', [
            item.id,
            claim.claim_token,
          ]),
        ).rejects.toMatchObject({ message: 'SYNTHETIC_FINANCIAL_FAILURE' });
        await client.query('rollback to savepoint attempted');
        expect(
          (
            await client.query<{ claims: string }>(
              "select current_setting('request.jwt.claims',true) claims",
            )
          ).rows[0]?.claims,
        ).toBe(claims);
        await client.query('reset role');
        await client.query('drop trigger reject_tracking_fixture on public.transactions');
        await client.query('set local role masarifi_worker');
        await client.query('select private.commit_tracking_nominal_capture($1,$2)', [
          item.id,
          claim.claim_token,
        ]);
        expect(
          (
            await client.query<{ claims: string }>(
              "select current_setting('request.jwt.claims',true) claims",
            )
          ).rows[0]?.claims,
        ).toBe(claims);
        await client.query('reset role');
        expect(
          (
            await client.query<{ n: number }>(
              'select count(*)::int n from public.transactions where user_id=$1',
              [owner],
            )
          ).rows[0]?.n,
        ).toBe(1);
      } finally {
        await client.query('rollback');
      }
    });
    expect(await effects()).toHaveLength(0);
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
