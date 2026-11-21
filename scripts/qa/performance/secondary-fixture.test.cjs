const assert = require('node:assert/strict');
const test = require('node:test');

const {buildFixture} = require('./fixture-oracle.cjs');
const {buildSecondaryFixture} = require('./secondary-fixture.cjs');

test('secondary-owner canaries have exact separate integer balances and no primary IDs',()=>{
  const fixture=buildSecondaryFixture();
  assert.equal(fixture.schemaVersion,2);
  assert.equal(fixture.seed,'masarifi-performance-2026-11-02-v2');
  assert.equal(fixture.owner,'perf_20261102_secondary');
  assert.equal(fixture.transactionCount,2);
  assert.deepEqual(fixture.intents.map(intent=>[intent.kind,intent.amountMinor,intent.occurredAt]),[
    ['income','543210','2025-01-15T09:00:00.000Z'],['expense','12345','2025-01-16T09:00:00.000Z'],
  ]);
  assert.deepEqual(fixture.expected.currencyBalances,{SAR:'530865',USD:'0'});
  assert.deepEqual(fixture.accounts.map(account=>fixture.expected.balances[account.id]),['530865','0','0','0']);
  const primaryIds=new Set([0,1000,10000].flatMap(tier=>{
    const primary=buildFixture(tier);
    return [...primary.accounts,...primary.categories,...primary.expected.transactions].map(row=>row.id);
  }));
  const canaryIds=[...fixture.accounts,...fixture.categories,...fixture.expected.transactions].map(row=>row.id);
  assert.equal(new Set(canaryIds).size,9);
  assert.equal(canaryIds.some(id=>primaryIds.has(id)),false);
});
