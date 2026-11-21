'use strict';
// Only disposable target fixtures. No session creation or external messages.
const {createRequire}=require('node:module'),{createHash,randomUUID}=require('node:crypto');
const load=createRequire('/app/dist/src/main.js'),assert=require('node:assert/strict');
const input=JSON.parse(require('node:fs').readFileSync(0,'utf8'));
const clerk=load('@clerk/backend').createClerkClient({secretKey:process.env.CLERK_SECRET_KEY,telemetry:{disabled:true,samplingRate:0}});
let stage='session',status,code,shape;const requestIds=[];
async function main(){
 let owner,session;
 for(const candidate of input.owners){const page=await clerk.sessions.getSessionList({userId:candidate,status:'active',limit:1}).catch(()=>({data:[]}));const current=(page.data??page)[0];if(current){owner=candidate;session=current.id;break;}}
 assert.ok(session);let generation;
 async function call(path,method='GET',body,extra={}){
  const requestId='selfhost-features-'+randomUUID();requestIds.push(requestId);
  const token=(await clerk.sessions.getToken(session)).jwt;
  const response=await fetch(input.origin+path,{method,headers:{authorization:'Bearer '+token,'x-request-id':requestId,...(method!=='GET'?{'idempotency-key':randomUUID()}:{}),...(generation!==undefined?{'x-financial-generation':String(generation)}:{}),...(body?{'content-type':'application/json'}:{}),...extra},...(body?{body:Buffer.isBuffer(body)?body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000),redirect:'error'});
  status=response.status;const value=await response.json();code=typeof value?.code==='string'?value.code:undefined;shape=Object.keys(value??{});
  assert.ok(status>=200&&status<300,'FEATURE_API_REJECTED');return value;
 }
 stage='generation';generation=(await call('/api/v1/me/financial-reset/state')).generation;
 stage='report-capture';
 const today=new Date().toISOString().slice(0,10);
 const report=await call('/api/v1/reports','POST',{type:'financial_summary',periodStart:today.slice(0,8)+'01',periodEnd:today,format:'pdf',delivery:'download'});
 assert.ok(report.attemptId);
 stage='assistant-conversation';const conversation=await call('/api/v1/assistant/conversations','POST',{title:'Selfhost migration QA'});assert.ok(conversation.id);
 stage='assistant-message';
 const assistant=await call('/api/v1/assistant/conversations/'+conversation.id+'/messages','POST',{content:'كيف أبدأ بتنظيم ميزانية شهرية بسيطة؟',contextScope:[],responseMode:'async'});
 assert.ok(assistant.id);
 stage='voice-create';const audio=Buffer.from(input.audioBase64,'base64');
 const audioHash=createHash('sha256').update(audio).digest('hex');
 const voice=await call('/api/v1/voice/sessions','POST',{locale:'ar',durationMs:Math.floor((audio.length-44)/32),contentType:'audio/wav',sizeBytes:audio.length,contentHash:audioHash,recordedAt:new Date().toISOString(),timezoneOffsetMinutes:180},{'x-voice-contract':'2'});
 assert.ok(voice.session?.id&&voice.upload?.path);
 stage='voice-upload';await call(voice.upload.path,'PUT',audio,{'content-type':'audio/wav','content-length':String(audio.length)});
 const uploaded=await call('/api/v1/voice/sessions/'+voice.session.id);
 stage='voice-process';await call('/api/v1/voice/sessions/'+voice.session.id+'/process','POST',{uploadCompleted:true,expectedVersion:uploaded.version,contentHash:audioHash});
 process.stdout.write(JSON.stringify({state:'fixtures-created',requestIds,reportCaptured:true,assistantQueued:true,voiceUploadedAndQueued:true,_private:{owner,generation,session,reportId:report.attemptId,conversationId:conversation.id,assistantMessageId:assistant.id,voiceSessionId:voice.session.id}}));
}
main().catch(error=>{process.stdout.write(JSON.stringify({state:'failed',stage,status,code,responseKeys:shape,requestIds,errorHash:createHash('sha256').update(String(error?.message??'unknown')).digest('hex')}));process.exitCode=1;});
