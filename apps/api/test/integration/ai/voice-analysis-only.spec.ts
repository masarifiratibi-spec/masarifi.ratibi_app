import { randomUUID } from 'node:crypto';
import { AiRepository } from '../../../src/ai/ai.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('Nonposting voice analysis boundary', () => {
  const pool = createLivePool();
  const user = 'voice_analysis_' + randomUUID();
  const account = randomUUID();
  const principal = { userId: user, sessionId: 'analysis-test', factorAgeSeconds: 0 };
  const input = {
    locale: 'en',
    durationMs: 3000,
    contentType: 'audio/m4a',
    sizeBytes: 100,
    contentHash: 'a'.repeat(64),
    recordedAt: new Date().toISOString(),
    timezoneOffsetMinutes: -180,
  };
  beforeAll(async () => {
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [user]);
    await pool.query(
      "insert into public.accounts(id,user_id,name,type,currency_code,is_default) values($1,$2,'Cash','cash','SAR',true)",
      [account, user],
    );
    await pool.query('update private.voice_automatic_policy set enabled=false');
  });
  afterAll(async () => {
    await pool.query('update private.voice_analysis_policy set enabled=false,owner_id=null');
    await pool.query('delete from public.voice_sessions where user_id=$1', [user]);
    await pool.onModuleDestroy();
  });

  async function analysisFixture() {
    await pool.query('update private.voice_automatic_policy set enabled=false');
    await pool.query('update private.voice_analysis_policy set enabled=true,owner_id=$1', [user]);
    const repository = new AiRepository(pool);
    const created = await repository.createVoiceSession(principal, input, randomUUID(), 300, {
      maxAuthAge: 300,
      thresholds: {},
      analysisOnly: true,
    });
    const session = String(
      ((created as Record<string, unknown>).resource as Record<string, unknown>).id,
    );
    const token = randomUUID();
    await pool.query(
      "update public.voice_sessions set status='processing',claim_token=$2,claimed_by='analysis-test',lease_until=clock_timestamp()+interval '2 minutes' where id=$1",
      [session, token],
    );
    const command = {
      kind: 'expense',
      amountMinor: 2500,
      currency: 'SAR',
      accountId: account,
      categoryId: null,
      title: 'Breakfast',
      merchant: null,
      paymentMethod: null,
      note: null,
      occurredAt: new Date().toISOString(),
      source: 'voice',
      externalRef: null,
    };
    return { repository, session, token, decisions: [{ status: 'eligible', command }] };
  }

  it('keeps accepted analysis nonfinancial even if the automatic gate is subsequently enabled', async () => {
    const f = await analysisFixture();
    await pool.query('update private.voice_automatic_policy set enabled=true');
    try {
      await f.repository.acceptVoiceBatch(
        f.session,
        f.token,
        f.decisions,
        'automatic-or-skip-v3.1',
      );
      await f.repository.finalizeVoiceBatches(25);
      expect((await f.repository.getVoiceBatchResult(principal, f.session)).addedCount).toBe(0);
      expect(
        (await pool.query('select * from private.voice_event_commands where user_id=$1', [user]))
          .rows,
      ).toHaveLength(0);
      expect(
        (await pool.query('select * from public.transactions where user_id=$1', [user])).rows,
      ).toHaveLength(0);
    } finally {
      await pool.query('update private.voice_automatic_policy set enabled=false');
    }
  });

  it('fences late analysis after cancellation and exposes its media only to the scoped purge', async () => {
    const f = await analysisFixture();
    await f.repository.cancelVoiceSession(principal, f.session, randomUUID());
    await expect(
      f.repository.acceptVoiceBatch(f.session, f.token, f.decisions, 'automatic-or-skip-v3.1'),
    ).rejects.toMatchObject({ status: 409 });
    const claims = await f.repository.claimAnalysisPurges('analysis-purge-test', 25, 120);
    expect(claims.map((c) => c.id)).toContain(f.session);
    for (const claim of claims) await f.repository.completePurge(claim.id, claim.purge_token, true);
    expect((await f.repository.getVoiceBatchResult(principal, f.session)).status).toBe('cancelled');
  });

  it('removes expired extracted fields from both the owner receipt and bounded cleanup storage', async () => {
    const f = await analysisFixture();
    await f.repository.acceptVoiceBatch(f.session, f.token, f.decisions, 'automatic-or-skip-v3.1');
    await pool.query(
      "update private.voice_batch_context set analysis_expires_at=clock_timestamp()-interval '1 second' where session_id=$1",
      [f.session],
    );
    await pool.query('update private.voice_analysis_policy set enabled=false');
    await f.repository.finalizeVoiceBatches(25);
    expect((await f.repository.getVoiceBatchResult(principal, f.session)).analysis).toMatchObject({
      events: [],
    });
    const claims = await f.repository.claimAnalysisPurges('expiry-test', 25, 120);
    for (const claim of claims) await f.repository.completePurge(claim.id, claim.purge_token, true);
    expect(
      (
        await pool.query(
          'select analysis_events from private.voice_batch_context where session_id=$1',
          [f.session],
        )
      ).rows[0],
    ).toEqual({ analysis_events: [] });
  });

  it('claims only allowed analysis sessions rather than an ordinary session for the same owner', async () => {
    const analysis = await analysisFixture();
    const ordinary = await analysisFixture();
    await pool.query(
      'update private.voice_batch_context set analysis_only=false where session_id=$1',
      [ordinary.session],
    );
    await pool.query(
      "update public.voice_sessions set status='uploaded',uploaded_at=clock_timestamp(),finalized_at=clock_timestamp(),claim_token=null,claimed_by=null,lease_until=null where id=any($1::uuid[])",
      [[analysis.session, ordinary.session]],
    );
    const claims = await analysis.repository.claimAnalysisWork('scope-test', 25, 120);
    expect(claims.map((c) => c.id)).toEqual([analysis.session]);
  });

  it('retains cleanup ownership through hard session deletion without claiming unrelated media', async () => {
    const f = await analysisFixture();
    await pool.query('delete from public.voice_sessions where id=$1', [f.session]);
    const claims = await f.repository.claimAnalysisPurges('tombstone-test', 25, 120);
    expect(claims.map((c) => c.id)).toContain(f.session);
    await pool.query(
      "update private.voice_media_tombstones set capability_expires_at=clock_timestamp()-interval '1 second' where id=$1",
      [f.session],
    );
    for (const claim of claims) await f.repository.completePurge(claim.id, claim.purge_token, true);
    expect(
      (await pool.query('select * from private.voice_media_tombstones where id=$1', [f.session]))
        .rows,
    ).toHaveLength(0);
  });

  it('rejects missing immutable context instead of completing a mode-less batch', async () => {
    const f = await analysisFixture();
    await pool.query('delete from private.voice_batch_context where session_id=$1', [f.session]);
    await expect(
      f.repository.acceptVoiceBatch(f.session, f.token, f.decisions, 'automatic-or-skip-v3.1'),
    ).rejects.toMatchObject({ status: 422, response: { code: 'VOICE_CONTRACT_INVALID' } });
  });

  it.each(['claim_voice_analysis_work', 'claim_voice_analysis_purge'])(
    'rejects unbounded NULL claim limits in %s',
    async (fn) => {
      await expect(
        pool.query(`select * from private.${fn}($1,$2,$3)`, ['null-limit-test', null, 120]),
      ).rejects.toMatchObject({ message: 'AI_CLAIM_INVALID' });
    },
  );

  it('admits only the authorized analysis owner while ordinary posting admission stays OFF', async () => {
    await pool.query('update private.voice_analysis_policy set enabled=true,owner_id=$1', [user]);
    const repository = new AiRepository(pool);
    await expect(
      repository.createVoiceSession(principal, input, 'ordinary-off', 300, {
        maxAuthAge: 300,
        thresholds: {},
      }),
    ).rejects.toMatchObject({ status: 503, response: { code: 'VOICE_AUTOMATIC_UNAVAILABLE' } });
    const result = await repository.createVoiceSession(principal, input, 'analysis-off', 300, {
      maxAuthAge: 300,
      thresholds: {},
      analysisOnly: true,
    });
    const replay = await repository.createVoiceSession(principal, input, 'analysis-off', 300, {
      maxAuthAge: 300,
      thresholds: {},
      analysisOnly: true,
    });
    expect(replay).toEqual({ ...result, replayed: true });
    const session = String(
      ((result as Record<string, unknown>).resource as Record<string, unknown>).id,
    );
    const token = randomUUID();
    await pool.query(
      "update public.voice_sessions set status='processing',claim_token=$2,claimed_by='analysis-test',lease_until=clock_timestamp()+interval '2 minutes' where id=$1",
      [session, token],
    );
    const command = {
      kind: 'expense',
      amountMinor: 2500,
      currency: 'SAR',
      accountId: account,
      categoryId: null,
      title: 'Breakfast',
      merchant: null,
      paymentMethod: null,
      note: null,
      occurredAt: new Date().toISOString(),
      source: 'voice',
      externalRef: null,
    };
    await repository.acceptVoiceBatch(
      session,
      token,
      [
        { status: 'eligible', command },
        { status: 'skipped', reason: 'missing_amount' },
      ],
      'automatic-or-skip-v3.1',
    );
    const receipt = await repository.getVoiceBatchResult(principal, session);
    expect(receipt).toMatchObject({
      status: 'completed',
      transactionIds: [],
      addedCount: 0,
      ledgerVersion: 0,
      analysis: {
        mode: 'analysis_only',
        persisted: false,
        events: [
          {
            ordinal: 0,
            kind: 'expense',
            amountMinor: 2500,
            accountId: account,
            title: 'Breakfast',
          },
        ],
      },
    });
    await repository.finalizeVoiceBatches(25);
    expect(
      (await pool.query('select * from public.transactions where user_id=$1', [user])).rows,
    ).toHaveLength(0);
    expect(
      (await pool.query('select * from private.voice_events where user_id=$1', [user])).rows,
    ).toHaveLength(0);
    expect(
      (await pool.query('select * from private.voice_event_commands where user_id=$1', [user]))
        .rows,
    ).toHaveLength(0);
    await pool.query('update private.voice_analysis_policy set owner_id=$1', [user + '-other']);
    await expect(
      repository.createVoiceSession(principal, input, 'not-authorized', 300, {
        maxAuthAge: 300,
        thresholds: {},
        analysisOnly: true,
      }),
    ).rejects.toMatchObject({ status: 503 });
    await pool.query('update private.voice_analysis_policy set enabled=false');
  });
});
