# Ignored Voice helpers: independent deep review

Pinned Tracking: 3bd0c5d3149259ad69fb6a5e86083a820052b7f4. All186 original source files read/hash checked; normalized Git blobs independently compared with Tracking. Parent ledger remains unchanged by this review. No originals/candidate/Git state/tests/providers/services/device/database/configuration modified or executed.

No additional missing product runtime behavior verified. INTEGRATE means extract exactly described offline pieces, not whole operating scripts. Exact per-file dispositions and boundary evidence in JSON.

## Missing narrow offline recovery

- The452 diagnostics implementation equals planned simpler diagnostics after replacing only adapter import and line endings. Keep simpler portable helper.
- Recover only the added ten mixed cash/card en/ar comparator case, missing-event/overflow checks and bounded evidence. Runtime ten-event processing already covered by canonical voice-batch.spec.ts:199,214,263.
- Extract capacity fixtureId/expectedRows/boundedPipeline and two fixture/summary tests. Leave candidate-specific review/dispatch/budget controls NEEDS DECISION. Bounded summary spreads arbitrary metadata; only known comparePipeline output is safe, or whitelist output fields.
- Extract confirmed capture input-only hash/time/reference validator and six tests with candidate parameter. Add explicit true verification flags: old false==false matches. Evidence consistency does not prove actual device/worker state or authorize admission.
- Extract visibility mock request factory and three tests with fictional origin/fake account read. Exclude install/global fetch/device entry/Metro/APK. Original factory forwards other-origin requests and calls supplied original for accounts; unchanged installation is not offline. Canonical Voice visibility tests already prove product stale-read/retry/no-duplicate behavior.
- Compiled idle worker child smoke is demonstrably hermetic in source: imports AiWorker only; fake repository/config; provider-disabled; no bootstrap/listener/DB. Current timer.hasRef test fixes same bug for analysis and assistant scopes, while compiled empty-poll process survival is additional acceptance. Use controlled child env, current compiled path/scopes, exit/error timeout handling and cleanup.
- Arabic Manual13 error banner/request-ID non-disclosure cases plus7 injected actual HTTP/client-to-form cases add cross-layer acceptance beyond canonical form403 and HTTP mapping tests. Update durable preparation and AMOUNT_OUT_OF_RANGE400 expectation to definite validation. Remove transient console captures.

## Current-contract fixture adaptations

Both old comparator suites omit required compact s occurrence and expect omitted dates at local midnight. Tracking now requires grounded occurrence and preserves immutable context.recordedAt. Adapt fixtures, never revert production behavior.

Suggested adaptation snippets (illustrative source review; not implementation):

~~~js
const expectedRecordedAt = new Date(context.recordedAt).toISOString();
const expense = { s: 1, k: 'e', a: '2500', c: 'e:SAR',
  b: 'e:ACCOUNT-1', g: 'CATEGORY-1', d: 'o:', m: '', i: true, q: 0.99 };
const income = { ...expense, s: 2, k: 'i', a: '-500000', g: 'CATEGORY-2' };
// Each expected row: occurredAt: expectedRecordedAt.
// Intentional duplicate purchases need distinct s values.
// Reordering must retain s identity rather than renumber duplicate extraction.
const events = rows.map(([kind, amount, account, category], ordinal) => ({
  s: ordinal + 1, /* retain other existing compact fields */
}));
// Missing-event test must retain surviving occurrence identities;
// parser overflow test keeps11 events and rejects the whole envelope.
~~~

~~~js
// Capture validator parameterization, after binding current candidate input:
assert.equal(prepared.candidate, expectedCandidate);
assert.equal(prepared.deviceTimezoneVerified, true);
assert.equal(prepared.workerPausedVerified, true);
// Keep existing exact-hash/ref/window/expiry assertions and original six tests.
// Add false preparation flags even when revalidated flags equal false.
~~~

~~~ts
// Existing Manual probe case requiring corrected current mapping:
[400, 'AMOUNT_OUT_OF_RANGE', 'coreFinance.validation.invalid']
// Use current durable preparation mocks/helper; injected request only.
// Keep UI request-ID nondisclosure and known domain metadata assertions.
~~~

## Unique operational/offline capabilities preserved NEEDS DECISION

These are not dismissed by age. Audio proof-format validator adds <=1000ms container-vs-declared measurement agreement; proof validator binds fullDecode/hash/size/duration to the actual input. Human confirmation binds candidate/locale/fixture/capture/audio, copies raw proof without mutation, and verifies human source. These are diagnostic admission rules, not production recorder rules.

Preflight has14 declared test invocations plus200/404/400 loop expansion, but imports a large operational samsung driver and /app compiled storage. Its English-before-Arabic phase, cancellation/unknown completion/exact purge acknowledgement safety tests are useful archived operational acceptance. Canonical voice-storage.spec.ts already covers precise NoSuchKey400/missing-object/failure behavior; manual-canary tests cover unrelated media claim/rollback.

Capacity operating guards bind cumulative two-then-four dispatch allowance, exact original dispatch files, unique captures, reviewed English success before Arabic, nonposting/purge/budget reconciliation and retained unknown-cost headroom. These are unique saved controls; modernize operating protocol together before use.

APK payload verifier ignores signature metadata only, rejects duplicate entries, hashes unsigned payload equality and checks staging/diagnostic markers. Clean EAS archive verifier binds tracked mobile source to clean pinned SHA and rejects untracked/private evidence. Hardcoded markers/paths require modernization; no missing product source.

Offline VOICE_DIAG summarizer computes native-stop/Ready/terminal/cleanup timing and overlapping next capture from sanitized logs. It assumes failed/complete captures and throws on absent stages, so preserve as evidence-reader modernization, not product code. Manual validation probe constrains imports to pure source/schema/DTO modules but reconstructs assumed historical inputs, not actual frozen bytes.

Receipt-loss/ingress harnesses create proxy listeners; their self-tests also start listeners. Host/provider/device/deployment/DB wrappers remain archived NEEDS DECISION. Compiled idle child above has no listener and mocked runtime dependencies.

## Superseded defect assertions

Old hydration, TransactionForm D1/D2, voice-refresh and cleanup-pin probes assert repaired defects. Current positive tests cover retry/owner isolation, preserving original unresolved operation, distinguish local prepare failure from financial uncertainty, same-receipt recovery/net-worth refresh and trusted closure before pin restoration. Do not restore assertions that require the defects.

## Exact extraction source snippets

Original source only, not implementation. Apply current-contract adaptations above. The fixtures/tests include synthetic pins; replace them with input parameters, not live config.

Source: C:\Users\DELL\.codex\worktrees\voice-auto-batches\MASREFY _Final\.superpowers\sdd\2026-10-04-voice-v3-runtime-investigation\accuracy-comparator-452.test.cjs, lines 1-32.
~~~js
const assert = require('node:assert/strict');
const test = require('node:test');
const { comparePipeline, captureMetadata } = require('./accuracy-diagnostics-452.cjs');
const cash = '11111111-1111-4111-8111-111111111111';
const food = '22222222-2222-4222-8222-222222222222';
const salary = '33333333-3333-4333-8333-333333333333';
const context = { locale: 'en', recordedAt: '2026-10-04T10:00:00Z', timezoneOffsetMinutes: -180,
  defaultAccountId: cash, references: [
    { alias: 'ACCOUNT-1', id: cash, kind: 'account', data: { currency: 'SAR', name: 'Cash', minorUnit: 2 } },
    { alias: 'CATEGORY-1', id: food, kind: 'category', data: { kind: 'expense' } },
    { alias: 'CATEGORY-2', id: salary, kind: 'category', data: { kind: 'income' } }
  ] };
