'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {classifyFinancialMessage} = require('./index');

for (const [text, currency, amountMinor] of [
  ['Paid 25 ريال عماني', 'OMR', 25000],
  ['Paid ١٫٢٥٠ ريال عماني', 'OMR', 1250],
  ['Paid ريال عُماني 1.250', 'OMR', 1250],
  ['Paid 1.250 ر.ع', 'OMR', 1250],
  ['Paid 1.250 دينار بحريني', 'BHD', 1250],
  ['Paid 25 ريال قطري', 'QAR', 2500],
  ['Paid 25 ريال سعودي', 'SAR', 2500],
  ['Paid 25 ريال', 'SAR', 2500],
  ['Paid 1.250 دينار كويتي', 'KWD', 1250],
]) {
  test(`qualified currency preserves its identity and scale: ${text}`, () => {
    const result = classifyFinancialMessage({text, receivedAt: Date.parse('2026-10-18T10:00:00Z')});
    assert.equal(result.currency, currency);
    assert.equal(result.amountMinor, amountMinor);
    assert.equal(result.disposition, 'capture_candidate');
  });
}

test('conflicting explicit currencies are held for review', () => {
  const result = classifyFinancialMessage({text:'Paid 25 ريال عماني / SAR 25'});
  assert.equal(result.disposition, 'review');
  assert.ok(result.reasonCodes.includes('amount_conflict'));
});
