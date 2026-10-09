import { createHash, randomUUID } from 'node:crypto';
import { classifyFinancialMessage } from '@masarifi/transaction-parser';
import { TrackingRepository } from '../../../src/tracking/tracking.repository';
import { normalizeNormalizedImport } from '../../../src/tracking/tracking.dto';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('automatic tracking source assurance', () => {
  const pool = createLivePool();
  const repository = new TrackingRepository(pool);
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  let owner: string;
  let account: string;
  beforeEach(async () => {
    owner = `tracking_assurance_${randomUUID()}`;
    account = randomUUID();
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [owner]);
    await pool.query(
      "insert into public.accounts(id,user_id,name,type,currency_code,last_four,automatic_tracking_enabled) values($1,$2,'Verified instrument','bank','EGP','4242',true)",
      [account, owner],
    );
    await repository.getPreferences({
      userId: owner,
      sessionId: 'safety-test',
      factorAgeSeconds: 0,
    });
    await pool.query('update public.tracking_preferences set enabled=true where user_id=$1', [
      owner,
    ]);
    await pool.query(
      "insert into public.user_sender_rules(user_id,sender_pattern,display_label,trusted,enabled) values($1,'VERIFIEDBANK','Verified Bank',true,true)",
      [owner],
    );
  });
  afterAll(async () => pool.onModuleDestroy());
  async function prepare(
    text: string,
    sender = 'VERIFIEDBANK',
    reference?: string,
    patch: Record<string, unknown> = {},
  ) {
    const native = randomUUID();
    const config = await repository.ruleSnapshot({
      userId: owner,
      sessionId: 'safety-test',
      factorAgeSeconds: 0,
    });
    const { providerReference, ...classification } = classifyFinancialMessage({
      text,
      country: 'EG',
      receivedAt: Date.parse('2026-10-09T10:00:00Z'),
    });
    void providerReference;
    const command = normalizeNormalizedImport({
      schemaVersion: 2,
      sourceType: 'sms',
      sourceChannel: 'android_sms',
      events: [
        {
          sourceItemKey: hash(native),
          receivedAt: '2026-10-09T10:00:00Z',
          occurredAt: classification.occurredAt,
          sender,
          amountMinor:
            classification.direction === 'incoming'
              ? classification.amountMinor
              : -(classification.amountMinor ?? 0),
          currency: classification.currency,
          kind: classification.direction === 'incoming' ? 'income' : 'expense',
          accountId: account,
          classification,
          metadata: {
            sourceProvider: 'asserted-provider',
            ...(typeof config.configurationRevision === 'string'
              ? { ruleConfigurationRevision: config.configurationRevision }
              : {}),
          },
          transport: {
            deviceId: 'assurance-device-0001',
            channel: 'android_sms',
            nativeIdDigest: hash(native),
            revisionDigest: hash(text),
          },
          ...(reference ? { providerReferenceDigest: hash(reference) } : {}),
          ...patch,
        },
      ],
    });
    const created = await repository.createImport(
      { userId: owner, sessionId: 'safety-test', factorAgeSeconds: 0 },
      command,
      { sourceName: 'Isolated automatic safety test', key: native, requestId: randomUUID() },
    );
    const session = String((created.resource as Record<string, unknown>).id);
    const claim = (await repository.claimImports('assurance-test')).find((c) => c.id === session);
    if (!claim) throw new Error('Claim missing');
    await repository.prepareImport(session, claim.claim_token);
    return (
      await pool.query<{ status: string; id: string; reason: string | null }>(
        'select i.id,i.status,r.reason from public.import_items i left join public.review_items r on r.import_item_id=i.id where i.session_id=$1',
        [session],
      )
    ).rows[0];
  }
  it('does not let an unknown observation reserve the verified provider reference identity', async () => {
    const unknown = await prepare('Purchase EGP 5 card XX4242', 'unknown.sender', 'same-reference');
    const trusted = await prepare('Purchase EGP 5 card XX4242', 'VERIFIEDBANK', 'same-reference');
    expect(unknown?.status).toBe('review');
    expect(trusted?.status).toBe('parsed');
    const identities = (
      await pool.query<{ id: string; identity: string }>(
        'select id,canonical_identity_hash identity from public.import_items where id=any($1::uuid[])',
        [[unknown?.id, trusted?.id]],
      )
    ).rows;
    expect(new Set(identities.map((row) => row.identity)).size).toBe(2);
  });
  it('does not let an unverified similar review quarantine a trusted capture', async () => {
    await prepare('Purchase EGP 7 card XX4242', 'unknown.sender');
    expect((await prepare('Purchase EGP 7 card XX4242'))?.status).toBe('parsed');
  });
  it('reports insufficient independent source proof instead of a blanket review', async () => {
    expect(await prepare('Purchase EGP 9 card XX4242', 'unknown.sender')).toMatchObject({
      status: 'review',
      reason: 'source_proof_required',
    });
  });
  it('accepts complete bank deposit eligibility through the existing ledger income family', async () => {
    expect((await prepare('Deposited EGP 11 to account XX4242'))?.status).toBe('parsed');
  });
  it('reports missing account evidence even if the caller supplies an arbitrary account id', async () => {
    expect(await prepare('Payment EGP 13')).toMatchObject({
      status: 'review',
      reason: 'account_proof_required',
    });
  });
  it('keeps blocked sources blocked even when marked trusted', async () => {
    await pool.query('update public.user_sender_rules set enabled=false where user_id=$1', [owner]);
    expect(await prepare('Purchase EGP 15 card XX4242')).toMatchObject({
      status: 'review',
      reason: 'source_blocked',
    });
  });
  it('uses the protected lifecycle before source/account confidence', async () => {
    expect(await prepare('Purchase EGP 17 pending card XX4242')).toMatchObject({
      status: 'review',
      reason: 'lifecycle_not_completed',
    });
  });
});
