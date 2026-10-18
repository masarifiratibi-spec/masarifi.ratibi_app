import { createHash, randomUUID } from 'node:crypto';
import { AiRepository } from '../../../src/ai/ai.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';
import { EngagementRepository } from '../../../src/engagement/engagement.repository';
import { StagingVoiceWorker } from '../../../src/ai/staging-voice.worker';

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
  const confirmations = new EngagementRepository(pool, {} as never);
  it('restricts Voice confirmation claims to the worker role and refuses absent worker identity', async () => {
    for (const role of ['masarifi_api', 'anon', 'authenticated', 'service_role']) {
      const grants = row(
        (
          await query(
            `select
        has_function_privilege($1,'private.voice_confirmation_sources(uuid,integer)','execute') sources,
        has_function_privilege($1,'private.claim_voice_notification_deliveries(uuid,text,integer,integer)','execute') deliveries`,
            [role],
          )
        ).rows[0],
      );
      expect(grants).toEqual({ sources: false, deliveries: false });
    }
    await expect(
      pool.withClient(async (client) => {
        await client.query('begin');
        try {
          await client.query("select set_config('request.jwt.claims','{}',true)");
          await client.query('set local role masarifi_worker');
          await client.query('select * from private.voice_confirmation_sources($1,1)', [
            randomUUID(),
          ]);
        } finally {
          await client.query('rollback');
        }
      }),
    ).rejects.toMatchObject({ code: '42501', message: 'VOICE_NOTIFICATION_CLAIM_FORBIDDEN' });
  });
  function query(text: string, values: readonly unknown[] = []) {
    return pool.query<Record<string, unknown>>(text, values);
  }
  // Legacy canary tests exercise SQL fences with an authenticated owner. The
  // operating-worker regression below deliberately uses the real claim-free path.
  async function executeLegacyEvent(values: readonly unknown[]) {
    return pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ sub: user }),
        ]);
        const value = await client.query<Record<string, unknown>>(
          'select private.execute_voice_event($1,$2,$3) result',
          values as unknown[],
        );
        await client.query('commit');
        return value;
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });
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
  async function prepare(mode = 'canary', activate = true, version = 1, patch = {}) {
    epochMode = mode;
    const manifest = {
      version,
      mode,
      sourceSha: 'a'.repeat(40),
      imageDigest: 'b'.repeat(64),
      apkHash: 'c'.repeat(64),
      controlHash: 'd'.repeat(64),
      clerkSessionHash: createHash('sha256').update('epoch-test').digest('hex'),
      ownerId: user,
      accountId: account,
      categoryId: category,
      ...(version === 2
        ? {
            maxTransactions: 1,
            maxExpenseMinor: 1000,
            expenseMinor: 1000,
            currency: 'SAR',
            locale: 'ar',
          }
        : {}),
      ...patch,
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
        'select private.activate_staging_voice_epoch($1,$2,clock_timestamp()+make_interval(secs=>$3))',
        [epoch, prepared.manifestHash, version === 2 ? 300 : 600],
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
  async function commit(session: string, patch = {}) {
    await accept(session, patch);
    const claim = row(
      (await query('select * from private.claim_staging_voice_finalization($1,1)', [epoch]))
        .rows[0],
    );
    expect(claim).toBeDefined();
    const event = row(
      (await query('select id from private.voice_events where batch_id=$1', [claim.batch_id]))
        .rows[0],
    );
    await (epochMode === 'operating'
      ? query('select private.execute_operating_voice_event($1,$2,$3)', [
          claim.batch_id,
          claim.token,
          event.id,
        ])
      : executeLegacyEvent([claim.batch_id, claim.token, event.id]));
    return {
      batch_id: String(claim.batch_id),
      token: String(claim.token),
      event: String(event.id),
    };
  }
  async function ledgerState() {
    return row(
      (
        await query(
          `select
            (select count(*)::int from public.transactions where user_id=$1) transactions,
            (select count(*)::int from public.transaction_postings p join public.transactions t on t.id=p.transaction_id where t.user_id=$1) postings,
            coalesce((select confirmed_minor::text from public.account_balances where account_id=$2),'0') balance`,
          [user, account],
        )
      ).rows[0],
    );
  }
  it('operating worker saves two movements without caller JWT claims and restores its connection identity', async () => {
    await prepare('operating');
    const session = await create();
    const before = await ledgerState();
    const command = {
      kind: 'expense',
      amountMinor: 100,
      currency: 'SAR',
      accountId: account,
      categoryId: category,
      title: 'Fixture',
      merchant: null,
      paymentMethod: null,
      note: null,
      occurredAt: new Date().toISOString(),
      source: 'voice',
      externalRef: null,
    };
    await accept(session, {}, [
      { status: 'eligible', command },
      { status: 'eligible', command: { ...command, amountMinor: 200 } },
    ]);
    await repository.finalizeVoiceEpoch(epoch, 1, false, true);
    expect(await ledgerState()).toEqual({
      transactions: Number(before.transactions) + 2,
      postings: Number(before.postings) + 2,
      balance: String(Number(before.balance) - 300),
    });
    expect(
      row((await query('select status from public.voice_sessions where id=$1', [session])).rows[0])
        .status,
    ).toBe('confirmed');
    await repository.finalizeVoiceEpoch(epoch, 1, false, true);
    expect((await ledgerState()).transactions).toBe(Number(before.transactions) + 2);
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query("select set_config('request.jwt.claims','{}',true)");
        await client.query('set local role masarifi_worker');
        const event = row(
          (
            await query(
              'select e.id,e.batch_id from private.voice_events e join private.voice_batches b on b.id=e.batch_id where b.session_id=$1 order by ordinal limit 1',
              [session],
            )
          ).rows[0],
        );
        await client.query('select private.execute_operating_voice_event($1,$2,$3)', [
          event.batch_id,
          randomUUID(),
          event.id,
        ]);
        expect(
          (
            await client.query<{ claims: string }>(
              "select current_setting('request.jwt.claims',true) claims",
            )
          ).rows[0]?.claims,
        ).toBe('{}');
      } finally {
        await client.query('rollback');
      }
    });
  });

  it.each(['{}', JSON.stringify({ sub: 'unrelated-prior-principal', marker: 'preserve' })])(
    'restores prior claims after fresh execution and a caught financial failure: %s',
    async (claims) => {
      await prepare('operating');
      const session = await create();
      await accept(session, { amountMinor: 100 });
      const claim = row(
        (await query('select * from private.claim_staging_voice_finalization($1,1)', [epoch]))
          .rows[0],
      );
      const event = row(
        (await query('select id from private.voice_events where batch_id=$1', [claim.batch_id]))
          .rows[0],
      );
      const before = await ledgerState();
      await pool.withClient(async (client) => {
        await client.query('begin');
        try {
          await client.query(`create function pg_temp.reject_voice_fixture() returns trigger language plpgsql as $$
            begin raise exception 'SYNTHETIC_FINANCIAL_FAILURE'; end $$`);
          await client.query(
            'create trigger reject_voice_fixture before insert on public.transactions for each row execute function pg_temp.reject_voice_fixture()',
          );
          await client.query("select set_config('request.jwt.claims',$1,true)", [claims]);
          await client.query('set local role masarifi_worker');
          await client.query('savepoint attempted');
          await expect(
            client.query('select private.execute_operating_voice_event($1,$2,$3)', [
              claim.batch_id,
              claim.token,
              event.id,
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
          await client.query('drop trigger reject_voice_fixture on public.transactions');
          await client.query('set local role masarifi_worker');
          await client.query('select private.execute_operating_voice_event($1,$2,$3)', [
            claim.batch_id,
            claim.token,
            event.id,
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
              await client.query<{ status: string }>(
                'select status from private.voice_events where id=$1',
                [event.id],
              )
            ).rows[0]?.status,
          ).toBe('committed');
        } finally {
          await client.query('rollback');
        }
      });
      expect(await ledgerState()).toEqual(before);
    },
  );

  it.each(['lease', 'command', 'wrong-event', 'frozen-owner'])(
    'operating identity capability rejects a changed %s without financial effects',
    async (boundary) => {
      await prepare('operating');
      const session = await create();
      await accept(session, { amountMinor: 100 });
      const claim = row(
        (await query('select * from private.claim_staging_voice_finalization($1,1)', [epoch]))
          .rows[0],
      );
      const event = row(
        (await query('select id from private.voice_events where batch_id=$1', [claim.batch_id]))
          .rows[0],
      );
      const before = await ledgerState();
      if (boundary === 'command')
        await query(
          "update private.voice_event_commands set command=jsonb_set(command,'{amountMinor}','999') where event_id=$1",
          [event.id],
        );
      if (boundary === 'frozen-owner')
        await query("update public.profiles set status='deletion_pending' where id=$1", [user]);
      try {
        await expect(
          pool.withClient(async (client) => {
            await client.query('begin');
            try {
              await client.query("select set_config('request.jwt.claims','{}',true)");
              await client.query('set local role masarifi_worker');
              return await client.query('select private.execute_operating_voice_event($1,$2,$3)', [
                claim.batch_id,
                boundary === 'lease' ? randomUUID() : claim.token,
                boundary === 'wrong-event' ? randomUUID() : event.id,
              ]);
            } finally {
              await client.query('rollback');
            }
          }),
        ).rejects.toBeDefined();
        expect(await ledgerState()).toEqual(before);
      } finally {
        if (boundary === 'frozen-owner')
          await query("update public.profiles set status='active' where id=$1", [user]);
      }
    },
  );

  it('operating failure settles once and retains server media until original expiry', async () => {
    await prepare('operating');
    const session = await create();
    await accept(session, { amountMinor: 100 });
    const claim = row(
      (await query('select * from private.claim_staging_voice_finalization($1,1)', [epoch]))
        .rows[0],
    );
    const event = row(
      (await query('select id from private.voice_events where batch_id=$1', [claim.batch_id]))
        .rows[0],
    );
    const before = await ledgerState();
    await query('select private.fail_operating_voice_event($1,$2,$3)', [
      claim.batch_id,
      claim.token,
      event.id,
    ]);
    expect(
      row(
        (
          await query('select status,attempt_count from private.voice_events where id=$1', [
            event.id,
          ])
        ).rows[0],
      ),
    ).toEqual({ status: 'execution_failed', attempt_count: 1 });
    await query(
      "update public.voice_sessions set storage_ref=$2,next_attempt_at=clock_timestamp(),media_capability_expires_at=clock_timestamp()-interval '1 second',lease_until=null,claim_token=null,claimed_by=null where id=$1",
      [session, 'voice/' + randomUUID() + '/' + randomUUID()],
    );
    await pool.withClient(async (holder) => {
      await holder.query('begin');
      try {
        await holder.query('select id from public.voice_sessions where id<>$1 for update', [
          session,
        ]);
        expect(
          (
            await query("select * from private.claim_voice_media_purge('general-fixture',100,120)")
          ).rows.map((r) => r.id),
        ).not.toContain(session);
      } finally {
        await holder.query('rollback');
      }
    });
    expect(
      (await query("select * from private.claim_staging_voice_purge($1,'fixture',25,120)", [epoch]))
        .rows,
    ).toHaveLength(0);
    await query(
      "update public.voice_sessions set created_at=clock_timestamp()-interval '25 hours',expires_at=clock_timestamp()-interval '2 hours' where id=$1",
      [session],
    );
    expect(
      (
        await query("select * from private.claim_staging_voice_purge($1,'fixture',25,120)", [epoch])
      ).rows.map((r) => r.id),
    ).toContain(session);
    expect(await ledgerState()).toEqual(before);
  });

  it('a profile frozen after claim cannot stop operating Posting or write owner metadata', async () => {
    await prepare('operating');
    const session = await create();
    await accept(session, { amountMinor: 100 });
    const before = await ledgerState();
    let frozen = false;
    const racing = new AiRepository({
      withClient: (action: (c: unknown) => Promise<unknown>) =>
        pool.withClient((client) => {
          const transport = Object.create(client) as typeof client;
          transport.query = (async (sql: string, values?: unknown[]) => {
            if (sql.includes('execute_operating_voice_event') && !frozen) {
              frozen = true;
              await query("update public.profiles set status='deletion_pending' where id=$1", [
                user,
              ]);
            }
            return client.query(sql, values);
          }) as typeof client.query;
          return action(transport);
        }),
    } as never);
    const worker = new StagingVoiceWorker(
      racing,
      {} as never,
      {} as never,
      epoch,
      'frozen-race',
      'a'.repeat(40),
      undefined,
      undefined,
      true,
    );
    try {
      await worker.tick();
      expect(await ledgerState()).toEqual(before);
      expect(
        row(
          (await query('select state from private.staging_voice_epochs where id=$1', [epoch]))
            .rows[0],
        ).state,
      ).toBe('active');
      expect(
        row((await query('select enabled from private.voice_automatic_policy')).rows[0]).enabled,
      ).toBe(true);
      expect(
        row(
          (
            await query(
              'select e.status,e.attempt_count from private.voice_events e join private.voice_batches b on b.id=e.batch_id where b.session_id=$1',
              [session],
            )
          ).rows[0],
        ),
      ).toEqual({ status: 'eligible', attempt_count: 0 });
      expect(
        (await query('select * from private.claim_staging_voice_finalization($1,1)', [epoch])).rows,
      ).toHaveLength(0);
    } finally {
      await worker.stop();
      await query("update public.profiles set status='active' where id=$1", [user]);
    }
  });

  it.each(['expired-finalizing', 'expired-media', 'uploaded'])(
    'a frozen owner with %s cannot close Posting or prevent an active owner saving',
    async (phase) => {
      await prepare('operating');
      const frozenSession = await create('en', other);
      if (phase !== 'uploaded') await accept(frozenSession, { accountId: otherAccount });
      if (phase === 'expired-media') {
        await query(
          "update private.voice_events set status='execution_failed' where batch_id in(select id from private.voice_batches where session_id=$1)",
          [frozenSession],
        );
        await query("update private.voice_batches set status='failed' where session_id=$1", [
          frozenSession,
        ]);
      }
      await query(
        `update public.voice_sessions set
        created_at=case when $2='uploaded' then created_at else clock_timestamp()-interval '25 hours' end,
        expires_at=case when $2='uploaded' then clock_timestamp()+interval '1 hour' else clock_timestamp()-interval '1 hour' end,
        status=case when $2='expired-media' then 'failed' else status end,
        storage_ref='voice/'||id::text||'/'||id::text, next_attempt_at=clock_timestamp(),
        media_capability_expires_at=clock_timestamp()-interval '1 second',lease_until=null,claim_token=null,claimed_by=null
        where id=$1`,
        [frozenSession, phase],
      );
      const activeSession = await create();
      if (phase === 'uploaded')
        await query(
          "update public.voice_sessions set next_attempt_at=clock_timestamp()+interval '1 hour' where id=$1",
          [frozenSession],
        );
      await accept(activeSession, { amountMinor: 100 });
      if (phase === 'uploaded')
        await query(
          'update public.voice_sessions set next_attempt_at=clock_timestamp() where id=$1',
          [frozenSession],
        );
      const snapshot = async () =>
        (
          await query(
            `select to_jsonb(s) payload,
        (select jsonb_agg(to_jsonb(b)) from private.voice_batches b where b.session_id=s.id) batches,
        (select jsonb_agg(to_jsonb(e)) from private.voice_events e join private.voice_batches b on b.id=e.batch_id where b.session_id=s.id) events
        from public.voice_sessions s where s.id=$1`,
            [frozenSession],
          )
        ).rows[0];
      const before = await snapshot();
      const finances = await ledgerState();
      await query("update public.profiles set status='deletion_pending' where id=$1", [other]);
      const remove = jest.fn().mockResolvedValue(undefined);
      const worker = new StagingVoiceWorker(
        repository,
        {
          processVoiceClaim: jest.fn().mockRejectedValue(new Error('FROZEN_OWNER_CLAIMED')),
        } as never,
        { delete: remove } as never,
        epoch,
        'frozen-lifecycle',
        'a'.repeat(40),
        undefined,
        undefined,
        true,
      );
      try {
        await worker.tick();
        expect(
          (await query('select state from private.staging_voice_epochs where id=$1', [epoch]))
            .rows[0]?.state,
        ).toBe('active');
        expect(await ledgerState()).toEqual({
          transactions: Number(finances.transactions) + 1,
          postings: Number(finances.postings) + 1,
          balance: String(Number(finances.balance) - 100),
        });
        expect(await snapshot()).toEqual(before);
        expect(remove).not.toHaveBeenCalledWith('voice/' + frozenSession + '/' + frozenSession);
      } finally {
        await worker.stop();
        await query("update public.profiles set status='active' where id=$1", [other]);
      }
    },
  );

  it('a profile frozen during asynchronous media purge cannot close Posting or mutate frozen payload', async () => {
    await prepare('operating');
    const session = await create();
    await accept(session, { amountMinor: 100 });
    await query(
      "update public.voice_sessions set storage_ref='voice/'||id::text||'/'||id::text,media_capability_expires_at=clock_timestamp()-interval '1 second',lease_until=null where id=$1",
      [session],
    );
    let frozenPayload: unknown;
    const worker = new StagingVoiceWorker(
      repository,
      {} as never,
      {
        delete: async () => {
          frozenPayload = (
            await query('select to_jsonb(s) payload from public.voice_sessions s where id=$1', [
              session,
            ])
          ).rows[0]?.payload;
          await query("update public.profiles set status='deletion_pending' where id=$1", [user]);
        },
      } as never,
      epoch,
      'frozen-purge-race',
      'a'.repeat(40),
      undefined,
      undefined,
      true,
    );
    try {
      await worker.tick();
      expect(frozenPayload).toBeDefined();
      expect(
        (
          await query('select to_jsonb(s) payload from public.voice_sessions s where id=$1', [
            session,
          ])
        ).rows[0]?.payload,
      ).toEqual(frozenPayload);
      expect(
        (await query('select state from private.staging_voice_epochs where id=$1', [epoch])).rows[0]
          ?.state,
      ).toBe('active');
    } finally {
      await worker.stop();
      await query("update public.profiles set status='active' where id=$1", [user]);
    }
  });

  it('continuous worker recovers a lost finalization response without a second ledger effect', async () => {
    await prepare('operating');
    const session = await create();
    const before = await ledgerState();
    await accept(session, { amountMinor: 100 });
    const interrupted = Object.create(repository) as AiRepository;
    let loseResponse = true;
    interrupted.finalizeVoiceEpoch = async (id, limit, bounded) => {
      const result = await repository.finalizeVoiceEpoch(id, limit, bounded, true);
      if (loseResponse) {
        loseResponse = false;
        throw new Error('Query read timeout');
      }
      return result;
    };
    const worker = new StagingVoiceWorker(
      interrupted,
      {} as never,
      {} as never,
      epoch,
      'continuous-test',
      'a'.repeat(40),
      undefined,
      undefined,
      true,
    );
    try {
      await worker.tick();
      const saved = await ledgerState();
      expect(saved).toEqual({
        transactions: Number(before.transactions) + 1,
        postings: Number(before.postings) + 1,
        balance: String(Number(before.balance) - 100),
      });
      const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 31000);
      try {
        await worker.tick();
        await worker.tick();
      } finally {
        clock.mockRestore();
      }
      expect(await ledgerState()).toEqual(saved);
      expect(
        row(
          (await query('select state from private.staging_voice_epochs where id=$1', [epoch]))
            .rows[0],
        ).state,
      ).toBe('active');
    } finally {
      await worker.stop();
    }
  });
  it('continuous execution outages do not exhaust the financial failure budget', async () => {
    await prepare('operating');
    const session = await create();
    await accept(session, { amountMinor: 100 });
    const before = await ledgerState();
    const interrupted = new AiRepository({
      withClient: async (action: (client: unknown) => Promise<unknown>) =>
        pool.withClient((client) => {
          const transport = Object.create(client) as typeof client;
          transport.query = ((sql: string, values?: unknown[]) => {
            if (sql.includes('private.execute_operating_voice_event('))
              return Promise.reject(new Error('Query read timeout'));
            return client.query(sql, values);
          }) as typeof client.query;
          return action(transport);
        }),
    } as never);
    for (let attempt = 0; attempt < 6; attempt++) {
      await expect(interrupted.finalizeVoiceEpoch(epoch, 1, false, true)).rejects.toThrow(
        'Query read timeout',
      );
      await query(
        'update private.voice_batches set next_attempt_at=clock_timestamp() where session_id=$1',
        [session],
      );
    }
    expect(await ledgerState()).toEqual(before);
    const event = row(
      (
        await query(
          'select e.status,e.attempt_count from private.voice_events e join private.voice_batches b on b.id=e.batch_id where b.session_id=$1',
          [session],
        )
      ).rows[0],
    );
    expect(event).toEqual({ status: 'eligible', attempt_count: 0 });
    await repository.finalizeVoiceEpoch(epoch, 1, false, true);
    const saved = await ledgerState();
    expect(Number(saved.transactions)).toBe(Number(before.transactions) + 1);
    expect(Number(saved.balance)).toBe(Number(before.balance) - 100);
  });
  it.each([false, true])(
    'repeated acknowledged heartbeat preserves financial receipts and closed=%s admission',
    async (closed) => {
      await prepare('operating');
      const session = await create();
      await commit(session);
      if (closed) await repository.closeVoiceEpoch(epoch, 'test_finished');
      const beforeLedger = await ledgerState();
      const sessionState = async () =>
        row(
          (
            await query('select to_jsonb(s) snapshot from public.voice_sessions s where id=$1', [
              session,
            ])
          ).rows[0],
        );
      const beforeSession = await sessionState();
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const state = await repository.voiceEpochHeartbeat(
          epoch,
          'heartbeat-repeat',
          'a'.repeat(40),
        );
        expect(state.enabled).toBe(!closed);
        expect(await ledgerState()).toEqual(beforeLedger);
        expect(await sessionState()).toEqual(beforeSession);
      }
      expect(
        row(
          (await query('select state from private.staging_voice_epochs where id=$1', [epoch]))
            .rows[0],
        ).state,
      ).toBe(closed ? 'closed' : 'active');
    },
  );
  it('projects only fresh committed operating Voice confirmations without changing the ledger or publishing history', async () => {
    await prepare('operating');
    const session = await create();
    await commit(session);
    const before = await ledgerState();
    const sources = await confirmations.claimVoiceSourceEvents(epoch, 1);
    expect(sources).toHaveLength(1);
    const source = row(sources[0]);
    expect(source).toMatchObject({ user_id: user, event_type: 'transaction.created' });
    const deliveries = [
      {
        channel: 'in_app' as const,
        provider: 'database' as const,
        title: 'Saved',
        body: 'Transaction saved',
        status: 'queued' as const,
        nextAttemptAt: new Date(),
      },
    ];
    const results = await Promise.all([
      confirmations.createNotificationFromSource(source, deliveries),
      confirmations.createNotificationFromSource(source, deliveries),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await confirmations.claimVoiceSourceEvents(epoch, 10)).toEqual([]);
    const claims = await confirmations.claimVoiceNotificationDeliveries(
      epoch,
      'voice-confirmation-test',
      10,
    );
    expect(claims).toHaveLength(1);
    const claimed = row(claims[0]);
    expect(await confirmations.claimVoiceNotificationDeliveries(epoch, 'other-worker', 10)).toEqual(
      [],
    );
    await query(
      "update private.notification_deliveries set lease_until=clock_timestamp()-interval '1 second' where id=$1",
      [claimed.id],
    );
    const recovered = await confirmations.claimVoiceNotificationDeliveries(
      epoch,
      'replacement-worker',
      10,
    );
    expect(recovered).toHaveLength(1);
    expect(row(recovered[0]).id).toBe(claimed.id);
    expect(row(recovered[0]).claim_token).not.toBe(claimed.claim_token);
    await query("select private.close_staging_voice_epoch($1,'notification_test_done')", [epoch]);
    expect(
      await confirmations.claimVoiceNotificationDeliveries(epoch, 'replacement-worker', 10),
    ).toEqual([]);
    expect(await ledgerState()).toEqual(before);
    expect(
      row(
        (
          await query('select published_at from private.outbox_events where id=$1', [
            source.source_event_id,
          ])
        ).rows[0],
      ).published_at,
    ).toBeNull();
  });

  it('never consumes the one-event canary or a prior operating generation as universal confirmation work', async () => {
    await prepare('canary', true, 2);
    const session = await create('ar');
    await commit(session, { amountMinor: 1000 });
    const canary = epoch;
    expect(await confirmations.claimVoiceSourceEvents(canary, 10)).toEqual([]);
    await prepare('operating');
    expect(await confirmations.claimVoiceSourceEvents(canary, 10)).toEqual([]);
    expect(await confirmations.claimVoiceSourceEvents(epoch, 10)).toEqual([]);
  });
  it.each([1, 2])(
    'version %i preparation keeps Posting disabled and financial admission closed',
    async (version) => {
      await query('update private.voice_automatic_policy set enabled=false');
      await prepare('canary', false, version);
      expect(
        row((await query('select enabled from private.voice_automatic_policy')).rows[0]).enabled,
      ).toBe(false);
      await expect(create()).rejects.toMatchObject({ status: 503 });
    },
  );
  it.each([301, 600])(
    'single Arabic expense rejects a %i-second activation without opening Posting',
    async (seconds) => {
      await query('update private.voice_automatic_policy set enabled=false');
      const prepared = await prepare('canary', false, 2);
      await expect(
        query(
          'select private.activate_staging_voice_epoch($1,$2,clock_timestamp()+make_interval(secs=>$3))',
          [epoch, prepared.manifestHash, seconds],
        ),
      ).rejects.toMatchObject({ message: 'VOICE_SCOPE_INVALID' });
      expect(
        row(
          (
            await query(
              'select state,started_at,expires_at from private.staging_voice_epochs where id=$1',
              [epoch],
            )
          ).rows[0],
        ),
      ).toEqual({ state: 'prepared', started_at: null, expires_at: null });
      expect(
        row((await query('select enabled from private.voice_automatic_policy')).rows[0]).enabled,
      ).toBe(false);
    },
  );
  it.each([
    { maxTransactions: 2 },
    { maxTransactions: '1' },
    { maxTransactions: null },
    { maxTransactions: undefined },
    { maxExpenseMinor: 1001 },
    { maxExpenseMinor: '1000' },
    { maxExpenseMinor: null },
    { maxExpenseMinor: undefined },
    { expenseMinor: 2500 },
    { expenseMinor: '1000' },
    { expenseMinor: null },
    { expenseMinor: undefined },
    { locale: 'en' },
    { currency: 'USD' },
    { version: 3 },
    { mode: 'operating' },
  ])(
    'rejects an invalid single Arabic expense manifest without changing controls %j',
    async (patch) => {
      await query('update private.voice_automatic_policy set enabled=false');
      const before = row(
        (
          await query(`select
      (select count(*)::int from private.staging_voice_epochs) epochs,
      (select to_jsonb(c) from private.staging_voice_runtime_control c) control`)
        ).rows[0],
      );
      await expect(prepare('canary', false, 2, patch)).rejects.toMatchObject({
        message: 'VOICE_SCOPE_INVALID',
      });
      expect(
        row(
          (
            await query(`select
      (select count(*)::int from private.staging_voice_epochs) epochs,
      (select to_jsonb(c) from private.staging_voice_runtime_control c) control`)
          ).rows[0],
        ),
      ).toEqual(before);
      expect(
        row((await query('select enabled from private.voice_automatic_policy')).rows[0]).enabled,
      ).toBe(false);
    },
  );
  it('single Arabic expense commits 1000 SAR minor once and automatically closes Posting', async () => {
    const before = await ledgerState();
    await prepare('canary', true, 2);
    const session = await create('ar');
    const committed = await commit(session, { amountMinor: 1000 });
    const transaction = row(
      (
        await query('select transaction_id from private.voice_events where id=$1', [
          committed.event,
        ])
      ).rows[0],
    ).transaction_id;
    const after = await ledgerState();
    expect(after.transactions).toBe(Number(before.transactions) + 1);
    expect(after.postings).toBe(Number(before.postings) + 1);
    expect(BigInt(String(after.balance)) - BigInt(String(before.balance))).toBe(-1000n);
    expect(
      row(
        (
          await query('select state,closed_reason from private.staging_voice_epochs where id=$1', [
            epoch,
          ])
        ).rows[0],
      ),
    ).toEqual({ state: 'closed', closed_reason: 'completed' });
    expect(
      row((await query('select enabled from private.voice_automatic_policy')).rows[0]).enabled,
    ).toBe(false);
    expect(
      row(
        (
          await query(
            'select command_evidence from private.staging_voice_members where session_id=$1',
            [session],
          )
        ).rows[0],
      ).command_evidence,
    ).toMatchObject({
      kind: 'expense',
      amountMinor: 1000,
      currency: 'SAR',
      accountId: account,
      categoryId: category,
    });
    const execute = () =>
      executeLegacyEvent([committed.batch_id, committed.token, committed.event]);
    const replays = await Promise.all([execute(), execute()]);
    expect(replays.map((result) => row(result.rows[0]).result)).toEqual([
      { status: 'committed', transactionId: transaction },
      { status: 'committed', transactionId: transaction },
    ]);
    const receipt = row(
      (await query('select private.get_voice_batch_result($1,$2) result', [user, session])).rows[0],
    ).result;
    expect(receipt).toMatchObject({
      status: 'completed',
      addedCount: 1,
      transactionIds: [transaction],
    });
    await expect(create('ar', user, '2'.repeat(64))).rejects.toMatchObject({ status: 503 });
    expect(await ledgerState()).toEqual(after);
  });
  it('single Arabic expense repeated acceptance preserves the accepted batch before execution', async () => {
    await prepare('canary', true, 2);
    const session = await create('ar');
    await accept(session, { amountMinor: 1000 });
    const before = row(
      (
        await query('select to_jsonb(s) session from public.voice_sessions s where id=$1', [
          session,
        ])
      ).rows[0],
    ).session;
    const ledgerBefore = await ledgerState();
    expect(
      row(
        (
          await query(
            "select private.accept_voice_batch($1,$2,'[]'::jsonb,'automatic-or-skip-v3.1') result",
            [session, randomUUID()],
          )
        ).rows[0],
      ).result,
    ).toEqual({ accepted: true });
    expect(
      row(
        (
          await query('select to_jsonb(s) session from public.voice_sessions s where id=$1', [
            session,
          ])
        ).rows[0],
      ).session,
    ).toEqual(before);
    expect(
      row(
        (await query('select state from private.staging_voice_epochs where id=$1', [epoch]))
          .rows[0],
      ).state,
    ).toBe('active');
    expect(
      row((await query('select enabled from private.voice_automatic_policy')).rows[0]).enabled,
    ).toBe(true);
    expect(
      row(
        (
          await query(
            'select count(*)::int n from private.voice_events where batch_id=(select id from private.voice_batches where session_id=$1)',
            [session],
          )
        ).rows[0],
      ).n,
    ).toBe(1);
    expect(await ledgerState()).toEqual(ledgerBefore);
  });
  it('single Arabic expense repeated acceptance returns its receipt after automatic closure without another effect', async () => {
    await prepare('canary', true, 2);
    const session = await create('ar');
    await commit(session, { amountMinor: 1000 });
    const before = row(
      (
        await query('select to_jsonb(s) session from public.voice_sessions s where id=$1', [
          session,
        ])
      ).rows[0],
    ).session;
    const ledgerBefore = await ledgerState();
    expect(
      row(
        (
          await query(
            "select private.accept_voice_batch($1,$2,'[]'::jsonb,'automatic-or-skip-v3.1') result",
            [session, randomUUID()],
          )
        ).rows[0],
      ).result,
    ).toEqual({ accepted: true });
    expect(
      row(
        (
          await query('select to_jsonb(s) session from public.voice_sessions s where id=$1', [
            session,
          ])
        ).rows[0],
      ).session,
    ).toEqual(before);
    expect(
      row(
        (
          await query('select state,closed_reason from private.staging_voice_epochs where id=$1', [
            epoch,
          ])
        ).rows[0],
      ),
    ).toEqual({ state: 'closed', closed_reason: 'completed' });
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
    ).toBe(1);
    expect(await ledgerState()).toEqual(ledgerBefore);
  });
  it.each([
    ['owner', 'ar', other, 'epoch-test'],
    ['Clerk session', 'ar', user, 'another-device'],
    ['locale', 'en', user, 'epoch-test'],
  ])(
    'single Arabic expense rejects a mismatched %s without admission',
    async (_name, locale, owner, authSession) => {
      const before = await ledgerState();
      await prepare('canary', true, 2);
      await expect(create(locale, owner, '1'.repeat(64), authSession)).rejects.toMatchObject({
        status: 503,
      });
      expect(
        row(
          (
            await query(
              'select count(*)::int n from private.staging_voice_members where epoch_id=$1',
              [epoch],
            )
          ).rows[0],
        ).n,
      ).toBe(0);
      expect(await ledgerState()).toEqual(before);
    },
  );
  it.each([
    [{ amountMinor: 1001 }, 'amount'],
    [{ currency: 'USD' }, 'currency'],
    [{ categoryId: '04000000-0000-4000-8000-000000000003' }, 'category'],
    [{ categoryId: null }, 'category'],
    [{ accountId: otherAccount }, 'account'],
    [{ occurredAt: '2026-01-01T00:00:00.000Z' }, 'capture_date'],
    [{ kind: 'income' }, 'kind'],
    [{ amountMinor: '1000' }, 'command_validity'],
    [{ note: 'private text' }, 'command_validity'],
    [{ occurredAt: 'invalid-date' }, 'command_validity'],
    [{ currency: 'USD', categoryId: null }, 'currency'],
  ])(
    'single Arabic expense closes before accepting a mismatched extracted command %j',
    async (patch, reason) => {
      const before = await ledgerState();
      await prepare('canary', true, 2);
      const session = await create('ar');
      expect(await accept(session, { amountMinor: 1000, ...patch })).toMatchObject({
        accepted: false,
        scopeMismatch: true,
        scopeMismatchReason: reason,
      });
      expect(
        row(
          (
            await query(
              'select status,failure_code,claim_token,claimed_by,lease_until from public.voice_sessions where id=$1',
              [session],
            )
          ).rows[0],
        ),
      ).toEqual({
        status: 'failed',
        failure_code: 'VOICE_SCOPE_INVALID',
        claim_token: null,
        claimed_by: null,
        lease_until: null,
      });
      expect(
        row(
          (
            await query('select count(*)::int n from private.voice_batches where session_id=$1', [
              session,
            ])
          ).rows[0],
        ).n,
      ).toBe(0);
      expect(
        row((await query('select enabled from private.voice_automatic_policy')).rows[0]).enabled,
      ).toBe(false);
      expect(
        row(
          (await query('select state from private.staging_voice_epochs where id=$1', [epoch]))
            .rows[0],
        ).state,
      ).toBe('closed');
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
      expect(await ledgerState()).toEqual(before);
    },
  );
  it.each([
    [[], 'decision_count'],
    [[{ status: 'skipped', reason: 'invalid_event' }], 'decision_status'],
    [[{ status: 'eligible', command: null }], 'command_validity'],
    [
      [
        { status: 'eligible', command: {} },
        { status: 'eligible', command: {} },
      ],
      'decision_count',
    ],
  ])(
    'malformed canary decisions report only the failed predicate %j',
    async (decisions, reason) => {
      const before = await ledgerState();
      await prepare('canary', true, 2);
      const session = await create('ar');
      expect(await accept(session, { amountMinor: 1000 }, decisions as unknown[])).toEqual({
        accepted: false,
        scopeMismatch: true,
        scopeMismatchReason: reason,
      });
      expect(
        row(
          (
            await query(
              'select status,failure_code,claim_token,claimed_by,lease_until from public.voice_sessions where id=$1',
              [session],
            )
          ).rows[0],
        ),
      ).toEqual({
        status: 'failed',
        failure_code: 'VOICE_SCOPE_INVALID',
        claim_token: null,
        claimed_by: null,
        lease_until: null,
      });
      expect(
        row((await query('select enabled from private.voice_automatic_policy')).rows[0]).enabled,
      ).toBe(false);
      expect(
        row(
          (
            await query('select count(*)::int n from private.voice_batches where session_id=$1', [
              session,
            ])
          ).rows[0],
        ).n,
      ).toBe(0);
      expect(await ledgerState()).toEqual(before);
    },
  );
  it('keeps the diagnostic helper private and uses the Riyadh date across UTC midnight', async () => {
    expect(
      row(
        (
          await query(
            "select pg_get_userbyid(proowner) owner,prosecdef,proconfig from pg_proc where oid='private.voice_canary_scope_mismatch_reason(jsonb,integer,jsonb,timestamptz)'::regprocedure",
          )
        ).rows[0],
      ),
    ).toEqual({ owner: 'masarifi_migration', prosecdef: false, proconfig: ['search_path=""'] });
    for (const role of [
      'anon',
      'authenticated',
      'service_role',
      'masarifi_api',
      'masarifi_worker',
    ]) {
      expect(
        row(
          (
            await query(
              "select has_function_privilege($1,'private.voice_canary_scope_mismatch_reason(jsonb,integer,jsonb,timestamptz)','execute') allowed",
              [role],
            )
          ).rows[0],
        ).allowed,
      ).toBe(false);
    }
    const command = {
      kind: 'expense',
      amountMinor: 1000,
      currency: 'SAR',
      accountId: account,
      categoryId: category,
      title: 'Voice transaction',
      merchant: null,
      paymentMethod: null,
      note: null,
      source: 'voice',
      externalRef: null,
      occurredAt: '2026-01-01T21:00:00.000Z',
    };
    const result = async (capture: string, occurredAt: string) =>
      row(
        (
          await query(
            'select private.voice_canary_scope_mismatch_reason($1::jsonb,1000,$2::jsonb,$3::timestamptz) reason',
            [
              JSON.stringify([{ status: 'eligible', command: { ...command, occurredAt } }]),
              JSON.stringify({ accountId: account, categoryId: category }),
              capture,
            ],
          )
        ).rows[0],
      ).reason;
    // UTC day changes while the Riyadh date remains the same.
    expect(await result('2026-01-01T21:00:00.000Z', '2026-01-02T00:00:00.000Z')).toBe('unknown');
    // The millisecond before Riyadh midnight belongs to the preceding local day.
    expect(await result('2026-01-01T21:00:00.000Z', '2026-01-01T20:59:59.999Z')).toBe(
      'capture_date',
    );
  });
  it('concurrent single Arabic expense captures admit only one slot', async () => {
    const before = await ledgerState();
    await prepare('canary', true, 2);
    const attempts = await Promise.allSettled([
      create('ar', user, '1'.repeat(64)),
      create('ar', user, '2'.repeat(64)),
    ]);
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = attempts.filter((result) => result.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ status: 503 });
    expect(
      row(
        (
          await query(
            'select count(*)::int n from private.staging_voice_members where epoch_id=$1',
            [epoch],
          )
        ).rows[0],
      ).n,
    ).toBe(1);
    expect(await ledgerState()).toEqual(before);
  });
  it('rejects the wrong owner, Arabic-first and a third capture without financial effects', async () => {
    const before = await ledgerState();
    await prepare();
    await expect(create('en', other)).rejects.toMatchObject({ status: 503 });
    await expect(create('en', user, '1'.repeat(64), 'another-device')).rejects.toMatchObject({
      status: 503,
    });
    await expect(create('ar')).rejects.toMatchObject({ status: 503 });
    await commit(await create('en'));
    await commit(await create('ar', user, '2'.repeat(64)));
    await expect(create()).rejects.toMatchObject({ status: 503 });
    const after = await ledgerState();
    expect(after.transactions).toBe(Number(before.transactions) + 2);
    expect(after.postings).toBe(Number(before.postings) + 2);
    expect(BigInt(String(after.balance)) - BigInt(String(before.balance))).toBe(-5000n);
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
  it.each([1, 2])('version %i fences in-flight execution after revocation', async (version) => {
    const before = await ledgerState();
    await prepare('canary', true, version);
    const session = await create(version === 2 ? 'ar' : 'en');
    await accept(session, { amountMinor: version === 2 ? 1000 : 2500 });
    const claim = row(
      (await query('select * from private.claim_staging_voice_finalization($1,1)', [epoch]))
        .rows[0],
    );
    const event = row(
      (await query('select id from private.voice_events where batch_id=$1', [claim.batch_id]))
        .rows[0],
    );
    await query("select private.close_staging_voice_epoch($1,'revoked')", [epoch]);
    await expect(executeLegacyEvent([claim.batch_id, claim.token, event.id])).rejects.toMatchObject(
      { message: 'VOICE_AUTOMATIC_PAUSED' },
    );
    expect(await ledgerState()).toEqual(before);
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
      (await executeLegacyEvent([committed.batch_id, committed.token, committed.event])).rows[0],
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
  it.each([
    [1, 'account-lock'],
    [1, 'deferred-commit'],
    [2, 'account-lock'],
    [2, 'deferred-commit'],
  ] as const)(
    'version %i rolls back all ledger effects when %s crosses the exact deadline',
    async (version, boundary) => {
      await prepare('canary', true, version);
      const session = await create(version === 2 ? 'ar' : 'en');
      await accept(session, { amountMinor: version === 2 ? 1000 : 2500 });
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
            const attempt = executeLegacyEvent([claim.batch_id, claim.token, event.id]).catch(
              (e: unknown) => e,
            );
            await new Promise((resolve) => setTimeout(resolve, 800));
            await client.query('rollback');
            return await attempt;
          }
          await client.query("select set_config('request.jwt.claims',$1,true)", [
            JSON.stringify({ sub: user }),
          ]);
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
  it.each([1, 2])(
    'version %i claims without duplication and recovers only expired leases',
    async (version) => {
      await prepare(version === 2 ? 'canary' : 'operating', true, version);
      const a = await create(version === 2 ? 'ar' : 'en');
      const sessions = version === 2 ? [a] : [a, await create('ar', other)];
      const results = await Promise.all([
        query("select * from private.claim_staging_voice_work($1,'worker-a',1,120)", [epoch]),
        query("select * from private.claim_staging_voice_work($1,'worker-b',1,120)", [epoch]),
      ]);
      const claimed = results.flatMap((r) => r.rows);
      expect(claimed).toHaveLength(sessions.length);
      expect(new Set(claimed.map((row) => row.id))).toEqual(new Set(sessions));
      expect(
        (
          await query("select * from private.claim_staging_voice_work($1,'worker-c',1,120)", [
            epoch,
          ])
        ).rows,
      ).toHaveLength(0);
      const old = row(claimed.find((r) => r.id === a));
      await query(
        "update public.voice_sessions set lease_until=clock_timestamp()-interval '1 second' where id=$1",
        [a],
      );
      const recovered = row(
        (
          await query("select * from private.claim_staging_voice_work($1,'worker-c',1,120)", [
            epoch,
          ])
        ).rows[0],
      );
      expect(recovered.id).toBe(a);
      expect(recovered.claim_token).not.toBe(old.claim_token);
      await expect(
        query("select private.accept_voice_batch($1,$2,'[]'::jsonb,'automatic-or-skip-v3.1')", [
          a,
          old.claim_token,
        ]),
      ).rejects.toMatchObject({ message: 'AI_WORK_FENCE_INVALID' });
      expect(
        row((await query('select enabled from private.voice_automatic_policy')).rows[0]).enabled,
      ).toBe(true);
      const work = row(
        (
          await query("select private.get_ai_work_input('voice.transcribe_extract',$1,$2) result", [
            a,
            recovered.claim_token,
          ])
        ).rows[0],
      ).result;
      expect(work).toMatchObject({ retainAcceptanceEvidence: version === 2 });
    },
  );
  it.each([1, 2])(
    'version %i expired epoch stops claims and heartbeat disables Posting',
    async (version) => {
      await prepare(version === 2 ? 'canary' : 'operating', true, version);
      await create(version === 2 ? 'ar' : 'en');
      await query(
        "update private.staging_voice_epochs set started_at=clock_timestamp()-interval '2 seconds',expires_at=clock_timestamp()-interval '1 second' where id=$1",
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
    },
  );
  it('scoped cleanup preserves historical sessions and private controls are capability-only', async () => {
    await query('update private.staging_voice_runtime_control set enforced=false');
    await query('update private.voice_automatic_policy set enabled=true');
    const historical = await create();
    await prepare('operating');
    const admitted = await create();
    await query(
      "update public.voice_sessions set status='failed',cancelled_at=clock_timestamp(),storage_ref='voice/'||id::text||'/'||id::text,media_capability_expires_at=clock_timestamp()-interval '1 second',lease_until=null where id=any($1::uuid[])",
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
    await query('select private.activate_staging_voice_epoch($1,$2,null)', [
      epoch,
      prepared.manifestHash,
    ]);
    const count = async () =>
      row(
        (
          await query(
            `select
      (select count(*)::int from public.transactions where user_id=$1) transactions,
      (select count(*)::int from public.transaction_postings p join public.transactions t on t.id=p.transaction_id where t.user_id=$1) postings,
      coalesce((select confirmed_minor::text from public.account_balances where account_id=$2),'0') balance`,
            [user, account],
          )
        ).rows[0],
      );
    const before = await count();
    for (const [locale, worker] of [
      ['en', 'before-restart'],
      ['ar', 'after-restart'],
    ]) {
      const state = row(
        (
          await query('select private.staging_voice_heartbeat($1,$2,$3) result', [
            epoch,
            worker,
            'a'.repeat(40),
          ])
        ).rows[0],
      ).result as Record<string, unknown>;
      expect(state.enabled).toBe(true);
      const session = await create(locale);
      const committed = await commit(session);
      const execute = () =>
        executeLegacyEvent([committed.batch_id, committed.token, committed.event]);
      const replay = await Promise.all([execute(), execute()]);
      expect(replay.map((r) => (r.rows[0]?.result as Record<string, unknown>).status)).toEqual([
        'committed',
        'committed',
      ]);
      const receipt = row(
        (await query('select private.get_voice_batch_result($1,$2) result', [user, session]))
          .rows[0],
      ).result as Record<string, unknown>;
      expect(receipt).toMatchObject({ status: 'completed', addedCount: 1 });
      expect(receipt.transactionIds).toHaveLength(1);
    }
    const after = await count();
    expect(after.transactions).toBe(Number(before.transactions) + 2);
    expect(after.postings).toBe(Number(before.postings) + 2);
    expect(BigInt(String(after.balance)) - BigInt(String(before.balance))).toBe(-5000n);
    expect(
      row(
        (
          await query('select state,expires_at from private.staging_voice_epochs where id=$1', [
            epoch,
          ])
        ).rows[0],
      ),
    ).toMatchObject({ state: 'active', expires_at: null });
    expect(
      row((await query('select enabled from private.voice_automatic_policy')).rows[0]).enabled,
    ).toBe(true);
  });
});
