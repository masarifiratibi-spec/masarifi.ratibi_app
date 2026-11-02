const {fixtureId,reduceLedgerIntents}=require('./fixture-oracle.cjs');

// Committed correctness rows remain separate from all scale and isolation cohorts.
function buildAdmissionFixture(){
  const owner='perf_20261102_admission';
  const accounts=['SAR','SAR','USD','USD'].map((currency,ordinal)=>({
    id:fixtureId(owner,'accounts',ordinal),currency,openingBalanceMinor:'0',isDefault:ordinal===0,type:'bank',
  }));
  const categories=['expense','expense','income'].map((kind,ordinal)=>({
    id:fixtureId(owner,'categories',ordinal),kind,initialVersion:1,
  }));
  const intents=[];
  const id=ordinal=>fixtureId(owner,'transactions',ordinal);
  for(const [ordinal,execution] of [[0,'service'],[1,'setup']]){
    intents.push({kind:'income',id:id(ordinal),accountId:accounts[0].id,currency:'SAR',amountMinor:'1234567',feeMinor:'0',
      occurredAt:'2025-02-01T09:00:00.000Z',categoryId:categories[2].id,execution});
  }
  for(const [ordinal,execution] of [[2,'service'],[3,'setup']]){
    intents.push({kind:'expense',id:id(ordinal),accountId:accounts[0].id,currency:'SAR',amountMinor:'57500',feeMinor:'0',
      occurredAt:'2025-02-02T09:00:00.000Z',categoryId:categories[0].id,execution});
  }
  for(const [ordinal,execution] of [[4,'service'],[5,'setup']]){
    intents.push({kind:'transfer',id:id(ordinal),accountId:accounts[0].id,destinationAccountId:accounts[1].id,
      currency:'SAR',amountMinor:'33333',feeMinor:'75',occurredAt:'2025-02-03T09:00:00.000Z',execution});
  }
  for(const [ordinal,execution] of [[2,'service'],[3,'setup']]){
    intents.push({kind:'reassignCategory',id:id(ordinal),expectedVersion:1,categoryId:categories[1].id,execution});
  }
  for(const [ordinal,original,execution] of [[6,2,'service'],[7,3,'setup']]){
    intents.push({kind:'reversal',id:id(ordinal),originalId:id(original),expectedVersion:2,
      occurredAt:'2025-02-04T09:00:00.000Z',execution});
  }
  return {schemaVersion:2,seed:'masarifi-performance-2026-11-02-v2',owner,transactionCount:8,
    timezone:'Asia/Riyadh',accounts,categories,intents,categoryRevisions:[],
    window:{startInclusive:'2024-10-31T21:00:00.000Z',endExclusive:'2026-10-31T21:00:00.000Z'},
    fxPolicy:'unavailable across currencies; never add currencies or assume unit rates',
    expected:reduceLedgerIntents(accounts,intents)};
}

module.exports={buildAdmissionFixture};
