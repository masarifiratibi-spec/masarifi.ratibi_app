const assert=require('node:assert/strict');
const test=require('node:test');
const {buildAdmissionFixture}=require('./admission-fixture.cjs');
const {buildFixture}=require('./fixture-oracle.cjs');
const {buildSecondaryFixture}=require('./secondary-fixture.cjs');

test('retained admission owner pairs service/setup effects with separate golden-owner IDs',()=>{
  const fixture=buildAdmissionFixture();
  assert.equal(fixture.owner,'perf_20261102_admission');
  assert.equal(fixture.schemaVersion,2);
  assert.equal(fixture.seed,'masarifi-performance-2026-11-02-v2');
  assert.equal(fixture.expected.transactions.length,8);
  assert.equal(fixture.intents.length,10);
  assert.equal(fixture.intents.filter(intent=>intent.execution==='service').length,5);
  assert.equal(fixture.intents.filter(intent=>intent.execution==='setup').length,5);
  assert.deepEqual(fixture.expected.currencyBalances,{SAR:'2468984',USD:'0'});
  assert.deepEqual(fixture.accounts.map(account=>fixture.expected.balances[account.id]),['2402318','66666','0','0']);
  assert.deepEqual(fixture.expected.transactions.filter(row=>row.kind==='expense').map(row=>[row.version,row.status,row.categoryId]),[
    [3,'reversed',fixture.categories[1].id],[3,'reversed',fixture.categories[1].id],
  ]);
  const allIds=[...[0,1000,10000].map(buildFixture),buildSecondaryFixture(),fixture].flatMap(owner=>
    [...owner.accounts,...owner.categories,...owner.expected.transactions].map(row=>row.id));
  assert.equal(allIds.length,11045);
  assert.equal(new Set(allIds).size,allIds.length);
});
