'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const parser = require('./index');
const classify = text => parser.classifyFinancialMessage({ text, channel: 'android_sms' });

test('bare riyal and dinar require verified account evidence and preserve explicit currencies', () => {
  for (const text of ['Purchase 50 ريال', 'Purchase 5 دينار']) {
    const result = classify(text);
    assert.equal(result.currency, null, text);
    assert.equal(result.disposition, 'review', text);
    assert.ok(result.reasonCodes.includes('currency_ambiguous'), text);
  }
  for (const [text, verifiedAccountCurrency, minor] of [
    ['Purchase 50 ريال', 'QAR', 5000], ['Purchase 4.200 ريال', 'OMR', 4200],
    ['Purchase 4.200 دينار', 'JOD', 4200], ['Purchase 4.200 دينار', 'BHD', 4200]
  ]) {
    const result = parser.classifyFinancialMessage({ text, verifiedAccountCurrency });
    assert.equal(result.currency, verifiedAccountCurrency);
    assert.equal(result.amountMinor, minor);
  }
  assert.equal(parser.classifyFinancialMessage({ text: 'Purchase SAR 50', verifiedAccountCurrency: 'QAR' }).currency, 'SAR');
  assert.equal(classify('Purchase 50 ريال يمني').currency, 'YER');
});

test('classifies Arabic clitics and salary possessives without matching unrelated words', () => {
  assert.equal(classify('تم إيداع راتبك 5000 SAR في حساب 1234').subtype, 'salary');
  assert.equal(classify('تم الشراء بمبلغ 50 ريال سعودي لدى متجر النور').disposition, 'capture_candidate');
  assert.equal(classify('تم السحب 100 ريال سعودي من الصراف').subtype, 'withdrawal');
  assert.notEqual(classify('مشاركة 50 SAR').disposition, 'capture_candidate');
});
test('keeps completed purchases at Arabic exhibition merchants out of promotion filtering', () => {
  assert.equal(classify('شراء 50 SAR من معرض النور').disposition, 'capture_candidate');
  assert.equal(classify('عرض خاص purchase SAR 50 discount 20%').disposition, 'ignore');
});
test('uses security-code context while retaining Code Coffee', () => {
  assert.equal(classify('Use code 481920 for purchase AED 250').disposition, 'ignore');
  assert.equal(classify('Purchase AED 250 at Code Coffee').disposition, 'capture_candidate');
});
test('separates available credit limits from posted amounts', () => {
  const result = classify('Purchase AED 100 at Coffee. Avl Cr. Limit AED 9000');
  assert.equal(result.amountMinor, 10000);
  assert.equal(result.disposition, 'capture_candidate');
});
test('cuts security boilerplate but preserves merchant words', () => {
  assert.equal(classify('Purchase AED 25 at Talabat. Never share this code').merchant, 'Talabat');
  assert.equal(classify('Purchase AED 25 at The Card Factory').merchant, 'The Card Factory');
});
test('reads Gulf aliases at their actual currency scales', () => {
  for (const [text, currency, minor] of [
    ['Purchase KD 12.750', 'KWD', 12750], ['Purchase BD 8.500', 'BHD', 8500],
    ['Purchase RO 4.200', 'OMR', 4200], ['Purchase SR 12.50', 'SAR', 1250],
    ['Purchase Dhs 12.50', 'AED', 1250], ['Purchase 4.200 دينار أردني', 'JOD', 4200]
  ]) {
    const result = classify(text);
    assert.equal(result.currency, currency, text);
    assert.equal(result.amountMinor, minor, text);
  }
});
