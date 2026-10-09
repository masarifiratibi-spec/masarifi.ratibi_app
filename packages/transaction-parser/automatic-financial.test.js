'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {classifyFinancialMessage: classify, defaultSnapshot, discoverFinancialMessage} = require('./index');
const parse = text => classify({text,country:'EG',receivedAt:Date.parse('2026-10-09T10:00:00Z')});

test('Egyptian Arabic, English and mixed completed bank credits retain income classification without a blanket review',()=>{
  for(const text of ['EGP 5 deposited to account XX4242','تم إيداع ٥٫٠٠ جنيه في حساب XX4242','تم credited مبلغ ۵٫۰۰ ج.م إلى account XX4242']) {
    assert.equal(parse(text).currency,'EGP',text);
    assert.equal(parse(text).amountMinor,500,text);
    assert.equal(parse(text).direction,'incoming',text);
    assert.equal(parse(text).disposition,'capture_candidate',text);
  }
});
test('credit-card funding and unidentified credits have a specific accounting exception',()=>{
  for(const text of ['Card XX4242 credited EGP 5','credited EGP 5']) {
    assert.ok(parse(text).reasonCodes.includes('credit_origin_required'),text);
    assert.equal(parse(text).disposition,'review');
  }
});
test('linked operations state their missing accounting identity',()=>{
  for(const [text,reason] of [['Cash withdrawal EGP 5','cash_destination_required'],['Transfer to SAMPLE EGP 5','transfer_counterparty_required'],['Transfer from SAMPLE EGP 5','transfer_counterparty_required'],['Refund EGP 5','original_transaction_required'],['Reversal EGP 5','original_transaction_required']]) {
    assert.ok(parse(text).reasonCodes.includes(reason),text);
    assert.ok(!parse(text).reasonCodes.includes('accounting_review_required'),text);
    assert.equal(parse(text).disposition,'review');
  }
});
test('transfer endpoints retain explicit source and destination evidence without assuming ownership',()=>{
  assert.deepEqual(parse('تحويل صادر ٥ جنيه من حساب XX1111 إلى حساب XX2222').instruments,
    [{role:'account',suffix:'1111',side:'source'},{role:'account',suffix:'2222',side:'destination'}]);
  assert.equal(parse('تحويل صادر ٥ جنيه من حساب XX1111 إلى حساب XX2222').disposition,'review');
});
test('a separate fee cannot silently disappear from an ordinary purchase posting',()=>{
  const result=parse('Purchase EGP 5 card XX4242 fee EGP 0.50');
  assert.equal(result.amountMinor,500);
  assert.equal(result.disposition,'review');
  assert.ok(result.reasonCodes.includes('fee_components_required'));
});
test('future and requested payments remain pending before action classification',()=>{
  for(const text of ['Payment request EGP 5','Scheduled payment EGP 5','سيتم تحويل ٥ جنيه','طلب دفع بمبلغ ٥ جنيه']) {
    assert.equal(parse(text).status,'pending',text);
    assert.equal(parse(text).disposition,'review',text);
  }
});
test('governed contexts make custom bilingual financial discovery useful without inventing direction',()=>{
  for(const text of ['MyBank alert transaction EGP 5','إشعار بنكي معاملة ٥ جنيه']) {
    const found=discoverFinancialMessage({text},defaultSnapshot,[{id:'custom-signal',value:text.startsWith('MyBank')?'MyBank alert':'إشعار بنكي',origin:'custom',enabled:true}]);
    assert.equal(found.strong,true,text);
    assert.equal(found.classification.direction,'unknown');
    assert.equal(found.classification.status,'unknown');
  }
});
test('generic pound wording does not override the qualified British currency alias',()=>{
  assert.equal(parse('Payment 5 جنيه استرليني').currency,'GBP');
  assert.equal(parse('Payment EGP 5').currency,'EGP');
});
test('Egyptian embedded time uses the actual Cairo offset for winter and summer',()=>{
  assert.equal(parse('Purchase EGP 5 on 2026-01-29 10:00').occurredAt,'2026-01-29T08:00:00.000Z');
  assert.equal(parse('Purchase EGP 5 on 2026-07-29 10:00').occurredAt,'2026-07-29T07:00:00.000Z');
});
