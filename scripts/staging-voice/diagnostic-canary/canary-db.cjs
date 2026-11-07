"use strict";
// Pinned stdin-only control helper. No credential is logged or written here.
const assert = require('node:assert/strict');
const {Client} = require('pg');
let input = '';
process.stdin.on('data', chunk => { input += chunk; if (input.length > 262144) throw Error('CONTROL_TOO_LARGE'); });
process.stdin.on('end', async () => {
  const enteredAt=Date.now();
  for(let attempt=1;attempt<=3;attempt++){
  let db;
  let c;
  try {
    c = JSON.parse(input);const s = c.scope;
    const actions = ['baseline','readiness','prepare','reconcile','activate','status','close','verify'];
    assert(actions.includes(c.action));
    assert.equal(process.env.SUPABASE_URL,'https://qcffvfbpzvpwcwxwjyro.supabase.co');
    const url = new URL(c.url);
    assert(url.hostname.endsWith('.supabase.com') && decodeURIComponent(url.username).endsWith('.qcffvfbpzvpwcwxwjyro'));
    assert.equal(s.project,'qcffvfbpzvpwcwxwjyro');
    assert.equal(s.ownerId,'user_3K2ItVcURds22ueEf31Py6e305q');
    assert.equal(s.accountId,'3161601e-1584-40b0-86ec-d170c018b551');
    assert.equal(s.categoryId,'04000000-0000-4000-8000-000000000006');
    const writes = ['prepare','activate','close'].includes(c.action);
    db = new Client({connectionString:c.url,connectionTimeoutMillis:5000,query_timeout:15000});
    await db.connect();
    await db.query(writes?'begin isolation level serializable':'begin isolation level repeatable read read only');
    await db.query("set local statement_timeout='15s'");
    const finance = async () => (await db.query(`select jsonb_build_object(
      'accounts',(select count(*) from public.accounts),'transactions',(select count(*) from public.transactions),'postings',(select count(*) from public.transaction_postings),
      'accountsHash',(select encode(extensions.digest(coalesce(string_agg(row_to_json(x)::text,E'\\n' order by x.id),''),'sha256'),'hex') from public.accounts x),
      'transactionsHash',(select encode(extensions.digest(coalesce(string_agg(row_to_json(x)::text,E'\\n' order by x.id),''),'sha256'),'hex') from public.transactions x),
      'postingsHash',(select encode(extensions.digest(coalesce(string_agg(row_to_json(x)::text,E'\\n' order by x.id),''),'sha256'),'hex') from public.transaction_postings x),
      'balancesHash',(select encode(extensions.digest(coalesce(string_agg(row_to_json(x)::text,E'\\n' order by x.account_id),''),'sha256'),'hex') from public.account_balances x),
      'otherBalancesHash',(select encode(extensions.digest(coalesce(string_agg(row_to_json(x)::text,E'\\n' order by x.account_id),''),'sha256'),'hex') from public.account_balances x where x.account_id<>$1::uuid),
      'balanceRow',to_jsonb(b),'confirmedMinor',b.confirmed_minor,'pendingMinor',b.pending_minor,'ledgerVersion',b.ledger_version,
      'ownerLedgerVersion',(select max(z.ledger_version) from public.account_balances z join public.accounts y on y.id=z.account_id where y.user_id=$2)) result
      from public.account_balances b where b.account_id=$1::uuid`,[s.accountId,s.ownerId])).rows[0].result;
    const admission = async () => (await db.query(`select jsonb_build_object(
      'posting',(select enabled from private.voice_automatic_policy),'activeEpochs',(select count(*) from private.staging_voice_epochs where state='active'),
      'analysisJobs',(select count(*) from public.voice_sessions v join private.voice_batch_context x on x.session_id=v.id where x.analysis_only and v.status in ('uploaded','processing')),
      'assistantJobs',(select count(*) from public.assistant_messages where work_status in ('queued','processing')),
      'eligible',exists(select 1 from public.accounts a join public.profiles p on p.id=a.user_id cross join public.categories k cross join public.currencies u where a.id=$1::uuid and a.user_id=$2 and a.is_default and a.currency_code='SAR' and a.status='active' and a.deleted_at is null and p.status='active' and k.id=$3::uuid and k.kind='expense' and k.active and k.deleted_at is null and (k.user_id is null or k.user_id=$2) and u.code='SAR' and u.enabled and not exists(select 1 from public.admin_profiles where user_id=$2)),
      'currentState',(select e.state from private.staging_voice_epochs e join private.staging_voice_runtime_control r on r.current_epoch=e.id),
      'migrationSelfGrant',exists(select 1 from pg_auth_members m join pg_roles r on r.oid=m.roleid where r.rolname='masarifi_migration' and m.member=(select oid from pg_roles where rolname=current_user) and m.grantor=m.member),
      'migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations)) result`,[s.accountId,s.ownerId,s.categoryId])).rows[0].result;
    const quotaAvailability = async () => {
      const value = (await db.query(`with quota_policy as (
        select coalesce(o.rolling_limit,
          (select (value#>>'{}')::integer from private.system_settings where setting_key='ai.voice.rolling_limit'),
          (select (value#>>'{}')::integer from private.system_settings where setting_key='ai.user.rolling_limit'),5) daily_limit,
          coalesce(o.monthly_limit,(select (value#>>'{}')::integer from private.system_settings where setting_key='ai.voice.monthly_limit')) monthly_limit,
          coalesce((select (value#>>'{}')::boolean from private.system_settings where setting_key='ai.voice.enabled'),true) enabled
        from (select 1) singleton left join private.ai_user_quota_overrides o
          on o.user_id=$1 and o.workload='voice_transcription'
      ), owner_usage as (
        select count(*) filter(where created_at>statement_timestamp()-interval '24 hours') used,
          count(*) filter(where created_at>=date_trunc('month',statement_timestamp() at time zone 'UTC') at time zone 'UTC') monthly_used
        from private.ai_usage_events where user_id=$1 and workload='voice_transcription' and reservation_status<>'released'
      ), route as (
        select (limits->>'monthlyBudget')::numeric budget,
          ((limits->>'inputTokens')::numeric*(max_price->>'prompt')::numeric)
          +((limits->>'outputTokens')::numeric*(max_price->>'completion')::numeric) reservation
        from private.ai_feature_routes where workload='voice_transcription' and deleted_at is null
      ), usage as (
        select coalesce(sum(estimated_cost) filter(where workload='voice_transcription'),0) spent,
          coalesce(sum(estimated_cost),0) global_spent from private.ai_usage_events
        where budget_period=date_trunc('month',current_date)::date and reservation_status in ('reserved','completed','failed')
      ) select jsonb_build_object('quota',jsonb_build_object('enabled',enabled,'limit',daily_limit,
          'used',used,'monthlyLimit',monthly_limit,'monthlyUsed',monthly_used),
        'budgetAvailable',exists(select 1 from route cross join usage where budget>0 and reservation>=0
          and spent+reservation<budget and global_spent+reservation<coalesce(
            (select (value#>>'{}')::numeric from private.system_settings where setting_key='ai.global.monthly_budget'),200))) result
        from quota_policy cross join owner_usage`,[s.ownerId])).rows[0].result;
      const q = value.quota;
      assert.equal(q.enabled,true,'VOICE_FEATURE_REQUIRED');
      assert(Number.isSafeInteger(q.limit) && q.limit>=1 && q.limit<=1000,'VALID_VOICE_QUOTA_REQUIRED');
      assert(Number.isSafeInteger(q.used) && q.used>=0 && q.used<q.limit,'AVAILABLE_VOICE_QUOTA_REQUIRED');
      assert(Number.isSafeInteger(q.monthlyUsed) && q.monthlyUsed>=0,'VALID_MONTHLY_USAGE_REQUIRED');
      assert(q.monthlyLimit===null || (Number.isSafeInteger(q.monthlyLimit) && q.monthlyLimit>=1 &&
        q.monthlyLimit<=1000000 && q.monthlyUsed<q.monthlyLimit),'AVAILABLE_MONTHLY_VOICE_QUOTA_REQUIRED');
      assert.equal(value.budgetAvailable,true,'AVAILABLE_VOICE_RESERVATION_BUDGET_REQUIRED');
      return value;
    };
    const off = async () => {
      const a = await admission(); assert.equal(a.posting,false); assert.equal(a.activeEpochs,0);
      assert.equal(a.analysisJobs,0); assert.equal(a.assistantJobs,0); assert.equal(a.eligible,true);
      for(const m of ['20261010221534','20261011002702','20261011004500','20261011004600','20261011005920','20261013053237']) assert(a.migrations.includes(m));
      const metadata = async signature => (await db.query(`select encode(extensions.digest(prosrc,'sha256'),'hex') "bodyHash",
        pg_get_userbyid(proowner) owner,prosecdef definer,proconfig config,proacl::text acl
        from pg_proc where oid=to_regprocedure($1)`,[signature])).rows[0];
      assert.deepEqual(await metadata('private.accept_voice_batch(uuid,uuid,jsonb,text)'),{
        bodyHash:'683de0fd60086962c86b256983b5feadd00f4c300166a82bfc782250de29ebec',owner:'masarifi_migration',
        definer:true,config:['search_path=""'],acl:'{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}'
      },'EXACT_QUALIFIED_ACCEPTANCE_REQUIRED');
      assert.deepEqual(await metadata('private.voice_canary_scope_mismatch_reason(jsonb,integer,jsonb,timestamptz)'),{
        bodyHash:'ce00e1b5da381a8baa4ac95f3e6882bb73dbccf107ff8007577e9c5410c1696b',owner:'masarifi_migration',
        definer:false,config:['search_path=""'],acl:'{masarifi_migration=X/masarifi_migration}'
      },'EXACT_PRIVATE_DIAGNOSTIC_REQUIRED');
      assert.deepEqual(await finance(),s.baseline);
      return quotaAvailability();
    };
    const epoch = async () => {
      const e = (await db.query('select *,manifest=$2::jsonb matches from private.staging_voice_epochs where id=$1::uuid',[c.state.epochId,JSON.stringify(c.state.packet)])).rows[0];
      assert(e && e.matches && e.manifest_hash===c.state.manifestHash);
      return e;
    };
    if(writes){
      const existing=(await db.query("select exists(select 1 from pg_auth_members m join pg_roles r on r.oid=m.roleid where r.rolname='masarifi_migration' and m.member=(select oid from pg_roles where rolname=current_user) and m.grantor=m.member) present")).rows[0];
      assert.equal(existing.present,false); // Never overwrite or revoke a pre-existing self-granted membership.
    }
    let elevated=false;
    const elevate=async()=>{
      await db.query('grant masarifi_migration to current_user with set true, inherit false');
      await db.query('set local role masarifi_migration');
      elevated=true;
    };
    const reset=async()=>{
      await db.query('reset role');await db.query('revoke masarifi_migration from current_user granted by current_user');elevated=false;
    };
    let result;
    if(c.action==='baseline') result={financial:await finance(),admission:await admission()};
    if(c.action==='readiness'){
      const quota=await off();const a=await admission();assert(a.currentState===null || a.currentState==='closed');
      assert.equal(a.migrationSelfGrant,false);
      result={financial:await finance(),admission:a,diagnosticVerified:true,quotaAvailability:quota};
    }
    if(c.action==='reconcile'){
      const rows=(await db.query('select id,manifest_hash,state from private.staging_voice_epochs where manifest=$1::jsonb',[JSON.stringify(c.state.packet)])).rows;
      assert(rows.length<=1);result=rows.length?{epochId:rows[0].id,manifestHash:rows[0].manifest_hash,state:rows[0].state}:null;
    }
    if(c.action==='prepare'){
      await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[s.ownerId]);
      await off(); const a=await admission(); assert(a.currentState===null || a.currentState==='closed');
      const p=c.state.packet;
      assert.equal(p.version,2); assert.equal(p.mode,'canary'); assert.equal(p.expenseMinor,1000);
      assert.equal(p.maxExpenseMinor,1000); assert.equal(p.maxTransactions,1); assert.equal(p.maxPostings,1);
      assert.equal(p.currency,'SAR'); assert.equal(p.locale,'ar');
      assert.equal(p.ownerId,s.ownerId); assert.equal(p.accountId,s.accountId); assert.equal(p.categoryId,s.categoryId);
      assert.equal(p.clerkSessionHash,s.clerkSessionHash); assert.equal(p.controlHash,c.scopeHash);
      await elevate();
      result=(await db.query('select private.prepare_staging_voice_epoch($1,$2::jsonb) result',[s.project,JSON.stringify(p)])).rows[0].result;
    }
    if(c.action==='activate'){
      await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[s.ownerId]);
      await off();const e=await epoch();assert.equal(e.state,'prepared');
      const now=Date.now();assert(now<c.state.deadline*1000 && now-c.state.startsAt*1000<90000);
      assert(now<s.expiresAt*1000 && now-c.approvalReceivedAt*1000<=3600000 && now>=c.approvalReceivedAt*1000);
      await elevate();
      // Obtain every row lock the capability will need before checking live DB clocks.
      await db.query('select singleton from private.staging_voice_runtime_control where enforced and current_epoch=$1::uuid for update',[e.id]);
      await db.query('select id from private.staging_voice_epochs where id=$1::uuid for update',[e.id]);
      await db.query('select singleton from private.voice_automatic_policy for update');
      const activated=await db.query("select private.activate_staging_voice_epoch($1::uuid,$2,$3::timestamptz) result where clock_timestamp()<to_timestamp($4) and clock_timestamp()<=to_timestamp($5)+interval '1 hour' and clock_timestamp()>=to_timestamp($5) and clock_timestamp()<to_timestamp($6)+interval '90 seconds' and clock_timestamp()<$3::timestamptz",[e.id,e.manifest_hash,new Date(c.state.deadline*1000).toISOString(),s.expiresAt,c.approvalReceivedAt,c.state.startsAt]);
      assert.equal(activated.rows.length,1);result=activated.rows[0].result;
    }
    if(['status','close'].includes(c.action)){
      const e=await epoch();
      if(c.action==='close'){
        await elevate();await db.query("select private.close_staging_voice_epoch($1::uuid,'bounded_canary_closed')",[e.id]);await reset();
      }
      result=(await db.query(`select jsonb_build_object('state',e.state,'posting',(select enabled from private.voice_automatic_policy),'currentEpochMatches',exists(select 1 from private.staging_voice_runtime_control where current_epoch=e.id),'deadline',e.expires_at,'heartbeatAt',e.heartbeat_at,'members',(select count(*) from private.staging_voice_members where epoch_id=e.id),'committed',(select count(*) from private.voice_events v join private.voice_batches b on b.id=v.batch_id join private.staging_voice_members m on m.session_id=b.session_id where m.epoch_id=e.id and v.status='committed')) result from private.staging_voice_epochs e where id=$1::uuid`,[e.id])).rows[0].result;
    }
    if(c.action==='verify'){
      await epoch();
      const ids=(await db.query(`select v.transaction_id id from private.voice_events v join private.voice_batches b on b.id=v.batch_id join private.staging_voice_members m on m.session_id=b.session_id where m.epoch_id=$1::uuid and v.status='committed'`,[c.state.epochId])).rows;
      assert(ids.length<=1);
      if(!ids.length){assert.deepEqual(await finance(),s.baseline);result={committed:0,financialPreserved:true};}
      else{
        const id=ids[0].id, before=s.baseline, after=await finance();
        assert.equal(after.accountsHash,before.accountsHash);assert.equal(after.accounts,before.accounts);
        assert.equal(after.transactions,before.transactions+1);assert.equal(after.postings,before.postings+1);
        assert.equal(after.otherBalancesHash,before.otherBalancesHash);
        assert.equal(after.confirmedMinor,before.confirmedMinor-1000);assert.equal(after.pendingMinor,before.pendingMinor);
        assert.equal(after.ledgerVersion,before.ownerLedgerVersion+1);
        const preserved=(await db.query(`select jsonb_build_object(
          'transactionsHash',(select encode(extensions.digest(coalesce(string_agg(row_to_json(x)::text,E'\\n' order by x.id),''),'sha256'),'hex') from public.transactions x where x.id<>$1::uuid),
          'postingsHash',(select encode(extensions.digest(coalesce(string_agg(row_to_json(x)::text,E'\\n' order by x.id),''),'sha256'),'hex') from public.transaction_postings x where x.transaction_id<>$1::uuid),
          'transactionMatches',exists(select 1 from public.transactions where id=$1::uuid and user_id=$2 and category_id=$4::uuid and kind='expense' and amount_minor=1000 and fee_minor=0 and currency_code='SAR' and status='confirmed' and deleted_at is null),
          'postingMatches',(select count(*)=1 and bool_and(account_id=$3::uuid and amount_minor=-1000 and clearing_state='confirmed') from public.transaction_postings where transaction_id=$1::uuid)) result`,[id,s.ownerId,s.accountId,s.categoryId])).rows[0].result;
        assert.equal(preserved.transactionsHash,before.transactionsHash);assert.equal(preserved.postingsHash,before.postingsHash);
        assert.equal(preserved.transactionMatches,true);assert.equal(preserved.postingMatches,true);
        const immutable = row => {const value={...row}; for(const key of ['confirmed_minor','pending_minor','ledger_version','reconciled_at','updated_at'])delete value[key];return value;};
        assert.deepEqual(immutable(after.balanceRow),immutable(before.balanceRow));
        result={committed:1,transactionId:id,confirmedMinor:after.confirmedMinor,pendingMinor:after.pendingMinor,ledgerVersion:after.ledgerVersion,financialPreserved:true};
      }
    }
    if(elevated)await reset();
    await db.query('commit');console.log(JSON.stringify(result));return;
  } catch(error){
    const rolledBack=db ? await db.query('rollback').then(()=>true,()=>false) : false;
    const now=Date.now(),s=c?.scope,state=c?.state;
    // A PostgreSQL serialization failure aborts the whole transaction. Repeat only
    // after an acknowledged rollback, with every original admission check intact.
    // Never retry transport errors, ambiguous commits, another begin or a capture.
    if(c?.action==='activate' && error.code==='40001' && rolledBack && attempt<3 &&
      now-enteredAt<10000 && now<state?.deadline*1000 && now<state?.startsAt*1000+90000 &&
      now<s?.expiresAt*1000 && now>=c.approvalReceivedAt*1000 && now-c.approvalReceivedAt*1000<=3600000)continue;
    console.error(JSON.stringify({status:'CANARY_DATABASE_FAILED',code:/^[A-Z0-9_]{1,20}$/.test(error.code||'')?error.code:null}));
    process.exitCode=1;return;
  } finally {if(db)await db.end();}
  }
});
