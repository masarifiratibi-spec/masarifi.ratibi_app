import { createHash, randomUUID } from 'node:crypto';
import { classifyFinancialMessage } from '@masarifi/transaction-parser';
import { TrackingRepository } from '../../../src/tracking/tracking.repository';
import { EngagementRepository } from '../../../src/engagement/engagement.repository';
import { normalizeNormalizedImport } from '../../../src/tracking/tracking.dto';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('scoped automatic tracking acceptance', () => {
  const pool = createLivePool();
  const repository = new TrackingRepository(pool);
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  let originalMode: string;
  beforeAll(async () => {
    originalMode =
      (await pool.query<{ mode: string }>('select mode from public.tracking_rule_channels limit 1'))
        .rows[0]?.mode ?? '';
    if (!originalMode) throw new Error('CHANNEL_EXPECTED');
    await pool.query("update public.tracking_rule_channels set mode='review'");
  });
  afterAll(async () => {
    await pool.query('update public.tracking_rule_channels set mode=$1', [originalMode]);
    await pool.onModuleDestroy();
  });
  async function journey(device: string, options: { optedIn?: boolean; expired?: boolean } = {}) {
    const userId = `tracking_cohort_${randomUUID()}`;
    const account = randomUUID();
    const principal = { userId, sessionId: 'cohort-test', factorAgeSeconds: 0 };
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [userId]);
    await pool.query(
      "insert into public.accounts(id,user_id,name,type,currency_code,last_four,automatic_tracking_enabled) values($1,$2,'Cohort bank','bank','EGP','4242',true)",
      [account, userId],
    );
    await repository.getPreferences(principal);
    await pool.query(
      'update public.tracking_preferences set enabled=true,review_required=$2 where user_id=$1',
      [userId, options.optedIn === false],
    );
    await pool.query(
      "insert into public.user_sender_rules(user_id,sender_pattern,display_label,trusted,enabled) values($1,'VERIFIEDBANK','Bank',true,true)",
      [userId],
    );
    // Running before the migration still exercises current behavior (review).
    // Once the feature exists, register a bounded owner/device/release cohort.
    const exists =
      (
        await pool.query<{ present: boolean }>(
          "select to_regclass('private.tracking_automatic_cohorts') is not null present",
        )
      ).rows[0]?.present ?? false;
    if (exists)
      await pool.query(
        `insert into private.tracking_automatic_cohorts(user_id,device_id,release_id,engine_version,expires_at,reason)
      select $1,'cohort-approved-device',release_id,'2.0.0',clock_timestamp()+$2::interval,'Isolated scoped acceptance test'
      from public.tracking_rule_channels limit 1`,
        [userId, options.expired ? '-1 hour' : '1 hour'],
      );
    const config = await repository.ruleSnapshot(principal);
    const native = randomUUID();
    const { providerReference, originalProviderReference, ...classification } =
      classifyFinancialMessage({
        text: 'Purchase EGP5 card XX4242',
        receivedAt: Date.parse('2026-10-09T10:00:00Z'),
      });
    void providerReference;
    void originalProviderReference;
    const command = normalizeNormalizedImport({
      schemaVersion: 2,
      sourceType: 'sms',
      sourceChannel: 'android_sms',
      events: [
        {
          sourceItemKey: hash(native),
          receivedAt: '2026-10-09T10:00:00Z',
          occurredAt: classification.occurredAt,
          sender: 'VERIFIEDBANK',
          amountMinor: -500,
          currency: 'EGP',
          kind: 'expense',
          accountId: account,
          classification,
          metadata: { ruleConfigurationRevision: config.configurationRevision },
          transport: {
            deviceId: device,
            channel: 'android_sms',
            nativeIdDigest: hash(native),
            revisionDigest: hash('body'),
          },
        },
      ],
    });
    const response = await repository.createImport(principal, command, {
      sourceName: 'Cohort test',
      key: native,
      requestId: randomUUID(),
    });
    const session = String((response.resource as Record<string, unknown>).id);
    const claim = (await repository.claimImports('cohort-test')).find(
      (entry) => entry.id === session,
    );
    if (!claim) throw new Error('CLAIM_EXPECTED');
    await repository.prepareImport(session, claim.claim_token);
    const finalized = await repository.finalizeImport(session, claim.claim_token);
    await repository.completeImport(session, claim.claim_token, 'succeeded', null);
    return { config, finalized, principal, account, session };
  }
  it('allows only the opted-in owner/device while the global rollout stays review', async () => {
    const approved = await journey('cohort-approved-device');
    expect(approved.config.rolloutMode).toBe('automatic');
    expect(approved.finalized.autoItems).toHaveLength(1);
    expect(
      (await pool.query<{ mode: string }>('select mode from public.tracking_rule_channels limit 1'))
        .rows[0]?.mode,
    ).toBe('review');
    expect((await journey('another-device')).finalized.autoItems).toHaveLength(0);
  });
  it('requires owner opt-in and a nonexpired cohort', async () => {
    expect(
      (await journey('cohort-approved-device', { optedIn: false })).finalized.autoItems,
    ).toHaveLength(0);
    expect(
      (await journey('cohort-approved-device', { expired: true })).finalized.autoItems,
    ).toHaveLength(0);
  });

  it('prepares one confirmation for a committed cohort capture and leaves unrelated events alone', async () => {
    const { principal, account, session } = await journey('cohort-approved-device');
    const transaction = (
      await pool.query<{ result: { transactionId: string } }>(
        'select private.post_transaction($1,$2::jsonb) result',
        [
          principal.userId,
          JSON.stringify({
            kind: 'expense',
            accountId: account,
            amountMinor: 500,
            currency: 'EGP',
            title: 'Cohort purchase',
            occurredAt: '2026-10-09T10:00:00Z',
            source: 'tracking-import',
          }),
        ],
      )
    ).rows[0]?.result.transactionId;
    if (!transaction) throw new Error('TRANSACTION_EXPECTED');
    await pool.query(
      "update public.import_items set status='accepted',transaction_id=$1 where session_id=$2",
      [transaction, session],
    );
    await pool.query(
      "select private.enqueue_outbox_event('transaction.created','transaction',$1,jsonb_build_object('userId',$2::text))",
      [transaction, principal.userId],
    );
    const unrelated = randomUUID();
    await pool.query(
      "select private.enqueue_outbox_event('assistant.message.completed','assistant-message',$1,jsonb_build_object('userId',$2::text))",
      [unrelated, principal.userId],
    );
    const engagement = new EngagementRepository(pool, {} as never);
    const sources = (await engagement.claimTrackingSourceEvents(100)).filter(
      (source) => source.user_id === principal.userId,
    );
    expect(sources).toHaveLength(1);
    const source = sources[0];
    if (!source) throw new Error('CONFIRMATION_SOURCE_EXPECTED');
    expect(source).toMatchObject({ source_id: transaction, event_type: 'transaction.created' });
    await engagement.createNotificationFromSource(source, [
      {
        channel: 'in_app',
        provider: 'database',
        title: 'Saved',
        body: 'Saved',
        status: 'queued',
        nextAttemptAt: null,
      },
      {
        channel: 'push',
        provider: 'push',
        title: 'Saved',
        body: 'Saved',
        status: 'queued',
        nextAttemptAt: null,
      },
    ]);
    expect(
      (await engagement.claimTrackingSourceEvents(100)).filter(
        (source) => source.user_id === principal.userId,
      ),
    ).toHaveLength(0);
    expect(
      (
        await pool.query('select published_at from private.outbox_events where aggregate_id=$1', [
          unrelated,
        ])
      ).rows,
    ).toEqual([{ published_at: null }]);
    expect(
      await repository.confirmation(
        principal,
        String(
          (
            await pool.query('select id from public.notification_events where source_event_id=$1', [
              source.source_event_id,
            ])
          ).rows[0]?.id,
        ),
      ),
    ).toMatchObject({
      ready: true,
      allowed: true,
      transaction: { amountMinor: 500, currency: 'EGP', direction: 'outgoing' },
    });
  });
});
