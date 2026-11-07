'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const helper=require('./capacity-fixtures.cjs');
test('ten-event fixture preserves repeated independent breakfast purchases and locale-independent financial fields',()=>{const control={purpose:'ten-events',locale:'en',cashAccountId:'cash',cardAccountId:'card',categoryIds:{breakfast:['food'],taxi:'taxi',household:'house',salary:'salary'}};const rows=helper.expectedRows(control);assert.equal(rows.length,10);assert.deepEqual(rows[0],rows[6]);assert.equal(rows[9][0],'income');assert.equal(rows[9][1],500000);assert.deepEqual(helper.expectedRows({...control,locale:'ar'}),rows);assert.equal(helper.expectedRows({...control,purpose:'accuracy'}).length,2);assert.equal(helper.fixtureId(control),'english-ten-events-v1');assert.equal(helper.fixtureId({...control,locale:'ar'}),'arabic-ten-events-v1');});
test('capacity metadata stays bounded and reveals no raw provider values',()=>{const diagnostic={allExpected:true,amountChecks:Array.from({length:10},()=>Array.from({length:10},()=>({identityFieldsMatch:true,providerEqualsExpected:true,providerEqualsMajorScale:false,decodedEqualsExpected:true,decodedEqualsMajorScale:false,canonicalEqualsExpected:true,canonicalEqualsMajorScale:false})))};const safe=helper.boundedPipeline(diagnostic);assert.equal(safe.allExpected,true);assert.equal(safe.amountChecks.length,10);assert(Buffer.byteLength(JSON.stringify(safe))<4096);assert.equal(safe.amountChecks[0].exactCanonicalMatches,10);});
test('bounded summaries discard arbitrary metadata and reject excessive comparisons',()=>{
 const safe=helper.boundedPipeline({allExpected:false,rawTranscript:'private value',amountMinor:500000,requestHeaders:{authorization:'private token'}});
 assert.deepEqual(safe,{allExpected:false});
 assert.throws(()=>helper.boundedPipeline({amountChecks:Array.from({length:11},()=>[])}),/METADATA_UNBOUNDED/);
 assert.throws(()=>helper.boundedPipeline({amountChecks:[Array.from({length:11},()=>({}))]}),/METADATA_UNBOUNDED/);
});
