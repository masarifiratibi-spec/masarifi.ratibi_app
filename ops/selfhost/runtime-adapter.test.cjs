'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtempSync,copyFileSync,writeFileSync,rmSync}=require('node:fs');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const directory=mkdtempSync(join(tmpdir(),'masarifi-runtime-test-'));
copyFileSync(join(__dirname,'runtime-adapter.cjs'),join(directory,'runtime-adapter.cjs'));
writeFileSync(join(directory,'runtime-scope.js'),`exports.isProjectRuntimeEnvironment=e=>e.MASARIFI_RUNTIME_SCOPE==='project-server'&&e.MASARIFI_STORAGE_PROVIDER==='filesystem'&&!e.SUPABASE_URL&&e.MASARIFI_STORAGE_URL==='https://api.example.test';`);
const {wrapEnvironment,hookIdempotent,hookException,correlatedFetch}=require(join(directory,'runtime-adapter.cjs'));
test.after(()=>rmSync(directory,{recursive:true,force:true}));
const valid={MASARIFI_PROCESS_KIND:'api',MASARIFI_RUNTIME_SCOPE:'project-server',MASARIFI_STORAGE_PROVIDER:'filesystem',MASARIFI_STORAGE_URL:'https://api.example.test',MASARIFI_STORAGE_SERVICE_KEY:'fixture-service-key-with-at-least-32-characters'};

test('delegates every legacy fence and returns no provider credential fallback',()=>{
  const validate=wrapEnvironment(input=>{
    assert.equal(input.SUPABASE_URL,'https://qcffvfbpzvpwcwxwjyro.supabase.co');
    assert.equal(input.MASARIFI_RUNTIME_SCOPE,undefined);
    if(input.MASARIFI_STAGING_VOICE_EPOCH_ID && input.MASARIFI_PROCESS_KIND!=='worker')throw Error('VOICE_SCOPE_INVALID');
    return {...input,legacyFlag:true};
  });
  const result=validate(valid);
  assert.equal(result.legacyFlag,true);assert.equal(result.SUPABASE_URL,undefined);assert.equal(result.SUPABASE_SERVICE_ROLE_KEY,undefined);
  assert.throws(()=>validate({...valid,MASARIFI_STAGING_VOICE_EPOCH_ID:'fixture'}),/VOICE_SCOPE_INVALID/);
  assert.throws(()=>validate({...valid,SUPABASE_SERVICE_ROLE_KEY:'stale'}),/Invalid environment/);
  assert.throws(()=>validate({...valid,MASARIFI_STORAGE_SERVICE_KEY:'short'}),/Invalid environment/);
  assert.throws(()=>validate({...valid,MASARIFI_PROCESS_KIND:'migration'}),/Invalid environment/);
  assert.throws(()=>validate({...valid,MASARIFI_RUNTIME_SCOPE:'other'}),/Invalid environment/);
});

test('logs accepted work after the original committed promise resolves',async()=>{
  let committed=false;const records=[];
  class Repository {async idempotent(){await Promise.resolve();committed=true;return {operationId:'fixture-operation'};}}
  class Logger {info(event,fields){assert.equal(committed,true);records.push({event,...fields});}}
  hookIdempotent(Repository,Logger);
  const result=await new Repository().idempotent(null,null,null,null,202);
  assert.equal(result.operationId,'fixture-operation');assert.equal(records[0].resourceId,'fixture-operation');
});
test('bridges the SSE message id and operation id only after acceptance commits',async()=>{
 const records=[];const id='99000000-0000-4000-8000-000000000001';
 class Repository{async idempotent(){return {operationId:'99000000-0000-4000-8000-000000000002',resource:{id,content:'private-sentinel'}};}}
 class Logger{info(message,fields){records.push({message,...fields});}}
 hookIdempotent(Repository,Logger);await new Repository().idempotent(null,null,null,null,202);
 assert.deepEqual(records.map(row=>row.resourceId),['99000000-0000-4000-8000-000000000002',id]);
 assert.ok(!JSON.stringify(records).includes('sentinel'));
});

test('retains the effective exception response and sends only sanitized diagnostics',()=>{
  const records=[];const response={statusCode:200};
  class Filter {catch(){response.statusCode=503;return 'original-response';}}
  class Logger {error(event,fields){records.push({event,...fields});}}
  hookException(Filter,Logger,()=>({code:'08006'}));
  const host={switchToHttp:()=>({getResponse:()=>response,getRequest:()=>({requestId:'fixture-request'})})};
  assert.equal(new Filter().catch(Error('fixture-private-sql'),host),'original-response');
  assert.equal(records[0].requestId,'fixture-request');assert.equal(records[0].code,'08006');
  assert.equal(JSON.stringify(records).includes('fixture-private-sql'),false);
});

test('correlates storage requests while preserving authentication, cancellation and caller input',async()=>{
  const calls=[];let requestId='fixture-request';
  const fetcher=async(...args)=>{calls.push(args);return new Response('{}');};
  const correlated=correlatedFetch(fetcher,()=>requestId);
  const headers={authorization:'Bearer fixture-key',apikey:'fixture-key'};
  const signal=new AbortController().signal;
  await correlated('https://api.example.test/storage',{headers,signal});
  assert.equal(new Headers(calls[0][1].headers).get('x-request-id'),requestId);
  assert.equal(new Headers(calls[0][1].headers).get('authorization'),headers.authorization);
  assert.equal(calls[0][1].signal,signal);assert.equal(headers['x-request-id'],undefined);
  requestId=undefined;await correlated('https://api.example.test/storage',{headers});
  assert.equal(calls[1][1].headers,headers);
});
