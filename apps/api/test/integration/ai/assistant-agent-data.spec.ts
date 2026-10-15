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
  it('denies the API role even when it knows the valid job and token', async () => {
    const client = await db.connect();
    try {
      await client.query('begin');
      await client.query('set local role masarifi_api');
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
  });
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
  it('denies a different claim token before reading financial data', async () => {
    await expect(reader.read(message, randomUUID(), { tool: 'overview' })).rejects.toThrow(
      'ASSISTANT_DATA_FENCE_DENIED',
    );
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
