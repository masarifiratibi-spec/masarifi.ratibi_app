const assert = require('node:assert/strict');
const test = require('node:test');
const { buildFixture, fixtureId, reduceLedgerIntents } = require('./fixture-oracle.cjs');

test('deterministic UUID allocation is stable and separates owners and tables', () => {
  // Independent Python SHA256/byte-masking vector for deterministic v4-shaped synthetic IDs.
  assert.equal(fixtureId('owner','transactions',1), 'f207e2e7-6c4d-45e4-ab1a-aa7173d18dbf');
  assert.notEqual(fixtureId('owner','transactions',1), fixtureId('other','transactions',1));
  assert.notEqual(fixtureId('owner','transactions',1), fixtureId('owner','accounts',1));
  assert.match(fixtureId('owner','transactions',1), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('independent integer reduction preserves principal, fee and reversal effects', () => {
  const accounts=[{id:'a',currency:'SAR'},{id:'b',currency:'SAR'},{id:'c',currency:'USD'}];
  const at='2026-01-01T00:00:00.000Z';
  const result=reduceLedgerIntents(accounts,[
    {kind:'income',id:'i',accountId:'a',currency:'SAR',amountMinor:'1000',feeMinor:'0',occurredAt:at,categoryId:'salary'},
    {kind:'expense',id:'e',accountId:'a',currency:'SAR',amountMinor:'125',feeMinor:'0',occurredAt:at,categoryId:'food'},
    {kind:'transfer',id:'t',accountId:'a',destinationAccountId:'b',currency:'SAR',amountMinor:'200',feeMinor:'10',occurredAt:at},
    {kind:'reversal',id:'r',originalId:'e',expectedVersion:1,occurredAt:at},
  ]);
  assert.deepEqual(result.balances,{a:'790',b:'200',c:'0'});
  assert.deepEqual(result.currencyBalances,{SAR:'990',USD:'0'});
  assert.equal(result.transactions.find(row=>row.id==='e').status,'reversed');
  assert.equal(result.transactions.find(row=>row.id==='e').version,2);
  assert.equal(result.currentConfirmed.expense.count,0);
  assert.equal(result.transactions.length,4);
  assert.equal(result.ledgerEvents[1].changes[0].deltaMinor,'-125');
});

test('category reassignment changes the version and grouping without financial effect', () => {
  const initial={kind:'expense',id:'e',accountId:'a',currency:'SAR',amountMinor:'123',feeMinor:'0',occurredAt:'2026-01-01T00:00:00.000Z',categoryId:'old'};
  const result=reduceLedgerIntents([{id:'a',currency:'SAR'}],[initial,{kind:'reassignCategory',id:'e',expectedVersion:1,categoryId:'new'}]);
  assert.equal(result.balances.a,'-123');
  assert.equal(result.transactions.length,1);
  assert.equal(result.transactions[0].version,2);
  assert.equal(result.transactions[0].categoryId,'new');
  assert.equal(result.ledgerEvents.length,1);
});

test('invalid currency, duplicates, stale versions and repeated reversals fail closed', () => {
  const accounts=[{id:'a',currency:'SAR'},{id:'b',currency:'USD'}];
  const expense={kind:'expense',id:'e',accountId:'a',currency:'SAR',amountMinor:'100',feeMinor:'0',occurredAt:'2026-01-01T00:00:00.000Z',categoryId:'food'};
  for(const intents of [
    [{...expense,currency:'USD'}],
    [{...expense,feeMinor:'1'}],
    [{...expense,kind:'transfer',destinationAccountId:'b'}],
    [expense,{...expense}],
    [expense,{kind:'reassignCategory',id:'e',expectedVersion:2,categoryId:'x'}],
    [expense,{kind:'reversal',id:'r',originalId:'e',expectedVersion:1,occurredAt:expense.occurredAt},{kind:'reversal',id:'r2',originalId:'e',expectedVersion:2,occurredAt:expense.occurredAt}],
  ])assert.throws(()=>reduceLedgerIntents(accounts,intents));
});

test('three fixture tiers have exact persisted cardinality, zero openings and currency separation', () => {
  for(const n of [0,1000,10000]){
    const fixture=buildFixture(n);
    assert.equal(fixture.schemaVersion,2);
    assert.equal(fixture.seed,'masarifi-performance-2026-11-02-v2');
    assert.equal(fixture.expected.transactions.length,n);
    assert.equal(fixture.accounts.length,4);
    assert.equal(fixture.accounts.filter(account=>account.currency==='SAR').length,2);
    assert.equal(fixture.accounts.filter(account=>account.currency==='USD').length,2);
    assert.ok(fixture.accounts.every(account=>account.openingBalanceMinor==='0'));
    assert.equal(new Set(fixture.expected.transactions.map(row=>row.id)).size,n);
    assert.equal(fixture.expected.transactions.filter(row=>row.kind==='reversal').length,n*.05);
    assert.equal(fixture.expected.transactions.filter(row=>row.status==='reversed').length,n*.05);
    assert.equal(fixture.expected.ledgerEvents.length,n);
    const reassignments=fixture.intents.filter(intent=>intent.kind==='reassignCategory');
    assert.equal(reassignments.length,n*.02);
    assert.equal(new Set(reassignments.map(intent=>intent.id)).size,n*.02);
    assert.equal(fixture.expected.transactions.filter(row=>row.kind==='expense'&&row.status==='confirmed'&&row.version===2&&row.categoryId===fixture.categories[1].id).length,n*.02);
    assert.deepEqual(buildFixture(n),fixture);
    assert.equal(fixture.months.length,24);
    assert.ok(fixture.expected.ledgerEvents.every(event=>event.occurredAt>=fixture.window.startInclusive&&event.occurredAt<fixture.window.endExclusive));
    assert.equal(fixture.fxPolicy,'unavailable across currencies; never add currencies or assume unit rates');
    if(n===0)assert.deepEqual(fixture.expected.currentConfirmed.expense.amountByCurrency,{SAR:'0',USD:'0'});
  }
  assert.throws(()=>buildFixture(999));
});

test('Riyadh boundaries, reversal-inclusive month closings and UUID pagination match independent goldens', () => {
  // Constants from a separate Python integer reducer over command intents only.
  const fixture=buildFixture(1000);
  assert.equal(fixture.window.startInclusive,'2024-10-31T21:00:00.000Z');
  assert.equal(fixture.window.endExclusive,'2026-10-31T21:00:00.000Z');
  assert.equal(fixture.months[0].endExclusive,'2024-11-30T21:00:00.000Z');
  for(const [index,expected] of [[0,['5442133','262040','0','0']],[1,['5442133','5879179','-279895','279895']]]){
    assert.deepEqual(fixture.accounts.map(account=>fixture.expected.monthClosingBalances[index].balances[account.id]),expected);
  }
  assert.deepEqual(fixture.expected.paginationIds.slice(0,3),[
    '8e43ef45-f8d4-4fec-81ee-2eb6acac8038','a90e361c-56a7-4179-aa4e-f7b0d5321ec7','3651f859-87b7-4d9a-b17c-c8c7b5d7cce6',
  ]);
  const tied=fixture.expected.transactions.filter(row=>row.occurredAt==='2024-11-01T09:00:00.000Z').map(row=>row.id);
  assert.deepEqual(fixture.expected.paginationIds.filter(id=>tied.includes(id)),[
    'f9629f73-9202-4a41-963f-99feb9e97943','b1c85dcc-4124-425c-bcfd-188d1452d3d0','230efe88-7646-4395-88f4-fe1f1a035fcb',
  ]);
});

test('aggregate integer balances retain units above JavaScript safe-integer range', () => {
  const intents=Array.from({length:1001},(_,index)=>({kind:'income',id:String(index),accountId:'a',currency:'SAR',
    amountMinor:'9000000000000',feeMinor:'0',occurredAt:'2026-01-01T00:00:00.000Z'}));
  intents.push({...intents[0],id:'last',amountMinor:'1'});
  assert.equal(reduceLedgerIntents([{id:'a',currency:'SAR'}],intents).balances.a,'9009000000000001');
});
