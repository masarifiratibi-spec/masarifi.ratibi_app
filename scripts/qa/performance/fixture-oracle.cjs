// Independent QA intent model. It imports no application projection or SQL helper.
const { createHash } = require('node:crypto');

const SEED = 'masarifi-performance-2026-11-02-v2';
const KINDS = ['income', 'expense', 'transfer', 'reversal'];

function required(condition, code) {
  if (!condition) throw new Error(code);
}

function fixtureId(owner, table, ordinal) {
  required(/^[a-zA-Z0-9_.-]+$/.test(owner) && /^[a-z_]+$/.test(table), 'FIXTURE_ID_DOMAIN_INVALID');
  required(Number.isSafeInteger(ordinal) && ordinal >= 0, 'FIXTURE_ID_ORDINAL_INVALID');
  const bytes = createHash('sha256')
    .update([SEED, owner, table, String(ordinal)].join('\0'), 'utf8').digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString('hex');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}

function integer(value, allowZero = false) {
  required(typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value), 'FIXTURE_INTEGER_REQUIRED');
  const result = BigInt(value);
  required(allowZero || result > 0n, 'FIXTURE_AMOUNT_MUST_BE_POSITIVE');
  return result;
}

function iso(value) {
  required(typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, 'FIXTURE_TIMESTAMP_INVALID');
  return value;
}

function reduceLedgerIntents(accounts, intents) {
  required(accounts.every(account => typeof account.id === 'string' && account.id.length > 0 && /^[A-Z]{3}$/.test(account.currency)), 'FIXTURE_ACCOUNT_INVALID');
  const accountMap = new Map(accounts.map(account => [account.id, account]));
  required(accountMap.size === accounts.length, 'FIXTURE_DUPLICATE_ACCOUNT');
  const balances = new Map(accounts.map(account => [account.id, 0n]));
  const rows = new Map();
  const events = [];
  function account(id, currency) {
    const selected = accountMap.get(id);
    required(selected && selected.currency === currency, 'FIXTURE_ACCOUNT_OR_CURRENCY_MISMATCH');
    return selected;
  }
  for (const intent of intents) {
    if (intent.kind === 'reassignCategory') {
      const original = rows.get(intent.id);
      required(original && original.status === 'confirmed' && original.version === intent.expectedVersion, 'FIXTURE_VERSION_OR_STATUS_INVALID');
      required(typeof intent.categoryId === 'string' && intent.categoryId.length > 0, 'FIXTURE_CATEGORY_REQUIRED');
      original.categoryId = intent.categoryId;
      original.version += 1;
      continue;
    }
    required(KINDS.includes(intent.kind) && typeof intent.id === 'string' && !rows.has(intent.id), 'FIXTURE_DUPLICATE_OR_INVALID_TRANSACTION');
    iso(intent.occurredAt);
    let amount, fee, currency, changes;
    if (intent.kind === 'reversal') {
      const original = rows.get(intent.originalId);
      required(original && original.kind !== 'reversal' && original.status === 'confirmed' && original.version === intent.expectedVersion, 'FIXTURE_REVERSAL_INVALID');
      amount = original.amount; fee = original.fee; currency = original.currency;
      changes = original.changes.map(change => ({ ...change, delta: -change.delta }));
      original.status = 'reversed'; original.version += 1;
    } else {
      amount = integer(intent.amountMinor); fee = integer(intent.feeMinor, true); currency = intent.currency;
      account(intent.accountId, currency);
      required(intent.kind !== 'income' || fee === 0n, 'FIXTURE_INCOME_FEE_UNSUPPORTED');
      required(intent.kind !== 'expense' || fee === 0n, 'FIXTURE_EXPENSE_FEE_UNSUPPORTED');
      changes = [{ accountId:intent.accountId, currency, delta:intent.kind === 'income' ? amount : -amount-fee }];
      if (intent.kind === 'transfer') {
        account(intent.destinationAccountId, currency);
        required(intent.destinationAccountId !== intent.accountId, 'FIXTURE_SELF_TRANSFER');
        changes.push({ accountId:intent.destinationAccountId, currency, delta:amount });
      }
    }
    for (const change of changes) balances.set(change.accountId, balances.get(change.accountId) + change.delta);
    rows.set(intent.id, { id:intent.id, kind:intent.kind, status:'confirmed', version:1, currency,
      occurredAt:intent.occurredAt, categoryId:intent.categoryId ?? null, originalId:intent.originalId ?? null, amount, fee, changes });
    events.push({ id:intent.id, occurredAt:intent.occurredAt, changes:changes.map(change => ({
      accountId:change.accountId, currency:change.currency, deltaMinor:change.delta.toString() })) });
  }
  const currencyBalances = {};
  for (const account of accounts) currencyBalances[account.currency] = (currencyBalances[account.currency] ?? 0n) + balances.get(account.id);
  const currencies=[...new Set(accounts.map(account=>account.currency))];
  const zeroCurrencies=()=>Object.fromEntries(currencies.map(currency=>[currency,0n]));
  const currentConfirmed = Object.fromEntries(KINDS.map(kind => [kind, { count:0, amountByCurrency:zeroCurrencies(), feeByCurrency:zeroCurrencies() }]));
  for (const row of rows.values()) {
    if (row.status !== 'confirmed') continue;
    const group = currentConfirmed[row.kind]; group.count += 1;
    group.amountByCurrency[row.currency] = (group.amountByCurrency[row.currency] ?? 0n) + row.amount;
    group.feeByCurrency[row.currency] = (group.feeByCurrency[row.currency] ?? 0n) + row.fee;
  }
  for (const group of Object.values(currentConfirmed)) {
    group.amountByCurrency = Object.fromEntries(Object.entries(group.amountByCurrency).map(([key,value]) => [key,value.toString()]));
    group.feeByCurrency = Object.fromEntries(Object.entries(group.feeByCurrency).map(([key,value]) => [key,value.toString()]));
  }
  return {
    balances:Object.fromEntries([...balances].map(([key,value]) => [key,value.toString()])),
    currencyBalances:Object.fromEntries(Object.entries(currencyBalances).map(([key,value]) => [key,value.toString()])),
    transactions:[...rows.values()].map(({ amount,fee,changes,...row }) => ({ ...row, amountMinor:amount.toString(), feeMinor:fee.toString(),
      changes:changes.map(({delta,...change}) => ({...change,deltaMinor:delta.toString()})) })),
    ledgerEvents:events, currentConfirmed,
  };
}