const expected = [
  { kind: 'expense', amountMinor: 2500, minorUnit: 2, currency: 'SAR', accountId: cash, categoryIds: [food], occurredAt: '2026-10-03T21:00:00.000Z' },
  { kind: 'income', amountMinor: 500000, minorUnit: 2, currency: 'SAR', accountId: cash, categoryIds: [salary], occurredAt: '2026-10-03T21:00:00.000Z' }
];
const expense = { k: 'e', a: '2500', c: 'e:SAR', b: 'e:ACCOUNT-1', g: 'CATEGORY-1', d: 'o:', m: '', i: true, q: 0.99 };
const income = { ...expense, k: 'i', a: '-500000', g: 'CATEGORY-2' };
const envelope = events => ({ complete: true, language: 'en', events });

test('actual compact parser and decider preserve ten capacity occurrences with bounded evidence',()=>{
 const {expectedRows,boundedPipeline}=require('./capacity-phase-452.cjs');
 const card='44444444-4444-4444-8444-444444444444',taxi='55555555-5555-4555-8555-555555555555',house='66666666-6666-4666-8666-666666666666';
 const control={purpose:'ten-events',locale:'en',cashAccountId:cash,cardAccountId:card,categoryIds:{breakfast:[food],taxi,household:house,salary}};
 const extra=[{alias:'ACCOUNT-2',id:card,kind:'account',data:{currency:'SAR',name:'Card',minorUnit:2}},{alias:'CATEGORY-3',id:taxi,kind:'category',data:{kind:'expense'}},{alias:'CATEGORY-4',id:house,kind:'category',data:{kind:'expense'}}];
 const ctx={...context,references:[...context.references,...extra]},rows=expectedRows(control);
 const wants=rows.map(([kind,amountMinor,accountId,categoryIds])=>({kind,amountMinor,accountId,categoryIds:Array.isArray(categoryIds)?categoryIds:[categoryIds],minorUnit:2,currency:'SAR',occurredAt:expected[0].occurredAt}));
 const events=rows.map(([kind,amount,account,category])=>({k:kind==='income'?'i':'e',a:String(kind==='income'?-amount:amount),c:'e:SAR',b:'e:'+ctx.references.find(x=>x.kind==='account'&&x.id===account).alias,g:ctx.references.find(x=>x.kind==='category'&&x.id===(Array.isArray(category)?category[0]:category)).alias,d:'o:',m:'',i:true,q:0.99}));
 for(const locale of ['en','ar']){const result=comparePipeline({...envelope(events),language:locale},{...ctx,locale},wants);assert.equal(result.allExpected,true);assert.equal(result.decisionCount,10);const safe=boundedPipeline(result);assert(Buffer.byteLength(JSON.stringify(safe))<4096);assert.equal(safe.amountChecks[0].exactCanonicalMatches,2);}
 assert.equal(comparePipeline(envelope(events.filter((_,i)=>i!==6)),ctx,wants).allExpected,false);
 assert.equal(comparePipeline(envelope([...events,events[0]]),ctx,wants).envelopeAccepted,false);
});
~~~

Source: C:\Users\DELL\.codex\worktrees\voice-auto-batches\MASREFY _Final\.superpowers\sdd\2026-10-04-voice-v3-runtime-investigation\capacity-phase-452.cjs, lines 52-65.
~~~js
function fixtureId(control){assert(['en','ar'].includes(control.locale));assert(['accuracy','ten-events'].includes(control.purpose));return (control.locale==='en'?'english':'arabic')+(control.purpose==='ten-events'?'-ten-events-v1':control.locale==='en'?'-two-events-v1':'-four-events-v1');}
function expectedRows(control) {
 assert(['accuracy','ten-events'].includes(control.purpose),'CAPACITY_PURPOSE_INVALID');assert(['en','ar'].includes(control.locale));
 const cash=control.cashAccountId,card=control.cardAccountId,c=control.categoryIds;
 const first=['expense',2500,cash,c.breakfast],last=['income',500000,cash,c.salary];
 if(control.purpose==='ten-events')return [first,['expense',4000,cash,c.taxi],['expense',12000,card,c.household],['expense',3000,cash,c.breakfast],['expense',5000,card,c.taxi],['expense',8000,cash,c.household],[...first],['expense',6000,cash,c.taxi],['expense',9000,card,c.household],last];
 return control.locale==='en'?[first,last]:[first,['expense',4000,cash,c.taxi],['expense',12000,card,c.household],last];
}
function boundedPipeline(diagnostic) {
 const {amountChecks,...metadata}=diagnostic;
 if(!amountChecks)return metadata;
 assert(amountChecks.length<=10&&amountChecks.every(row=>row.length<=10),'CAPACITY_METADATA_UNBOUNDED');
 return {...metadata,amountChecks:amountChecks.map(row=>({identityMatches:row.filter(x=>x.identityFieldsMatch).length,exactProviderMatches:row.filter(x=>x.identityFieldsMatch&&x.providerEqualsExpected).length,exactDecodedMatches:row.filter(x=>x.identityFieldsMatch&&x.decodedEqualsExpected).length,exactCanonicalMatches:row.filter(x=>x.identityFieldsMatch&&x.canonicalEqualsExpected).length,majorScaleMatches:row.filter(x=>x.identityFieldsMatch&&(x.providerEqualsMajorScale||x.decodedEqualsMajorScale||x.canonicalEqualsMajorScale)).length}))};
}
~~~

Source: C:\Users\DELL\.codex\worktrees\voice-auto-batches\MASREFY _Final\.superpowers\sdd\2026-10-04-voice-v3-runtime-investigation\capacity-phase-452.test.cjs, lines 14-15.
~~~js
test('ten-event fixture preserves repeated independent breakfast purchases and locale-independent financial fields',()=>{const control={purpose:'ten-events',locale:'en',cashAccountId:'cash',cardAccountId:'card',categoryIds:{breakfast:['food'],taxi:'taxi',household:'house',salary:'salary'}};const rows=helper.expectedRows(control);assert.equal(rows.length,10);assert.deepEqual(rows[0],rows[6]);assert.equal(rows[9][0],'income');assert.equal(rows[9][1],500000);assert.deepEqual(helper.expectedRows({...control,locale:'ar'}),rows);assert.equal(helper.expectedRows({...control,purpose:'accuracy'}).length,2);assert.equal(helper.fixtureId(control),'english-ten-events-v1');assert.equal(helper.fixtureId({...control,locale:'ar'}),'arabic-ten-events-v1');});
test('capacity metadata stays bounded and reveals no raw provider values',()=>{const diagnostic={allExpected:true,amountChecks:Array.from({length:10},()=>Array.from({length:10},()=>({identityFieldsMatch:true,providerEqualsExpected:true,providerEqualsMajorScale:false,decodedEqualsExpected:true,decodedEqualsMajorScale:false,canonicalEqualsExpected:true,canonicalEqualsMajorScale:false})))};const safe=helper.boundedPipeline(diagnostic);assert.equal(safe.allExpected,true);assert.equal(safe.amountChecks.length,10);assert(Buffer.byteLength(JSON.stringify(safe))<4096);assert.equal(safe.amountChecks[0].exactCanonicalMatches,10);});
~~~

