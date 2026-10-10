import { createHash, randomUUID } from 'node:crypto';
import { AiRepository } from '../../../src/ai/ai.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';

// This suite runs only against the disposable CI/local database, never hosted Staging.
describeLiveDatabase('Staging Voice epoch financial boundary', () => {
  const pool = createLivePool();
  const user = 'voice_epoch_' + randomUUID();
  const other = 'voice_epoch_other_' + randomUUID();
  const account = randomUUID();
  const otherAccount = randomUUID();
  const category = '04000000-0000-4000-8000-000000000002';
  let epoch: string;
  let epochMode: string;
  let oldEnforced: boolean;
  let oldPosting: boolean;
  const repository = new AiRepository(pool);
  function query(text: string, values: readonly unknown[] = []) {
    return pool.query<Record<string, unknown>>(text, values);
  }
  function row<T>(value: T | undefined): T {
    if (value === undefined) throw new Error('EXPECTED_DATABASE_ROW');
    return value;
  }
  beforeAll(async () => {
    for (const [owner, id] of [
      [user, account],
      [other, otherAccount],
    ]) {
      await query("insert into public.profiles(id,status) values($1,'active')", [owner]);
      await query(
        "insert into public.accounts(id,user_id,name,type,currency_code,is_default) values($1,$2,'Cash','cash','SAR',true)",
        [id, owner],
      );
    }
    oldEnforced =
      row((await query('select enforced from private.staging_voice_runtime_control')).rows[0])
        .enforced === true;
    oldPosting =
      row((await query('select enabled from private.voice_automatic_policy')).rows[0]).enabled ===
      true;
  });
  afterEach(async () => {
    if (epoch) await query("select private.close_staging_voice_epoch($1,'test_finished')", [epoch]);
    await query('update private.staging_voice_runtime_control set enforced=$1,current_epoch=null', [
      oldEnforced,
    ]);
    await query('update private.voice_automatic_policy set enabled=$1', [oldPosting]);
  });
  afterAll(async () => {
    await pool.onModuleDestroy();
  });
  async function prepare(mode = 'canary', activate = true) {
    epochMode = mode;
    const manifest = {
      version: 1,
      mode,
      sourceSha: 'a'.repeat(40),
      imageDigest: 'b'.repeat(64),
      apkHash: 'c'.repeat(64),
      controlHash: 'd'.repeat(64),
      clerkSessionHash: createHash('sha256').update('epoch-test').digest('hex'),
      ownerId: user,
      accountId: account,
      categoryId: category,
    };
    const prepared = row(
      (
        await query('select private.prepare_staging_voice_epoch($1,$2::jsonb) result', [
          'qcffvfbpzvpwcwxwjyro',
          JSON.stringify(manifest),
        ])
      ).rows[0],
    ).result as Record<string, unknown>;
    epoch = String(prepared.epochId);
    if (activate)
      await query(
        "select private.activate_staging_voice_epoch($1,$2,clock_timestamp()+interval '600 seconds')",
        [epoch, prepared.manifestHash],
      );
    return prepared;
  }
  async function create(
    locale = 'en',
    owner = user,
    hash = '1'.repeat(64),
    authSession = 'epoch-test',
  ) {
    const captureTime = row(
      (
        await query(
          'select to_char(clock_timestamp() at time zone \'UTC\', \'YYYY-MM-DD"T"HH24:MI:SS.US"Z"\') value',
        )
      ).rows[0],
    ).value;
    const input = {
      locale,
      durationMs: 3000,
      contentType: 'audio/m4a',
      sizeBytes: 100,
      contentHash: hash,
      recordedAt: String(captureTime),
      timezoneOffsetMinutes: -180,
    };
    const created = await repository.createVoiceSession(
      { userId: owner, sessionId: authSession, factorAgeSeconds: 0 },
      input,
      randomUUID(),
      300,
      { maxAuthAge: 300, thresholds: {} },
    );
    const session = String((created as { resource: Record<string, unknown> }).resource.id);
    await query(
      "update public.voice_sessions set status='uploaded',uploaded_at=clock_timestamp(),finalized_at=clock_timestamp() where id=$1",
      [session],
    );
    return session;
  }
  async function accept(session: string, patch = {}, decisionsOverride?: unknown[]) {
    const claims = (
      await query("select * from private.claim_staging_voice_work($1,'epoch-test',1,120)", [epoch])
    ).rows;
    const claim = row(claims.find((r) => r.id === session));
    expect(claim).toBeDefined();
    const work = row(
      (
        await query("select private.get_ai_work_input('voice.transcribe_extract',$1,$2) result", [
          session,
          claim.claim_token,
        ])
      ).rows[0],
    ).result as Record<string, unknown>;
    expect(work.retainAcceptanceEvidence).toBe(epochMode === 'canary');
    const command = {
      kind: 'expense',
      amountMinor: 2500,
      currency: 'SAR',
      accountId: account,
      categoryId: category,
      title: 'Food',
      merchant: null,
      paymentMethod: null,
      note: null,
      occurredAt: new Date().toISOString(),
      source: 'voice',
      externalRef: null,
      ...patch,
    };
    return row(
      (
        await query('select private.accept_voice_batch($1,$2,$3::jsonb,$4) result', [
          session,
          claim.claim_token,
          JSON.stringify(decisionsOverride ?? [{ status: 'eligible', command }]),
          'automatic-or-skip-v3.1',
        ])
      ).rows[0],
    ).result as Record<string, unknown>;
  }
  async function commit(session: string) {
    await accept(session);
    const claim = row(
      (await query('select * from private.claim_staging_voice_finalization($1,1)', [epoch]))
        .rows[0],
    );
    expect(claim).toBeDefined();
    const event = row(
      (await query('select id from private.voice_events where batch_id=$1', [claim.batch_id]))
        .rows[0],
    );
    await query('select private.execute_voice_event($1,$2,$3)', [
      claim.batch_id,
      claim.token,
      event.id,
    ]);
    return {
      batch_id: String(claim.batch_id),
      token: String(claim.token),
      event: String(event.id),
    };
  }
  it('preparation keeps Posting disabled and financial admission closed', async () => {
    await query('update private.voice_automatic_policy set enabled=false');
    await prepare('canary', false);
    expect(
      row((await query('select enabled from private.voice_automatic_policy')).rows[0]).enabled,
    ).toBe(false);
    await expect(create()).rejects.toMatchObject({ status: 503 });
  });
  it('rejects the wrong owner, Arabic-first and a third capture without financial effects', async () => {
    await prepare();
    await expect(create('en', other)).rejects.toMatchObject({ status: 503 });
    await expect(create('en', user, '1'.repeat(64), 'another-device')).rejects.toMatchObject({
      status: 503,
    });
    await expect(create('ar')).rejects.toMatchObject({ status: 503 });
    await commit(await create('en'));
    await commit(await create('ar', user, '2'.repeat(64)));
    await expect(create()).rejects.toMatchObject({ status: 503 });
    expect(
      row(
        (await query('select count(*)::int n from public.transactions where user_id=$1', [user]))
          .rows[0],
      ).n,
    ).toBe(2);
    expect(
      row(
        (
          await query(
            'select confirmed_minor::text amount from public.account_balances where account_id=$1',
            [account],
          )
        ).rows[0],
      ).amount,
    ).toBe('-5000');
  });
  it.each([
    { amountMinor: 2501 },
    { accountId: otherAccount },
    { occurredAt: '2026-01-01T00:00:00.000Z' },
  ])('closes admission before accepting an unexpected extracted command %j', async (patch) => {
    await prepare();
    const session = await create();
    const result = await accept(session, patch);
    expect(result.accepted).toBe(false);
    expect(
      row((await query('select enabled from private.voice_automatic_policy')).rows[0]).enabled,
    ).toBe(false);
    expect(
      row(
        (
          await query(
            'select count(*)::int n from private.voice_events where batch_id=(select id from private.voice_batches where session_id=$1)',
            [session],
          )
        ).rows[0],
      ).n,
    ).toBe(0);
  });
  it('fences in-flight execution after revocation and permits only committed receipt replay', async () => {
    await prepare();
    const session = await create();
    await accept(session);
    const claim = row(
      (await query('select * from private.claim_staging_voice_finalization($1,1)', [epoch]))
        .rows[0],
    );
    const event = row(
      (await query('select id from private.voice_events where batch_id=$1', [claim.batch_id]))
        .rows[0],
    );
    await query("select private.close_staging_voice_epoch($1,'revoked')", [epoch]);
    await expect(
      query('select private.execute_voice_event($1,$2,$3)', [
        claim.batch_id,
        claim.token,
        event.id,
      ]),
    ).rejects.toMatchObject({ message: 'VOICE_AUTOMATIC_PAUSED' });
  });
  it('replays a committed event after the transaction commits without another posting', async () => {
    await prepare();
    const committed = await commit(await create());
    const before = row(
      (
        await query('select transaction_id from private.voice_events where id=$1', [
          committed.event,
        ])
      ).rows[0],
    ).transaction_id;
    expect(
      row(
        (
          await query(
            'select command_evidence from private.staging_voice_members where epoch_id=$1',
            [epoch],
          )
        ).rows[0],
      ).command_evidence,
    ).toMatchObject({ amountMinor: 2500, accountId: account });
    await query("select private.close_staging_voice_epoch($1,'finished')", [epoch]);
    const replay = row(
      (
        await query('select private.execute_voice_event($1,$2,$3) result', [
          committed.batch_id,
          committed.token,
          committed.event,
        ])
      ).rows[0],
    ).result as Record<string, unknown>;
    expect(replay).toEqual({ status: 'committed', transactionId: before });
    expect(
      row(
        (
          await query(
            'select count(*)::int n from public.transaction_postings where transaction_id=$1',
            [before],
          )
        ).rows[0],
      ).n,
    ).toBe(1);
  });
  it.each(['account-lock', 'deferred-commit'])(
    'rolls back all ledger effects when %s crosses the exact deadline',
    async (boundary) => {
      await prepare();
      const session = await create();
      await accept(session);
      const claim = row(
        (await query('select * from private.claim_staging_voice_finalization($1,1)', [epoch]))
          .rows[0],
      );
      const event = row(
        (await query('select id from private.voice_events where batch_id=$1', [claim.batch_id]))
          .rows[0],
      );
      const ledgerState = async () =>
        row(
          (
            await query(
              `select
        (select count(*)::int from public.transactions where user_id=$1) transactions,
        (select count(*)::int from public.transaction_postings p join public.transactions t on t.id=p.transaction_id where t.user_id=$1) postings,
        (select jsonb_agg(to_jsonb(b) order by b.account_id) from public.account_balances b join public.accounts a on a.id=b.account_id where a.user_id=$1) balances`,
              [user],
            )
          ).rows[0],
        );
      const before = await ledgerState();
      await query(
        "update private.staging_voice_epochs set expires_at=clock_timestamp()+interval '600 milliseconds' where id=$1",
        [epoch],
      );
      const result = await pool.withClient(async (client) => {
        await client.query('begin');
        try {
          if (boundary === 'account-lock') {
            await client.query('select id from public.accounts where id=$1 for update', [account]);
            const attempt = query('select private.execute_voice_event($1,$2,$3)', [
              claim.batch_id,
              claim.token,
              event.id,
            ]).catch((e: unknown) => e);
            await new Promise((resolve) => setTimeout(resolve, 800));
            await client.query('rollback');
            return await attempt;
          }
          await client.query('select private.execute_voice_event($1,$2,$3)', [
            claim.batch_id,
            claim.token,
            event.id,
          ]);
          await new Promise((resolve) => setTimeout(resolve, 800));
          try {
            return await client.query('commit');
          } catch (e) {
            await client.query('rollback');
            return e;
          }
        } finally {
          await client.query('rollback');
        }
      });
      expect(result).toMatchObject({ message: 'VOICE_SCOPE_EXPIRED' });
      expect(await ledgerState()).toEqual(before);
      expect(
        row(
          (await query('select transaction_id from private.voice_events where id=$1', [event.id]))
            .rows[0],
        ).transaction_id,
      ).toBeNull();
      expect(
        row(
          (
            await query(
              'select count(*)::int n from public.transactions t join private.voice_events e on e.transaction_id=t.id where e.id=$1',
              [event.id],
            )
          ).rows[0],
        ).n,
      ).toBe(0);
      await query("select private.staging_voice_heartbeat($1,'deadline-test',$2)", [
        epoch,
        'a'.repeat(40),
      ]);
      expect(
        row((await query('select enabled from private.voice_automatic_policy')).rows[0]).enabled,
      ).toBe(false);
    },
  );
  it('admits multiple eligible owners in operating mode and never claims old sessions', async () => {
    await query('update private.staging_voice_runtime_control set enforced=false');
    await query('update private.voice_automatic_policy set enabled=true');
    const historical = await create();
    await prepare('operating');
    const a = await create('en');
    const b = await create('ar', other);
    const rows = (
      await query("select * from private.claim_staging_voice_work($1,'epoch-test',2,120)", [epoch])
    ).rows;
    expect(new Set(rows.map((row) => row.id))).toEqual(new Set([a, b]));
    expect(rows.map((row) => row.id)).not.toContain(historical);
    for (const claim of rows) {
      const work = row(
        (
          await query("select private.get_ai_work_input('voice.transcribe_extract',$1,$2) result", [
            claim.id,
            claim.claim_token,
          ])
        ).rows[0],
      ).result as Record<string, unknown>;
      expect(work.retainAcceptanceEvidence).toBe(false);
    }
    await expect(
      repository.getVoiceBatchResult(
        { userId: other, sessionId: 'other-test', factorAgeSeconds: 0 },
        a,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('claims concurrently without duplication and recovers only expired leases', async () => {
    await prepare('operating');
    const a = await create(),
      b = await create('ar', other);
    const results = await Promise.all([
      query("select * from private.claim_staging_voice_work($1,'worker-a',1,120)", [epoch]),
      query("select * from private.claim_staging_voice_work($1,'worker-b',1,120)", [epoch]),
    ]);
    expect(new Set(results.flatMap((r) => r.rows.map((row) => row.id)))).toEqual(new Set([a, b]));
    expect(
      (await query("select * from private.claim_staging_voice_work($1,'worker-c',1,120)", [epoch]))
        .rows,
    ).toHaveLength(0);
    const old = row(results.flatMap((r) => r.rows).find((r) => r.id === a));
    await query(
      "update public.voice_sessions set lease_until=clock_timestamp()-interval '1 second' where id=$1",
      [a],
    );
    const recovered = row(
      (await query("select * from private.claim_staging_voice_work($1,'worker-c',1,120)", [epoch]))
        .rows[0],
    );
    expect(recovered.id).toBe(a);
    expect(recovered.claim_token).not.toBe(old.claim_token);
    await expect(
      query("select private.accept_voice_batch($1,$2,'[]'::jsonb,'automatic-or-skip-v3.1')", [
        a,
        old.claim_token,
      ]),
    ).rejects.toBeDefined();
  });
  it('expired epoch stops claims and heartbeat disables Posting', async () => {
    await prepare('operating');
    await create();
    await query(
      "update private.staging_voice_epochs set expires_at=clock_timestamp()-interval '1 second' where id=$1",
      [epoch],
    );
    expect(
      (await query("select * from private.claim_staging_voice_work($1,'expired',1,120)", [epoch]))
        .rows,
    ).toHaveLength(0);
    const state = row(
      (
        await query("select private.staging_voice_heartbeat($1,'expired',$2) result", [
          epoch,
          'a'.repeat(40),
        ])
      ).rows[0],
    ).result as Record<string, unknown>;
    expect(state.enabled).toBe(false);
    expect(
      row((await query('select enabled from private.voice_automatic_policy')).rows[0]).enabled,
    ).toBe(false);
  });
  it('scoped cleanup preserves historical sessions and private controls are capability-only', async () => {
    await query('update private.staging_voice_runtime_control set enforced=false');
    await query('update private.voice_automatic_policy set enabled=true');
    const historical = await create();
    await prepare('operating');
    const admitted = await create();
    await query(
      "update public.voice_sessions set status='failed',storage_ref='voice/'||id::text||'/'||id::text,media_capability_expires_at=clock_timestamp()-interval '1 second',lease_until=null where id=any($1::uuid[])",
      [[historical, admitted]],
    );
    const claimed = (
      await query("select * from private.claim_staging_voice_purge($1,'cleanup',25,120)", [epoch])
    ).rows;
    expect(claimed.map((r) => r.id)).toEqual([admitted]);
    const privileges = row(
      (
        await query(`select has_table_privilege('masarifi_worker','private.staging_voice_epochs','UPDATE') dml,
      has_table_privilege('masarifi_api','private.staging_voice_members','SELECT') exposed,
      has_function_privilege('masarifi_worker','private.activate_staging_voice_epoch(uuid,text,timestamptz)','EXECUTE') activate,
      has_function_privilege('masarifi_worker','private.claim_staging_voice_work(uuid,text,integer,integer)','EXECUTE') scoped`)
      ).rows[0],
    );
    expect(privileges).toEqual({ dml: false, exposed: false, activate: false, scoped: true });
  });
  it('keeps persistent operating Posting through worker replacement and committed receipt recovery', async () => {
    const prepared = await prepare('operating', false);
    await query('select private.activate_staging_voice_epoch($1,$2,null)', [epoch, prepared.manifestHash]);
    const count = async () => row((await query(`select
      (select count(*)::int from public.transactions where user_id=$1) transactions,
      (select count(*)::int from public.transaction_postings p join public.transactions t on t.id=p.transaction_id where t.user_id=$1) postings,
      coalesce((select confirmed_minor::text from public.account_balances where account_id=$2),'0') balance`, [user, account])).rows[0]);
    const before = await count();
    for (const [locale, worker] of [['en', 'before-restart'], ['ar', 'after-restart']]) {
      const state = row((await query('select private.staging_voice_heartbeat($1,$2,$3) result',
        [epoch, worker, 'a'.repeat(40)])).rows[0]).result as Record<string, unknown>;
      expect(state.enabled).toBe(true);
      const session = await create(locale);
      const committed = await commit(session);
      const execute = () => query('select private.execute_voice_event($1,$2,$3) result',
        [committed.batch_id, committed.token, committed.event]);
      const replay = await Promise.all([execute(), execute()]);
      expect(replay.map(r => (r.rows[0]?.result as Record<string, unknown>).status))
        .toEqual(['committed', 'committed']);
      const receipt = row((await query('select private.get_voice_batch_result($1,$2) result',
        [user, session])).rows[0]).result as Record<string, unknown>;
      expect(receipt).toMatchObject({ status: 'completed', addedCount: 1 });
      expect(receipt.transactionIds).toHaveLength(1);
    }
    const after = await count();
    expect(after.transactions).toBe(Number(before.transactions) + 2);
    expect(after.postings).toBe(Number(before.postings) + 2);
    expect(BigInt(String(after.balance)) - BigInt(String(before.balance))).toBe(-5000n);
    expect(row((await query('select state,expires_at from private.staging_voice_epochs where id=$1', [epoch])).rows[0]))
      .toMatchObject({ state: 'active', expires_at: null });
    expect(row((await query('select enabled from private.voice_automatic_policy')).rows[0]).enabled).toBe(true);
  });

});
