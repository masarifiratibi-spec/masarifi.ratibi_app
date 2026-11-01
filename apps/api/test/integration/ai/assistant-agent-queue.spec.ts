import { createHash, randomUUID } from 'node:crypto';
import { Client } from 'pg';

interface QueuedMessage {
  id: string;
}
interface AgentClaim {
  id: string;
  userId: string;
  claimToken: string;
  attempt: number;
  content: string;
}
interface UsageRow {
  request_id: string;
  estimated_cost: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  fallback_used: boolean;
  reservation_status: string;
}
const owned = process.env.TEST_ASSISTANT_FIXTURE_OWNED === '1';
const suite = owned ? describe : describe.skip;
suite('isolated assistant agent durable queue', () => {
  const url = process.env.TEST_ASSISTANT_AGENT_DATABASE_URL;
  const db = new Client({ connectionString: url });
  const owner = `assistant_queue_${randomUUID()}`;
  const conversation = randomUUID();
  beforeAll(async () => {
    if (!url || new URL(url).hostname !== '127.0.0.1' || new URL(url).port !== '15876')
      throw Error('OWNED_ASSISTANT_FIXTURE_REQUIRED');
    await db.connect();
  });
  beforeEach(async () => {
    await db.query('begin');
    await approvePrompt();
    await db.query(
      "update private.ai_feature_routes set enabled=true where workload='financial_assistant'",
    );
    await db.query("insert into public.profiles(id,status) values($1,'active')", [owner]);
    await db.query(
      "insert into public.assistant_consents(user_id,policy_version) values($1,'assistant-privacy-v1')",
      [owner],
    );
    await db.query('insert into public.assistant_conversations(id,user_id) values($1,$2)', [
      conversation,
      owner,
    ]);
    await db.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: owner, role: 'authenticated', sid: 'synthetic-session' }),
    ]);
  });
  afterEach(async () => {
    await db.query('rollback');
  });
  afterAll(async () => {
    await db.end();
  });

  async function scalar<T>(sql: string, parameters: unknown[] = []): Promise<T> {
    const row = (await db.query<{ value: T }>(sql, parameters)).rows[0];
    if (!row) throw Error('FIXTURE_QUERY_RETURNED_NO_ROW');
    return row.value;
  }
  async function enqueue(operationId = randomUUID()): Promise<QueuedMessage> {
    const quota = await scalar<{ allowed: boolean }>(
      "select private.reserve_ai_quota($1,$2,'financial_assistant') value",
      [owner, operationId],
    );
    if (!quota.allowed) throw new Error('FIXTURE_QUOTA_REJECTED');
    return scalar<QueuedMessage>(
      `select private.enqueue_assistant_agent_message($1,$2,'آخر معاملة؟','financial_advice',
      array['accounts_summary','recent_transactions','budgets','obligations','tracking_reviews'],
      '{"assistantAgent":1}','[]','[]','async',$3) value`,
      [owner, conversation, operationId],
    );
  }
  function claim(): Promise<AgentClaim | null> {
    return scalar<AgentClaim | null>('select private.claim_assistant_agent_job($1,120) value', [
      owner,
    ]);
  }
  async function requireClaim(): Promise<AgentClaim> {
    const claimed = await claim();
    if (!claimed) throw Error('FIXTURE_JOB_NOT_CLAIMED');
    return claimed;
  }
  async function reserve(operationId: string): Promise<void> {
    await db.query(
      `insert into private.ai_usage_events(user_id,workload,model,provider,request_id,estimated_cost)
      values($1,'financial_assistant','pending','pending',$2,0.15744)`,
      [owner, operationId],
    );
  }
  async function usage(operationId: string): Promise<UsageRow[]> {
    return (
      await db.query<UsageRow>(
        `select request_id,estimated_cost::text,input_tokens,output_tokens,
      latency_ms,fallback_used,reservation_status from private.ai_usage_events where request_id=$1`,
        [operationId],
      )
    ).rows;
  }
  async function approvePrompt(): Promise<void> {
    const admin = `assistant_prompt_admin_${randomUUID()}`;
    await db.query("insert into public.profiles(id,status) values($1,'active')", [admin]);
    await db.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
      admin,
    ]);
    await db.query(
      "update private.ai_prompt_versions set status='retired' where workload='financial_assistant' and status='approved'",
    );
    await db.query(
      `insert into private.ai_prompt_versions(workload,version_no,template,schema_version,status,evaluation_passed,approved_by,published_at)
      select 'financial_assistant',coalesce(max(version_no),0)+1,'Synthetic isolated queue test prompt.',1,'approved',true,$1,clock_timestamp()
      from private.ai_prompt_versions where workload='financial_assistant'`,
      [admin],
    );
  }
  function receipt(
    inputTokens: number,
    outputTokens: number,
    cost: string,
    latencyMs: number,
    fallbackUsed = false,
  ) {
    return {
      generationHash: createHash('sha256').update(randomUUID()).digest('hex'),
      model: 'synthetic/model',
      provider: 'synthetic-provider',
      usage: { inputTokens, outputTokens, cost },
      latencyMs,
      fallbackUsed,
    };
  }
  function record(claimed: AgentClaim, supplied: unknown): Promise<boolean> {
    return scalar<boolean>('select private.record_assistant_agent_receipt($1,$2,$3) value', [
      claimed.id,
      claimed.claimToken,
      supplied,
    ]);
  }
  function finish(claimed: AgentClaim): Promise<{ messageId: string }> {
    return scalar<{ messageId: string }>(
      'select private.finish_assistant_agent_job($1,$2,$3) value',
      [
        claimed.id,
        claimed.claimToken,
        {
          provider: 'synthetic-provider',
          model: 'synthetic/model',
          content: 'Synthetic grounded response.',
          evidence: [],
          preview: null,
          metadata: { schemaVersion: 1 },
        },
      ],
    );
  }

  it('keeps a new DEV request away from the existing worker and binds its claim to its owner', async () => {
    const request = await enqueue();
    const ordinary = await db.query<{ id: string }>(
      "select * from private.claim_ai_work('assistant.respond','ordinary-worker',100,120)",
    );
    expect(ordinary.rows.map((row) => row.id)).not.toContain(request.id);
    expect(
      await scalar<AgentClaim | null>(
        "select private.claim_assistant_agent_job('another-owner',120) value",
      ),
    ).toBeNull();
    expect(await claim()).toMatchObject({
      id: request.id,
      userId: owner,
      content: 'آخر معاملة؟',
      attempt: 1,
    });
    expect(await claim()).toBeNull();
  });

  it('claims a normal queued owner without developer configuration and retains the lease fence', async () => {
    const request = await enqueue();
    await db.query('set local role masarifi_worker');
    const claimed = await scalar<AgentClaim>(
      'select private.claim_next_assistant_agent_job(120) value',
    );
    expect(claimed).toMatchObject({ id: request.id, userId: owner, attempt: 1 });
    expect(await scalar('select private.claim_next_assistant_agent_job(120) value')).toBeNull();
    await expect(
      db.query('select private.read_assistant_agent_data($1,$2,$3)', [
        claimed.id,
        randomUUID(),
        { tool: 'overview' },
      ]),
    ).rejects.toThrow();
  });

  it.each(['masarifi_api', 'authenticated', 'anon'])(
    'does not grant queue selection to %s',
    async (role) => {
      await db.query(`set local role ${role}`);
      await expect(
        db.query('select private.claim_next_assistant_agent_job(120)'),
      ).rejects.toMatchObject({ code: '42501' });
    },
  );

  it('cancels a queued ordinary request after consent is revoked', async () => {
    const request = await enqueue();
    await db.query(
      'update public.assistant_consents set revoked_at=clock_timestamp() where user_id=$1',
      [owner],
    );
    await db.query('set local role masarifi_worker');
    expect(await scalar('select private.claim_next_assistant_agent_job(120) value')).toBeNull();
    await db.query('reset role');
    expect(
      await scalar('select state value from private.assistant_agent_jobs where id=$1', [
        request.id,
      ]),
    ).toBe('failed');
  });
  it('counts the isolated DEV assistant limit independently from earlier Voice requests', async () => {
    for (let index = 0; index < 6; index += 1) {
      await db.query(
        `insert into private.ai_usage_events(user_id,workload,model,provider,request_id,estimated_cost,reservation_status)
        values($1,'voice_transcription','synthetic','synthetic',$2,0,'completed')`,
        [owner, randomUUID()],
      );
    }
    const operationId = randomUUID();
    await enqueue(operationId);
    const rows = await usage(operationId);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]?.estimated_cost)).toBeGreaterThan(0);
    expect(rows[0]?.reservation_status).toBe('reserved');
  });
  it('recovers an expired claim on the same request and rejects completion by the old worker', async () => {
    const request = await enqueue();
    const first = await requireClaim();
    await db.query(
      "update private.assistant_agent_jobs set lease_until=now()-interval '1 second' where id=$1",
      [request.id],
    );
    const second = await requireClaim();
    expect(second.id).toBe(request.id);
    expect(second.claimToken).not.toBe(first.claimToken);
    await expect(
      db.query("select private.finish_assistant_agent_job($1,$2,'{}')", [
        request.id,
        first.claimToken,
      ]),
    ).rejects.toMatchObject({ message: 'AI_WORK_FENCE_INVALID' });
  });
  it('does not claim work after consent revocation', async () => {
    await enqueue();
    await db.query(
      'update public.assistant_consents set revoked_at=clock_timestamp() where user_id=$1',
      [owner],
    );
    expect(await claim()).toBeNull();
  });
  it('does not publish an answer after the owner cancels an already claimed request', async () => {
    await enqueue();
    const claimed = await requireClaim();
    await db.query(
      "update public.assistant_messages set work_status='cancelled',claim_token=null,claimed_by=null,lease_until=null where id=$1",
      [claimed.id],
    );
    await db.query('savepoint cancelled_completion');
    await expect(finish(claimed)).rejects.toMatchObject({ message: 'AI_WORK_FENCE_INVALID' });
    await db.query('rollback to savepoint cancelled_completion');
    expect(
      await scalar<number>(
        'select count(*)::integer value from public.assistant_messages where reply_to_message_id=$1',
        [claimed.id],
      ),
    ).toBe(0);
  });
  it('retries transient failure through the same isolated queue without legacy admission', async () => {
    const request = await enqueue();
    const first = await requireClaim();
    expect(
      await scalar<boolean>(
        "select private.fail_assistant_agent_job($1,$2,'AI_TEMPORARILY_UNAVAILABLE',true) value",
        [request.id, first.claimToken],
      ),
    ).toBe(true);
    expect(
      await scalar<string>('select state value from private.assistant_agent_jobs where id=$1', [
        request.id,
      ]),
    ).toBe('queued');
    const legacy = await db.query<{ id: string }>(
      "select * from private.claim_ai_work('assistant.respond','ordinary-worker',100,120)",
    );
    expect(legacy.rows.map((row) => row.id)).not.toContain(request.id);
  });
  it('reserves six bounded generations once while a replay remains one user question', async () => {
    const operationId = randomUUID();
    await reserve(operationId);
    const first = await enqueue(operationId);
    expect(await usage(operationId)).toEqual([
      expect.objectContaining({ estimated_cost: '0.94464000', reservation_status: 'reserved' }),
    ]);
    expect((await enqueue(operationId)).id).toBe(first.id);
    expect(await usage(operationId)).toEqual([
      expect.objectContaining({ estimated_cost: '0.94464000' }),
    ]);
    expect(
      await scalar<number>(
        "select count(*)::integer value from private.ai_usage_events where user_id=$1 and workload='financial_assistant'",
        [owner],
      ),
    ).toBe(1);
  });
  it('deduplicates generation receipts and completes one quota row at the exact known total', async () => {
    await approvePrompt();
    const operationId = randomUUID();
    await reserve(operationId);
    await enqueue(operationId);
    const claimed = await requireClaim();
    const first = receipt(100, 20, '0.005', 20);
    await record(claimed, first);
    await record(claimed, first);
    await record(claimed, receipt(50, 30, '0.007', 30, true));
    expect(
      await scalar<number>(
        'select count(*)::integer value from private.assistant_agent_receipts where job_id=$1',
        [claimed.id],
      ),
    ).toBe(2);
    expect(await usage(operationId)).toEqual([
      expect.objectContaining({
        input_tokens: 150,
        output_tokens: 50,
        latency_ms: 50,
        fallback_used: true,
        estimated_cost: '0.94464000',
      }),
    ]);
    const saved = await finish(claimed);
    expect(saved.messageId).toMatch(/^[a-f0-9-]{36}$/);
    expect(await usage(operationId)).toEqual([
      expect.objectContaining({
        request_id: operationId,
        input_tokens: 150,
        output_tokens: 50,
        estimated_cost: '0.01200000',
        reservation_status: 'completed',
      }),
    ]);
    expect(
      await scalar<number>(
        "select count(*)::integer value from private.ai_usage_events where user_id=$1 and workload='financial_assistant'",
        [owner],
      ),
    ).toBe(1);
  });
  it('retains the full reservation when a dispatched generation has uncertain usage', async () => {
    await approvePrompt();
    const operationId = randomUUID();
    await reserve(operationId);
    await enqueue(operationId);
    const claimed = await requireClaim();
    await record(claimed, receipt(100, 20, '0.005', 20));
    await record(claimed, { uncertain: true });
    await finish(claimed);
    expect(await usage(operationId)).toEqual([
      expect.objectContaining({
        input_tokens: 100,
        output_tokens: 20,
        estimated_cost: '0.94464000',
        reservation_status: 'completed',
      }),
    ]);
    expect(
      await scalar<number>(
        'select count(*)::integer value from private.assistant_agent_receipts where job_id=$1',
        [claimed.id],
      ),
    ).toBe(1);
  });
  it('bounds dispatched generations across lease recovery and protects charged cost from stale rollup', async () => {
    const operationId = randomUUID();
    await reserve(operationId);
    await enqueue(operationId);
    let claimed = await requireClaim();
    for (let index = 0; index < 6; index += 1) {
      await db.query(
        `select private.authorize_assistant_agent_dispatch($1,$2,private.get_effective_ai_route('financial_assistant'))`,
        [claimed.id, claimed.claimToken],
      );
      if (index === 2) {
        await db.query(
          "update private.assistant_agent_jobs set lease_until=now()-interval '1 second' where id=$1",
          [claimed.id],
        );
        claimed = await requireClaim();
      }
    }
    await db.query('savepoint dispatch_limit');
    await expect(
      db.query(
        `select private.authorize_assistant_agent_dispatch($1,$2,private.get_effective_ai_route('financial_assistant'))`,
        [claimed.id, claimed.claimToken],
      ),
    ).rejects.toMatchObject({ message: 'AI_DISPATCH_LIMIT' });
    await db.query('rollback to savepoint dispatch_limit');
    await db.query("select private.fail_assistant_agent_job($1,$2,'AI_DISPATCH_REJECTED',false)", [
      claimed.id,
      claimed.claimToken,
    ]);
    await db.query(
      "update private.ai_usage_events set created_at=now()-interval '3 hours' where request_id=$1",
      [operationId],
    );
    await db.query('select private.rollup_ai_usage(1000)');
    expect(await usage(operationId)).toEqual([
      expect.objectContaining({ estimated_cost: '0.94464000', reservation_status: 'failed' }),
    ]);
  });
  it('retains the bound for a crashed dispatch without a receipt after later completion', async () => {
    await approvePrompt();
    const operationId = randomUUID();
    await reserve(operationId);
    await enqueue(operationId);
    const first = await requireClaim();
    await db.query(
      `select private.authorize_assistant_agent_dispatch($1,$2,private.get_effective_ai_route('financial_assistant'))`,
      [first.id, first.claimToken],
    );
    await db.query(
      "update private.assistant_agent_jobs set lease_until=now()-interval '1 second' where id=$1",
      [first.id],
    );
    const recovered = await requireClaim();
    await db.query(
      `select private.authorize_assistant_agent_dispatch($1,$2,private.get_effective_ai_route('financial_assistant'))`,
      [recovered.id, recovered.claimToken],
    );
    await record(recovered, receipt(100, 20, '0.005', 20));
    await finish(recovered);
    expect(await usage(operationId)).toEqual([
      expect.objectContaining({ estimated_cost: '0.94464000', reservation_status: 'completed' }),
    ]);
    expect(
      await scalar<string | null>(
        'select prompt_version_id value from public.assistant_messages where reply_to_message_id=$1',
        [first.id],
      ),
    ).toBeNull();
  });
  it('closes an expired claim at the retry ceiling and retains potentially charged usage', async () => {
    const operationId = randomUUID();
    await reserve(operationId);
    await enqueue(operationId);
    const first = await requireClaim();
    await db.query(
      `select private.authorize_assistant_agent_dispatch($1,$2,private.get_effective_ai_route('financial_assistant'))`,
      [first.id, first.claimToken],
    );
    await db.query(
      "update private.assistant_agent_jobs set attempt_count=3,lease_until=now()-interval '1 second' where id=$1",
      [first.id],
    );
    expect(await claim()).toBeNull();
    expect(
      await scalar<string>('select work_status value from public.assistant_messages where id=$1', [
        first.id,
      ]),
    ).toBe('failed');
    expect(await usage(operationId)).toEqual([
      expect.objectContaining({ estimated_cost: '0.94464000', reservation_status: 'failed' }),
    ]);
  });
  it('does not shrink the retry reservation after a known charged transient failure', async () => {
    const operationId = randomUUID();
    await reserve(operationId);
    await enqueue(operationId);
    const first = await requireClaim();
    await db.query(
      `select private.authorize_assistant_agent_dispatch($1,$2,private.get_effective_ai_route('financial_assistant'))`,
      [first.id, first.claimToken],
    );
    await record(first, receipt(100, 20, '0.005', 20));
    await db.query(
      "select private.fail_assistant_agent_job($1,$2,'AI_TEMPORARILY_UNAVAILABLE',true)",
      [first.id, first.claimToken],
    );
    expect(await usage(operationId)).toEqual([
      expect.objectContaining({ estimated_cost: '0.94464000', reservation_status: 'completed' }),
    ]);
  });
  it('refuses a fresh dispatch against an older monthly reservation', async () => {
    const operationId = randomUUID();
    await reserve(operationId);
    await enqueue(operationId);
    const claimed = await requireClaim();
    await db.query(
      "update private.ai_usage_events set budget_period=(date_trunc('month',current_date)-interval '1 month')::date where request_id=$1",
      [operationId],
    );
    await expect(
      db.query(
        `select private.authorize_assistant_agent_dispatch($1,$2,private.get_effective_ai_route('financial_assistant'))`,
        [claimed.id, claimed.claimToken],
      ),
    ).rejects.toMatchObject({ message: 'AI_BUDGET_EXHAUSTED' });
  });
  it('refuses dispatch using a route that changed after the worker read it', async () => {
    await enqueue();
    const claimed = await requireClaim();
    const previous = await scalar<Record<string, unknown>>(
      "select private.get_effective_ai_route('financial_assistant') value",
    );
    await db.query(
      "update private.ai_feature_routes set version=version+1 where workload='financial_assistant'",
    );
    await expect(
      db.query('select private.authorize_assistant_agent_dispatch($1,$2,$3)', [
        claimed.id,
        claimed.claimToken,
        previous,
      ]),
    ).rejects.toMatchObject({ message: 'AI_ROUTE_UNAVAILABLE' });
  });
  it('refuses provider dispatch after consent revocation even with a fresh lease', async () => {
    await enqueue();
    const claimed = await requireClaim();
    await db.query(
      'update public.assistant_consents set revoked_at=clock_timestamp() where user_id=$1',
      [owner],
    );
    await expect(
      db.query(
        `select private.authorize_assistant_agent_dispatch($1,$2,private.get_effective_ai_route('financial_assistant'))`,
        [claimed.id, claimed.claimToken],
      ),
    ).rejects.toMatchObject({ message: 'AI_WORK_FENCE_INVALID' });
  });
});
