const assert = require('node:assert/strict');
const test = require('node:test');
const { comparePipeline, captureMetadata } = require('./accuracy-diagnostics.cjs');
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
  { kind: 'expense', amountMinor: 2500, minorUnit: 2, currency: 'SAR', accountId: cash, categoryIds: [food], occurredAt: new Date(context.recordedAt).toISOString() },
  { kind: 'income', amountMinor: 500000, minorUnit: 2, currency: 'SAR', accountId: cash, categoryIds: [salary], occurredAt: new Date(context.recordedAt).toISOString() }
];
const expense = { s: 1, k: 'e', a: '2500', c: 'e:SAR', b: 'e:ACCOUNT-1', g: 'CATEGORY-1', d: 'o:', m: '', i: true, q: 0.99 };
const income = { ...expense, s: 2, k: 'i', a: '-500000', g: 'CATEGORY-2' };
const envelope = events => ({ complete: true, language: 'en', events });

test('reordered complete events retain exact occurrence agreement', () => {
  assert.equal(comparePipeline(envelope([income, expense]), context, expected).allExpected, true);
});
test('missing event cannot pass even when provider says complete', () => {
  const result = comparePipeline(envelope([expense]), context, expected);
  assert.deepEqual(result.expectedOccurrencePresent, [true, false]);
  assert.equal(result.allExpected, false);
});
test('each intentional duplicate requires its own occurrence', () => {
  const wants = [expected[0], expected[0]];
  assert.equal(comparePipeline(envelope([expense, { ...expense, s: 2 }]), context, wants).allExpected, true);
  assert.deepEqual(comparePipeline(envelope([expense]), context, wants).expectedOccurrencePresent, [true, false]);
});
test('amount-scale diagnosis distinguishes provider units from canonical sign normalization', () => {
  const correct = comparePipeline(envelope([expense, income]), context, expected);
  assert.equal(correct.amountChecks[1][1].providerEqualsExpected, true);
  assert.equal(correct.amountChecks[1][1].decodedEqualsExpected, true);
  assert.equal(correct.amountChecks[1][1].canonicalEqualsExpected, true);
  const wrong = comparePipeline(envelope([{ ...expense, a: '25' }, { ...income, a: '-5000' }]), context, expected);
  assert.equal(wrong.allExpected, false);
  for (let i = 0; i < 2; i++) {
    assert.equal(wrong.amountChecks[i][i].identityFieldsMatch, true);
    assert.equal(wrong.amountChecks[i][i].providerEqualsMajorScale, true);
    assert.equal(wrong.amountChecks[i][i].canonicalEqualsMajorScale, true);
  }
  assert(!JSON.stringify(wrong).includes('5000'));
});
test('malformed one-item sibling preserves a slot and does not hide a healthy event', () => {
  const result = comparePipeline(envelope([null, income]), context, expected);
  assert.equal(result.providerEventCount, 2);
  assert.equal(result.decodedEventCount, 2);
  assert.equal(result.decisionCount, 2);
  assert.deepEqual(result.expectedOccurrencePresent, [false, true]);
});
test('wrong income sign is skipped without correcting the financial value', () => {
  const result = comparePipeline(envelope([expense, { ...income, a: '500000' }]), context, expected);
  assert.deepEqual(result.expectedOccurrencePresent, [true, false]);
});
test('incomplete and overflow envelopes produce no decision prefix', () => {
  for (const raw of [{ ...envelope([expense]), complete: false }, envelope(Array(11).fill(expense))]) {
    const result = comparePipeline(raw, context, expected);
    assert.equal(result.envelopeAccepted, false);
    assert.equal(result.decisionCount, undefined);
  }
});
test('Arabic and English use the same canonical comparator', () => {
  assert.equal(comparePipeline({ ...envelope([expense, income]), language: 'ar' }, { ...context, locale: 'ar' }, expected).allExpected, true);
});
test('capture metadata strips raw probe tags while retaining independent container measurements', () => {
  const bytes = Buffer.alloc(32); bytes.write('ftyp', 4);
  const probe = { streams: [{ codec_type: 'audio', codec_name: 'aac', channels: 1, sample_rate: '44100', duration: '3.021', tags: { title: 'private capture' } }], format: { filename: '/private/path' } };
  const result = captureMetadata(bytes, 3000, probe);
  assert.equal(result.containerDurationMs, 3021);
  assert.equal(result.durationDeltaMs, 21);
  assert.equal(result.codec, 'aac');
  assert.match(result.audioHash, /^[0-9a-f]{64}$/);
  assert(!JSON.stringify(result).includes('private'));
  assert.throws(() => captureMetadata(bytes, 3000, { streams: [{ codec_type: 'audio', codec_name: 'pcm_s16le' }] }), /AAC_AUDIO_REQUIRED/);
});

test('actual compact parser and decider preserve ten capacity occurrences with bounded evidence',()=>{
 const {expectedRows,boundedPipeline}=require('./capacity-fixtures.cjs');
 const card='44444444-4444-4444-8444-444444444444',taxi='55555555-5555-4555-8555-555555555555',house='66666666-6666-4666-8666-666666666666';
 const control={purpose:'ten-events',locale:'en',cashAccountId:cash,cardAccountId:card,categoryIds:{breakfast:[food],taxi,household:house,salary}};
 const extra=[{alias:'ACCOUNT-2',id:card,kind:'account',data:{currency:'SAR',name:'Card',minorUnit:2}},{alias:'CATEGORY-3',id:taxi,kind:'category',data:{kind:'expense'}},{alias:'CATEGORY-4',id:house,kind:'category',data:{kind:'expense'}}];
 const ctx={...context,references:[...context.references,...extra]},rows=expectedRows(control);
 const wants=rows.map(([kind,amountMinor,accountId,categoryIds])=>({kind,amountMinor,accountId,categoryIds:Array.isArray(categoryIds)?categoryIds:[categoryIds],minorUnit:2,currency:'SAR',occurredAt:expected[0].occurredAt}));
 const events=rows.map(([kind,amount,account,category],ordinal)=>({s:ordinal+1,k:kind==='income'?'i':'e',a:String(kind==='income'?-amount:amount),c:'e:SAR',b:'e:'+ctx.references.find(x=>x.kind==='account'&&x.id===account).alias,g:ctx.references.find(x=>x.kind==='category'&&x.id===(Array.isArray(category)?category[0]:category)).alias,d:'o:',m:'',i:true,q:0.99}));
 for(const locale of ['en','ar']){const result=comparePipeline({...envelope(events),language:locale},{...ctx,locale},wants);assert.equal(result.allExpected,true);assert.equal(result.decisionCount,10);const safe=boundedPipeline(result);assert(Buffer.byteLength(JSON.stringify(safe))<4096);assert.equal(safe.amountChecks[0].exactCanonicalMatches,2);}
 assert.equal(comparePipeline(envelope(events.filter((_,i)=>i!==6)),ctx,wants).allExpected,false);
 assert.equal(comparePipeline(envelope([...events,events[0]]),ctx,wants).envelopeAccepted,false);
});
