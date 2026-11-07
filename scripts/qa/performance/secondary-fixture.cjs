const {fixtureId,reduceLedgerIntents} = require('./fixture-oracle.cjs');

// This owner proves non-disclosure; it is not a fourth transaction-count cohort.
function buildSecondaryFixture(){
  const owner='perf_20261102_secondary';
  const accounts=['SAR','SAR','USD','USD'].map((currency,ordinal)=>({
    id:fixtureId(owner,'accounts',ordinal),currency,openingBalanceMinor:'0',isDefault:ordinal===0,type:'bank',
  }));
  const categories=['expense','expense','income'].map((kind,ordinal)=>({
    id:fixtureId(owner,'categories',ordinal),kind,initialVersion:1,
  }));
  const intents=[
    {kind:'income',id:fixtureId(owner,'transactions',0),accountId:accounts[0].id,currency:'SAR',
      amountMinor:'543210',feeMinor:'0',occurredAt:'2025-01-15T09:00:00.000Z',categoryId:categories[2].id},
    {kind:'expense',id:fixtureId(owner,'transactions',1),accountId:accounts[0].id,currency:'SAR',
      amountMinor:'12345',feeMinor:'0',occurredAt:'2025-01-16T09:00:00.000Z',categoryId:categories[0].id},
  ];
  return {schemaVersion:2,seed:'masarifi-performance-2026-11-02-v2',owner,transactionCount:2,
    timezone:'Asia/Riyadh',accounts,categories,intents,categoryRevisions:[],
    window:{startInclusive:'2024-10-31T21:00:00.000Z',endExclusive:'2026-10-31T21:00:00.000Z'},
    fxPolicy:'unavailable across currencies; never add currencies or assume unit rates',
    expected:reduceLedgerIntents(accounts,intents)};
}

module.exports={buildSecondaryFixture};
