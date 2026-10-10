// CI-only financial fixture: exercise migration upgrades with committed ledger
// and Savings data. This file is prepared outside all existing checkouts.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const requireApi = createRequire(resolve(__dirname, '../../apps/api/package.json'));
const { Client } = requireApi('pg');

const [mode, receiptPath] = process.argv.slice(2);
assert.ok(['seed', 'verify'].includes(mode) && receiptPath, 'Expected seed|verify and receipt path');
const connection = new URL(process.env.DATABASE_URL || '');
assert.equal(process.env.NODE_ENV, 'test');
assert.equal(process.env.CROSS_FEATURE_DISPOSABLE_DATABASE_NAME, 'postgres');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(connection.hostname), 'Disposable local database required');
assert.equal(connection.pathname, '/postgres');

const owner = 'integration_main_upgrade_fixture';
const client = new Client({ connectionString: connection.toString() });
async function snapshot() {
  const queries = {
    accounts: 'select id,user_id,name,type,currency_code,status,version,institution_name,last_four,credit_limit_minor,is_default,icon_key,color_key,notes,sort_order,include_in_totals,opened_at,closed_at,deleted_at,created_at,updated_at,automatic_tracking_enabled,statement_day,payment_due_day,monthly_interest_rate_basis_points,minimum_payment_minor from public.accounts where user_id=$1 order by id',
    balances: 'select b.account_id,b.confirmed_minor,b.pending_minor,b.ledger_version,b.reconciled_at,b.updated_at from public.account_balances b join public.accounts a on a.id=b.account_id where a.user_id=$1 order by b.account_id',
    transactions: 'select id,user_id,kind,status,amount_minor,fee_minor,currency_code,title,category_id,merchant,payment_method,note,source,external_ref,reverses_transaction_id,version,occurred_at,deleted_at,undo_expires_at,created_at,updated_at from public.transactions where user_id=$1 order by id',
    postings: 'select p.id,p.transaction_id,p.account_id,p.amount_minor,p.clearing_state,p.posting_role,p.occurred_at,p.created_at from public.transaction_postings p join public.transactions t on t.id=p.transaction_id where t.user_id=$1 order by p.id',
    goals: 'select id,user_id,name,currency_code,target_minor,opening_tracked_minor,linked_account_id,status,version,target_date,icon_key,emergency_fund,deleted_at,created_at,updated_at from public.savings_goals where user_id=$1 order by id',
    movements: 'select id,user_id,goal_id,transaction_id,amount_minor,kind,operation_id,replaces_movement_id,occurred_at,created_at from public.savings_goal_movements where user_id=$1 order by id',
    revisions: 'select r.id,r.transaction_id,r.revision_no,r.actor_id,r.reason,r.before_snapshot,r.after_snapshot,r.created_at from audit.transaction_revisions r join public.transactions t on t.id=r.transaction_id where t.user_id=$1 order by r.transaction_id,r.revision_no',
  };
  const evidence = {};
  for (const [name, sql] of Object.entries(queries)) evidence[name] = (await client.query(sql, [owner])).rows;
  return JSON.parse(JSON.stringify(evidence));
}

async function main() {
  await client.connect();
  try {
    if (mode === 'seed') {
      const accountId = randomUUID(), goalId = randomUUID();
      await client.query('begin');
      await client.query('grant masarifi_migration to current_user with set true, inherit false');
      await client.query('set local role masarifi_migration');
      await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: owner })]);
      await client.query("insert into public.profiles(id,status) values($1,'active')", [owner]);
      await client.query("insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Upgrade cash','cash','SAR')", [accountId, owner]);
      await client.query("insert into public.savings_goals(id,user_id,name,currency_code,target_minor,opening_tracked_minor,linked_account_id) values($1,$2,'Upgrade Savings','SAR',100000,1000,$3)", [goalId,owner,accountId]);
      let incomeId;
      for (const [kind, amountMinor] of [['income', 10000], ['expense', 2500]]) {
        const command = {kind, amountMinor, currency:'SAR', accountId, categoryId:null, title:'Upgrade '+kind, merchant:null,paymentMethod:null,note:null,occurredAt:new Date(Date.now()-60000).toISOString(),source:'manual',externalRef:null};
        const result = await client.query('select private.post_transaction($1,$2::jsonb) result', [owner, JSON.stringify(command)]);
        if (kind === 'income') incomeId = result.rows[0].result.transactionId;
      }
      await client.query('select private.record_savings_movement($1,$2::jsonb)', [owner,JSON.stringify({goalId,movementId:randomUUID(),transactionId:incomeId,expectedVersion:1,kind:'contribution',amountMinor:'10000',replacesMovementId:null,operationId:randomUUID(),requestId:'integration-main-upgrade'})]);
      await client.query('reset role');
      await client.query('revoke masarifi_migration from current_user granted by current_user');
      await client.query('commit');
      const before = await snapshot();
      assert.equal(before.transactions.length, 2);
      assert.equal(before.postings.length, 2);
      assert.equal(before.balances[0].confirmed_minor, '7500');
      assert.equal(before.movements[0].amount_minor, '10000');
      assert.equal(before.goals[0].opening_tracked_minor, '1000');
      writeFileSync(receiptPath, JSON.stringify(before, null, 2)+'\n', {flag:'wx'});
      console.log('Committed main-schema ledger and Savings fixture; expected cash balance 7500 minor units.');
    } else {
      assert.deepEqual(await snapshot(), JSON.parse(readFileSync(receiptPath,'utf8')), 'Upgrade changed committed financial evidence');
      console.log('Upgrade preserved accounts, exact balances, transaction headers/postings/revisions, Savings goals and movements.');
    }
  } finally {
    await client.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
