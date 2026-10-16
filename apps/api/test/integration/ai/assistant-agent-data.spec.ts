import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AssistantAgentData } from '../../../src/ai/assistant-agent-data';
import { PoolService } from '../../../src/platform/database/pool.service';

const url = process.env.TEST_ASSISTANT_DATA_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite('fenced assistant finance tools on isolated PostgreSQL', () => {
  let db: Pool;
  let reader: AssistantAgentData;
  let workerPool: PoolService;
  const owner = `assistant_data_${randomUUID()}`,
    other = `assistant_other_${randomUUID()}`;
  const message = randomUUID(),
    conversation = randomUUID(),
    token = randomUUID();
  beforeAll(async () => {
    if (
      !url ||
      !['127.0.0.1', 'localhost'].includes(new URL(url).hostname) ||
      process.env.TEST_ASSISTANT_FIXTURE_OWNED !== '1'
    )
      throw Error('OWNED_LOCAL_FIXTURE_REQUIRED');
    db = new Pool({ connectionString: url });
    workerPool = new PoolService({
      get: (key: string) =>
        key === 'DATABASE_URL'
          ? url
          : key === 'MASARIFI_DATABASE_POOL_MAX'
            ? 1
            : key === 'MASARIFI_PROCESS_KIND'
              ? 'worker'
              : undefined,
    } as never);
    reader = new AssistantAgentData(workerPool);
    await db.query(`insert into public.profiles(id) values($1),($2)`, [owner, other]);
    await db.query(
      `insert into public.assistant_consents(user_id,policy_version) values($1,'assistant-privacy-v1')`,
      [owner],
    );
    await db.query(`insert into public.assistant_conversations(id,user_id) values($1,$2)`, [
      conversation,
      owner,
    ]);
    await db.query(
      `insert into public.assistant_messages(id,user_id,conversation_id,role,content_redacted,work_status,context_scope) values($1,$2,$3,'user','finance question','processing',array['accounts_summary','recent_transactions','budgets','obligations','tracking_reviews'])`,
      [message, owner, conversation],
    );
    await db.query(
      `insert into private.assistant_agent_jobs(id,user_id,state,claim_token,lease_until) values($1,$2,'processing',$3,clock_timestamp()+interval '10 minutes')`,
      [message, owner, token],
    );
    await db.query(
      `insert into public.accounts(user_id,name,type,currency_code) values($1,'shared','cash','SAR'),($1,'shared','bank','SAR'),($1,'unique wallet','wallet','SAR'),($2,'other secret','cash','USD')`,
      [owner, other],
    );
    await db.query(
      `insert into public.budgets(user_id,name,currency_code,period_start,period_end,total_minor,status) values($1,'real budget','SAR','2024-02-01','2024-02-29',70000,'active')`,
      [owner],
    );
    await db.query(
      `insert into public.salary_profiles(user_id,name,amount_minor,currency_code,frequency,expected_day) values($1,'actual salary',150000,'SAR','monthly',25)`,
      [owner],
    );
    await db.query(
      `insert into public.savings_goals(user_id,name,currency_code,target_minor,opening_tracked_minor) values($1,'real goal','SAR',100000,2500)`,
      [owner],
    );
    await db.query(
      `insert into public.obligations(user_id,name,type,schedule_kind,currency_code,frequency,start_date) values($1,'real obligation','bill','irregular','SAR','irregular','2024-01-01')`,
      [owner],
    );
    await db.query(
      `insert into public.transactions(user_id,kind,amount_minor,currency_code,title,occurred_at,status) values($1,'expense',12345,'SAR','owner expense','2024-02-29','confirmed'),($1,'expense',400,'SAR','pending expense','2024-02-29','pending'),($1,'income',900000,'USD','foreign currency','2024-02-28','confirmed'),($1,'expense',111,'SAR','old expense','2023-01-01','confirmed'),($2,'expense',999999,'SAR','other owner secret','2024-02-29','confirmed')`,
      [owner, other],
    );
  });
  afterAll(async () => {
    await workerPool.onModuleDestroy();
    await db.end();
  });
  it('separates currencies and pending amounts and isolates the job owner', async () => {
    const result = await reader.read(message, token, {
      tool: 'summary',
      startDate: '2024-02-28',
      endDate: '2024-02-29',
    });
    expect(result.data.summaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currency: 'SAR',
          kind: 'expense',
          status: 'confirmed',
          amountMinor: '12345',
          count: 1,
        }),
        expect.objectContaining({
          currency: 'SAR',
          kind: 'expense',
          status: 'pending',
          amountMinor: '400',
          count: 1,
        }),
        expect.objectContaining({
          currency: 'USD',
          kind: 'income',
          status: 'confirmed',
          amountMinor: '900000',
          count: 1,
        }),
      ]),
    );
    expect(JSON.stringify(result.data)).not.toContain('999999');
    expect(result.data.summaries).toHaveLength(3);
  });
  it('paginates with a full count and keeps identifiers outside provider data', async () => {
    const first = await reader.read(message, token, { tool: 'transactions', limit: 1 });
    expect(first.data.transactions).toEqual(expect.objectContaining({ count: 4, hasMore: true }));
    expect((first.data.transactions as { items: unknown[] }).items).toHaveLength(1);
    const second = await reader.read(message, token, { tool: 'transactions', limit: 1, offset: 3 });
    expect(second.data.transactions).toEqual(expect.objectContaining({ count: 4, hasMore: false }));
    expect(JSON.stringify(first.data)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(first.aliases).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'transaction' })]),
    );
  });
  it('returns grounded current planning state and profile without private contact fields', async () => {
    const result = await reader.read(message, token, {
      tool: 'planning',
      startDate: '2024-02-01',
      endDate: '2024-02-29',
    });
    const planning = result.data.planning as {
      stateAsOf: string;
      collections: Record<
        'budget' | 'salary' | 'goal' | 'obligation',
        { items: Record<string, unknown>[] }
      >;
    };
    expect(planning.stateAsOf).toBe('current');
    expect(planning.collections.budget.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'real budget', totalMinor: '70000' }),
      ]),
    );
    expect(planning.collections.salary.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'actual salary', amountMinor: '150000' }),
      ]),
    );
    expect(planning.collections.goal.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'real goal', trackedMinor: '2500' }),
      ]),
    );
    expect(planning.collections.obligation.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'real obligation', remainingPrincipalMinor: '0' }),
      ]),
    );
    const overview = await reader.read(message, token, {
      tool: 'overview',
      startDate: '2024-02-01',
      endDate: '2024-02-29',
    });
    expect(overview.data.accounts).toEqual(expect.objectContaining({ count: 3 }));
    expect(overview.data.profile).toEqual({ locale: 'ar', timezone: 'Asia/Riyadh' });
    expect(JSON.stringify(overview.data)).not.toContain('other secret');
  });
  it('requires clarification for duplicate account names and resolves a stable alias precisely', async () => {
    const ambiguous = await reader.read(message, token, {
      tool: 'transactions',
      account: 'shared',
    });
    expect(ambiguous.data).toEqual({ status: 'ambiguous', selector: 'account', matches: 2 });
    const catalog = await reader.read(message, token, { tool: 'accounts' });
    const account = (
      catalog.data.accounts as { items: { alias: string; name: string }[] }
    ).items.find((a) => a.name === 'unique wallet');
    if (!account) throw Error('FIXTURE_ACCOUNT_MISSING');
    const selected = await reader.read(message, token, {
      tool: 'accounts',
      account: account.alias,
    });
    expect(selected.data.accounts).toEqual(
      expect.objectContaining({
        count: 1,
        items: [expect.objectContaining({ name: 'unique wallet' })],
      }),
    );
  });
  it.each(['masarifi_api', 'anon', 'authenticated', 'service_role'] as const)(
    'denies %s even when it knows the valid job and token',
    async (role) => {
      const client = await db.connect();
      try {
        await client.query('begin');
        await client.query(`set local role ${role}`);
        await expect(
          client.query('select private.read_assistant_agent_data($1,$2,$3)', [
            message,
            token,
            { tool: 'accounts' },
          ]),
        ).rejects.toThrow('permission denied');
      } finally {
        await client.query('rollback');
        client.release();
      }
    },
  );
  it.each(['expired', 'archived'] as const)('denies a %s job scope', async (state) => {
    if (state === 'expired')
      await db.query(
        "update private.assistant_agent_jobs set lease_until=clock_timestamp()-interval '1 second' where id=$1",
        [message],
      );
    else
      await db.query("update public.assistant_conversations set status='archived' where id=$1", [
        conversation,
      ]);
    try {
      await expect(reader.read(message, token, { tool: 'summary' })).rejects.toThrow(
        'ASSISTANT_DATA_FENCE_DENIED',
      );
    } finally {
      await db.query(
        "update private.assistant_agent_jobs set lease_until=clock_timestamp()+interval '10 minutes' where id=$1",
        [message],
      );
      await db.query("update public.assistant_conversations set status='active' where id=$1", [
        conversation,
      ]);
    }
  });
  it('honors budgets-only consent scope for overview and denies transaction tools', async () => {
    await db.query(
      "update public.assistant_messages set context_scope=array['budgets'] where id=$1",
      [message],
    );
    try {
      const overview = await reader.read(message, token, {
        tool: 'overview',
        startDate: '2024-02-01',
        endDate: '2024-02-29',
      });
      expect(overview.data.accounts).toBeUndefined();
      expect(overview.data.transactions).toBeUndefined();
      expect(overview.data.summaries).toBeUndefined();
      const collections = (overview.data.planning as { collections: Record<string, unknown> })
        .collections;
      expect(collections.salary).toBeUndefined();
      expect(collections.obligation).toBeUndefined();
      expect(collections.budget).toBeDefined();
      expect(
        overview.aliases.every((a) =>
          ['budget', 'budget_category', 'goal', 'report_schedule'].includes(a.kind),
        ),
      ).toBe(true);
      await expect(reader.read(message, token, { tool: 'transactions' })).rejects.toThrow(
        'ASSISTANT_DATA_SCOPE_DENIED',
      );
    } finally {
      await db.query(
        "update public.assistant_messages set context_scope=array['accounts_summary','recent_transactions','budgets','obligations','tracking_reviews'] where id=$1",
        [message],
      );
    }
  });
  it('sorts only the requested expense kind even when an income is larger', async () => {
    const result = await reader.read(message, token, {
      tool: 'transactions',
      kind: 'expense',
      sort: 'largest',
      limit: 1,
    });
    expect((result.data.transactions as { items: unknown[] }).items).toEqual([
      expect.objectContaining({ kind: 'expense', amountMinor: '12345' }),
    ]);
  });
  it('applies literal merchant or note search with exact date and currency filters', async () => {
    const result = await reader.read(message, token, {
      tool: 'transactions',
      search: 'owner expense',
      currency: 'SAR',
      startDate: '2024-02-29',
      endDate: '2024-02-29',
    });
    expect(result.data.transactions).toEqual(
      expect.objectContaining({
        count: 1,
        hasMore: false,
        items: [expect.objectContaining({ title: 'owner expense', amountMinor: '12345' })],
      }),
    );
    const missing = await reader.read(message, token, {
      tool: 'transactions',
      search: 'other owner secret',
    });
    expect(missing.data.transactions).toEqual(expect.objectContaining({ count: 0, items: [] }));
  });
  it('distinguishes an unavailable account projection from a persisted zero balance', async () => {
    const selectedAccount = (
      await db.query<{ id: string }>(
        "select id from public.accounts where user_id=$1 and name='unique wallet'",
        [owner],
      )
    ).rows[0];
    if (!selectedAccount) throw Error('FIXTURE_ACCOUNT_MISSING');
    const missingAccount = selectedAccount.id;
    await db.query('delete from public.account_balances where account_id=$1', [missingAccount]);
    const unknown = await reader.read(message, token, {
      tool: 'accounts',
      account: 'unique wallet',
    });
    expect((unknown.data.accounts as { items: unknown[] }).items).toEqual([
      expect.objectContaining({
        balanceAvailability: 'unavailable',
        confirmedMinor: null,
        pendingMinor: null,
      }),
    ]);
    await db.query(
      'insert into public.account_balances(account_id,confirmed_minor,pending_minor) values($1,0,0)',
      [missingAccount],
    );
    const knownZero = await reader.read(message, token, {
      tool: 'accounts',
      account: 'unique wallet',
    });
    expect((knownZero.data.accounts as { items: unknown[] }).items).toEqual([
      expect.objectContaining({
        balanceAvailability: 'available',
        confirmedMinor: '0',
        pendingMinor: '0',
      }),
    ]);
  });
  it('provides the latest confirmed transaction across history when this month has no transactions', async () => {
    const overview = await reader.read(message, token, { tool: 'overview' });
    expect(overview.data.transactions).toEqual(expect.objectContaining({ count: 0, items: [] }));
    const latest = overview.data.latestTransactionAllHistory as {
      coverage: string;
      transaction: { alias: string };
    };
    expect(latest.coverage).toBe('all_history');
    expect(latest.transaction).toEqual(
      expect.objectContaining({
        status: 'confirmed',
        amountMinor: '12345',
        currency: 'SAR',
        title: 'owner expense',
      }),
    );
    expect(overview.aliases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ alias: latest.transaction.alias, kind: 'transaction' }),
      ]),
    );
  });
  it('filters exact minor amounts within one currency and aggregates top merchants', async () => {
    const filtered = await reader.read(message, token, {
      tool: 'transactions',
      currency: 'SAR',
      minAmountMinor: '10000',
      maxAmountMinor: '13000',
    });
    expect(filtered.data.transactions).toEqual(
      expect.objectContaining({
        count: 1,
        items: [expect.objectContaining({ amountMinor: '12345' })],
      }),
    );
    const summary = await reader.read(message, token, {
      tool: 'summary',
      startDate: '2024-02-01',
      endDate: '2024-02-29',
    });
    expect(summary.data.topExpenseMerchants).toEqual(
      expect.objectContaining({
        count: 1,
        limit: 10,
        hasMore: false,
        items: [
          expect.objectContaining({
            merchant: '(unknown)',
            currency: 'SAR',
            amountMinor: '12345',
            count: 1,
          }),
        ],
      }),
    );
  });
  it('reads aggregate tracking outcomes without raw message bodies', async () => {
    const result = await reader.read(message, token, { tool: 'tracking' });
    expect(result.data.tracking).toEqual(
      expect.objectContaining({ stateAsOf: 'current', outcomes: [] }),
    );
    expect(JSON.stringify(result.data)).not.toMatch(/smsBody|rawBody|messageBody/u);
  });
  it('denies a different claim token before reading financial data', async () => {
    await expect(reader.read(message, randomUUID(), { tool: 'overview' })).rejects.toThrow(
      'ASSISTANT_DATA_FENCE_DENIED',
    );
  });
  it('matches report spending effects for fees, refunds and transfers without mixing pending or currencies', async () => {
    await db.query(
      `insert into public.transactions(user_id,kind,amount_minor,fee_minor,currency_code,title,merchant,occurred_at,status)
      values($1,'expense',1000,50,'SAR','parity expense','shop','2024-06-10','confirmed'),
      ($1,'refund',200,9,'SAR','parity refund','shop','2024-06-10','confirmed'),
      ($1,'transfer',5000,20,'SAR','parity transfer','bank','2024-06-10','confirmed'),
      ($1,'income',3000,30,'SAR','parity income','employer','2024-06-10','confirmed'),
      ($1,'expense',9000,10,'SAR','parity pending','shop','2024-06-10','pending')`,
      [owner],
    );
    const result = await reader.read(message, token, {
      tool: 'summary',
      startDate: '2024-06-01',
      endDate: '2024-06-30',
    });
    expect(result.data.financialEffects).toEqual([
      {
        currency: 'SAR',
        incomeMinor: '3000',
        expenseMinor: '900',
        netCashFlowMinor: '2100',
        transactionCount: 4,
      },
    ]);
    expect(result.data.summaries).toContainEqual(
      expect.objectContaining({ kind: 'expense', amountMinor: '1000', feesMinor: '50' }),
    );
  });
  it('paginates category and merchant rankings after the tenth group', async () => {
    await db.query(
      `with ranked_categories as (
        insert into public.categories(user_id,label_ar,label_en,kind)
        select $1,'فئة اختبار '||n,'ranking category '||n,'expense' from generate_series(1,13) n returning id,label_en
      ) insert into public.transactions(user_id,category_id,kind,amount_minor,currency_code,title,merchant,occurred_at,status)
      select $1,id,'expense',replace(label_en,'ranking category ','')::integer,'SAR','ranking',
        'shop-'||replace(label_en,'ranking category ',''),'2024-07-10','confirmed' from ranked_categories`,
      [owner],
    );
    const result = await reader.read(message, token, {
      tool: 'summary',
      startDate: '2024-07-01',
      endDate: '2024-07-31',
      limit: 2,
      offset: 10,
    });
    expect(result.data.topExpenseMerchants).toEqual(
      expect.objectContaining({
        count: 13,
        limit: 2,
        offset: 10,
        hasMore: true,
        items: [
          expect.objectContaining({ merchant: 'shop-3' }),
          expect.objectContaining({ merchant: 'shop-2' }),
        ],
      }),
    );
    expect(result.data.topExpenseCategories).toEqual(
      expect.objectContaining({
        count: 13,
        limit: 2,
        offset: 10,
        hasMore: true,
        items: [
          expect.objectContaining({ labelEn: 'ranking category 3', amountMinor: '3' }),
          expect.objectContaining({ labelEn: 'ranking category 2', amountMinor: '2' }),
        ],
      }),
    );
  });
  it('provides complete balances only for contributing active accounts and marks missing projections', async () => {
    await db.query(
      `update public.accounts set include_in_totals=false where user_id=$1 and name='shared'`,
      [owner],
    );
    const result = await reader.read(message, token, { tool: 'accounts', limit: 1 });
    expect(result.data.balanceTotals).toEqual([
      {
        currency: 'SAR',
        confirmedMinor: '0',
        pendingMinor: '0',
        availability: 'available',
        accountCount: 1,
        missingBalanceCount: 0,
      },
    ]);
    await db.query(
      `insert into public.accounts(user_id,name,type,currency_code) values($1,'missing projection','cash','SAR')`,
      [owner],
    );
    const missing = await reader.read(message, token, { tool: 'accounts' });
    expect(missing.data.balanceTotals).toEqual([
      {
        currency: 'SAR',
        confirmedMinor: null,
        pendingMinor: null,
        availability: 'unavailable',
        accountCount: 2,
        missingBalanceCount: 1,
      },
    ]);
  });
  it('bounds combined planning collections and returns exact totals independent of the page', async () => {
    await db.query(
      `insert into public.savings_goals(user_id,name,currency_code,target_minor,opening_tracked_minor)
      select $1,'extra goal '||n,'SAR',1000,100 from generate_series(1,30) n`,
      [owner],
    );
    const result = await reader.read(message, token, { tool: 'planning', limit: 2 });
    const planning = result.data.planning as {
      totals: unknown;
      collections: Record<string, { items: unknown[] }>;
    };
    expect(Object.values(planning.collections).flatMap((c) => c.items)).toHaveLength(2);
    expect(planning.totals).toEqual(
      expect.objectContaining({
        goals: [
          {
            currency: 'SAR',
            targetMinor: '130000',
            trackedMinor: '5500',
            shortfallMinor: '124500',
            count: 31,
          },
        ],
      }),
    );
    const selected = await reader.read(message, token, {
      tool: 'planning',
      collection: 'goal',
      limit: 2,
      offset: 30,
    });
    expect((selected.data.planning as { collections: unknown }).collections).toMatchObject({
      goal: {
        count: 31,
        offset: 30,
        hasMore: false,
        items: [expect.any(Object)],
      },
    });
  });
  it.each(['savings_movement', 'obligation_payment', 'report_delivery'] as const)(
    'returns explicit empty %s details',
    async (collection) => {
      const result = await reader.read(message, token, { tool: 'planning', collection });
      expect((result.data.planning as { collections: unknown }).collections).toMatchObject({
        [collection]: { count: 0, items: [], hasMore: false },
      });
      expect(Object.keys((result.data.planning as { collections: object }).collections)).toEqual([
        collection,
      ]);
    },
  );
  it.each(['tracking_review', 'tracking_history', 'voice_session', 'voice_preference'] as const)(
    'returns owner-fenced bounded %s without raw payloads',
    async (collection) => {
      const result = await reader.read(message, token, { tool: 'tracking', collection, limit: 1 });
      expect((result.data.tracking as { collections: unknown }).collections).toMatchObject({
        [collection]: { count: 0, items: [], hasMore: false },
      });
      expect(Object.keys((result.data.tracking as { collections: object }).collections)).toEqual([
        collection,
      ]);
      expect(
        JSON.stringify((result.data.tracking as { collections: unknown }).collections),
      ).not.toMatch(/"(?:storageRef|provider|transcript|rawBody|analysisEvents)"/u);
    },
  );
  it('hides scheduled and receipt children of archived financial parents', async () => {
    const salaryId = randomUUID(),
      obligationId = randomUUID();
    await db.query(
      `insert into public.salary_profiles(id,user_id,name,amount_minor,currency_code,frequency,expected_day,status,deleted_at)
      values($1,$2,'archived salary sentinel',100,'SAR','monthly',25,'archived',now())`,
      [salaryId, owner],
    );
    await db.query(
      `insert into public.salary_receipts(user_id,salary_profile_id,expected_at,amount_minor) values($1,$2,'2024-08-01',100)`,
      [owner, salaryId],
    );
    await db.query(
      `insert into public.obligations(id,user_id,name,type,schedule_kind,currency_code,frequency,start_date,status,deleted_at)
      values($1,$2,'archived obligation sentinel','bill','irregular','SAR','irregular','2024-01-01','archived',now())`,
      [obligationId, owner],
    );
    await db.query(
      `insert into public.obligation_schedule_items(user_id,obligation_id,due_at,amount_minor,sequence_no)
      values($1,$2,'2024-08-01',100,1)`,
      [owner, obligationId],
    );
    const result = await reader.read(message, token, {
      tool: 'planning',
      startDate: '2024-08-01',
      endDate: '2024-08-31',
    });
    expect(JSON.stringify(result)).not.toContain('archived salary sentinel');
    expect(JSON.stringify(result)).not.toContain('archived obligation sentinel');
  });
  it('reduces a large obligation page before the response cap and retains honest continuation', async () => {
    await db.query(
      `insert into public.obligations(user_id,name,type,schedule_kind,currency_code,frequency,start_date,principal_minor)
      select $1,repeat('ط',150)||n,'debt','irregular','SAR','irregular','2024-01-01',1000 from generate_series(1,50) n`,
      [owner],
    );
    const result = await reader.read(message, token, {
      tool: 'planning',
      collection: 'obligation',
      limit: 50,
    });
    expect(Buffer.byteLength(JSON.stringify(result), 'utf8')).toBeLessThan(65536);
    const collection = (
      result.data.planning as {
        collections: {
          obligation: { items: unknown[]; count: number; limit: number; hasMore: boolean };
        };
      }
    ).collections.obligation;
    expect(collection.count).toBe(51);
    expect(collection.items.length).toBeLessThan(50);
    expect(collection.limit).toBe(collection.items.length);
    expect(collection.hasMore).toBe(true);
  });
  it('returns normalized review and Voice status details without copying stored payloads', async () => {
    const sessionId = randomUUID(),
      itemId = randomUUID(),
      voiceId = randomUUID();
    await db.query(
      `insert into public.import_sessions(id,user_id,source_type,request_hash) values($1,$2,'manual',repeat('a',64))`,
      [sessionId, owner],
    );
    await db.query(
      `insert into public.import_items(id,user_id,session_id,source_item_key,normalized_hash,source_hash,amount_minor,currency_code,merchant,normalized_payload,status)
      values($1,$2,$3,'one',repeat('b',64),repeat('c',64),321,'SAR','actual shop','{"rawBody":"private payload sentinel"}','review')`,
      [itemId, owner, sessionId],
    );
    await db.query(
      `insert into public.review_items(user_id,import_item_id,reason,proposed_values,original_values)
      values($1,$2,'low_confidence','{"rawBody":"private proposed sentinel"}','{}')`,
      [owner, itemId],
    );
    await db.query(
      `insert into public.voice_sessions(id,user_id,locale,content_type,size_bytes,duration_ms,expires_at,operation_id,storage_ref)
      values($1::uuid,$2,'ar','audio/m4a',1000,1000,now()+interval '1 hour',$3::uuid,'voice/'||$1::text||'/'||$3::text)`,
      [voiceId, owner, randomUUID()],
    );
    await db.query(
      `insert into private.voice_batch_context(session_id,user_id,thresholds,analysis_only,analysis_events,analysis_expires_at)
      values($1,$2,'{}',true,'[{"text":"private analysis sentinel"}]',now()+interval '10 minutes')`,
      [voiceId, owner],
    );
    await db.query(
      `insert into public.voice_transcripts(user_id,session_id,provider,model,text_redacted,language)
      values($1,$2,'private-provider','private-model','private transcript sentinel','ar')`,
      [owner, voiceId],
    );
    const review = await reader.read(message, token, {
      tool: 'tracking',
      collection: 'tracking_review',
    });
    expect((review.data.tracking as { collections: unknown }).collections).toMatchObject({
      tracking_review: {
        count: 1,
        items: [
          expect.objectContaining({
            merchant: 'actual shop',
            amountMinor: '321',
            status: 'pending',
          }),
        ],
      },
    });
    const voice = await reader.read(message, token, {
      tool: 'tracking',
      collection: 'voice_session',
    });
    expect((voice.data.tracking as { collections: unknown }).collections).toMatchObject({
      voice_session: {
        count: 1,
        items: [
          expect.objectContaining({
            status: 'uploaded',
            analysisOnly: true,
            analysisEventCount: 1,
            committedEventCount: 0,
          }),
        ],
      },
    });
    expect(JSON.stringify([review, voice])).not.toMatch(
      /private payload sentinel|private proposed sentinel|private analysis sentinel|private transcript sentinel|private-provider|private-model|voice\//u,
    );
  });
  it('returns complete payable and receivable totals using the application obligation projection', async () => {
    const obligationId = randomUUID();
    const transaction = (
      await db.query<{ id: string }>(
        `select id from public.transactions where user_id=$1 and title='parity expense'`,
        [owner],
      )
    ).rows[0];
    if (!transaction) throw Error('FIXTURE_TRANSACTION_MISSING');
    await db.query(
      `insert into public.obligations(id,user_id,name,direction,type,schedule_kind,currency_code,frequency,start_date,principal_minor,opening_paid_minor)
      values($1,$2,'payable projection','payable','debt','irregular','USD','irregular','2024-01-01',10000,1000)`,
      [obligationId, owner],
    );
    await db.query(
      `insert into public.obligations(user_id,name,direction,type,schedule_kind,currency_code,frequency,start_date,principal_minor)
      values($1,'receivable projection','receivable','debt','irregular','USD','irregular','2024-01-01',2000)`,
      [owner],
    );
    await db.query(
      `insert into public.obligation_payments(user_id,obligation_id,transaction_id,paid_at,amount_minor,payment_case,allocation_intent)
      values($1,$2,$3,'2024-08-01',1000,'partial','current')`,
      [owner, obligationId, transaction.id],
    );
    const result = await reader.read(message, token, {
      tool: 'planning',
      currency: 'USD',
      limit: 1,
    });
    expect(
      (result.data.planning as { totals: { obligations: unknown } }).totals.obligations,
    ).toEqual(
      expect.arrayContaining([
        {
          currency: 'USD',
          direction: 'payable',
          remainingPrincipalMinor: '8000',
          overdueMinor: '0',
          count: 1,
        },
        {
          currency: 'USD',
          direction: 'receivable',
          remainingPrincipalMinor: '2000',
          overdueMinor: '0',
          count: 1,
        },
      ]),
    );
  });
  it('accepts null collection directly at the SQL boundary but rejects wrong-domain selectors', async () => {
    const result = (
      await db.query<{ result: { data: { status: string } } }>(
        'select private.read_assistant_agent_data($1,$2,$3) result',
        [message, token, { tool: 'summary', collection: null }],
      )
    ).rows[0];
    expect(result?.result.data.status).toBe('ok');
    for (const collection of ['voice_session', 1]) {
      await expect(
        db.query('select private.read_assistant_agent_data($1,$2,$3)', [
          message,
          token,
          { tool: 'summary', collection },
        ]),
      ).rejects.toThrow('ASSISTANT_DATA_QUERY_INVALID');
    }
  });
  it('attributes a refund to its original category outside the period and uses owner-local midnight', async () => {
    const category = randomUUID(),
      original = randomUUID();
    await db.query(
      `insert into public.categories(id,user_id,label_ar,label_en,kind)
      values($1,$2,'اختبار استرداد','refund category','expense')`,
      [category, owner],
    );
    await db.query(
      `insert into public.transactions(id,user_id,category_id,kind,amount_minor,currency_code,title,occurred_at,status)
      values($1,$2,$3,'expense',1000,'SAR','original outside period','2024-08-01','confirmed')`,
      [original, owner, category],
    );
    await db.query(
      `insert into public.transactions(user_id,category_id,reverses_transaction_id,kind,amount_minor,fee_minor,currency_code,title,occurred_at,status)
      values($1,$2,null,'expense',500,50,'SAR','local start boundary','2024-08-31T21:00:00Z','confirmed'),
      ($1,null,$3,'refund',200,10,'SAR','linked refund','2024-09-01T18:00:00Z','confirmed'),
      ($1,$2,null,'expense',999,0,'SAR','next local day','2024-09-01T21:00:00Z','confirmed')`,
      [owner, category, original],
    );
    const result = await reader.read(message, token, {
      tool: 'summary',
      category: 'refund category',
      startDate: '2024-09-01',
      endDate: '2024-09-01',
    });
    expect(result.data.financialEffects).toEqual([
      {
        currency: 'SAR',
        incomeMinor: '0',
        expenseMinor: '350',
        netCashFlowMinor: '-350',
        transactionCount: 2,
      },
    ]);
    expect(result.data.topExpenseCategories).toEqual(
      expect.objectContaining({
        count: 1,
        items: [
          expect.objectContaining({ labelEn: 'refund category', amountMinor: '300', count: 2 }),
        ],
      }),
    );
  });
  it('counts fees on other movement kinds and keeps confirmed financial effects currency separated', async () => {
    await db.query(
      `insert into public.transactions(user_id,kind,amount_minor,fee_minor,currency_code,title,occurred_at,status)
      values($1,'opening',100,7,'SAR','fee opening','2024-10-01','confirmed'),
      ($1,'reversal',100,11,'SAR','fee reversal','2024-10-01','confirmed'),
      ($1,'adjustment',100,13,'SAR','fee adjustment','2024-10-01','confirmed'),
      ($1,'income',1000,20,'USD','usd income','2024-10-01','confirmed'),
      ($1,'expense',9999,99,'USD','pending excluded','2024-10-01','pending')`,
      [owner],
    );
    const result = await reader.read(message, token, {
      tool: 'summary',
      startDate: '2024-10-01',
      endDate: '2024-10-01',
    });
    expect(result.data.financialEffects).toEqual([
      {
        currency: 'SAR',
        incomeMinor: '0',
        expenseMinor: '31',
        netCashFlowMinor: '-31',
        transactionCount: 3,
      },
      {
        currency: 'USD',
        incomeMinor: '1000',
        expenseMinor: '20',
        netCashFlowMinor: '980',
        transactionCount: 1,
      },
    ]);
  });
  it('includes signed savings movements in complete totals while hiding deleted goal details', async () => {
    const goal = randomUUID(),
      deletedGoal = randomUUID(),
      transaction = randomUUID();
    await db.query(
      `insert into public.transactions(id,user_id,kind,amount_minor,currency_code,title,occurred_at,status)
      values($1,$2,'expense',100,'EUR','goal fixture','2024-11-01','confirmed')`,
      [transaction, owner],
    );
    await db.query(
      `insert into public.savings_goals(id,user_id,name,currency_code,target_minor,opening_tracked_minor)
      values($1,$2,'signed goal','EUR',1000,500)`,
      [goal, owner],
    );
    await db.query(
      `insert into public.savings_goals(id,user_id,name,currency_code,target_minor,opening_tracked_minor,status,deleted_at)
      values($1,$2,'deleted goal sentinel','EUR',9999,9999,'deleted',now())`,
      [deletedGoal, owner],
    );
    await db.query(
      `insert into public.savings_goal_movements(user_id,goal_id,transaction_id,amount_minor,occurred_at,kind)
      values($1,$2,$3,300,'2024-11-01','contribution'),($1,$2,$3,-100,'2024-11-01','withdrawal'),
      ($1,$2,$3,-50,'2024-11-01','adjustment'),($1,$4,$3,1,'2024-11-01','contribution')`,
      [owner, goal, transaction, deletedGoal],
    );
    const result = await reader.read(message, token, {
      tool: 'planning',
      currency: 'EUR',
      collection: 'savings_movement',
      limit: 1,
    });
    expect(result.data.planning as { totals: unknown; collections: unknown }).toMatchObject({
      totals: {
        goals: [
          {
            currency: 'EUR',
            targetMinor: '1000',
            trackedMinor: '650',
            shortfallMinor: '350',
            count: 1,
          },
        ],
        obligations: [],
      },
      collections: {
        savings_movement: {
          count: 3,
          hasMore: true,
          items: [expect.any(Object)],
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain('deleted goal sentinel');
  });
  it('excludes archived and opted-out accounts from complete current totals in each currency', async () => {
    const active = randomUUID(),
      archived = randomUUID(),
      excluded = randomUUID();
    await db.query(
      `insert into public.accounts(id,user_id,name,type,currency_code,status,include_in_totals,deleted_at)
      values($1,$2,'included euro','cash','EUR','active',true,null),($3,$2,'archived euro','cash','EUR','archived',true,now()),
      ($4,$2,'excluded euro','cash','EUR','active',false,null)`,
      [active, owner, archived, excluded],
    );
    await db.query(
      `insert into public.account_balances(account_id,confirmed_minor,pending_minor)
      values($1,123,-5),($2,999,0),($3,888,0)`,
      [active, archived, excluded],
    );
    const result = await reader.read(message, token, {
      tool: 'accounts',
      currency: 'EUR',
      limit: 1,
    });
    expect(result.data.balanceTotals).toEqual([
      {
        currency: 'EUR',
        confirmedMinor: '123',
        pendingMinor: '-5',
        availability: 'available',
        accountCount: 1,
        missingBalanceCount: 0,
      },
    ]);
  });
  it('returns report delivery and tracking history status without snapshots or source/provider references', async () => {
    await db.query(
      `insert into private.report_output_attempts(user_id,report_type,period_start,period_end,ledger_version,snapshot,provider_message_id,expires_at)
      values($1,'financial_summary','2024-12-01','2024-12-31',0,'{"secret":"report snapshot sentinel"}','provider-private-sentinel',now()+interval '1 hour'),
      ($2,'financial_summary','2024-12-01','2024-12-31',0,'{}','other-provider-sentinel',now()+interval '1 hour')`,
      [owner, other],
    );
    await db.query(
      `insert into public.tracking_history(user_id,source_type,source_ref,outcome,reason_codes)
      values($1,'sms','source private sentinel','parsed',array['recognized']),($2,'sms','other source sentinel','failed',array['failure'])`,
      [owner, other],
    );
    const report = await reader.read(message, token, {
      tool: 'planning',
      collection: 'report_delivery',
    });
    expect((report.data.planning as { collections: unknown }).collections).toMatchObject({
      report_delivery: {
        count: 1,
        items: [
          expect.objectContaining({ deliveryStatus: 'queued', reportType: 'financial_summary' }),
        ],
      },
    });
    const history = await reader.read(message, token, {
      tool: 'tracking',
      collection: 'tracking_history',
    });
    expect((history.data.tracking as { collections: unknown }).collections).toMatchObject({
      tracking_history: {
        count: 1,
        items: [
          expect.objectContaining({
            outcome: 'parsed',
            sourceType: 'sms',
            reasonCodes: ['recognized'],
          }),
        ],
      },
    });
    expect(JSON.stringify([report, history])).not.toMatch(
      /report snapshot sentinel|provider-private-sentinel|other-provider-sentinel|source private sentinel|other source sentinel/u,
    );
  });
  it('keeps new tracking and report details behind their context scopes', async () => {
    await db.query(
      "update public.assistant_messages set context_scope=array['accounts_summary'] where id=$1",
      [message],
    );
    try {
      await expect(
        reader.read(message, token, { tool: 'tracking', collection: 'voice_session' }),
      ).rejects.toThrow('ASSISTANT_DATA_SCOPE_DENIED');
      await expect(
        reader.read(message, token, {
          tool: 'planning',
          collection: 'report_delivery',
        }),
      ).rejects.toThrow('ASSISTANT_DATA_SCOPE_DENIED');
    } finally {
      await db.query(
        "update public.assistant_messages set context_scope=array['accounts_summary','recent_transactions','budgets','obligations','tracking_reviews'] where id=$1",
        [message],
      );
    }
  });
  describe('planning collection scope authorization', () => {
    const emptyOwner = `assistant_scope_${randomUUID()}`,
      scopedMessage = randomUUID(),
      scopedConversation = randomUUID(),
      scopedToken = randomUUID();
    beforeAll(async () => {
      await db.query('insert into public.profiles(id) values($1)', [emptyOwner]);
      await db.query(
        "insert into public.assistant_consents(user_id,policy_version) values($1,'assistant-privacy-v1')",
        [emptyOwner],
      );
      await db.query('insert into public.assistant_conversations(id,user_id) values($1,$2)', [
        scopedConversation,
        emptyOwner,
      ]);
      await db.query(
        `insert into public.assistant_messages(id,user_id,conversation_id,role,content_redacted,work_status,context_scope)
        values($1,$2,$3,'user','scope regression','processing',array['accounts_summary'])`,
        [scopedMessage, emptyOwner, scopedConversation],
      );
      await db.query(
        `insert into private.assistant_agent_jobs(id,user_id,state,claim_token,lease_until)
        values($1,$2,'processing',$3,clock_timestamp()+interval '10 minutes')`,
        [scopedMessage, emptyOwner, scopedToken],
      );
    });
    it.each([
      ['salary', 'accounts_summary', 'budgets'],
      ['salary_receipt', 'accounts_summary', 'budgets'],
      ['obligation', 'obligations', 'budgets'],
      ['obligation_schedule', 'obligations', 'budgets'],
      ['obligation_payment', 'obligations', 'budgets'],
      ['budget', 'budgets', 'accounts_summary'],
      ['budget_category', 'budgets', 'accounts_summary'],
      ['goal', 'budgets', 'accounts_summary'],
      ['savings_movement', 'budgets', 'accounts_summary'],
      ['report_schedule', 'budgets', 'accounts_summary'],
      ['report_delivery', 'budgets', 'accounts_summary'],
    ] as const)(
      'denies %s without %s and preserves an authorized empty result',
      async (collection, requiredScope, insufficientScope) => {
        await db.query(
          'update public.assistant_messages set context_scope=$1::text[] where id=$2',
          [[insufficientScope], scopedMessage],
        );
        await expect(
          reader.read(scopedMessage, scopedToken, { tool: 'planning', collection }),
        ).rejects.toThrow('ASSISTANT_DATA_SCOPE_DENIED');
        await db.query(
          'update public.assistant_messages set context_scope=$1::text[] where id=$2',
          [[requiredScope], scopedMessage],
        );
        const result = await reader.read(scopedMessage, scopedToken, {
          tool: 'planning',
          collection,
        });
        expect((result.data.planning as { collections: unknown }).collections).toEqual({
          [collection]: { count: 0, items: [], offset: 0, limit: 20, hasMore: false },
        });
        expect(result.aliases).toEqual([]);
      },
    );
  });
  it('reports only the current owner Voice operating status and never another owner epoch', async () => {
    const current = (
      await db.query<{ enforced: boolean; current_epoch: string | null }>(
        'select enforced,current_epoch from private.staging_voice_runtime_control',
      )
    ).rows[0];
    const policy = (
      await db.query<{ enabled: boolean }>('select enabled from private.voice_automatic_policy')
    ).rows[0];
    if (!current || !policy) throw Error('FIXTURE_VOICE_CONTROL_MISSING');
    const ownEpoch = randomUUID(),
      otherEpoch = randomUUID();
    await db.query(
      `insert into private.staging_voice_epochs(id,manifest,manifest_hash,mode,state,started_at,heartbeat_at)
      values($1,jsonb_build_object('ownerId',$2::text,'secret','private manifest sentinel'),repeat('a',64),'operating','active',now(),now()),
      ($3,jsonb_build_object('ownerId',$4::text,'secret','other manifest sentinel'),repeat('b',64),'operating','active',now(),now())`,
      [ownEpoch, owner, otherEpoch, other],
    );
    try {
      await db.query(
        'update private.staging_voice_runtime_control set enforced=true,current_epoch=$1',
        [ownEpoch],
      );
      await db.query('update private.voice_automatic_policy set enabled=true');
      const own = await reader.read(message, token, { tool: 'tracking' });
      expect(
        (own.data.tracking as { voiceOperatingStatus: unknown }).voiceOperatingStatus,
      ).toMatchObject({
        availability: 'available',
        state: 'active',
        mode: 'operating',
        activeOperating: true,
      });
      expect(
        (own.data.tracking as { voiceOperatingStatus: unknown }).voiceOperatingStatus,
      ).toHaveProperty('heartbeatAt', expect.any(String));
      expect(JSON.stringify(own.data)).not.toMatch(
        /private manifest sentinel|other manifest sentinel|ownerId|manifest|epochId|workerId/u,
      );
      await db.query('update private.voice_automatic_policy set enabled=false');
      const off = await reader.read(message, token, { tool: 'tracking' });
      expect(
        (off.data.tracking as { voiceOperatingStatus: unknown }).voiceOperatingStatus,
      ).toMatchObject({ activeOperating: false });
      await db.query('update private.staging_voice_runtime_control set current_epoch=$1', [
        otherEpoch,
      ]);
      const foreign = await reader.read(message, token, { tool: 'tracking' });
      expect(
        (foreign.data.tracking as { voiceOperatingStatus: unknown }).voiceOperatingStatus,
      ).toEqual({ availability: 'unavailable' });
    } finally {
      await db.query(
        'update private.staging_voice_runtime_control set enforced=$1,current_epoch=$2',
        [current.enforced, current.current_epoch],
      );
      await db.query('update private.voice_automatic_policy set enabled=$1', [policy.enabled]);
    }
  });
  it('denies revoked consent on the next tool call', async () => {
    await db.query(
      'update public.assistant_consents set revoked_at=clock_timestamp() where user_id=$1',
      [owner],
    );
    await expect(reader.read(message, token, { tool: 'transactions' })).rejects.toThrow(
      'ASSISTANT_DATA_FENCE_DENIED',
    );
  });
});
