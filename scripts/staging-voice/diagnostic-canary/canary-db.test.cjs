"use strict";
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const source = fs.readFileSync(path.join(__dirname, 'canary-db.cjs'), 'utf8');
const acceptance = {bodyHash:'683de0fd60086962c86b256983b5feadd00f4c300166a82bfc782250de29ebec',owner:'masarifi_migration',definer:true,config:['search_path=""'],acl:'{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}'};
const helper = {bodyHash:'ce00e1b5da381a8baa4ac95f3e6882bb73dbccf107ff8007577e9c5410c1696b',owner:'masarifi_migration',definer:false,config:['search_path=""'],acl:'{masarifi_migration=X/masarifi_migration}'};
async function exercise(action='readiness', change={}) {
  const queries=[], output=[], errors=[], callbacks={};
  const baseline={confirmedMinor:-31000,pendingMinor:0};
  const admission={posting:false,activeEpochs:0,analysisJobs:0,assistantJobs:0,eligible:true,currentState:'closed',migrationSelfGrant:false,migrations:['20261010221534','20261011002702','20261011004500','20261011004600','20261011005920','20261013053237']};
  const metadata={acceptance:{...acceptance},helper:{...helper},...change};
  class Client {
    async connect(){} async end(){}
    async query(sql, args=[]) {
      queries.push(sql);
      if(sql.includes('pg_proc')) return {rows:metadata[args[0].includes('accept_voice_batch')?'acceptance':'helper']?[metadata[args[0].includes('accept_voice_batch')?'acceptance':'helper']]:[]};
      if(sql.includes("'posting'")) return {rows:[{result:admission}]};
      if(sql.includes("'accounts'")) return {rows:[{result:change.finance || baseline}]};
      if(sql.includes('pg_auth_members')) return {rows:[{present:false}]};
      return {rows:[]};
    }
  }
  const processStub={env:{SUPABASE_URL:'https://qcffvfbpzvpwcwxwjyro.supabase.co'},stdin:{on:(event,fn)=>{callbacks[event]=fn;}}};
  new Function('require','process','console',source)(name=>name==='pg'?{Client}:require(name),processStub,{log:value=>output.push(JSON.parse(value)),error:value=>errors.push(JSON.parse(value))});
  callbacks.data(JSON.stringify({action,scope:{project:'qcffvfbpzvpwcwxwjyro',ownerId:'user_3K2ItVcURds22ueEf31Py6e305q',accountId:'3161601e-1584-40b0-86ec-d170c018b551',categoryId:'04000000-0000-4000-8000-000000000006',baseline},url:'postgresql://reader.qcffvfbpzvpwcwxwjyro:inert@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'}));
  await callbacks.end();
  return {queries,output,errors,exitCode:processStub.exitCode};
}
test('readiness verifies exact deployed diagnostic metadata using a read-only transaction',async()=>{
  const r=await exercise();assert.equal(r.exitCode,undefined);assert.equal(r.output[0].diagnosticVerified,true);
  assert(r.queries.includes('begin isolation level repeatable read read only'));
  assert(r.queries.includes('commit'));assert(!r.queries.some(sql=>/^(grant|revoke|set local role|update|insert|delete)/i.test(sql)));
});
test('each acceptance body, owner, security, search path and ACL drift refuses readiness',async()=>{
  for(const [field,value] of Object.entries({bodyHash:'foreign',owner:'foreign',definer:false,config:['search_path=public'],acl:null})) {
    const r=await exercise('readiness',{acceptance:{...acceptance,[field]:value}});
    assert.equal(r.exitCode,1,field);assert.equal(r.output.length,0);assert(r.queries.includes('rollback'));
  }
});
test('each helper body, owner, security, search path and ACL drift refuses readiness',async()=>{
  for(const [field,value] of Object.entries({bodyHash:'foreign',owner:'foreign',definer:true,config:['search_path=public'],acl:null})) {
    const r=await exercise('readiness',{helper:{...helper,[field]:value}});assert.equal(r.exitCode,1,field);assert.equal(r.output.length,0);
  }
});
test('missing functions and changed finances cannot qualify readiness',async()=>{
  for(const change of [{acceptance:null},{helper:null},{finance:{confirmedMinor:-32000,pendingMinor:0}}]) {
    const r=await exercise('readiness',change);assert.equal(r.exitCode,1);assert.equal(r.output.length,0);
  }
});
test('prepare rejects unexpected acceptance before role elevation or epoch creation',async()=>{
  const r=await exercise('prepare',{acceptance:{...acceptance,bodyHash:'foreign'}});
  assert.equal(r.exitCode,1);assert(r.queries.includes('rollback'));
  assert(!r.queries.some(sql=>sql.startsWith('grant ') || sql.includes('prepare_staging_voice_epoch')));
});
