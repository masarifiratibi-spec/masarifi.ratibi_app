import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';

const databaseUrl = process.env.MASARIFI_DELETION_LOCAL_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite('owner erasure with a large foreign outbox on the owned local fixture', () => {
  let client: Client;
  const owner = `outbox_erase_${randomUUID()}`;
  const request = randomUUID();
  const resource = randomUUID();
  const foreignAggregate = randomUUID();
  const transaction = randomUUID();

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('OWNED_LOCAL_FIXTURE_REQUIRED');
    const target = new URL(databaseUrl);
    if (
      !['127.0.0.1', 'localhost'].includes(target.hostname) ||
      target.port !== '15876' ||
      target.pathname !== '/reliability_deletion_20261016'
    )
      throw new Error('OWNED_LOCAL_FIXTURE_REQUIRED');
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
  });
  afterAll(async () => client.end());
  afterEach(async () => client.query('rollback'));

  it('uses indexed candidates and removes only owned payload among 500,000 foreign events', async () => {
    await client.query('begin');
    await client.query('set local role masarifi_migration');
    await client.query('insert into public.profiles(id) values($1)', [owner]);
    await client.query(
      "insert into private.account_deletion_requests(id,user_id,status,verified_at,cooling_off_ends_at) values($1,$2,'processing',clock_timestamp(),clock_timestamp())",
      [request, owner],
    );
    await client.query("select set_config('masarifi.ledger_command','on',true)");
    await client.query(
      "insert into public.transactions(id,user_id,kind,amount_minor,currency_code,title,occurred_at) values($1,$2,'expense',100,'SAR','Private sync snapshot',clock_timestamp())",
      [transaction, owner],
    );
    await client.query(
      "insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload) values('transaction',$1,'transaction.created','{}')",
      [transaction],
    );
    await client.query(
      `insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload,published_at)
       select 'erasure_benchmark_foreign',$1,'system.health',
         jsonb_build_object('message',repeat('x',480),'sequence',n),clock_timestamp()
       from generate_series(1,500000) n`,
      [foreignAggregate],
    );
    await client.query(
      `insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload) values
       ('system',null,'system.owner',jsonb_build_object('userId',$1::text)),
       ('system',null,'system.owner',jsonb_build_object('profileId',$1::text)),
       ('voice-session',$2,'voice.snapshot','{}'),
       ('voice_session',$2,'voice.snapshot','{}'),
       ('voice-session',$2,'privacy.deletion_requested',jsonb_build_object('userId',$1::text)),
       ('unrelated',$2,'system.foreign','{}')`,
      [owner, resource],
    );
    await client.query('analyze private.outbox_events');
    await client.query('set local role masarifi_worker');
    await client.query('select private.freeze_account_deletion_owner($1,$2)', [request, owner]);
    await client.query('select private.prepare_account_owner_erasure($1,$2)', [request, owner]);
    await client.query('set local role masarifi_migration');
    // Exercise the sync-owner branch independently of resource membership.
    await client.query(
      "delete from private.account_erasure_resources where request_id=$1 and resource_type='transaction' and resource_id=$2",
      [request, transaction],
    );
    await client.query(
      "insert into private.account_erasure_resources(request_id,resource_type,resource_id) values($1,'voice_session',$2),($1,'ai_work','not-a-uuid')",
      [request, resource],
    );
    const definition = await client.query<{ definition: string }>(
      "select pg_get_functiondef('private.erase_account_owner_payload(uuid,text)'::regprocedure) definition",
    );
    const actualDelete = definition.rows[0]?.definition.match(
      /delete from private\.outbox_events[\s\S]*?;/i,
    )?.[0];
    if (!actualDelete) throw new Error('ERASURE_OUTBOX_STATEMENT_REQUIRED');
    const plan = await client.query<{
      'QUERY PLAN': { Plan: Record<string, unknown> }[];
    }>(
      `explain (format json) ${actualDelete.replace(/\bp_request\b/g, '$1').replace(/\bp_owner\b/g, '$2')}`,
      [request, owner],
    );
    const nodes: Record<string, unknown>[] = [];
    const visit = (node: Record<string, unknown>) => {
      nodes.push(node);
      for (const child of (node.Plans ?? []) as Record<string, unknown>[]) visit(child);
    };
    const root = plan.rows[0]?.['QUERY PLAN'][0]?.Plan;
    if (!root) throw new Error('ERASURE_OUTBOX_PLAN_REQUIRED');
    visit(root);
    expect(
      nodes.filter(
        (node) => node['Relation Name'] === 'outbox_events' && node['Node Type'] === 'Seq Scan',
      ),
    ).toEqual([]);
    expect(nodes.some((node) => node['Index Name'] === 'outbox_events_erasure_resource_idx')).toBe(
      true,
    );

    await client.query('set local role masarifi_worker');
    await client.query('select * from private.lock_account_erasure_objects($1,$2)', [
      request,
      owner,
    ]);
    await client.query("set local statement_timeout='1500ms'");
    await client.query('select private.erase_account_owner_payload($1,$2)', [request, owner]);
    await client.query('set constraints all immediate');
    await client.query('reset statement_timeout');
    await client.query('reset role');
    const remaining = await client.query(
      `select
       count(*) filter(where aggregate_id=$1)::int foreign_events,
       count(*) filter(where aggregate_id=$2 and event_type='privacy.deletion_requested')::int evidence,
       count(*) filter(where aggregate_id=$2 and aggregate_type='unrelated')::int unrelated,
       count(*) filter(where aggregate_id=$2 and event_type='voice.snapshot')::int owned_resources,
       count(*) filter(where aggregate_id=$4)::int owned_sync,
       count(*) filter(where event_type='system.owner' and (payload->>'userId'=$3 or payload->>'profileId'=$3))::int owned_payload
       from private.outbox_events where aggregate_id in ($1,$2,$4) or event_type='system.owner'`,
      [foreignAggregate, resource, owner, transaction],
    );
    expect(remaining.rows[0]).toEqual({
      foreign_events: 500000,
      evidence: 1,
      unrelated: 1,
      owned_resources: 0,
      owned_sync: 0,
      owned_payload: 0,
    });
  }, 120000);

  it('rejects a conflicting prebuilt index instead of trusting IF NOT EXISTS', async () => {
    await client.query('begin');
    await client.query('set local role masarifi_migration');
    await client.query('drop index private.outbox_events_erasure_user_idx');
    await client.query(
      "create index outbox_events_erasure_user_idx on private.outbox_events ((payload->>'profileId')) where payload?'userId'",
    );
    await client.query('reset role');
    const migration = readFileSync(
      resolve(
        __dirname,
        '../../../../../supabase/migrations/20261016201500_owner_outbox_erasure_lookup.sql',
      ),
      'utf8',
    );
    await expect(client.query(migration)).rejects.toMatchObject({
      code: '55000',
      message: 'ERASURE_OUTBOX_INDEX_DEFINITION_REQUIRED',
    });
  });
});
