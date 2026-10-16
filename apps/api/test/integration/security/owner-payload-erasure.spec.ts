import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

const databaseUrl = process.env.MASARIFI_DELETION_LOCAL_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite('request-bound owner payload erasure on the owned local fixture', () => {
  let client: Client;
  const owner = `erase_${randomUUID()}`;
  const other = `preserve_${randomUUID()}`;
  const request = randomUUID();
  const account = randomUUID();
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
  beforeEach(async () => {
    await client.query('begin');
    await client.query('set local role masarifi_migration');
    await client.query('insert into public.profiles(id) values($1),($2)', [owner, other]);
    await client.query(
      "insert into private.account_deletion_requests(id,user_id,status,verified_at,cooling_off_ends_at) values($1,$2,'processing',clock_timestamp(),clock_timestamp())",
      [request, owner],
    );
    await client.query("select set_config('masarifi.ledger_command','on',true)");
    await client.query(
      "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Owned cash','cash','SAR')",
      [account, owner],
    );
    await client.query(
      "insert into public.transactions(id,user_id,kind,amount_minor,currency_code,title,occurred_at) values($1,$2,'expense',100,'SAR','Private expense',clock_timestamp())",
      [transaction, owner],
    );
    await client.query(
      "insert into public.transaction_postings(transaction_id,account_id,amount_minor,posting_role,occurred_at) values($1,$2,-100,'source',clock_timestamp())",
      [transaction, account],
    );
    await client.query(
      "insert into audit.transaction_revisions(transaction_id,revision_no,actor_id,reason,before_snapshot,after_snapshot) values($1,1,$2,'Private correction','{}','{}')",
      [transaction, owner],
    );
    await client.query(
      'insert into public.account_balances(account_id,confirmed_minor) values($1,-100)',
      [account],
    );
    await client.query('insert into public.user_preferences(user_id) values($1),($2)', [
      owner,
      other,
    ]);
    await client.query('insert into public.onboarding_progress(user_id) values($1),($2)', [
      owner,
      other,
    ]);
    await client.query('reset role');
  });
  afterEach(async () => {
    await client.query('rollback');
  });

  it('erases financial history and identity payload idempotently without touching another owner', async () => {
    await client.query('set local role masarifi_worker');
    await client.query('select private.freeze_account_deletion_owner($1,$2)', [request, owner]);
    await client.query('select private.prepare_account_owner_erasure($1,$2)', [request, owner]);
    await client.query('select * from private.lock_account_erasure_objects($1,$2)', [
      request,
      owner,
    ]);
    const result = await client.query<{ removed: number }>(
      'select private.erase_account_owner_payload($1,$2) removed',
      [request, owner],
    );
    expect(result.rows[0]?.removed).toBeGreaterThan(0);
    await client.query('select * from private.lock_account_erasure_objects($1,$2)', [
      request,
      owner,
    ]);
    await client.query('select private.erase_account_owner_payload($1,$2)', [request, owner]);
    await client.query('reset role');
    const rows = await client.query(
      `select
      (select count(*)::int from public.transactions where user_id=$1) transactions,
      (select count(*)::int from public.accounts where user_id=$1) accounts,
      (select count(*)::int from public.user_preferences where user_id=$1) preferences,
      (select count(*)::int from public.user_preferences where user_id=$2) other_preferences,
      (select count(*)::int from private.account_erasure_context) context,
      (select status from public.profiles where id=$1) status`,
      [owner, other],
    );
    expect(rows.rows[0]).toEqual({
      transactions: 0,
      accounts: 0,
      preferences: 0,
      other_preferences: 1,
      context: 0,
      status: 'deletion_pending',
    });
  });

  it('rejects another owner and worker-forged custom settings without weakening normal history immutability', async () => {
    await client.query('set local role masarifi_worker');
    await client.query('savepoint denied');
    await expect(
      client.query('select private.freeze_account_deletion_owner($1,$2)', [request, other]),
    ).rejects.toMatchObject({ code: '42501' });
    await client.query('rollback to denied');
    await client.query(
      "select set_config('masarifi.account_erasure','on',true),set_config('masarifi.erasure_owner',$1,true)",
      [owner],
    );
    await client.query('savepoint forged');
    await expect(
      client.query(
        'insert into private.account_erasure_context(transaction_id,request_id,user_id) values(txid_current(),$1,$2)',
        [request, owner],
      ),
    ).rejects.toMatchObject({ code: '42501' });
    await client.query('rollback to forged');
    await client.query('set local role masarifi_migration');
    await client.query('savepoint immutable');
    await expect(
      client.query('delete from public.transaction_postings where transaction_id=$1', [
        transaction,
      ]),
    ).rejects.toMatchObject({ code: '42501' });
    await client.query('rollback to immutable');
  });

  it('requires object enumeration in the same transaction and a frozen processing owner', async () => {
    await client.query('set local role masarifi_worker');
    await client.query('savepoint active');
    await expect(
      client.query('select private.erase_account_owner_payload($1,$2)', [request, owner]),
    ).rejects.toMatchObject({ code: '42501' });
    await client.query('rollback to active');
    await client.query('select private.freeze_account_deletion_owner($1,$2)', [request, owner]);
    await client.query('savepoint unlocked');
    await expect(
      client.query('select private.erase_account_owner_payload($1,$2)', [request, owner]),
    ).rejects.toMatchObject({ code: '42501' });
    await client.query('rollback to unlocked');
  });

  it('removes replacement-linked planning history and owner categories while preserving system categories', async () => {
    await client.query('set local role masarifi_migration');
    const ids = Array.from({ length: 9 }, () => randomUUID());
    const [category, child, salary, receipt, obligation, schedule, payment, goal, movement] = ids;
    await client.query(
      "insert into public.categories(id,user_id,kind,label_ar,label_en) values($1,$3,'expense','فئة خاصة','Private category'),($2,$3,'expense','فئة فرعية','Child category')",
      [category, child, owner],
    );
    await client.query('update public.categories set parent_id=$1 where id=$2', [category, child]);
    const systemCategories = (
      await client.query<{ n: number }>(
        'select count(*)::int n from public.categories where user_id is null',
      )
    ).rows[0]?.n;
    await client.query(
      "insert into public.salary_profiles(id,user_id,name,amount_minor,currency_code,frequency,expected_day,account_id) values($1,$2,'Salary',1000,'SAR','monthly',1,$3)",
      [salary, owner, account],
    );
    await client.query(
      'insert into public.salary_receipts(id,user_id,salary_profile_id,expected_at,amount_minor) values($1,$2,$3,clock_timestamp(),1000)',
      [receipt, owner, salary],
    );
    await client.query(
      "insert into public.salary_receipts(user_id,salary_profile_id,expected_at,amount_minor,replaces_receipt_id) values($1,$2,clock_timestamp()+interval '1 day',1000,$3)",
      [owner, salary, receipt],
    );
    await client.query(
      "insert into public.obligations(id,user_id,name,type,schedule_kind,currency_code,frequency,start_date,default_account_id) values($1,$2,'Private debt','other','irregular','SAR','irregular',current_date,$3)",
      [obligation, owner, account],
    );
    await client.query(
      'insert into public.obligation_schedule_items(id,user_id,obligation_id,due_at,amount_minor,sequence_no) values($1,$2,$3,clock_timestamp(),100,1)',
      [schedule, owner, obligation],
    );
    await client.query(
      "insert into public.obligation_payments(id,user_id,obligation_id,transaction_id,paid_at,amount_minor,payment_case,allocation_intent) values($1,$2,$3,$4,clock_timestamp(),100,'full','current')",
      [payment, owner, obligation, transaction],
    );
    await client.query(
      'insert into public.obligation_payment_allocations(user_id,payment_id,schedule_item_id,amount_minor) values($1,$2,$3,100)',
      [owner, payment, schedule],
    );
    await client.query(
      "insert into public.savings_goals(id,user_id,name,currency_code,target_minor,linked_account_id) values($1,$2,'Private goal','SAR',1000,$3)",
      [goal, owner, account],
    );
    await client.query(
      "insert into public.savings_goal_movements(id,user_id,goal_id,transaction_id,amount_minor,occurred_at,kind) values($1,$2,$3,$4,100,clock_timestamp(),'contribution')",
      [movement, owner, goal, transaction],
    );
    await client.query(
      "insert into public.savings_goal_movements(user_id,goal_id,transaction_id,amount_minor,occurred_at,kind,replaces_movement_id) values($1,$2,$3,-100,clock_timestamp(),'reversal',$4)",
      [owner, goal, transaction, movement],
    );
    await client.query('set local role masarifi_worker');
    await client.query('select private.freeze_account_deletion_owner($1,$2)', [request, owner]);
    await client.query('select private.prepare_account_owner_erasure($1,$2)', [request, owner]);
    await client.query('select * from private.lock_account_erasure_objects($1,$2)', [
      request,
      owner,
    ]);
    await client.query('select private.erase_account_owner_payload($1,$2)', [request, owner]);
    await client.query('reset role');
    expect(
      (
        await client.query<{ n: number }>(
          'select count(*)::int n from public.categories where user_id is null',
        )
      ).rows[0]?.n,
    ).toBe(systemCategories);
    expect(
      (
        await client.query<{ n: number }>(
          'select count(*)::int n from public.savings_goal_movements where user_id=$1',
          [owner],
        )
      ).rows[0]?.n,
    ).toBe(0);
    expect(
      (
        await client.query<{ n: number }>(
          'select count(*)::int n from public.categories where user_id=$1',
          [owner],
        )
      ).rows[0]?.n,
    ).toBe(0);
  });

  it('fixes populated immutable tracking feedback without allowing normal deletion', async () => {
    await client.query('set local role masarifi_migration');
    const history = randomUUID();
    await client.query(
      "insert into public.tracking_history(id,user_id,source_type,source_ref,outcome,transaction_id) values($1,$2,'manual','Private sender','feedback',$3)",
      [history, owner, transaction],
    );
    await client.query(
      "insert into public.tracking_feedback(user_id,history_id,feedback_type,comment) values($1,$2,'other','Private feedback')",
      [owner, history],
    );
    await client.query('savepoint normal_feedback');
    await expect(
      client.query('delete from public.tracking_feedback where user_id=$1', [owner]),
    ).rejects.toMatchObject({ code: '42501' });
    await client.query('rollback to normal_feedback');
    await client.query('set local role masarifi_worker');
    await client.query('select private.freeze_account_deletion_owner($1,$2)', [request, owner]);
    await client.query('select private.prepare_account_owner_erasure($1,$2)', [request, owner]);
    await client.query('select private.delete_tracking_data($1)', [owner]);
    await client.query('select * from private.lock_account_erasure_objects($1,$2)', [
      request,
      owner,
    ]);
    await client.query('select private.erase_account_owner_payload($1,$2)', [request, owner]);
  });

  it('blocks late background writes after freezing instead of resurrecting owner payload', async () => {
    await client.query('set local role masarifi_worker');
    await client.query('select private.freeze_account_deletion_owner($1,$2)', [request, owner]);
    await client.query('savepoint late_write');
    await expect(
      client.query(
        "insert into public.financial_insights(user_id,signal_key,kind,payload,source_version,expires_at) values($1,'budget:late','budget_threshold','{}',1,clock_timestamp()+interval '1 day')",
        [owner],
      ),
    ).rejects.toMatchObject({ code: '42501', message: 'PROFILE_INACTIVE' });
    await client.query('rollback to late_write');
  });

  it('blocks a resource hold before any owner history is removed', async () => {
    await client.query('set local role masarifi_migration');
    await client.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
      other,
    ]);
    await client.query(
      "insert into private.retention_policies(resource_type,retention_days,deletion_mode,legal_basis) values('erasure-test',0,'delete','Synthetic local test fixture') on conflict(resource_type) do nothing",
    );
    await client.query(
      "insert into private.retention_holds(resource_type,resource_id,reason,created_by) values('erasure-test',$1,'Synthetic explicit hold',$2)",
      [transaction, other],
    );
    await client.query('set local role masarifi_worker');
    await client.query('select private.freeze_account_deletion_owner($1,$2)', [request, owner]);
    await client.query('savepoint held');
    await expect(
      client.query('select private.prepare_account_owner_erasure($1,$2)', [request, owner]),
    ).rejects.toMatchObject({ message: 'ERASURE_ACTIVE_HOLD' });
    await client.query('rollback to held');
    await client.query('reset role');
    expect(
      (
        await client.query<{ n: number }>(
          'select count(*)::int n from public.transaction_postings where transaction_id=$1',
          [transaction],
        )
      ).rows[0]?.n,
    ).toBe(1);
  });

  it('refuses cross-owner financial dependencies without deleting the other owner', async () => {
    await client.query('set local role masarifi_migration');
    const foreignAccount = randomUUID();
    await client.query(
      "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Other cash','cash','SAR')",
      [foreignAccount, other],
    );
    await client.query(
      "insert into public.transaction_postings(transaction_id,account_id,amount_minor,posting_role,occurred_at) values($1,$2,100,'destination',clock_timestamp())",
      [transaction, foreignAccount],
    );
    await client.query('set local role masarifi_worker');
    await client.query('select private.freeze_account_deletion_owner($1,$2)', [request, owner]);
    await client.query('select private.prepare_account_owner_erasure($1,$2)', [request, owner]);
    await client.query('select * from private.lock_account_erasure_objects($1,$2)', [
      request,
      owner,
    ]);
    await client.query('savepoint foreign_owner');
    await expect(
      client.query('select private.erase_account_owner_payload($1,$2)', [request, owner]),
    ).rejects.toMatchObject({ code: '42501' });
    await client.query('rollback to foreign_owner');
    await client.query('reset role');
    expect(
      (
        await client.query<{ user_id: string }>('select user_id from public.accounts where id=$1', [
          foreignAccount,
        ])
      ).rows[0]?.user_id,
    ).toBe(other);
    expect(
      (
        await client.query<{ n: number }>(
          'select count(*)::int n from public.transaction_postings where transaction_id=$1',
          [transaction],
        )
      ).rows[0]?.n,
    ).toBe(2);
  });

  it('fences an in-flight report worker and enumerates both actual and partial export object keys', async () => {
    const reportId = randomUUID();
    const exportId = randomUUID();
    await client.query('set local role masarifi_migration');
    await client.query(
      "insert into private.report_output_attempts(id,user_id,report_type,period_start,period_end,ledger_version,snapshot,expires_at) values($1,$2,'financial_summary',current_date,current_date,1,'{\"format\":\"pdf\"}',clock_timestamp()+interval '1 day')",
      [reportId, owner],
    );
    await client.query(
      "insert into private.privacy_export_requests(id,user_id,status) values($1,$2,'verified')",
      [exportId, owner],
    );
    const reportWorker = new Client({ connectionString: databaseUrl });
    await reportWorker.connect();
    try {
      await reportWorker.query('select pg_advisory_lock(hashtextextended($1,0))', [reportId]);
      await client.query('set local role masarifi_worker');
      await client.query('select private.freeze_account_deletion_owner($1,$2)', [request, owner]);
      await client.query('savepoint busy_report');
      await expect(
        client.query('select * from private.lock_account_erasure_objects($1,$2)', [request, owner]),
      ).rejects.toMatchObject({ message: 'ERASURE_WORK_BUSY' });
      await client.query('rollback to busy_report');
      await reportWorker.query('select pg_advisory_unlock(hashtextextended($1,0))', [reportId]);
      const refs = await client.query('select * from private.lock_account_erasure_objects($1,$2)', [
        request,
        owner,
      ]);
      expect(refs.rows).toEqual(
        expect.arrayContaining([
          {
            kind: 'report',
            storage_ref: expect.stringMatching(
              new RegExp(`^reports/[a-f0-9]{64}/${reportId}\\.pdf$`),
            ) as unknown,
          },
          { kind: 'export', storage_ref: `exports/${exportId}/privacy.zip` },
        ]),
      );
      await client.query('select private.erase_account_owner_payload($1,$2)', [request, owner]);
    } finally {
      await reportWorker.end();
    }
  });

  it('keeps a fresh export upload retryable and leaves its database reference intact', async () => {
    await client.query('set local role masarifi_migration');
    await client.query(
      "insert into private.privacy_export_requests(user_id,status) values($1,'processing')",
      [owner],
    );
    await client.query('set local role masarifi_worker');
    await client.query('select private.freeze_account_deletion_owner($1,$2)', [request, owner]);
    await client.query('savepoint busy_export');
    await expect(
      client.query('select * from private.lock_account_erasure_objects($1,$2)', [request, owner]),
    ).rejects.toMatchObject({ message: 'ERASURE_EXPORT_BUSY' });
    await client.query('rollback to busy_export');
    await client.query('reset role');
    expect(
      (
        await client.query<{ status: string }>(
          'select status from private.privacy_export_requests where user_id=$1',
          [owner],
        )
      ).rows[0]?.status,
    ).toBe('processing');
  });

  it('removes Voice provider and AI owner links while retaining only an outstanding media purge fence', async () => {
    const session = randomUUID();
    const operation = randomUUID();
    const epoch = randomUUID();
    await client.query('set local role masarifi_migration');
    await client.query(
      `insert into public.voice_sessions(id,user_id,locale,storage_ref,content_type,size_bytes,duration_ms,expires_at,operation_id)
       values($1,$2,'en',$3,'audio/wav',44,1000,clock_timestamp()+interval '1 hour',$4)`,
      [session, owner, `voice/${session}/${randomUUID()}`, operation],
    );
    await client.query(
      "insert into private.voice_provider_attempts(operation_id,attempt_no,session_id,model,provider,reserved_cost,max_input_tokens,max_output_tokens) values($1,1,$2,'test/model','test-provider',0,100,100)",
      [operation, session],
    );
    await client.query(
      "insert into private.ai_usage_events(user_id,workload,model,provider,request_id) values($1,'voice_transcription','test/model','test-provider',$2)",
      [owner, operation],
    );
    await client.query(
      "insert into private.ai_failure_events(user_id,workload,failure_code,request_id) values($1,'voice_transcription','TEST_FAILURE',$2)",
      [owner, operation],
    );
    await client.query(
      "insert into private.staging_voice_epochs(id,manifest,manifest_hash,mode) values($1,'{}',repeat('a',64),'operating')",
      [epoch],
    );
    await client.query(
      "insert into private.staging_voice_members(session_id,epoch_id,user_id,locale,capture_at,content_hash,command_evidence) values($1,$2,$3,'en',clock_timestamp(),repeat('b',64),'{\"privateText\":\"fixture\"}')",
      [session, epoch, owner],
    );
    await client.query('set local role masarifi_worker');
    await client.query('select private.freeze_account_deletion_owner($1,$2)', [request, owner]);
    await client.query('select private.prepare_account_owner_erasure($1,$2)', [request, owner]);
    await client.query('select private.delete_ai_owner_data($1,500)', [owner]);
    await client.query('select * from private.lock_account_erasure_objects($1,$2)', [
      request,
      owner,
    ]);
    await client.query('select private.erase_account_owner_payload($1,$2)', [request, owner]);
    await client.query('reset role');
    expect(
      (
        await client.query<{ n: number }>(
          'select count(*)::int n from private.voice_provider_attempts where session_id=$1',
          [session],
        )
      ).rows[0]?.n,
    ).toBe(0);
    expect(
      (
        await client.query<{ n: number }>(
          'select count(*)::int n from private.ai_usage_events where request_id=$1',
          [operation],
        )
      ).rows[0]?.n,
    ).toBe(0);
    expect(
      (
        await client.query<{ n: number }>(
          'select count(*)::int n from private.ai_failure_events where request_id=$1',
          [operation],
        )
      ).rows[0]?.n,
    ).toBe(0);
    expect(
      (
        await client.query(
          'select command_evidence from private.staging_voice_members where session_id=$1',
          [session],
        )
      ).rows,
    ).toEqual([{ command_evidence: null }]);
    expect(
      (
        await client.query<{ n: number }>(
          'select count(*)::int n from private.voice_media_tombstones where id=$1',
          [session],
        )
      ).rows[0]?.n,
    ).toBe(1);
  });

  it('holds the active-profile read lock until the command transaction releases it', async () => {
    const lockedOwner = `lock_${randomUUID()}`;
    const deletionWorker = new Client({ connectionString: databaseUrl });
    await deletionWorker.connect();
    try {
      await deletionWorker.query('insert into public.profiles(id) values($1)', [lockedOwner]);
      await client.query('savepoint running_command');
      await client.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ sub: lockedOwner }),
      ]);
      await client.query('set local role masarifi_api');
      await client.query('select private.assert_active_profile($1)', [lockedOwner]);
      await deletionWorker.query('begin');
      await deletionWorker.query("set local lock_timeout='100ms'");
      await expect(
        deletionWorker.query('select id from public.profiles where id=$1 for update', [
          lockedOwner,
        ]),
      ).rejects.toMatchObject({ code: '55P03' });
      await deletionWorker.query('rollback');
      await client.query('rollback to running_command');
      await deletionWorker.query('begin');
      await deletionWorker.query("set local lock_timeout='100ms'");
      expect(
        (
          await deletionWorker.query('select id from public.profiles where id=$1 for update', [
            lockedOwner,
          ])
        ).rowCount,
      ).toBe(1);
      await deletionWorker.query('rollback');
    } finally {
      await deletionWorker.query('rollback');
      await deletionWorker.query('delete from public.profiles where id=$1', [lockedOwner]);
      await deletionWorker.end();
    }
  });

  it('cleans the privileged context even when a worker does not call erase after object enumeration', async () => {
    await client.query('set local role masarifi_worker');
    await client.query('select private.freeze_account_deletion_owner($1,$2)', [request, owner]);
    await client.query('select * from private.lock_account_erasure_objects($1,$2)', [
      request,
      owner,
    ]);
    await client.query('set constraints private.account_erasure_context_transaction_end immediate');
    await client.query('reset role');
    expect(
      (
        await client.query<{ n: number }>(
          'select count(*)::int n from private.account_erasure_context where transaction_id=txid_current()',
        )
      ).rows[0]?.n,
    ).toBe(0);
  });

  it('retains only scoped Support upload instructions until capability expiry, with owner-bound leases', async () => {
    const ticket = randomUUID();
    const attachment = randomUUID();
    const key = `support/${ticket}/${attachment}`;
    await client.query('set local role masarifi_migration');
    const category = (
      await client.query<{ id: string }>(
        "insert into public.support_categories(key,name) values('erasure_fixture','Erasure fixture') on conflict(key) do update set name=excluded.name returning id",
      )
    ).rows[0]?.id;
    await client.query(
      "insert into public.support_tickets(id,user_id,category_id,subject) values($1,$2,$3,'Private support subject')",
      [ticket, owner, category],
    );
    await client.query(
      "insert into private.support_attachments(id,ticket_id,storage_ref,filename_safe,content_type,size_bytes,sha256) values($1,$2,$3,'private.txt','text/plain',3,repeat('d',64))",
      [attachment, ticket, key],
    );
    await client.query('set local role masarifi_worker');
    await client.query('select set_config(\'request.jwt.claims\',\'{"role":"worker"}\',true)');
    await client.query('select private.freeze_account_deletion_owner($1,$2)', [request, owner]);
    await client.query('select private.prepare_account_owner_erasure($1,$2)', [request, owner]);
    await client.query('select private.delete_engagement_owner_data($1,500)', [owner]);
    const objects = await client.query(
      'select * from private.lock_account_erasure_objects($1,$2)',
      [request, owner],
    );
    expect(objects.rows).toContainEqual({ kind: 'support', storage_ref: key });
    await client.query('select private.erase_account_owner_payload($1,$2)', [request, owner]);
    expect(
      (
        await client.query<{ id: string; storage_ref: string; lease_token: string }>(
          'select * from private.claim_account_upload_erasure($1,16)',
          [other],
        )
      ).rows,
    ).toHaveLength(0);
    const claim = (
      await client.query<{ id: string; storage_ref: string; lease_token: string }>(
        'select * from private.claim_account_upload_erasure($1,16)',
        [owner],
      )
    ).rows[0];
    if (!claim) throw new Error('UPLOAD_CLAIM_MISSING');
    expect(claim.storage_ref).toBe(key);
    expect(
      (
        await client.query<{ id: string; storage_ref: string; lease_token: string }>(
          'select * from private.claim_account_upload_erasure($1,16)',
          [owner],
        )
      ).rows,
    ).toHaveLength(0);
    await client.query('savepoint wrong_upload_owner');
    await expect(
      client.query<{ finished: boolean }>(
        'select private.complete_account_upload_erasure($1,$2,$3)',
        [other, claim.id, claim.lease_token],
      ),
    ).rejects.toMatchObject({ message: 'ERASURE_PURGE_LEASE_INVALID' });
    await client.query('rollback to wrong_upload_owner');
    expect(
      (
        await client.query<{ finished: boolean }>(
          'select private.complete_account_upload_erasure($1,$2,$3) finished',
          [owner, claim.id, claim.lease_token],
        )
      ).rows[0]?.finished,
    ).toBe(false);
    await client.query('set local role masarifi_migration');
    expect(
      (
        await client.query<{ n: number }>(
          'select count(*)::int n from public.support_tickets where user_id=$1',
          [owner],
        )
      ).rows[0]?.n,
    ).toBe(0);
    await client.query(
      "update private.account_upload_erasure_tombstones set capability_expires_at=clock_timestamp()-interval '1 second',next_attempt_at=clock_timestamp() where user_id=$1",
      [owner],
    );
    await client.query('set local role masarifi_worker');
    const finalClaim = (
      await client.query<{ id: string; storage_ref: string; lease_token: string }>(
        'select * from private.claim_account_upload_erasure($1,16)',
        [owner],
      )
    ).rows[0];
    if (!finalClaim) throw new Error('FINAL_UPLOAD_CLAIM_MISSING');
    expect(
      (
        await client.query<{ finished: boolean }>(
          'select private.complete_account_upload_erasure($1,$2,$3) finished',
          [owner, finalClaim.id, finalClaim.lease_token],
        )
      ).rows[0]?.finished,
    ).toBe(true);
    await client.query('reset role');
    expect(
      (
        await client.query<{ n: number }>(
          'select count(*)::int n from private.account_upload_erasure_tombstones where user_id=$1',
          [owner],
        )
      ).rows[0]?.n,
    ).toBe(0);
  });

  it('redacts stale identity-provider payloads after freezing while preserving active owner webhooks', async () => {
    await client.query('set local role masarifi_worker');
    await client.query('select private.freeze_account_deletion_owner($1,$2)', [request, owner]);
    await client.query('set local role masarifi_migration');
    const deletedReceipt = await client.query<{ payload: unknown }>(
      `insert into private.clerk_webhook_events(clerk_event_id,event_type,signature_verified_at,payload_hash,payload)
       values($1,'user.updated',clock_timestamp(),repeat('e',64),jsonb_build_object('data',jsonb_build_object('id',$2::text,'email','private@example.test','first_name','Private'))) returning payload`,
      [randomUUID(), owner],
    );
    expect(deletedReceipt.rows[0]?.payload).toEqual({ data: { id: owner } });
    const activeReceipt = await client.query<{ payload: unknown }>(
      `insert into private.clerk_webhook_events(clerk_event_id,event_type,signature_verified_at,payload_hash,payload)
       values($1,'user.updated',clock_timestamp(),repeat('f',64),jsonb_build_object('data',jsonb_build_object('id',$2::text,'first_name','Other'))) returning payload`,
      [randomUUID(), other],
    );
    expect(activeReceipt.rows[0]?.payload).toEqual({ data: { id: other, first_name: 'Other' } });
  });

  it('conserves charged AI budgets as anonymous monthly aggregates without original identifiers', async () => {
    await client.query('set local role masarifi_migration');
    const originals: string[] = [];
    const requests: string[] = [];
    const sourceHashes: string[] = [];
    for (const [status, cost, workload] of [
      ['completed', '1.25', 'voice_transcription'],
      ['completed', '2.75', 'voice_transcription'],
      ['reserved', '3.50', 'voice_transcription'],
      ['failed', '2.00', 'financial_assistant'],
      ['released', '9.00', 'voice_transcription'],
    ]) {
      const id = randomUUID();
      const requestId = randomUUID();
      const hash = id.replaceAll('-', '').repeat(2);
      originals.push(id);
      requests.push(requestId);
      sourceHashes.push(hash);
      await client.query(
        `insert into private.ai_usage_events(id,user_id,workload,model,provider,request_id,estimated_cost,reservation_status,provider_generation_hash,input_tokens,output_tokens,latency_ms,fallback_used)
         values($1,$2,$3,'fixture/budget-model','fixture-budget-provider',$4,$5,$6,$7,35,12,123,true)`,
        [id, owner, workload, requestId, cost, status, hash],
      );
    }
    const foreignId = randomUUID();
    await client.query(
      `insert into private.ai_usage_events(id,user_id,workload,model,provider,request_id,estimated_cost,reservation_status,provider_generation_hash)
       values($1,$2,'voice_transcription','fixture/budget-model','fixture-budget-provider',$3,7,'completed',repeat('a',64))`,
      [foreignId, other, randomUUID()],
    );
    const foreignBefore = (
      await client.query<{ value: unknown }>(
        'select to_jsonb(u) value from private.ai_usage_events u where id=$1',
        [foreignId],
      )
    ).rows[0]?.value;
    const budgetQuery = `select coalesce(jsonb_agg(to_jsonb(t) order by budget_period,workload),'[]') totals from (
      select budget_period,workload,sum(estimated_cost)::text cost from private.ai_usage_events
      where model='fixture/budget-model' and provider='fixture-budget-provider'
        and reservation_status in ('reserved','completed','failed') group by budget_period,workload) t`;
    const budgetBefore = (await client.query<{ totals: unknown }>(budgetQuery)).rows[0]?.totals;
    await client.query('set local role masarifi_worker');
    await client.query('select private.freeze_account_deletion_owner($1,$2)', [request, owner]);
    await client.query('select private.prepare_account_owner_erasure($1,$2)', [request, owner]);
    // Replay must not duplicate the conserved cost.
    await client.query('select private.prepare_account_owner_erasure($1,$2)', [request, owner]);
    await client.query('select private.rollup_ai_usage(1000)');
    await client.query('reset role');
    expect((await client.query<{ totals: unknown }>(budgetQuery)).rows[0]?.totals).toEqual(
      budgetBefore,
    );
    expect(
      (
        await client.query<{ value: unknown }>(
          'select to_jsonb(u) value from private.ai_usage_events u where id=$1',
          [foreignId],
        )
      ).rows[0]?.value,
    ).toEqual(foreignBefore);
    expect(
      (
        await client.query<{ n: number }>(
          `select count(*)::int n from private.ai_usage_events where id=any($1::uuid[]) or request_id=any($2::text[]) or provider_generation_hash=any($3::text[])`,
          [originals, requests, sourceHashes],
        )
      ).rows[0]?.n,
    ).toBe(0);
    const anonymous = await client.query<{
      count: number;
      coarse: boolean;
      telemetry_cleared: boolean;
      identifiers_fresh: boolean;
      reserved: number;
    }>(
      `
      select count(*)::int count,bool_and(created_at=(budget_period::timestamp at time zone 'UTC')) coarse,
        bool_and(input_tokens=0 and output_tokens=0 and latency_ms=0 and fallback_used=false and provider_generation_hash is null) telemetry_cleared,
        bool_and(request_id ~ '^[0-9a-f-]{36}$' and id<>all($1::uuid[]) and request_id<>all($2::text[])) identifiers_fresh,
        count(*) filter(where reservation_status='reserved')::int reserved
      from private.ai_usage_events where user_id is null and model='fixture/budget-model' and provider='fixture-budget-provider'`,
      [originals, requests],
    );
    expect(anonymous.rows[0]).toEqual({
      count: 4,
      coarse: true,
      telemetry_cleared: true,
      identifiers_fresh: true,
      reserved: 0,
    });
  });
});
