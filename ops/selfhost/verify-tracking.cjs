'use strict';
const {createRequire}=require('node:module');
const {createHash,randomUUID}=require('node:crypto');
const fs=require('node:fs');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const load=createRequire('/app/dist/src/main.js');
const clerk=load('@clerk/backend').createClerkClient({secretKey:process.env.CLERK_SECRET_KEY,telemetry:{disabled:true,debug:false,samplingRate:0}});
const hash=value=>createHash('sha256').update(value).digest('hex');
async function main(){
 const owners=[];
 for(const owner of input.owners){
  const page=await clerk.sessions.getSessionList({userId:owner,status:'active',limit:1});const sessions=page.data??page;
  if(!Array.isArray(sessions)||!sessions.length)continue;
  const token=await clerk.sessions.getToken(sessions[0].id);const checks=[];
  for(const path of ['/tracking/status','/tracking/preferences','/tracking/keyword-rules','/tracking/sender-rules','/tracking/history']){
   const requestId='selfhost-tracking-'+randomUUID();const response=await fetch(input.origin+'/api/v1'+path,{headers:{authorization:'Bearer '+token.jwt,'x-request-id':requestId},redirect:'error',signal:AbortSignal.timeout(15000)});const data=await response.json();
   if(!response.ok)throw Error('TRACKING_READ_FAILED:'+response.status);
   if(path==='/tracking/status'){
    if(typeof data.available!=='boolean'||!['paused','review_all','automatic_clear'].includes(data.mode)||!Number.isSafeInteger(data.activeKeywordCount))throw Error('TRACKING_STATUS_INVALID');
    checks.push({path,status:response.status,available:data.available,mode:data.mode,requestId});
   }else checks.push({path,status:response.status,requestId});
  }
  owners.push({subjectHash:hash(owner),checks});if(owners.length===2)break;
 }
 if(owners.length!==2)throw Error('TWO_OWNERS_REQUIRED');
 process.stdout.write(JSON.stringify({state:'passed',owners,readOnly:true,permissionsChanged:false,financialWrites:false}));
}
main().catch(error=>{process.stdout.write(JSON.stringify({state:'failed',errorHash:hash(String(error?.message??'unknown'))}));process.exitCode=1;});