Source: C:\Users\DELL\.codex\worktrees\voice-auto-batches\MASREFY _Final\.superpowers\sdd\2026-10-04-voice-v3-runtime-investigation\confirmed-capture-452.cjs, lines 1-17.
~~~js
'use strict';
const assert=require('node:assert/strict'),{createHash}=require('node:crypto');
function validateConfirmedCapture({prepared,revalidated,capture,expectedHash,now}) {
 assert(['accuracy','ten-events'].includes(prepared.purpose),'ACCURACY_CAPTURE_REQUIRED');
 assert.equal(prepared.candidate,'45212149cb798a4ad2c52fb4affee2119cba6efb');
 for(const key of ['candidate','purpose','carrierApkSha256','cashAccountId','cardAccountId','categoryIds','deviceTimezone','deviceTimezoneVerified','workerPausedVerified'])
  assert.deepEqual(revalidated[key],prepared[key],'REVALIDATED_REFERENCE_MISMATCH');
 assert.match(expectedHash,/^[0-9a-f]{64}$/);
 assert.equal(createHash('sha256').update(capture.id).digest('hex'),expectedHash,'CONFIRMED_CAPTURE_MISMATCH');
 const opened=Date.parse(prepared.windowOpenedAt),checked=Date.parse(revalidated.windowOpenedAt),recorded=Date.parse(capture.capture_at),expires=Date.parse(capture.expires_at);
 assert([now,opened,checked,recorded,expires].every(Number.isFinite),'CAPTURE_TIME_INVALID');
 assert(now>=opened&&now-opened<=3600000,'CONFIRMED_PREPARATION_TOO_OLD');
 assert(now>=checked&&now-checked<=120000,'REFERENCE_REVALIDATION_REQUIRED');
 assert(recorded>=opened&&recorded<=now,'CONFIRMED_CAPTURE_TIME_INVALID');
 assert(expires-now>180000,'CAPTURE_EXPIRY_TOO_CLOSE');
}
module.exports={validateConfirmedCapture};
~~~

Source: C:\Users\DELL\.codex\worktrees\voice-auto-batches\MASREFY _Final\.superpowers\sdd\2026-10-04-voice-v3-runtime-investigation\confirmed-capture-452.test.cjs, lines 1-31.
~~~js
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');
const file=__dirname+'/confirmed-capture-452.cjs';
const helper=fs.existsSync(file)?require(file):{};
const now=Date.parse('2026-10-05T06:05:00Z');
const prepared={candidate:'45212149cb798a4ad2c52fb4affee2119cba6efb',purpose:'accuracy',carrierApkSha256:'carrier',cashAccountId:'cash',cardAccountId:'card',categoryIds:{breakfast:['food'],taxi:'taxi',household:'house',salary:'salary'},deviceTimezone:'Asia/Riyadh',deviceTimezoneVerified:true,workerPausedVerified:true,windowOpenedAt:new Date(now-20*60000).toISOString()};
const capture={id:'22222222-2222-4222-8222-222222222222',capture_at:new Date(now-3*60000).toISOString(),expires_at:new Date(now+86400000).toISOString()};
const revalidated={...prepared,windowOpenedAt:new Date(now-1000).toISOString()};
const expectedHash=createHash('sha256').update(capture.id).digest('hex');
const invoke=(patch={})=>helper.validateConfirmedCapture({prepared,revalidated,capture,expectedHash,now,...patch});
test('exact fresh confirmed capture can be bound after references are revalidated without changing its original window',()=>{
 assert.equal(typeof helper.validateConfirmedCapture,'function');
 invoke();assert.equal(prepared.windowOpenedAt,new Date(now-20*60000).toISOString());
});
test('confirmed recovery rejects different capture identity and changed references',()=>{
 for(const patch of [{expectedHash:'b'.repeat(64)},{expectedHash:'bad'},{revalidated:{...revalidated,cardAccountId:'different'}},{revalidated:{...revalidated,categoryIds:{...revalidated.categoryIds,taxi:'different'}}},{revalidated:{...revalidated,candidate:'different'}}]) assert.throws(()=>invoke(patch));
});
test('confirmed recovery rejects stale or future reference checks and old capture preparation',()=>{
 for(const patch of [{revalidated:{...revalidated,windowOpenedAt:new Date(now-120001).toISOString()}},{revalidated:{...revalidated,windowOpenedAt:new Date(now+1).toISOString()}},{prepared:{...prepared,windowOpenedAt:new Date(now-3600001).toISOString()}}]) assert.throws(()=>invoke(patch));
});
test('confirmed recovery rejects capture before preparation, future capture and insufficient expiry',()=>{
 for(const patch of [{capture:{...capture,capture_at:new Date(now-21*60000).toISOString()}},{capture:{...capture,capture_at:new Date(now+1).toISOString()}},{capture:{...capture,expires_at:new Date(now+180000).toISOString()}},{capture:{...capture,capture_at:'invalid'}}]) assert.throws(()=>invoke(patch));
});
test('cancel-only captures cannot use confirmed accuracy admission',()=>{
 assert.throws(()=>invoke({prepared:{...prepared,purpose:'cancel-only'},revalidated:{...revalidated,purpose:'cancel-only'}}));
});
test('explicit ten-event phase keeps exact-hash fresh-reference recovery constraints',()=>{
 const phase={...prepared,purpose:'ten-events'},checked={...revalidated,purpose:'ten-events'};
 invoke({prepared:phase,revalidated:checked});
 assert.throws(()=>invoke({prepared:phase,revalidated:{...checked,windowOpenedAt:new Date(now-120001).toISOString()}}),/REFERENCE_REVALIDATION_REQUIRED/);
});
~~~

Source: C:\Users\DELL\.codex\worktrees\voice-auto-batches\MASREFY _Final\.superpowers\sdd\2026-10-04-voice-v3-runtime-investigation\visibility-device-fixture.js, lines 1-69.
~~~js
'use strict';
const SESSION = '55555555-5555-4555-8555-555555555555';
const TRANSACTION = '66666666-6666-4666-8666-666666666666';
const ORIGIN = 'https://api.staging.masarifiratibi.com';

