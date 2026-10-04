import { randomUUID } from 'node:crypto';
import { AiRepository } from '../../../src/ai/ai.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('missing fixture row');
  return value;
}

describeLiveDatabase('Voice automatic batch ledger boundary', () => {
  const pool = createLivePool();
  const user = 'voice_batch_' + randomUUID();
  const account = randomUUID();
  beforeAll(async () => {
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [user]);
    await pool.query(
      "insert into public.accounts(id,user_id,name,type,currency_code,is_default) values($1,$2,'Cash','cash','SAR',true)",
      [account, user],
    );
    await pool.query('update private.voice_automatic_policy set enabled=true');
  });
  afterAll(async () => {
    await pool.onModuleDestroy();
  });
  async function fixture(
    decisions?: (command: Record<string, unknown>) => unknown[],
    thresholds = {},
  ) {
    const session = randomUUID(),
      token = randomUUID();
    await pool.query(
      "insert into public.voice_sessions(id,user_id,locale,status,duration_ms,content_type,size_bytes,storage_ref,expires_at,operation_id,contract_version,claimed_by,claim_token,lease_until) values($1,$2,'en','processing',3000,'audio/m4a',100,'voice/'||$1::uuid::text||'/'||$3::uuid::text,clock_timestamp()+interval '23 hours',$3,3,'test-worker',$4,clock_timestamp()+interval '2 minutes')",
      [session, user, randomUUID(), token],
    );
    await pool.query(
      'insert into private.voice_batch_context(session_id,user_id,default_account_id,thresholds) values($1,$2,$3,$4::jsonb)',
      [session, user, account, JSON.stringify(thresholds)],
    );
    const command = {
      kind: 'income',
      amountMinor: 1250,
      currency: 'SAR',
      accountId: account,
      categoryId: null,
      title: 'Voice transaction',
      merchant: null,
      paymentMethod: null,
      note: null,
      occurredAt: new Date(Date.now() - 1000).toISOString(),
      source: 'voice',
      externalRef: null,
    };
    const accepted = await pool.query<{ result: { batchId: string } }>(
      'select private.accept_voice_batch($1,$2,$3::jsonb,$4) result',
      [
        session,
        token,
        JSON.stringify(
          decisions
            ? decisions(command)
            : [
                { status: 'eligible', command },
                { status: 'eligible', command },
                { status: 'skipped', reason: 'missing_amount' },
              ],
        ),
        'automatic-or-skip-v3.1',
      ],
    );
    const batch = required(accepted.rows[0]).result.batchId;
    const events = await pool.query<{ id: string; status: string }>(
      'select id,status from private.voice_events where batch_id=$1 order by ordinal',
      [batch],
    );
    let claim: { batch_id: string; token: string } | undefined;
    if (events.rows.some((event) => event.status === 'eligible'))
      for (let page = 0; page < 20 && !claim; page++) {
        const claims = await pool.query<{ batch_id: string; token: string }>(
          'select * from private.claim_voice_finalization(25)',
        );
        claim = claims.rows.find((candidate) => candidate.batch_id === batch);
        if (!claims.rows.length) break;
      }
    return {
      session,
      batch,
      get claim() {
        return required(claim);
      },
      events: events.rows,
    };
  }
  it('continues healthy siblings when one occurrence repeatedly fails infrastructure execution', async () => {
    const { batch, events } = await fixture();
    const first = required(events[0]).id;
    await pool.query('update private.voice_batches set lease_until=null where id=$1', [batch]);
    await pool.query(
      "create or replace function private.voice_batch_item_fault() returns trigger language plpgsql as $$ begin if new.external_ref=TG_ARGV[0] then raise exception 'TEST_ITEM_INFRASTRUCTURE_FAILURE'; end if; return new; end $$",
    );
    await pool.query(
      `create trigger voice_batch_item_fault before insert on public.transactions for each row execute function private.voice_batch_item_fault('voice-event:${first}')`,
    );
    try {
      const repository = new AiRepository(pool);
      await repository.finalizeVoiceBatches(25);
      const statuses = () =>
        pool.query<{ status: string }>(
          'select status from private.voice_events where batch_id=$1 order by ordinal',
          [batch],
        );
      expect((await statuses()).rows.map((row) => row.status)).toEqual([
        'eligible',
        'committed',
        'skipped',
      ]);
      for (let attempt = 1; attempt < 5; attempt++) {
        await pool.query(
          'update private.voice_events set next_attempt_at=clock_timestamp() where id=$1',
          [first],
        );
        await pool.query(
          'update private.voice_batches set next_attempt_at=clock_timestamp() where id=$1',
          [batch],
        );
        await repository.finalizeVoiceBatches(25);
      }
      expect((await statuses()).rows.map((row) => row.status)).toEqual([
        'execution_failed',
        'committed',
        'skipped',
      ]);
      expect(
        required(
          (await pool.query('select attempt_count from private.voice_events where id=$1', [first]))
            .rows[0],
        ).attempt_count,
      ).toBe(5);
      expect(
        required(
          (await pool.query('select status from private.voice_batches where id=$1', [batch]))
            .rows[0],
        ).status,
      ).toBe('failed');
      expect(
        (await pool.query('select * from private.voice_event_commands where event_id=$1', [first]))
          .rows,
      ).toHaveLength(0);
    } finally {
      await pool.query('drop trigger voice_batch_item_fault on public.transactions');
      await pool.query('drop function private.voice_batch_item_fault()');
    }
  });
  it('serializes item retry with the owner cancellation boundary without consuming attempts', async () => {
    const { session, batch, claim, events } = await fixture();
    const eventId = required(events[0]).id;
    await pool.query('update private.voice_events set attempt_count=4 where id=$1', [eventId]);
    await pool.withClient(async (holder) => {
      await holder.query('begin');
      try {
        await holder.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [user]);
        await pool.withClient(async (retry) => {
          await retry.query('begin');
          try {
            await retry.query("set local role masarifi_worker; set local lock_timeout='100ms'");
            await expect(
              retry.query('select private.retry_voice_event($1,$2,$3)', [
                batch,
                claim.token,
                eventId,
              ]),
            ).rejects.toMatchObject({ code: '55P03' });
          } finally {
            await retry.query('rollback');
          }
        });
        await holder.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ sub: user }),
        ]);
        await holder.query('select private.cancel_voice_session($1,$2)', [user, session]);
        await holder.query('commit');
      } finally {
        await holder.query('rollback');
      }
    });
    expect(
      (
        await pool.query('select status,attempt_count from private.voice_events where id=$1', [
          eventId,
        ])
      ).rows[0],
    ).toMatchObject({ status: 'cancelled', attempt_count: 4 });
    expect(
      (await pool.query('select * from private.voice_event_commands where event_id=$1', [eventId]))
        .rows,
    ).toHaveLength(0);
  });
  it('purges v3 unacknowledged uploads at the upload deadline', async () => {
    const session = randomUUID();
    await pool.query(
      "insert into public.voice_sessions(id,user_id,locale,status,duration_ms,content_type,size_bytes,storage_ref,expires_at,operation_id,contract_version,upload_deadline,media_capability_expires_at) values($1,$2,'en','uploaded',1000,'audio/m4a',100,'voice/'||$1::uuid::text||'/'||$3::uuid::text,clock_timestamp()+interval '23 hours',$3,3,clock_timestamp()-interval '1 minute',clock_timestamp()-interval '1 minute')",
      [session, user, randomUUID()],
    );
    const claim = (
      await pool.query<{ id: string; purge_token: string }>(
        'select * from private.claim_voice_media_purge($1,100,120)',
        ['test-v3-purge'],
      )
    ).rows.find((row) => row.id === session);
    expect(claim).toBeDefined();
    await pool.query('select private.complete_voice_media_purge($1,$2,true,null)', [
      session,
      required(claim).purge_token,
    ]);
    expect(
      required(
        (
          await pool.query('select status,storage_ref from public.voice_sessions where id=$1', [
            session,
          ])
        ).rows[0],
      ),
    ).toMatchObject({ status: 'expired', storage_ref: null });
  });
  it('posts each identical occurrence once through concurrent delivery and leaves skips financially empty', async () => {
    const { batch, claim, events } = await fixture();
    await Promise.all(
      Array.from({ length: 4 }, () =>
        pool.query('select private.execute_voice_event($1,$2,$3)', [
          batch,
          claim.token,
          required(events[0]).id,
        ]),
      ),
    );
    await pool.query('select private.execute_voice_event($1,$2,$3)', [
      batch,
      claim.token,
      required(events[1]).id,
    ]);
    expect(
      (
        await pool.query<{ count: string }>(
          'select count(*) from public.transactions where user_id=$1 and external_ref=any($2)',
          [user, events.map((e) => 'voice-event:' + e.id)],
        )
      ).rows[0]?.count,
    ).toBe('2');
    expect(
      (
        await pool.query<{ count: string }>(
          'select count(*) from private.voice_event_commands where event_id=any($1)',
          [events.map((e) => e.id)],
        )
      ).rows[0]?.count,
    ).toBe('0');
    const skipped = (
      await pool.query('select * from private.voice_events where id=$1', [required(events[2]).id])
    ).rows[0];
    expect(required(skipped).transaction_id).toBeNull();
    expect(required(skipped).reason_code).toBe('missing_amount');
    expect(Object.keys(required(skipped))).not.toContain('command');
  });
  it('cancels remaining items while preserving authoritative committed receipts', async () => {
    const { session, batch, claim, events } = await fixture();
    await pool.query('select private.execute_voice_event($1,$2,$3)', [
      batch,
      claim.token,
      required(events[0]).id,
    ]);
    await pool.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: user }),
    ]);
    // Owner authorization is set on the same connection as cancellation.
    await pool.withClient(async (c) => {
      await c.query('begin');
      try {
        await c.query("select set_config('request.jwt.claims',$1,true)", [
          JSON.stringify({ sub: user }),
        ]);
        const result = (
          await c.query<{ result: { addedCount: number; status: string } }>(
            'select private.cancel_voice_session($1,$2) result',
            [user, session],
          )
        ).rows[0]?.result;
        expect(result).toMatchObject({ addedCount: 1, status: 'cancelled' });
        await c.query('commit');
      } catch (error) {
        await c.query('rollback');
        throw error;
      }
    });
    expect(
      (
        await pool.query('select status from private.voice_events where id=$1', [
          required(events[1]).id,
        ])
      ).rows[0]?.status,
    ).toBe('cancelled');
  });
  it('applies aggregate authorization and retains no skipped financial command', async () => {
    const { batch, events } = await fixture(undefined, { SAR: 2000 });
    expect(events.map((event) => event.status)).toEqual(['skipped', 'skipped', 'skipped']);
    expect(
      (
        await pool.query('select * from private.voice_event_commands where event_id=any($1)', [
          events.map((event) => event.id),
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (await pool.query('select status from private.voice_batches where id=$1', [batch])).rows[0]
        ?.status,
    ).toBe('completed');
    expect(
      (
        await pool.query(
          "select column_name from information_schema.columns where table_schema='private' and table_name='voice_batches' and column_name='totals'",
        )
      ).rows,
    ).toHaveLength(0);
  });
  it('resumes after lease loss using permanent receipts and never recreates an occurrence', async () => {
    const { batch, claim, events } = await fixture();
    await pool.query('select private.execute_voice_event($1,$2,$3)', [
      batch,
      claim.token,
      required(events[0]).id,
    ]);
    await pool.query(
      "update private.voice_batches set lease_until=clock_timestamp()-interval '1 second' where id=$1",
      [batch],
    );
    const replacement = required(
      (
        await pool.query<{ batch_id: string; token: string }>(
          'select * from private.claim_voice_finalization(25)',
        )
      ).rows.find((row) => row.batch_id === batch),
    );
    await expect(
      pool.query('select private.execute_voice_event($1,$2,$3)', [
        batch,
        claim.token,
        required(events[1]).id,
      ]),
    ).rejects.toThrow('VOICE_EXECUTION_FENCE_INVALID');
    await pool.query('select private.execute_voice_event($1,$2,$3)', [
      batch,
      replacement.token,
      required(events[0]).id,
    ]);
    await pool.query('select private.execute_voice_event($1,$2,$3)', [
      batch,
      replacement.token,
      required(events[1]).id,
    ]);
    expect(
      (
        await pool.query(
          "select transaction_id from private.voice_events where batch_id=$1 and status='committed'",
          [batch],
        )
      ).rows,
    ).toHaveLength(2);
  });
  it('skips malformed individual commands before persistence while preserving safe siblings', async () => {
    const { batch, claim, events } = await fixture((command) => [
      { status: 'eligible', command: { ...command, note: 'private discarded narrative' } },
      { status: 'eligible', command: { ...command, occurredAt: 'invalid date' } },
      { status: 'eligible', command },
    ]);
    expect(events.map((event) => event.status)).toEqual(['skipped', 'skipped', 'eligible']);
    await pool.query('select private.execute_voice_event($1,$2,$3)', [
      batch,
      claim.token,
      required(events[2]).id,
    ]);
    expect(
      (
        await pool.query('select command from private.voice_event_commands where user_id=$1', [
          user,
        ])
      ).rows.every((row) => !JSON.stringify(row).includes('private discarded narrative')),
    ).toBe(true);
  });
  it('expires unexecuted commands even when automatic execution is paused', async () => {
    const { session, batch, events } = await fixture();
    await pool.query(
      "update public.voice_sessions set created_at=clock_timestamp()-interval '23 hours',expires_at=clock_timestamp()-interval '1 second' where id=$1",
      [session],
    );
    await pool.query('update private.voice_automatic_policy set enabled=false');
    try {
      await pool.query('select private.purge_expired_voice_commands(25)');
      expect(
        (
          await pool.query('select * from private.voice_event_commands where event_id=any($1)', [
            events.map((event) => event.id),
          ])
        ).rows,
      ).toHaveLength(0);
      expect(
        (await pool.query('select status from private.voice_batches where id=$1', [batch])).rows[0]
          ?.status,
      ).toBe('failed');
    } finally {
      await pool.query('update private.voice_automatic_policy set enabled=true');
    }
  });
  it('does not give Worker or API roles general financial mutation or table privileges', async () => {
    const result = required(
      (
        await pool.query(
          "select has_function_privilege('masarifi_worker','private.post_transaction(text,jsonb)','EXECUTE') ledger,has_table_privilege('masarifi_worker','private.voice_event_commands','INSERT') commands,has_function_privilege('masarifi_api','private.execute_voice_event(uuid,uuid,uuid)','EXECUTE') api_execution",
        )
      ).rows[0],
    );
    expect(result).toEqual({ ledger: false, commands: false, api_execution: false });
  });
  it('isolates v3 receipts, recovery and cancellation by owner and trusted claims', async () => {
    const { session, batch } = await fixture(() => [
      { status: 'skipped', reason: 'unsupported_event' },
    ]);
    const other = 'voice_other_' + randomUUID();
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [other]);
    const asApi = (claim: string, sql: string, values: unknown[]) =>
      pool.withClient(async (client) => {
        await client.query('begin');
        try {
          await client.query('set local role masarifi_api');
          await client.query("select set_config('request.jwt.claims',$1,true)", [
            JSON.stringify({ sub: claim }),
          ]);
          return await client.query<{ result: Record<string, unknown> }>(sql, values);
        } finally {
          await client.query('rollback');
        }
      });
    const receipt = required(
      (await asApi(user, 'select private.get_voice_batch_result($1,$2) result', [user, session]))
        .rows[0],
    ).result;
    expect(receipt).toMatchObject({ status: 'completed', addedCount: 0, transactionIds: [] });
    expect(Object.keys(receipt).sort()).toEqual(
      ['sessionId', 'batchId', 'status', 'transactionIds', 'addedCount', 'ledgerVersion'].sort(),
    );
    await expect(
      asApi(other, 'select private.get_voice_batch_result($1,$2)', [other, session]),
    ).rejects.toThrow('VOICE_SESSION_NOT_FOUND');
    await expect(
      asApi(other, 'select private.get_voice_batch_result($1,$2)', [user, session]),
    ).rejects.toThrow('AI_OWNER_REQUIRED');
    expect(
      required(
        (
          await asApi(other, 'select private.list_voice_batch_recovery($1,null,null,100) result', [
            other,
          ])
        ).rows[0],
      ).result,
    ).toEqual({ items: [] });
    await expect(
      asApi(other, 'select private.cancel_voice_session($1,$2)', [other, session]),
    ).rejects.toThrow('VOICE_SESSION_NOT_FOUND');
    expect(
      required(
        (await pool.query('select status from private.voice_batches where id=$1', [batch])).rows[0],
      ).status,
    ).toBe('completed');
  });
  it.each([
    'public.transactions',
    'public.transaction_postings',
    'public.account_balances',
    'audit.transaction_revisions',
    'audit.audit_events',
    'private.outbox_events',
    'private.voice_events',
  ])('rolls back the whole item on failure writing %s', async (table) => {
    const { batch, claim, events } = await fixture();
    await pool.query(
      "create or replace function private.voice_batch_test_fault() returns trigger language plpgsql as $$ begin raise exception 'TEST_VOICE_ATOMIC_FAULT'; end $$",
    );
    await pool.query(
      `create trigger voice_batch_test_fault before insert or update on ${table} for each row execute function private.voice_batch_test_fault()`,
    );
    try {
      await expect(
        pool.query('select private.execute_voice_event($1,$2,$3)', [
          batch,
          claim.token,
          required(events[0]).id,
        ]),
      ).rejects.toThrow('TEST_VOICE_ATOMIC_FAULT');
      expect(
        (
          await pool.query('select id from public.transactions where external_ref=$1', [
            'voice-event:' + required(events[0]).id,
          ])
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await pool.query('select status from private.voice_events where id=$1', [
            required(events[0]).id,
          ])
        ).rows[0]?.status,
      ).toBe('eligible');
    } finally {
      await pool.query(`drop trigger voice_batch_test_fault on ${table}`);
      await pool.query('drop function private.voice_batch_test_fault()');
    }
  });
  it('skips balance overflow without blocking a safe sibling on another account', async () => {
    const overflowAccount = randomUUID();
    await pool.query(
      "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Overflow boundary','cash','SAR')",
      [overflowAccount, user],
    );
    const { batch, claim, events } = await fixture((command) => [
      { status: 'eligible', command: { ...command, amountMinor: 200, accountId: overflowAccount } },
      { status: 'eligible', command },
    ]);
    await pool.query('select private.post_transaction($1,$2::jsonb)', [
      user,
      JSON.stringify({
        kind: 'income',
        amountMinor: Number.MAX_SAFE_INTEGER - 100,
        currency: 'SAR',
        accountId: overflowAccount,
        categoryId: null,
        title: 'Boundary seed',
        merchant: null,
        paymentMethod: null,
        note: null,
        occurredAt: new Date().toISOString(),
        source: 'manual',
        externalRef: null,
      }),
    ]);
    await pool.query('select private.execute_voice_event($1,$2,$3)', [
      batch,
      claim.token,
      required(events[0]).id,
    ]);
    await pool.query('select private.execute_voice_event($1,$2,$3)', [
      batch,
      claim.token,
      required(events[1]).id,
    ]);
    expect(
      (
        await pool.query<{ status: string }>(
          'select status from private.voice_events where batch_id=$1 order by ordinal',
          [batch],
        )
      ).rows.map((row) => row.status),
    ).toEqual(['skipped', 'committed']);
  });
  it('skips and erases an eligible command whose account becomes invalid', async () => {
    const { batch, claim, events } = await fixture();
    await pool.query(
      "update public.accounts set status='closed',is_default=false,closed_at=clock_timestamp() where id=$1",
      [account],
    );
    {
      await pool.query('select private.execute_voice_event($1,$2,$3)', [
        batch,
        claim.token,
        required(events[0]).id,
      ]);
      expect(
        (
          await pool.query('select status,transaction_id from private.voice_events where id=$1', [
            required(events[0]).id,
          ])
        ).rows[0],
      ).toMatchObject({ status: 'skipped', transaction_id: null });
      expect(
        (
          await pool.query('select * from private.voice_event_commands where event_id=$1', [
            required(events[0]).id,
          ])
        ).rows,
      ).toHaveLength(0);
    }
  });
});
