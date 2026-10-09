import { createHash, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { classifyFinancialMessage, defaultSnapshot } from '@masarifi/transaction-parser';
import { LedgerRepository } from '../../../src/ledger/ledger.repository';
import { LedgerService } from '../../../src/ledger/ledger.service';
import { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import { SecurityRepository } from '../../../src/security/security.repository';
import { normalizeNormalizedImport } from '../../../src/tracking/tracking.dto';
import { TrackingRepository } from '../../../src/tracking/tracking.repository';
import { TrackingService } from '../../../src/tracking/tracking.service';
import { TrackingWorker } from '../../../src/tracking/tracking.worker';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('screenshot capture v2 ledger and governance', () => {
  const pool = createLivePool();
  const repository = new TrackingRepository(pool);
  const ledger = new LedgerService(
    new LedgerRepository(pool),
    new SecurityRepository(pool),
    new PlatformConfigService(new ConfigService() as never),
  );
  const service = new TrackingService(repository, ledger, {} as never);
  const worker = new TrackingWorker(repository, ledger, {} as never);
  const owner = `capture_${randomUUID()}`;
  const accountId = randomUUID();
  const principal = { userId: owner, sessionId: 'integration-capture', factorAgeSeconds: 0 };
  const admin = `${owner}_admin`;
  const adminPrincipal = { ...principal, userId: admin };
  let originalChannel: Record<string, unknown>;
  const hash = (text: string) => createHash('sha256').update(text).digest('hex');

  beforeAll(async () => {
    const channel = (
      await pool.query<Record<string, unknown>>('select * from public.tracking_rule_channels')
    ).rows[0];
    if (!channel) throw new Error('CHANNEL_EXPECTED');
    originalChannel = channel;
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [owner]);
    await pool.query(
      "insert into public.accounts(id,user_id,name,type,currency_code,automatic_tracking_enabled) values($1,$2,'Capture bank','bank','AED',true)",
      [accountId, owner],
    );
    await repository.getPreferences(principal);
    await pool.query(
      'update public.tracking_preferences set enabled=true,review_required=false where user_id=$1',
      [owner],
    );
    await repository.sender(
      principal,
      {
        id: null,
        senderPattern: 'ADCBAlert',
        displayLabel: 'ADCB',
        institutionId: null,
        trusted: true,
        enabled: true,
        expectedVersion: null,
      },
      'capture-sender-integration',
      randomUUID(),
    );
    await pool.query("update public.tracking_rule_channels set mode='automatic'");
  });
  afterAll(async () => {
    await worker.stop();
    await pool.query('update public.tracking_rule_channels set release_id=$1,mode=$2,version=$3', [
      originalChannel.release_id,
      originalChannel.mode,
      originalChannel.version,
    ]);
    await pool.onModuleDestroy();
  });
  async function capture(
    text: string,
    nativeId: string,
    reference?: string,
    channel = 'android_sms',
    provider = 'adcb',
  ) {
    const parsed = classifyFinancialMessage({
      text,
      sender: 'ADCBAlert',
      country: 'AE',
      receivedAt: Date.parse('2026-09-26T10:00:00Z'),
    });
    const { providerReference, ...classification } = parsed;
    expect(providerReference).toBeNull();
    const command = normalizeNormalizedImport({
      schemaVersion: 2,
      sourceType: channel === 'android_sms' ? 'sms' : 'provider',
      sourceChannel: channel,
      events: [
        {
          sourceItemKey: hash(nativeId),
          receivedAt: '2026-09-26T10:00:00Z',
          occurredAt: classification.occurredAt,
          sender: 'ADCBAlert',
          amountMinor:
            classification.direction === 'incoming'
              ? classification.amountMinor
              : -(classification.amountMinor ?? 0),
          currency: classification.currency,
          kind:
            classification.subtype === 'salary'
              ? 'income'
              : ['refund', 'reversal'].includes(classification.subtype)
                ? 'refund'
                : classification.subtype.startsWith('transfer_')
                  ? 'transfer'
                  : 'expense',
          accountId,
          merchant: classification.merchant,
          classification,
          metadata: { sourceProvider: provider },
          transport: {
            deviceId: 'integration-device-0001',
            channel,
            nativeIdDigest: hash(nativeId),
            revisionDigest: hash(text),
          },
          ...(reference ? { providerReferenceDigest: hash(reference) } : {}),
        },
      ],
    });
    const response = await repository.createImport(principal, command, {
      sourceName: 'Android capture integration',
      key: `capture-${nativeId}`,
      requestId: randomUUID(),
    });
    const sessionId = String((response.resource as Record<string, unknown>).id);
    await worker.runJob('import.parse');
    const items = await repository.listOwner(principal, 'items', null, 100, null, { sessionId });
    return { sessionId, items: items as Record<string, unknown>[] };
  }
  it('publishes only a validated immutable release and permits a versioned pointer rollback', async () => {
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [admin]);
    await pool.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
      admin,
    ]);
    await pool.query(
      "insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason) select $1,id,$1,'Isolated capture governance verification' from public.roles where key='import-operator'",
      [admin],
    );
    const input = (body: unknown) => ({
      principal: adminPrincipal,
      body,
      idempotencyKey: 'release-' + randomUUID(),
      requestId: randomUUID(),
    });
    const draft = await service.releaseMutate(
      null,
      input({
        action: 'create',
        expectedVersion: 1,
        reason: 'Isolated screenshot release verification',
        patch: {
          snapshot: { ...defaultSnapshot, releaseId: 'integration-release-' + randomUUID() },
        },
      }),
    );
    const release = draft.resource as Record<string, unknown>;
    await expect(
      service.releaseMutate(
        String(release.id),
        input({
          action: 'publish',
          expectedVersion: 1,
          reason: 'Publish before validation must fail',
        }),
      ),
    ).rejects.toThrow();
    await service.releaseMutate(
      String(release.id),
      input({
        action: 'validate',
        expectedVersion: 1,
        reason: 'Validate complete screenshot safety corpus',
      }),
    );
    await service.releaseMutate(
      String(release.id),
      input({
        action: 'publish',
        expectedVersion: 2,
        reason: 'Publish validated screenshot safety corpus',
      }),
    );
    await expect(
      pool.query("update public.tracking_rule_releases set snapshot='{}' where id=$1", [
        release.id,
      ]),
    ).rejects.toThrow('TRACKING_RELEASE_IMMUTABLE');
    const config = await repository.ruleSnapshot(principal);
    await service.releaseMutate(
      String(originalChannel.release_id),
      input({
        action: 'rollback',
        expectedVersion: config.channelVersion,
        reason: 'Keep baseline pointer after isolated test',
        patch: { mode: 'automatic' },
      }),
    );
  });
  it('posts through the normal ledger, then links cross-channel proven replay to the same transaction', async () => {
    const first = await capture(
      'Debit card XX4242 was used for AED12.50 at SAMPLE SHOP',
      'native-first',
      'provider-reference',
    );
    const firstItem = first.items.find((i) => i.sessionId === first.sessionId);
    if (!firstItem) throw new Error('ITEM_EXPECTED');
    expect(firstItem.status).toBe('accepted');
    const second = await capture(
      'Debit card XX4242 was used for AED12.50 at SAMPLE SHOP',
      'native-second',
      'provider-reference',
      'android_notification',
    );
    const secondItem = second.items.find((i) => i.sessionId === second.sessionId);
    expect(secondItem).toMatchObject({
      status: 'accepted',
      transactionId: firstItem.transactionId,
    });
    expect(
      (
        await pool.query<{ count: number }>(
          'select count(*)::int count from public.transactions where user_id=$1',
          [owner],
        )
      ).rows[0]?.count,
    ).toBe(1);
    expect(
      (
        await pool.query(
          'select sum(amount_minor)::bigint amount from public.transaction_postings where account_id=$1',
          [accountId],
        )
      ).rows[0]?.amount,
    ).toBe('-1250');
  });
  it('retains pending refund in review and does not emit a money effect', async () => {
    const captured = await capture(
      'AED5.00 has been refunded; amount will be credited within 2-3 working days',
      'pending-refund',
    );
    expect(captured.items.find((i) => i.sessionId === captured.sessionId)).toMatchObject({
      status: 'review',
      transactionId: null,
    });
  });
  it('holds a distinct same-amount purchase for similarity review rather than deleting it as a replay', async () => {
    const captured = await capture(
      'Debit card XX4242 was used for AED12.50 at SAMPLE SHOP',
      'native-distinct',
    );
    expect(captured.items.find((i) => i.sessionId === captured.sessionId)).toMatchObject({
      status: 'review',
      transactionId: null,
    });
    expect(
      (
        await pool.query(
          'select count(*)::int count from public.import_items where user_id=$1 and session_id=$2',
          [owner, captured.sessionId],
        )
      ).rows[0]?.count,
    ).toBe(1);
  });
  async function accept(item: Record<string, unknown>, edit: Record<string, unknown>) {
    const review = (
      await pool.query<{ id: string; version: string }>(
        'select id,version from public.review_items where import_item_id=$1',
        [item.id],
      )
    ).rows[0];
    if (!review) throw new Error('REVIEW_EXPECTED');
    return service.decideReview(review.id, {
      principal,
      body: { decision: 'edit_accept', expectedVersion: Number(review.version), edit },
      idempotencyKey: 'review-' + randomUUID(),
      requestId: randomUUID(),
    });
  }
  function itemFor(captured: { sessionId: string; items: Record<string, unknown>[] }) {
    const item = captured.items.find((i) => i.sessionId === captured.sessionId);
    if (!item) throw new Error('ITEM_EXPECTED');
    return item;
  }
  it('reuses the refund saved by a secondary review across settlement progression', async () => {
    const purchase = itemFor(
      await capture('Debit card XX4242 was used for AED24.30 at SAMPLE NOVA', 'refund-original'),
    );
    const original = (
      (await ledger.getTransaction(
        principal,
        String(purchase.transactionId),
        randomUUID(),
      )) as Record<string, unknown>
    ).transaction as Record<string, unknown>;
    await capture(
      'AED4.20 has been refunded; amount will be credited within 2-3 working days',
      'refund-primary',
      'settlement-reference',
    );
    const secondary = itemFor(
      await capture(
        'AED4.20 has been refunded; amount will be credited within 2-3 working days',
        'refund-secondary',
        'settlement-reference',
      ),
    );
    await accept(secondary, {
      settlementConfirmed: true,
      originalTransactionId: purchase.transactionId,
      originalTransactionVersion: original.version,
    });
    const settled = itemFor(
      await capture('AED4.20 has been refunded', 'refund-settled', 'settlement-reference'),
    );
    const reserved = await repository.captureTransaction(principal, String(settled.id));
    expect(reserved?.transactionId).toBeTruthy();
    await accept(settled, {
      originalTransactionId: purchase.transactionId,
      originalTransactionVersion: original.version,
    });
    expect(
      (
        await pool.query(
          "select count(*)::int count from public.transactions where user_id=$1 and kind='refund' and reverses_transaction_id=$2",
          [owner, purchase.transactionId],
        )
      ).rows[0]?.count,
    ).toBe(1);
  });
  it('posts the identified incoming transfer account as destination', async () => {
    const source = randomUUID();
    await pool.query(
      "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Transfer source','bank','AED')",
      [source, owner],
    );
    const incoming = itemFor(
      await capture('Incoming transfer from SAMPLE AED7.30', 'incoming-transfer'),
    );
    await accept(incoming, { destinationAccountId: source });
    const entries = (
      await pool.query(
        'select p.account_id,p.amount_minor::text amount from public.transaction_postings p join public.import_items i on i.transaction_id=p.transaction_id where i.id=$1',
        [incoming.id],
      )
    ).rows;
    expect(entries).toEqual(
      expect.arrayContaining([
        { account_id: source, amount: '-730' },
        { account_id: accountId, amount: '730' },
      ]),
    );
  });
  it('keeps a conflicting same-reference amount unresolved instead of ignoring edits', async () => {
    const saved = itemFor(
      await capture(
        'Debit card XX4242 was used for AED8.90 at CONFLICT SHOP',
        'conflict-original',
        'conflict-reference',
      ),
    );
    expect(saved.status).toBe('accepted');
    const conflict = itemFor(
      await capture(
        'Debit card XX4242 was used for AED9.90 at CONFLICT SHOP',
        'conflict-revision',
        'conflict-reference',
      ),
    );
    await expect(accept(conflict, { amountMinor: 990 })).rejects.toMatchObject({ status: 409 });
    expect(
      (await pool.query('select status from public.import_items where id=$1', [conflict.id]))
        .rows[0]?.status,
    ).toBe('review');
  });

  it('stores masked instrument bindings only when explicitly requested during review', async () => {
    const review = itemFor(await capture('Purchase AED2.17 pending card XX4242', 'binding-review'));
    await accept(review, { settlementConfirmed: true, rememberAccountBinding: true });
    expect(
      (
        await pool.query(
          'select provider,role,suffix,account_id from public.tracking_account_bindings where user_id=$1',
          [owner],
        )
      ).rows,
    ).toEqual([{ provider: 'adcb', role: 'card', suffix: '4242', account_id: accountId }]);
  });

  it('rejects swapped transfer replay edits without posting a second transfer', async () => {
    const source = randomUUID();
    await pool.query(
      "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Replay source','bank','AED')",
      [source, owner],
    );
    const incoming = itemFor(
      await capture('Incoming transfer from SAMPLE AED6.30', 'incoming-proof', 'transfer-proof'),
    );
    await accept(incoming, { destinationAccountId: source });
    const replay = itemFor(
      await capture(
        'Incoming transfer from SAMPLE AED6.30',
        'incoming-proof-replay',
        'transfer-proof',
      ),
    );
    await expect(
      accept(replay, { accountId: source, destinationAccountId: accountId }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (await pool.query('select status from public.import_items where id=$1', [replay.id])).rows[0]
        ?.status,
    ).toBe('review');
  });
  it('rejects an unrecognized provider binding before creating money', async () => {
    const review = itemFor(
      await capture(
        'Purchase AED3.17 pending card XX4242',
        'unknown-binding',
        undefined,
        'android_sms',
        'unknown-provider',
      ),
    );
    const prior: unknown = (
      await pool.query('select count(*)::int count from public.transactions where user_id=$1', [
        owner,
      ])
    ).rows[0]?.count;
    await expect(
      accept(review, { settlementConfirmed: true, rememberAccountBinding: true }),
    ).rejects.toMatchObject({ status: 400 });
    expect(
      (
        await pool.query('select count(*)::int count from public.transactions where user_id=$1', [
          owner,
        ])
      ).rows[0]?.count,
    ).toBe(prior);
  });
  it('uses the ledger reversal operation for a reviewed reversal', async () => {
    const original = itemFor(
      await capture('Debit card XX4242 was used for AED26.40 at SAMPLE NOVA', 'reversal-original'),
    );
    const transaction = (
      (await ledger.getTransaction(
        principal,
        String(original.transactionId),
        randomUUID(),
      )) as Record<string, unknown>
    ).transaction as Record<string, unknown>;
    const reversal = itemFor(await capture('Reversal AED26.40 card XX4242', 'reversal-notice'));
    await accept(reversal, {
      originalTransactionId: original.transactionId,
      originalTransactionVersion: transaction.version,
    });
    const reversed = (
      await pool.query(
        'select t.kind,t.reverses_transaction_id from public.transactions t join public.import_items i on i.transaction_id=t.id where i.id=$1',
        [reversal.id],
      )
    ).rows[0];
    expect(reversed).toMatchObject({
      kind: 'reversal',
      reverses_transaction_id: original.transactionId,
    });
  });
  it('holds a later settled message similar to an unresolved pending candidate', async () => {
    await capture('Pending purchase AED4.61 card XX4242 at SAMPLE MARKET', 'unresolved-purchase');
    const settled = itemFor(
      await capture('Purchase AED4.61 card XX4242 at SAMPLE MARKET', 'settled-without-proof'),
    );
    expect(settled).toMatchObject({ status: 'review', transactionId: null });
    expect(
      (
        await pool.query(
          'select count(*)::int count from public.transactions where user_id=$1 and amount_minor=461',
          [owner],
        )
      ).rows[0]?.count,
    ).toBe(0);
  });
  it('links equivalent spending wording with the same provider reference across channels', async () => {
    const first = itemFor(
      await capture(
        'Debit card XX4242 was used for AED5.91 at SAMPLE ARC',
        'wording-sms',
        'wording-proof',
      ),
    );
    const replay = itemFor(
      await capture(
        'Paid AED5.91 at SAMPLE ARC',
        'wording-notification',
        'wording-proof',
        'android_notification',
      ),
    );
    expect(first.status).toBe('accepted');
    expect(replay).toMatchObject({ status: 'accepted', transactionId: first.transactionId });
    expect(
      (
        await pool.query(
          'select count(*)::int count from public.transactions where user_id=$1 and amount_minor=591',
          [owner],
        )
      ).rows[0]?.count,
    ).toBe(1);
  });
  it('holds an automatic replay that disagrees with the account actually saved during review', async () => {
    const correctedAccount = randomUUID();
    await pool.query(
      "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Corrected account','bank','AED')",
      [correctedAccount, owner],
    );
    const pending = itemFor(
      await capture(
        'Pending purchase AED7.81 card XX4242 at SAMPLE EDIT',
        'edited-account-pending',
        'edited-account-proof',
      ),
    );
    await accept(pending, { accountId: correctedAccount, settlementConfirmed: true });
    const replay = itemFor(
      await capture(
        'Purchase AED7.81 card XX4242 at SAMPLE EDIT',
        'edited-account-replay',
        'edited-account-proof',
      ),
    );
    expect(replay).toMatchObject({ status: 'review', transactionId: null });
    const postings = (
      await pool.query(
        'select p.account_id,p.amount_minor::text amount from public.transaction_postings p join public.transactions t on t.id=p.transaction_id where t.user_id=$1 and t.amount_minor=781',
        [owner],
      )
    ).rows;
    expect(postings).toEqual([{ account_id: correctedAccount, amount: '-781' }]);
  });
  it('posts a separate fee sharing its purchase reference as a distinct ledger effect', async () => {
    const purchase = itemFor(
      await capture(
        'Purchase AED6.82 card XX4242 at SAMPLE FEE',
        'purchase-with-fee',
        'purchase-fee-proof',
      ),
    );
    const fee = itemFor(
      await capture('Service charge AED0.37 card XX4242', 'separate-fee', 'purchase-fee-proof'),
    );
    expect(purchase.status).toBe('accepted');
    expect(fee.status).toBe('accepted');
    expect(fee.transactionId).not.toBe(purchase.transactionId);
    const postings = (
      await pool.query(
        'select t.amount_minor::text amount from public.transactions t where t.user_id=$1 and t.id=any($2::uuid[]) order by t.amount_minor',
        [owner, [purchase.transactionId, fee.transactionId]],
      )
    ).rows;
    expect(postings).toEqual([{ amount: '37' }, { amount: '682' }]);
  });
});