function createFixture(original, assertOwner, emit, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  let account = null, reads = 0, admitted = false;
  let firstRead;
  const started = new Promise(resolve => { firstRead = resolve; });
  let accountResolved;
  const accountReady = new Promise(resolve => { accountResolved = resolve; });
  const boundedWait = async (pending, reason) => {
    let timer;
    try { await Promise.race([pending, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(reason)), 10000); })]); }
    finally { clearTimeout(timer); }
  };
  const createdAt = new Date().toISOString();
  const result = () => ({ sessionId: SESSION, batchId: '77777777-7777-4777-8777-777777777777', status: 'completed', transactionIds: [TRANSACTION], addedCount: 1, ledgerVersion: 1 });
  const reply = value => new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json', 'x-visibility-fixture': 'not-persisted' } });
  const row = () => ({ id: TRANSACTION, kind: 'expense', status: 'confirmed', amountMinor: 2500, currency: 'SAR', accountIds: [account], sourceAccountId: account, destinationAccountId: null, feeMinor: 0, categoryId: null, title: 'DIAGNOSTIC - not saved', merchant: null, paymentMethod: null, note: null, occurredAt: createdAt, source: 'voice', originalTransactionId: null, version: 1, deletedAt: null, undoExpiresAt: null });
  const request = async (input, init) => {
    const url = new URL(typeof input === 'object' && input && typeof input.url === 'string' ? input.url : String(input));
    if (url.origin !== ORIGIN) return original(input, init);
    const method = (init && init.method || typeof input === 'object' && input && input.method || 'GET').toUpperCase();
    if (method !== 'GET') {
      emit({ stage: 'blocked-write', method, operation: url.pathname.startsWith('/api/v1/sync') ? 'sync' : 'other' });
      throw new Error('VISIBILITY_FIXTURE_WRITES_DISABLED');
    }
    if (/^\/api\/v1\/(voice|transactions|transfers|accounts|categories)(\/|$)/.test(url.pathname)) {
      assertOwner();
    }
    if (url.pathname === '/api/v1/accounts') {
      const response = await original(input, init);
      if (!response.ok) throw new Error('VISIBILITY_FIXTURE_ACCOUNT_READ_FAILED');
      const page = await response.clone().json();
      const cash = page.items.filter(item => item.isDefault && item.status === 'active' && item.currency === 'SAR');
      if (cash.length !== 1) throw new Error('VISIBILITY_FIXTURE_OWNED_ACCOUNT_REQUIRED');
      account = cash[0].id;
      accountResolved();
      return response;
    }
    if (url.pathname === '/api/v1/transactions') {
      await boundedWait(accountReady, 'VISIBILITY_FIXTURE_ACCOUNT_NOT_READY');
      assertOwner();
      const index = ++reads;
      emit({ stage: 'transaction-read', index, admitted, virtualTransactionId: TRANSACTION });
      if (index === 1) {
        firstRead();
        await wait(2500);
        emit({ stage: 'older-empty-read-completed', index });
        return reply({ items: [], nextCursor: null, ledgerVersion: 0, requestId: 'visibility-old-read' });
      }
      if (!admitted) throw new Error('VISIBILITY_FIXTURE_RECEIPT_REQUIRED');
      return reply({ items: [row()], nextCursor: null, ledgerVersion: 1, requestId: 'visibility-read-' + index });
    }
    if (url.pathname === '/api/v1/voice/batches/recovery') {
      await boundedWait(started, 'VISIBILITY_FIXTURE_NO_INITIAL_READ');
      await wait(100);
      assertOwner();
      admitted = true;
      emit({ stage: 'completed-fixture-receipt', virtualSessionId: SESSION, virtualTransactionId: TRANSACTION, persisted: false });
      return reply({ items: [{ ...result(), createdAt }] });
    }
    if (/^\/api\/v1\/voice\//.test(url.pathname)) throw new Error('VISIBILITY_FIXTURE_NO_REAL_VOICE_REQUEST');
    if (url.pathname === '/api/v1/transactions/' + TRANSACTION) throw new Error('VISIBILITY_FIXTURE_NO_EDIT_OR_DETAIL');
    return original(input, init);
  };
  return { request, result, ids: { session: SESSION, transaction: TRANSACTION } };
}
~~~

Source: C:\Users\DELL\.codex\worktrees\voice-auto-batches\MASREFY _Final\.superpowers\sdd\2026-10-04-voice-v3-runtime-investigation\visibility-device-fixture.test.cjs, lines 1-38.
~~~js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('./visibility-device-fixture');
const root = 'https://api.staging.masarifiratibi.com/api/v1';
function make(assertOwner = () => {}, wait = async()=>{}) {
  const calls = [];
  const original = async (url, init) => { calls.push({url,init}); return new Response(JSON.stringify({items:[{id:'10000000-0000-4000-8000-000000000001',isDefault:true,status:'active',currency:'SAR'}]})); };
  return { fixture:createFixture(original,assertOwner,()=>{},wait), calls };
}
test('blocks every financial mutation and voice upload/process with no original dispatch',async()=>{
  const {fixture,calls}=make();
  for(const path of ['/transactions','/transfers','/accounts','/categories','/voice/sessions','/voice/sessions/x/audio','/voice/sessions/x/process','/sync/mutations','/conflicts/x','/planning/goals','/devices','/unknown-write-path'])
    for(const method of ['POST','PUT','PATCH','DELETE']) await assert.rejects(fixture.request(root+path,{method}),/WRITES_DISABLED/);
  assert.equal(calls.length,0);
  await assert.rejects(fixture.request(new Request(root+'/sync/mutations',{method:'POST',body:'{}'})),/WRITES_DISABLED/);
  assert.equal(calls.length,0);
});
test('rejects a different owner before any fixture or network response',async()=>{
  const {fixture,calls}=make(()=>{throw new Error('OWNER_MISMATCH');});
  await assert.rejects(fixture.request(root+'/transactions'),/OWNER_MISMATCH/); assert.equal(calls.length,0);
});
test('serves a virtual committed receipt plus labelled row without persistence or provider calls',async()=>{
  let release;
  const oldWait = new Promise(resolve=>{release=resolve;});
  const {fixture,calls}=make(()=>{},ms=>ms===2500?oldWait:Promise.resolve());
  await fixture.request(root+'/accounts');
  const oldRead=fixture.request(root+'/transactions?limit=100');
  let oldSettled=false; oldRead.then(()=>{oldSettled=true;});
  const receipt=await (await fixture.request(root+'/voice/batches/recovery')).json();
  assert.equal(oldSettled,false,'receipt must precede the old pre-commit read');
  const page=await(await fixture.request(root+'/transactions?limit=100')).json();
  release();
  assert.equal((await (await oldRead).json()).items.length,0);
  assert.equal(receipt.items[0].transactionIds[0],page.items[0].id);
  assert.equal(page.items[0].title,'DIAGNOSTIC - not saved');
  assert.equal(page.items[0].sourceAccountId,'10000000-0000-4000-8000-000000000001');
  assert.equal(calls.length,1); assert.equal(calls[0].url,root+'/accounts');
});
~~~

