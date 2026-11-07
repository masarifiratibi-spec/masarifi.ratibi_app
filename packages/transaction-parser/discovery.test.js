'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const parser = require('./index');
const fs = require('node:fs');
const snapshot = {...parser.defaultSnapshot, discoveryContexts:['transaction','معاملة']};
const custom = [{id:'my-phrase',value:'MyBank alert',origin:'custom',enabled:true}];
function discover(text, overrides=[]) {
  return parser.discoverFinancialMessage({text,channel:'android_notification'},snapshot,overrides);
}
test('financial discovery interface is available', () => {
  assert.equal(typeof parser.discoverFinancialMessage,'function');
  assert.equal(typeof parser.compileFinancialDiscoveryPolicy,'function');
});
test('strong Arabic, English and mixed actions require a transaction money token', () => {
  for(const text of ['Purchase SAR 12.50','شراء عبر نقاط بيع مبلغ ١٢٫٥٠ ريال','تم purchase بمبلغ AED۱۲٫۵۰']) {
    assert.equal(discover(text).strong,true,text);
  }
});
test('custom wording contributes discovery only with independent financial context and money', () => {
  const found=discover('MyBank alert transaction EGP 5',custom);
  assert.equal(found.strong,true);
  assert.deepEqual(found.customRuleKeys,['custom.my-phrase']);
  assert.equal(found.classification.direction,'unknown');
  assert.equal(found.classification.status,'unknown');
  assert.equal(discover('MyBank alert EGP 5',custom).strong,false);
  assert.equal(discover('MyBank alert transaction',custom).strong,false);
});
test('custom matches are recorded even when a published rule classifies the event', () => {
  const found=discover('MyBank alert Purchase EGP 5',custom);
  assert.equal(found.strong,true);
  assert.ok(found.classification.appliedRuleKeys.includes('custom.my-phrase'));
  assert.equal(found.classification.disposition,'capture_candidate');
});
test('irrelevant money, balance, marketing, OTP and declined events never pass strong admission', () => {
  for(const text of ['Hello EGP 5','Purchase. Available Balance SAR 500','Offer Purchase AED 10 discount','OTP 123456 purchase EGP 5','Payment EGP 5 declined','Payment EGP 5 failed']) {
    assert.equal(discover(text,custom).strong,false,text);
  }
});
test('disabled published wording cannot admit content; protected failure still wins', () => {
  assert.equal(discover('Purchase SAR 5',[{value:'purchase',enabled:false}]).strong,false);
  assert.equal(discover('Purchase SAR 5 failed',[{value:'failed',enabled:false}]).strong,false);
});
test('pending is financial discovery but never a completed candidate', () => {
  const found=discover('Purchase SAR 5 pending');
  assert.equal(found.strong,true);
  assert.equal(found.classification.status,'pending');
  assert.equal(found.classification.disposition,'review');
});
test('native policy contains database predicates, currency aliases and enabled custom evidence', () => {
  const policy=parser.compileFinancialDiscoveryPolicy(snapshot,custom);
  assert.equal(policy.version,1);
  assert.equal(policy.releaseId,snapshot.releaseId);
  assert.ok(policy.rules.some(rule=>rule.ruleKey==='action.purchase'));
  assert.deepEqual(policy.contexts,['transaction','معاملة']);
  assert.deepEqual(policy.custom.map(rule=>rule.phrase),['mybank alert']);
  assert.ok(policy.currencies.some(currency=>currency.code==='EGP'));
});
test('native parity fixture is the exact database-derived shared policy',()=>{
  const fixture=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,
    '../../apps/mobile/modules/masarifi-sms-inbox/android/src/test/resources/financial-discovery-policy.json'),'utf8'));
  assert.deepEqual(fixture,parser.compileFinancialDiscoveryPolicy(snapshot,custom));
});