// Twenty-four complete Riyadh calendar months; PostgreSQL's clock is never replaced.
function monthBoundary(index) { return new Date(Date.UTC(2024,10+index,1)-3*3600000).toISOString(); }
function occurredAt(ordinal) {
  return new Date(Date.UTC(2024,10+ordinal%24,1+Math.floor(ordinal/24)%28,12,0,ordinal%60)-3*3600000).toISOString();
}

function buildFixture(transactionCount) {
  required([0,1000,10000].includes(transactionCount), 'FIXTURE_TIER_INVALID');
  const owner = 'perf_20261102_t' + transactionCount;
  const accounts = ['SAR','SAR','USD','USD'].map((currency,index) => ({
    id:fixtureId(owner,'accounts',index), currency, openingBalanceMinor:'0', isDefault:index===0, type:'bank',
  }));
  const categories = ['expense','expense','income'].map((kind,index) => ({id:fixtureId(owner,'categories',index),kind,initialVersion:1}));
  const intents = [];
  const incomeCount = transactionCount*.25;
  const expenseCount = transactionCount*.6;
  const transferCount = transactionCount*.1;
  const reversalCount = transactionCount*.05;
  let ordinal = 0;
  const transactionId = index => fixtureId(owner,'transactions',index);
  const sourceAccount = index => accounts[index%4];
  for (let index=0;index<incomeCount;index+=1) {
    const selected=sourceAccount(index);
    intents.push({kind:'income',id:transactionId(ordinal++),accountId:selected.id,currency:selected.currency,
      amountMinor:String(500000+(index*7919)%500000),feeMinor:'0',occurredAt:occurredAt(index),categoryId:categories[2].id});
  }
  for (let index=0;index<expenseCount;index+=1) {
    const selected=sourceAccount(index);
    intents.push({kind:'expense',id:transactionId(ordinal++),accountId:selected.id,currency:selected.currency,
      amountMinor:String(100+(index*7919)%200000),feeMinor:'0',occurredAt:occurredAt(index),categoryId:categories[0].id});
  }
  for (let index=0;index<transferCount;index+=1) {
    const pair=index%2*2, sourceIndex=pair+Math.floor(index/2)%2, destinationIndex=pair+(sourceIndex%2===0?1:0);
    const selected=accounts[sourceIndex];
    intents.push({kind:'transfer',id:transactionId(ordinal++),accountId:selected.id,destinationAccountId:accounts[destinationIndex].id,currency:selected.currency,
      amountMinor:String(1000+(index*3571)%100000),feeMinor:index%13===0?'75':'0',occurredAt:occurredAt(index)});
  }
  for (let index=0;index<reversalCount;index+=1) {
    const expense=intents[incomeCount+index];
    intents.push({kind:'reversal',id:transactionId(ordinal++),originalId:expense.id,expectedVersion:1,
      occurredAt:new Date(Date.parse(expense.occurredAt)+7*86400000).toISOString()});
  }
  for (let index=0;index<transactionCount*.02;index+=1) {
    intents.push({kind:'reassignCategory',id:transactionId(incomeCount+reversalCount+index),expectedVersion:1,categoryId:categories[1].id});
  }
  const expected=reduceLedgerIntents(accounts,intents);
  const months=Array.from({length:24},(_,index)=>({key:new Date(Date.UTC(2024,10+index,1)).toISOString().slice(0,7),
    startInclusive:monthBoundary(index),endExclusive:monthBoundary(index+1)}));
  const orderedEvents=[...expected.ledgerEvents].sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)||a.id.localeCompare(b.id));
  const closing=new Map(accounts.map(account=>[account.id,0n]));let cursor=0;
  expected.monthClosingBalances=months.map(month=>{
    while(cursor<orderedEvents.length && orderedEvents[cursor].occurredAt<month.endExclusive){
      for(const change of orderedEvents[cursor].changes)closing.set(change.accountId,closing.get(change.accountId)+BigInt(change.deltaMinor));
      cursor+=1;
    }
    return {month:month.key,balances:Object.fromEntries([...closing].map(([id,value])=>[id,value.toString()]))};
  });
  expected.paginationIds=[...expected.transactions].sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)||b.id.localeCompare(a.id)).map(row=>row.id);
  return {schemaVersion:2,seed:SEED,owner,transactionCount,timezone:'Asia/Riyadh',accounts,categories,intents,months,
    window:{startInclusive:monthBoundary(0),endExclusive:monthBoundary(24)},
    categoryRevisions:[{id:categories[0].id,expectedVersion:1,resultVersion:2,operation:'renameWithoutFinancialEffect'}],
    fxPolicy:'unavailable across currencies; never add currencies or assume unit rates',
    oracleSemantics:'Posting-event balances and current-status groups are distinct; endpoint mapping requires its financial contract.',expected};
}

module.exports={buildFixture,fixtureId,reduceLedgerIntents};