Source: C:\Users\DELL\.codex\worktrees\voice-auto-batches\MASREFY _Final\.superpowers\sdd\2026-10-05-voice-analysis-only\probe-worker-idle.cjs, lines 1-31.
~~~js
'use strict';
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
if (process.argv[2] === 'child') {
  const { AiWorker } = require('../../../apps/api/dist/src/ai/ai.worker');
  const worker = new AiWorker(
    { claimAnalysisPurges: async () => [] }, {}, {},
    {
      get: key => key === 'MASARIFI_VOICE_ANALYSIS_ONLY',
      getRequired: key => key === 'MASARIFI_AI_PROVIDER_ENABLED' ? false : key === 'MASARIFI_AI_WORKER_POLL_MS' ? 1000 : 1,
    },
  );
  worker.start();
  console.log('IDLE_WORKER_STARTED');
  process.on('SIGTERM', async () => { await worker.stop(); process.exit(0); });
} else {
  const child = spawn(process.execPath, [__filename, 'child'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let exited = false;
  let started = false;
  child.stdout.on('data', data => { if (data.toString().includes('IDLE_WORKER_STARTED')) started = true; });
  child.stderr.on('data', data => process.stderr.write(data));
  child.on('exit', () => { exited = true; });
  setTimeout(() => {
    try {
      assert.equal(started, true);
      assert.equal(exited, false, 'Standalone worker exited during twelve idle polls');
      console.log('COMPILED_WORKER_SURVIVED_12_SECONDS_IDLE_NO_DATABASE_PROVIDER_OR_FINANCIAL_WORK');
    } catch (error) { console.error(error.message); process.exitCode = 1; }
    finally { child.kill('SIGTERM'); }
  }, 12000);
}
~~~

Source: C:\Users\DELL\.codex\worktrees\voice-auto-batches\MASREFY _Final\.superpowers\sdd\2026-10-06-installed-issue-reproduction\manual-banner.probe.test.tsx, lines 105-161.
~~~js
it.each([
 ['validation400', 'validation', {status:400, domainCode:'VALIDATION_FAILED'}, 'coreFinance.validation.invalid'],
 ['forbidden403', 'unknown', {status:403, domainCode:'FORBIDDEN'}, 'coreFinance.validation.invalid'],
 ['profile403', 'unknown', {status:403, domainCode:'PROFILE_INACTIVE'}, 'coreFinance.validation.invalid'],
 ['notfound404', 'not_found', {status:404, domainCode:'NOT_FOUND'}, 'coreFinance.validation.invalid'],
 ['conflict409', 'conflict', {status:409, domainCode:'IDEMPOTENCY_KEY_REUSED'}, 'coreFinance.validation.invalid'],
 ['currency409', 'conflict', {status:409, domainCode:'CURRENCY_MISMATCH'}, 'coreFinance.validation.invalid'],
 ['localSchema', 'validation', undefined, 'coreFinance.validation.invalid'],
 ['auth401', 'offline', {status:401, domainCode:'AUTH_TOKEN_INVALID'}, 'coreFinance.manual.auth'],
 ['rate429', 'offline', {status:429, domainCode:'RATE_LIMITED'}, 'coreFinance.manual.rateLimit'],
 ['category409', 'conflict', {status:409, domainCode:'CATEGORY_INVALID'}, 'coreFinance.manual.category'],
 ['account409', 'conflict', {status:409, domainCode:'ACCOUNT_CLOSED'}, 'coreFinance.manual.account'],
 ['timeout503', 'offline', {status:503, uncertain:true}, 'coreFinance.manual.uncertain'],
 ['receiptMismatch', 'unknown', {status:502, uncertain:true}, 'coreFinance.manual.uncertain'],
] as const)('INERT Manual %s branch', async (name, code, metadata, message) => {
 changeLocale('ar');
 const requestId = '10000000-0000-4000-8000-000000000077';
 jest.mocked(coreFinanceService.loadDraft).mockResolvedValue(requiredDraft('50','Food'));
 jest.mocked(coreFinanceService.createTransaction).mockRejectedValue(new CoreFinanceError(code, metadata ? {...metadata, requestId} : undefined));
 renderWithQueryData(<TransactionForm />, [[coreFinanceKeys.accounts(false),fixtureAccounts],[coreFinanceKeys.categories(false),fixtureCategories]]);
 await screen.findByLabelText(translate('coreFinance.form.amount'), {}, {timeout:5000});
 fireEvent.press(screen.getByLabelText(translate('coreFinance.form.save')));
 await screen.findByText(translate(message));
 expect(coreFinanceService.createTransaction).toHaveBeenCalledTimes(1);
 expect(screen.queryByText(requestId)).toBeNull();
 console.log(JSON.stringify({probe:name,banner:translate(message),requestIdVisible:false,transport:'mock only'}));
});

it.each([
 [400,'VALIDATION_FAILED','coreFinance.validation.invalid'],
 [403,'FORBIDDEN','coreFinance.validation.invalid'],
 [403,'PROFILE_INACTIVE','coreFinance.validation.invalid'],
 [401,'AUTH_TOKEN_INVALID','coreFinance.manual.auth'],
 [429,'RATE_LIMITED','coreFinance.manual.rateLimit'],
 [503,'LEDGER_UNAVAILABLE','coreFinance.manual.uncertain'],
 [400,'AMOUNT_OUT_OF_RANGE','coreFinance.manual.uncertain'],
] as const)('INERT real HTTP/client/proxy -> form: %s %s',async(status,domainCode,message)=>{
 const {registerLiveClerkBridge}=jest.requireActual('@/services/live/auth-service');
 registerLiveClerkBridge({getSession:async()=>({id:'session-inert',userId:'user_inert',method:'google',issuedAt:1,expiresAt:9999999999999}),getToken:async()=> 'inert-token'});
 const {createLiveCoreFinanceService}=jest.requireActual('@/services/mocks/core-finance-service');
 const requestId='10000000-0000-4000-8000-000000000077';
 const request=jest.fn(async()=>({ok:false,status,json:async()=>({code:domainCode,requestId})}));
 const live=createLiveCoreFinanceService({baseUrl:'https://inert.invalid',request});
 changeLocale('ar');
 jest.mocked(coreFinanceService.loadDraft).mockResolvedValue(requiredDraft('50','Food'));
 const caught:any[]=[];
 jest.mocked(coreFinanceService.createTransaction).mockImplementation(async(...args)=>{try{return await live.createTransaction(...args);}catch(e){caught.push(e);throw e;}});
 renderWithQueryData(<TransactionForm />,[[coreFinanceKeys.accounts(false),fixtureAccounts],[coreFinanceKeys.categories(false),fixtureCategories]]);
 await screen.findByLabelText(translate('coreFinance.form.amount'), {}, {timeout:5000});
 fireEvent.press(screen.getByLabelText(translate('coreFinance.form.save')));
 await screen.findByText(translate(message));
 expect(request).toHaveBeenCalledTimes(1);
 expect(caught[0]).toBeInstanceOf(CoreFinanceError);
 if(domainCode!=='AMOUNT_OUT_OF_RANGE') expect(caught[0].metadata).toMatchObject({status,domainCode,requestId});
 expect(screen.queryByText(requestId)).toBeNull();
 console.log(JSON.stringify({probe:'http-'+domainCode,metadata:caught[0].metadata,banner:translate(message),realNetworkCalls:0}));
});
~~~

## Complete per-file ledger

| Source | Disposition | Proof / narrow extraction |
|---|---|---|
| .superpowers/sdd/2026-10-04-voice-v3-processing-and-accuracy-repair/accuracy-diagnostics.cjs | INTEGRATE | Recover inert offline diagnostic matcher, capture-metadata validator and nine redaction/sign/duplicate/scale tests using current compiled Voice adapter. No database/provider/service access; verify after candidate API build. |
| .superpowers/sdd/2026-10-04-voice-v3-processing-and-accuracy-repair/accuracy-diagnostics.test.cjs | INTEGRATE | Recover inert offline diagnostic matcher, capture-metadata validator and nine redaction/sign/duplicate/scale tests using current compiled Voice adapter. No database/provider/service access; verify after candidate API build. |
| .superpowers/sdd/2026-10-04-voice-v3-processing-and-accuracy-repair/bootstrap-clean.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-processing-and-accuracy-repair/bootstrap-local.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-processing-and-accuracy-repair/verify-apk-payload.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-processing-and-accuracy-repair/verify-eas-source.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/accuracy-comparator-452.test.cjs | INTEGRATE | Recover only added ten mixed cash/card en/ar diagnostic comparator test; nine other tests equal simpler planned suite. Current s occurrence and immutable recordedAt required. Bounded summary depends only on extracted expectedRows/boundedPipeline; runtime ten events already canonical. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/accuracy-diagnostics-452.cjs | SUPERSEDED | Pure comparePipeline/captureMetadata implementation exactly equals planned simpler diagnostics after replacing only adapter require and CRLF normalization. /app absolute require is an operational path, not an improvement. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/accuracy-harness-preflight-452.cjs | NEEDS DECISION | 14 declared invocations plus200/404/400 loop expansion, mocked HTTP/SQL but operational samsung harness and /app paths. Unique human attestation, phase/settle/purge acknowledgement acceptance preserved. Precise NoSuchKey/failure and unrelated media claim behavior already canonical. validateAudioFormat adds <=1000ms diagnostic measurement agreement absent simpler captureMetadata, documented extraction option. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/analysis-bootstrap-final.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/analysis-bootstrap-local.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/analysis-refresh-local.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/attest-arabic-fixture-452.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/attest-capacity-fixture-452.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/attest-english-fixture-452.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/capacity-phase-452.cjs | INTEGRATE | PARTIAL: extract fixtureId, expectedRows and boundedPipeline only. guardDispatch/validateResult/validateCapacityPrerequisites/checkBudgetHeadroom operational protocol remains archived NEEDS DECISION. Bounded summary requires trusted known comparePipeline output; rest-spread metadata is not general redaction. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/capacity-phase-452.test.cjs | INTEGRATE | PARTIAL: recover fixture and bounded-evidence tests, two declarations. Five dispatch/review/budget protocol declarations remain archived NEEDS DECISION. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/confirmed-capture-452.cjs | INTEGRATE | PARTIAL input-only capture ID hash/time/reference validator. Parameterize candidate instead of old452 pin; require deviceTimezoneVerified/workerPausedVerified true rather than false==false matching. This does not establish actual device/worker state or provider approval. Operational caller remains NEEDS DECISION. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/confirmed-capture-452.test.cjs | INTEGRATE | Six offline validation declarations missing as a standalone tool suite. Recover using synthetic candidate parameter and add false-flag rejection. No operating admission meaning is carried. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/download-audio-452.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/extend-capacity-wrappers-452.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/historical-shadow-cleanup.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/lock-accuracy-purge-452.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/lock-historical-purge.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/normalize-audio-proof-452.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/observe-english-capture-452.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/prepare-accuracy-harness.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/prepare-accuracy-operator-452.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/prepare-capacity-control-452.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/prepare-mic-inspection-apk.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/prepare-samsung-452.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/prepare-visibility-apk.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/probe-local-mic-sample.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/samsung-accuracy-452.cjs | NEEDS DECISION | Operational DB/provider/cancellation/purge driver contains valid injectable guards explicitly reviewed. Preserve proof-input hash/size/duration/fullDecode binding, <=1000ms measurement guard, human attestation, settleCarrier/purgeExact acknowledgement tests for separate offline extraction decision. No production transplant. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/summarize-device-diag.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/verify-admission.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/verify-apk-payload.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/verify-eas-source.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/verify-permission-admission.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/visibility-device-entry.js | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/visibility-device-fixture.js | INTEGRATE | PARTIAL mock request factory only, fictional origin and injected fake accounts. Exclude install/global fetch/device hooks, real staging origin and owner pin. Original factory forwards other-origin traffic and calls injected original for accounts; installation unchanged is not offline. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/visibility-device-fixture.test.cjs | INTEGRATE | Three additional fake request-factory safety declarations: all mutation methods and Request objects blocked, wrong owner rejected, delayed precommit read/receipt/labelled row ordering. Runtime stale-read behavior already canonical. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/visibility-metro.config.js | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-04-voice-v3-runtime-investigation/visibility-public-config.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-05-voice-analysis-only/api-device-receipt.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-05-voice-analysis-only/api-preflight.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-05-voice-analysis-only/probe-local-bootstrap.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-05-voice-analysis-only/probe-worker-idle.cjs | INTEGRATE | Hermetic compiled child acceptance adds twelve empty-poll survival. Child imports compiled AiWorker only, fake repository/config and provider disabled; no app/bootstrap, listener or real pool. Current timer.hasRef tests fix same defect. Modernize controlled env/paths/scopes and cleanup before recovery. |
| .superpowers/sdd/2026-10-05-voice-automatic-manual-repair/bootstrap-final.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-05-voice-automatic-manual-repair/bootstrap-local.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-05-voice-automatic-manual-repair/bootstrap-review.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-05-voice-automatic-manual-repair/bootstrap-verified.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-05-voice-automatic-manual-repair/canary-compiled-preflight.cjs | ALREADY INCLUDED | Independently calculated normalized Git blob equals pinned Tracking source. |
| .superpowers/sdd/2026-10-05-voice-automatic-manual-repair/canary-controls.test.cjs | ALREADY INCLUDED | Independently calculated normalized Git blob equals pinned Tracking source. |
| .superpowers/sdd/2026-10-05-voice-automatic-manual-repair/canary-db.cjs | ALREADY INCLUDED | Independently calculated normalized Git blob equals pinned Tracking source. |
| .superpowers/sdd/2026-10-05-voice-automatic-manual-repair/canary-guards.cjs | ALREADY INCLUDED | Independently calculated normalized Git blob equals pinned Tracking source. |
| .superpowers/sdd/2026-10-05-voice-automatic-manual-repair/canary-host.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-05-voice-automatic-manual-repair/canary-voice.cjs | ALREADY INCLUDED | Independently calculated normalized Git blob equals pinned Tracking source. |
| .superpowers/sdd/2026-10-05-voice-automatic-manual-repair/project-readonly-audit.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-06-astra-independent-review/cleanup-pin-probe.cjs | SUPERSEDED | Old probe asserts pin-first shutdown skipping. Canonical closure stops trusted effects/policy before mutable restoration pin, with positive closure tests. Do not restore bad-behavior assertion. |
| .superpowers/sdd/2026-10-06-astra-independent-review/original-controls/canary-controls.test.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-06-astra-independent-review/original-controls/canary-guards.cjs | ALREADY INCLUDED | Independently calculated normalized Git blob equals pinned Tracking source. |
| .superpowers/sdd/2026-10-06-astra-independent-review/original-controls/canary-host.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-06-astra-independent-review/original-probes/hydration.probe.test.ts | SUPERSEDED | Old probe asserts failed hydration remains cached. Current positive retry/owner-isolation regression proves intended recovery; do not reintroduce bad-behavior assertion. |
| .superpowers/sdd/2026-10-06-astra-independent-review/original-probes/TransactionForm.probe.test.tsx | SUPERSEDED | Old probes assert replacement of uncertain submission and incorrect local-preparation uncertainty. Newer durable original-operation, retry and preparation-failure regressions cover repaired behavior. |
| .superpowers/sdd/2026-10-06-astra-review-repairs/canary-closure.test.cjs | ALREADY INCLUDED | All six closure/fault-isolation test bodies are retained in canonical Tracking test; only historical helper require path differs. |
| .superpowers/sdd/2026-10-06-installed-issue-reproduction/build-review-probes.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-06-installed-issue-reproduction/manual-banner.probe.test.tsx | INTEGRATE | PARTIAL Arabic13 failure banner/request-ID non-disclosure cases and7 injected HTTP-to-form cases. Update durable preparation and known mappings: AMOUNT_OUT_OF_RANGE400 is definite validation, not old uncertainty. No live request. |
| .superpowers/sdd/2026-10-06-installed-issue-reproduction/manual-validation-probe.cjs | NEEDS DECISION | Pure constrained source/schema/DTO validation is useful but reconstructs assumed historical visible IDs/date, not actual frozen submission. Canonical input/DTO tests cover product validation. Archive as explicit offline evidence-reader modernization. |
| .superpowers/sdd/2026-10-06-installed-issue-reproduction/probe-jest.config.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-06-installed-issue-reproduction/voice-refresh.probe.test.tsx | SUPERSEDED | Probe asserts missing same-receipt refresh/net-worth invalidation; current positive retry and refreshed scoped finance behavior supersede these negative bug assertions. |
| .superpowers/sdd/2026-10-07-assistant-runtime-alignment/existing-voice-host-control.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-07-assistant-runtime-alignment/inspect-staging.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-07-cross-feature-regressions/align-analysis-owner.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-07-cross-feature-regressions/apply-required-review-migration.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-07-cross-feature-regressions/bootstrap-candidate-disposable.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-07-cross-feature-regressions/disposable-platform-schema.sql | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-07-cross-feature-regressions/evaluate-assistant-prompt.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-07-cross-feature-regressions/install-reviewed-monitor.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-07-cross-feature-regressions/observe-deployment.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-07-cross-feature-regressions/original-host-control.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-07-cross-feature-regressions/prepare-cohort.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-07-cross-feature-regressions/prepare-reviewed-cohort.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-07-cross-feature-regressions/prepare-voice-review-database.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-07-cross-feature-regressions/send-reviewed-cohort.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-07-cross-feature-regressions/update-deployment-control.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-ai-usage-limits/activate-admin.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-ai-usage-limits/apply-ai-usage-api.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-ai-usage-limits/apply-correction-api.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-ai-usage-limits/apply-correction-migration.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-ai-usage-limits/apply-migration.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-ai-usage-limits/build-admin.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-ai-usage-limits/deploy-admin.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-ai-usage-limits/governance-before-cold-plan.sql | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-ai-usage-limits/prepare-ai-usage-cohort.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-ai-usage-limits/prepare-correction-cohort.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-ai-usage-limits/record-correction-runtime.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-ai-usage-limits/record-runtime.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-ai-usage-limits/samsung-observe.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-ai-usage-navigation/activate-staging-admin.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-ai-usage-navigation/build-staging-admin.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-ai-usage-refinement/activate-staging-admin-final.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-ai-usage-refinement/activate-staging-admin.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-ai-usage-refinement/build-staging-admin-final.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-ai-usage-refinement/build-staging-admin.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-automatic-voice/compare-source.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-automatic-voice/deploy-operating.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-automatic-voice/interrupt-processing-evidence.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-automatic-voice/observe-operating.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-automatic-voice/prepare-operating.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-automatic-voice/replay-committed-evidence.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-automatic-voice/operating-560135b4-3443-4c39-be0c-7601f8cbccde/close-epoch.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-automatic-voice/operating-560135b4-3443-4c39-be0c-7601f8cbccde/host-control.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-automatic-voice/operating-713560f1-ae59-4ecf-8509-a38580e49377/close-epoch.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-automatic-voice/operating-713560f1-ae59-4ecf-8509-a38580e49377/host-control.py | ALREADY INCLUDED | Independently calculated normalized Git blob equals pinned Tracking source. |
| .superpowers/sdd/2026-10-08-final-acceptance/admin-quota-acceptance.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/admin-route-acceptance.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/admin-route-activate.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/admin-route-inspect.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/apply-preserved-api.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/apply-provider-api.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/apply-provider-worker.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/apply-worker-upgrade.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/inspect-assistant-ingress.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/inspect-assistant-runtime.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/inspect-failed-voice.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/inspect-ingress-indent.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/inspect-ingress.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/inspect-proxy.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/prepare-preserved-cohort.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/prepare-provider-cohort.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/prepare-provider-worker.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/prepare-worker-upgrade.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/receipt-loss-host.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/receipt-loss-remote.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/receipt-loss.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/record-host.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/reset-disposable-usage.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/rotate-provider-worker-epoch.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/rotate-worker-epoch.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/ssh-evidence.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/start-assistant-only.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/receipt-loss-v4/receipt-loss-host.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/receipt-loss-v4/receipt-loss-remote.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/receipt-loss-v4/receipt-loss.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/worker-upgrade-3e969f26-4adf-4a46-b070-3bf3c526fcf4/close-epoch.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/worker-upgrade-3e969f26-4adf-4a46-b070-3bf3c526fcf4/host-control.py | ALREADY INCLUDED | Independently calculated normalized Git blob equals pinned Tracking source. |
| .superpowers/sdd/2026-10-08-final-acceptance/worker-upgrade-900df50a-1839-4af3-8380-aecfbf6668e1/close-epoch.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/worker-upgrade-900df50a-1839-4af3-8380-aecfbf6668e1/host-control.py | ALREADY INCLUDED | Independently calculated normalized Git blob equals pinned Tracking source. |
| .superpowers/sdd/2026-10-08-final-acceptance/worker-upgrade-d7aa1c1d-21f1-43bd-9345-8c199049ab2b/close-epoch.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/worker-upgrade-d7aa1c1d-21f1-43bd-9345-8c199049ab2b/host-control.py | ALREADY INCLUDED | Independently calculated normalized Git blob equals pinned Tracking source. |
| .superpowers/sdd/2026-10-08-final-acceptance/worker-upgrade-e9b10f34-766f-4429-acdb-fe64b61941a0/close-epoch.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/worker-upgrade-e9b10f34-766f-4429-acdb-fe64b61941a0/host-control.py | ALREADY INCLUDED | Independently calculated normalized Git blob equals pinned Tracking source. |
| .superpowers/sdd/2026-10-08-final-acceptance/worker-upgrade-ee39ed55-1ec9-4df8-877f-9198b4d79043/close-epoch.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-final-acceptance/worker-upgrade-ee39ed55-1ec9-4df8-877f-9198b4d79043/host-control.py | ALREADY INCLUDED | Independently calculated normalized Git blob equals pinned Tracking source. |
| .superpowers/sdd/2026-10-08-voice-time-and-home/api-deployment-remote.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-voice-time-and-home/bootstrap-disposable.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-voice-time-and-home/observe-host.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-voice-time-and-home/pgmq-schema.sql | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-voice-time-and-home/prepare-api-cohort.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-voice-time-and-home/prepare-api-console.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-voice-time-and-home/prepare-worker-console.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-voice-time-and-home/prepare-worker-upgrade.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-voice-time-and-home/rotate-worker-epoch.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-voice-time-and-home/worker-upgrade-remote.py | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-voice-time-and-home/worker-upgrade-bc8e88f4-b0d1-413a-944e-3a9c45e9a793/close-epoch.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/2026-10-08-voice-time-and-home/worker-upgrade-bc8e88f4-b0d1-413a-944e-3a9c45e9a793/host-control.py | ALREADY INCLUDED | Independently calculated normalized Git blob equals pinned Tracking source. |
| .superpowers/sdd/voice-v3-release-readiness/bounded-outbox-proof.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/voice-v3-release-readiness/readonly-runtime.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/voice-v3-staging-acceptance/capacity-maintenance.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/voice-v3-staging-acceptance/check-shadow-runtime.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/voice-v3-staging-acceptance/diagnose-capacity-read.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/voice-v3-staging-acceptance/disable-voice-v3.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/voice-v3-staging-acceptance/inspect-publisher.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/voice-v3-staging-acceptance/inspect-shadow-media.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/voice-v3-staging-acceptance/lock-shadow-purge.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/voice-v3-staging-acceptance/prepare-fixtures.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/voice-v3-staging-acceptance/prepare-samsung-shadow.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/voice-v3-staging-acceptance/read-disk-metrics.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/voice-v3-staging-acceptance/samsung-shadow.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/voice-v3-staging-acceptance/verify-canary-ingress.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/voice-v3-staging-acceptance/verify-post-maintenance-routes.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/voice-v3-staging-acceptance/voice-canary-ingress.cjs | NEEDS DECISION | Preserved operational/diagnostic tooling. Review and modernize separately before any service, database, provider, device or deployment action; no runtime feature transplant and no execution authorized by this recovery. |
| .superpowers/sdd/voice-v3-staging-acceptance/voice-v3-capacity.cjs | ALREADY INCLUDED | Independently calculated normalized Git blob equals pinned Tracking source. |
| apps/mobile/android/app/src/main/java/com/masarifi/mobile/dev/MainActivity.kt | SUPERSEDED | Standard generated Expo55 development-package activity/application, no financial/native custom code. Regenerate from preserved current canonical Tracking native modules/configuration and compile; do not copy dev identity. |
| apps/mobile/android/app/src/main/java/com/masarifi/mobile/dev/MainApplication.kt | SUPERSEDED | Standard generated Expo55 development-package activity/application, no financial/native custom code. Regenerate from preserved current canonical Tracking native modules/configuration and compile; do not copy dev identity. |

Source hash changes since inventory: 0. Dispositions: ALREADY INCLUDED 15; INTEGRATE 11; NEEDS DECISION 153; SUPERSEDED 7. No tests executed.

Compiled idle smoke hermetic proof: constructor is empty and accepts injected repository/storage/gateway/config; provider=false bypasses extraction; empty fake analysis purge claims use neither storage nor gateway; no application bootstrap. Recover with allowlisted child env (no inherited credentials), fake methods throwing on unexpected calls, finite parent timeout, exit/error hooks, SIGTERM then bounded kill cleanup. Source review only; compiled artifact import behavior remains unexecuted.

## Optional offline audio-proof extraction, decision kept explicit

These pure functions are absent from the simpler helper and have substantive format/provenance negative tests. They introduce a <=1000ms diagnostic agreement threshold and human fixture confirmation contract, so original operating driver remains NEEDS DECISION. If recovering only independent byte/probe validation, omit human/provider admission functions; place guards in inert utility and use fictional input/probe fixtures, never change production recorder policy.
Source: C:\Users\DELL\.codex\worktrees\voice-auto-batches\MASREFY _Final\.superpowers\sdd\2026-10-04-voice-v3-runtime-investigation\samsung-accuracy-452.cjs, lines835-870.
~~~js
function confirmAudioFixture(proof, confirmation, control) {
  assert(["accuracy", "ten-events"].includes(control.purpose), "ACCURACY_FIXTURE_REQUIRED");
  assert.equal(confirmation.source, "human-user", "HUMAN_CONFIRMATION_REQUIRED");
  assert.equal(confirmation.confirmed, true, "HUMAN_CONFIRMATION_REQUIRED");
  assert.equal(confirmation.candidate, control.candidate, "FIXTURE_CANDIDATE_MISMATCH");
  assert.equal(confirmation.locale, control.locale, "FIXTURE_LOCALE_MISMATCH");
  assert.equal(confirmation.fixture, capacity.fixtureId(control), "FIXTURE_ID_MISMATCH");
  assert.equal(confirmation.sessionHash, hash(control.sessionId), "FIXTURE_CAPTURE_MISMATCH");
  assert.equal(proof.humanFixtureConfirmed, false, "RAW_DECODER_PROOF_REQUIRED");
  assert.match(proof.audioHash, /^[0-9a-f]{64}$/);
  for (const key of ["audioHash", "sizeBytes", "declaredDurationMs"])
    assert.equal(confirmation[key], proof[key], "FIXTURE_AUDIO_MISMATCH");
  const validated = { ...proof, humanFixtureConfirmed: true };
  validateAudioProof(validated);
  return validated;
}
function validateAudioProof(proof, input) {
  assert.equal(proof.fullDecodePassed, true, "AUDIO_DECODE_REQUIRED");
  assert.equal(proof.humanFixtureConfirmed, true, "FIXTURE_CONFIRMATION_REQUIRED");
  assert.equal(proof.codec, "aac", "AAC_AUDIO_REQUIRED");
  validateAudioFormat(proof);
  if (input) {
    assert.equal(proof.audioHash, input.contentHash, "PROBE_AUDIO_HASH_MISMATCH");
    assert.equal(proof.sizeBytes, input.sizeBytes, "PROBE_SIZE_MISMATCH");
    assert.equal(proof.declaredDurationMs, input.durationMs, "PROBE_DURATION_MISMATCH");
  }
}
function validateAudioFormat(proof) {
  assert.equal(proof.codec, "aac", "AAC_AUDIO_REQUIRED");
  assert(Number.isInteger(proof.channels) && proof.channels >= 1 && proof.channels <= 2, "AUDIO_CHANNELS_INVALID");
  assert(Number.isInteger(proof.sampleRate) && proof.sampleRate >= 8000 && proof.sampleRate <= 192000, "AUDIO_SAMPLE_RATE_INVALID");
  assert(Number.isInteger(proof.declaredDurationMs) && proof.declaredDurationMs > 0 && proof.declaredDurationMs <= 60000, "AUDIO_DECLARED_DURATION_INVALID");
  assert(Number.isInteger(proof.containerDurationMs) && proof.containerDurationMs > 0 && proof.containerDurationMs <= 61000, "AUDIO_CONTAINER_DURATION_INVALID");
  // Diagnostic admission guard only; does not change the production recorder contract.
  assert(Math.abs(proof.containerDurationMs - proof.declaredDurationMs) <= 1000, "AUDIO_DURATION_DISAGREEMENT");
}
~~~
Original offline negative test source: C:\Users\DELL\.codex\worktrees\voice-auto-batches\MASREFY _Final\.superpowers\sdd\2026-10-04-voice-v3-runtime-investigation\accuracy-harness-preflight-452.cjs, lines40-47.
~~~js
test('audio proof rejects unusable streams and mismatched independently decoded input', () => {
  const input={contentHash:'a'.repeat(64),sizeBytes:4096,durationMs:1000};
  const proof={audioHash:input.contentHash,sizeBytes:4096,declaredDurationMs:1000,containerDurationMs:1024,codec:'aac',channels:1,sampleRate:44100,fullDecodePassed:true,humanFixtureConfirmed:true};
  helper.validateAudioProof(proof,input);
  for(const patch of [{codec:'mp3'},{channels:0},{channels:3},{sampleRate:0},{sampleRate:192001},{containerDurationMs:0},{containerDurationMs:61001},{containerDurationMs:2500},{fullDecodePassed:false},{humanFixtureConfirmed:false},{audioHash:'b'.repeat(64)},{sizeBytes:4095},{declaredDurationMs:999}]) {
    assert.throws(()=>helper.validateAudioProof({...proof,...patch},input));
  }
});
~~~
