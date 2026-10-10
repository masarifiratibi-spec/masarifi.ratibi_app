'use strict';
const assert = require('node:assert/strict');
function fixtureId(control){assert(['en','ar'].includes(control.locale));assert(['accuracy','ten-events'].includes(control.purpose));return (control.locale==='en'?'english':'arabic')+(control.purpose==='ten-events'?'-ten-events-v1':control.locale==='en'?'-two-events-v1':'-four-events-v1');}
function expectedRows(control) {
 assert(['accuracy','ten-events'].includes(control.purpose),'CAPACITY_PURPOSE_INVALID');assert(['en','ar'].includes(control.locale));
 const cash=control.cashAccountId,card=control.cardAccountId,c=control.categoryIds;
 const first=['expense',2500,cash,c.breakfast],last=['income',500000,cash,c.salary];
 if(control.purpose==='ten-events')return [first,['expense',4000,cash,c.taxi],['expense',12000,card,c.household],['expense',3000,cash,c.breakfast],['expense',5000,card,c.taxi],['expense',8000,cash,c.household],[...first],['expense',6000,cash,c.taxi],['expense',9000,card,c.household],last];
 return control.locale==='en'?[first,last]:[first,['expense',4000,cash,c.taxi],['expense',12000,card,c.household],last];
}
function boundedPipeline(diagnostic) {
 assert(diagnostic && typeof diagnostic === 'object');
 const safe = {};
 for(const key of ['declaredComplete','languageMatches','envelopeAccepted','allExpected'])
  if(typeof diagnostic[key] === 'boolean') safe[key] = diagnostic[key];
 for(const key of ['providerEventCount','decodedEventCount','decisionCount']) {
  if(diagnostic[key] === undefined) continue;
  assert(Number.isInteger(diagnostic[key]) && diagnostic[key] >= 0 && diagnostic[key] <= 11);
  safe[key] = diagnostic[key];
 }
 if(diagnostic.expectedOccurrencePresent !== undefined) {
  assert(Array.isArray(diagnostic.expectedOccurrencePresent) && diagnostic.expectedOccurrencePresent.length <= 10 && diagnostic.expectedOccurrencePresent.every(value => typeof value === 'boolean'));
  safe.expectedOccurrencePresent = [...diagnostic.expectedOccurrencePresent];
 }
 const amountChecks = diagnostic.amountChecks;
 if(amountChecks === undefined) return safe;
 assert(Array.isArray(amountChecks) && amountChecks.length <= 10 && amountChecks.every(row => Array.isArray(row) && row.length <= 10),'CAPACITY_METADATA_UNBOUNDED');
 const count = (row, field) => row.filter(value => value.identityFieldsMatch === true && value[field] === true).length;
 safe.amountChecks = amountChecks.map(row => ({
  identityMatches: row.filter(value => value.identityFieldsMatch === true).length,
  exactProviderMatches: count(row,'providerEqualsExpected'),
  exactDecodedMatches: count(row,'decodedEqualsExpected'),
  exactCanonicalMatches: count(row,'canonicalEqualsExpected'),
  majorScaleMatches: row.filter(value => value.identityFieldsMatch === true && (value.providerEqualsMajorScale === true || value.decodedEqualsMajorScale === true || value.canonicalEqualsMajorScale === true)).length
 }));
 return safe;
}
module.exports={fixtureId,expectedRows,boundedPipeline};
