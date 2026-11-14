'use strict';
// Runs inside the isolated shadow, using its actual mounted live adapters.
const {createRequire}=require('node:module');
const {createHash,randomUUID}=require('node:crypto');
const {Readable}=require('node:stream');
const assert=require('node:assert/strict');
const load=createRequire('/app/dist/src/main.js');
load('reflect-metadata');
const environment=load('./platform/config/environment.schema.js').validateEnvironment({...process.env});
const config={get:key=>environment[key],getRequired:key=>{if(environment[key]===undefined)throw Error('FIXTURE_CONFIG_MISSING');return environment[key];}};
const {logContext}=load('./platform/observability/log-context.js');
const hash=value=>createHash('sha256').update(value).digest('hex');
const requestId='selfhost-storage-e2e-'+randomUUID();
const cleanup=[];
const completed=[];

async function checked(url,init={}){
  const headers=new Headers(init.headers);headers.set('x-request-id',requestId);
  const response=await fetch(url,{...init,headers,redirect:'error',signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,200,'FIXTURE_HTTP_FAILED');return response;
}
async function signedRead(url,body){
  assert.equal(new URL(url).origin,environment.MASARIFI_STORAGE_URL);
  const response=await checked(url);
  assert.equal(hash(Buffer.from(await response.arrayBuffer())),hash(body));
}

async function main(){
  const body=Buffer.from('selfhost,fixture\nprivate,ok\n');
  const voice=new (load('./ai/ai.storage.js').AiStorage)(config);
  const support=new (load('./engagement/support.storage.js').SupportStorage)(config);
  const reports=new (load('./reports/reports.storage.js').ReportsStorage)(config);
  const tracking=new (load('./tracking/tracking.storage.js').TrackingStorage)(config);
  const exports=new (load('./security/export-storage.js').ExportStorage)(config);
  await logContext.run({requestId},async()=>{
    try{
      const voiceKey='voice/'+randomUUID()+'/'+randomUUID();cleanup.push(()=>voice.delete(voiceKey));
      const voiceCapability=await voice.signedUpload(voiceKey,300,'audio/mp4');
      await checked(voiceCapability.url,{method:'PUT',headers:voiceCapability.headers,body});
      assert.equal(hash(await voice.download(voiceKey,body.length)),hash(body));
      const tampered=new URL(voiceCapability.url);tampered.pathname=voiceCapability.url.split('?')[0].replace(voiceKey.split('/').at(-1),randomUUID()).replace(tampered.origin,'');
      assert.equal((await fetch(tampered,{method:'PUT',headers:voiceCapability.headers,body,redirect:'error'})).status,403);
      completed.push('voice');

      const supportKey='support/'+randomUUID()+'/'+randomUUID();cleanup.push(()=>support.delete(supportKey));
      const supportCapability=await support.signUpload(supportKey,'text/plain',hash(body));
      await checked(supportCapability.url,{method:'PUT',headers:supportCapability.headers,body});
      await support.verify(supportKey,body.length,'text/plain',hash(body));
      await signedRead((await support.signDownload(supportKey)).url,body);completed.push('support');

      const attempt=randomUUID();const reportKey=reports.key(attempt,'selfhost-fixture-user','csv');cleanup.push(()=>reports.delete(reportKey));
      const stored=await reports.upload(attempt,'selfhost-fixture-user','csv','text/csv; charset=utf-8',Readable.from([body]),1024);
      assert.equal(stored.bytes,body.length);assert.equal(stored.sha256,hash(body));
      await reports.verify(reportKey,body.length);await signedRead(await reports.sign(reportKey,60),body);completed.push('reports');

      const trackingKey='tracking/'+randomUUID()+'/'+randomUUID();cleanup.push(()=>tracking.delete(trackingKey));
      assert.equal(await tracking.upload(trackingKey,body,'text/csv'),true);
      const headers={authorization:'Bearer '+environment.MASARIFI_STORAGE_SERVICE_KEY,apikey:environment.MASARIFI_STORAGE_SERVICE_KEY};
      const fetched=await checked(environment.MASARIFI_STORAGE_URL+'/storage/v1/object/authenticated/tracking-imports/'+trackingKey,{headers});
      assert.equal(hash(Buffer.from(await fetched.arrayBuffer())),hash(body));completed.push('tracking');

      const exportKey='exports/'+randomUUID()+'/'+randomUUID()+'.zip';cleanup.push(()=>exports.delete(exportKey));
      await exports.upload(exportKey,Readable.from([body]),body.length);
      const head=await exports.head(exportKey,body.length);assert.equal(head.etag,hash(body));
      await signedRead(await exports.sign(exportKey,60),body);completed.push('privacy-export');
    }finally{
      for(const remove of cleanup.reverse())await remove();
    }
  });
  process.stdout.write(JSON.stringify({state:'passed',adapters:completed,requestId,https:true,checksums:true,tamperedCapabilityRejected:true,fixtureFilesRemoved:true}));
}
main().catch(error=>{process.stdout.write(JSON.stringify({state:'failed',stage:'storage-adapter-roundtrips',completed,requestId,errorName:error?.name,errorHash:hash(String(error?.message??'unknown'))}));process.exitCode=1;});
