'use strict';
// Read only the disposable fixture results. Never print capabilities or content.
const {createRequire}=require('node:module'),{createHash,randomUUID}=require('node:crypto');
const load=createRequire('/app/dist/src/main.js'),assert=require('node:assert/strict');
const input=JSON.parse(require('node:fs').readFileSync(0,'utf8'));
const clerk=load('@clerk/backend').createClerkClient({secretKey:process.env.CLERK_SECRET_KEY,telemetry:{disabled:true,samplingRate:0}});
let stage='session',status,code;const requestIds=[];
async function main(){
 const fixture=input.fixture;
 async function call(path){
  const requestId='selfhost-feature-results-'+randomUUID();requestIds.push(requestId);
  const token=(await clerk.sessions.getToken(fixture.session)).jwt;
  const response=await fetch(input.origin+path,{headers:{authorization:'Bearer '+token,'x-request-id':requestId},signal:AbortSignal.timeout(30000),redirect:'error'});
  status=response.status;const body=await response.json();code=typeof body?.code==='string'?body.code:undefined;
  assert.equal(status,200,'FEATURE_RESULT_API_REJECTED');return body;
 }
 stage='report-ready';const report=await call('/api/v1/reports/'+fixture.reportId);
 assert.ok(['ready','delivered'].includes(report.status),'REPORT_NOT_READY');
 const url=new URL(report.downloadUrl);assert.equal(url.origin,'https://api.masarifiratibi.com');
 stage='report-download';const pdf=await fetch(url,{signal:AbortSignal.timeout(30000),redirect:'error'});
 assert.equal(pdf.status,200);assert.equal(pdf.headers.get('content-type')?.split(';')[0],'application/pdf');
 const bytes=Buffer.from(await pdf.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
 const digest=createHash('sha256').update(bytes).digest('hex');assert.equal(pdf.headers.get('etag')?.replaceAll('"',''),digest);
 stage='assistant-result';const assistant=await call('/api/v1/assistant/conversations/'+fixture.conversationId+'/messages/'+fixture.assistantMessageId+'/result');
 assert.equal(assistant.status,'completed','ASSISTANT_NOT_COMPLETED');assert.ok(typeof assistant.response?.content==='string'&&assistant.response.content.trim().length>0,'ASSISTANT_CONTENT_MISSING');
 stage='voice-result';const voice=await call('/api/v1/voice/sessions/'+fixture.voiceSessionId);
 assert.ok(['proposed','confirmed'].includes(voice.status),'VOICE_NOT_PROPOSED');
 const recovery=await call('/api/v1/voice/sessions/'+fixture.voiceSessionId+'/recovery');
 assert.ok(recovery.proposal&&typeof recovery.proposal.id==='string','VOICE_PROPOSAL_MISSING');
 assert.ok(recovery.proposal.payload&&Array.isArray(recovery.proposal.fields),'VOICE_EXTRACTION_MISSING');
 process.stdout.write(JSON.stringify({state:'passed',requestIds,report:{ready:true,projectHttps:true,pdfMagic:true,bytes:bytes.length,checksumVerified:true},assistant:{completed:true,contentPresent:true},voice:{status:voice.status,extractionPresent:true},sourceChanged:false}));
}
main().catch(error=>{process.stdout.write(JSON.stringify({state:'failed',stage,status,code,errorHash:createHash('sha256').update(String(error?.message??'unknown')).digest('hex')}));process.exitCode=1;});
