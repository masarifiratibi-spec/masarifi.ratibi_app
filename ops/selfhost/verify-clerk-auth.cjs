'use strict';
const {createRequire}=require('node:module');
const {createHash,randomUUID}=require('node:crypto');
const fs=require('node:fs');
const load=createRequire('/app/dist/src/main.js');
const hash=value=>createHash('sha256').update(value).digest('hex');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const {createClerkClient}=load('@clerk/backend');
const clerk=createClerkClient({secretKey:process.env.CLERK_SECRET_KEY,...(process.env.CLERK_PUBLISHABLE_KEY?{publishableKey:process.env.CLERK_PUBLISHABLE_KEY}:{}),telemetry:{disabled:true,debug:false,samplingRate:0}});

async function main(){
  const records=[];let providerErrors=0;let activeOwners=0;
  for(const owner of input.owners){
    let sessions;
    try{const page=await clerk.sessions.getSessionList({userId:owner,status:'active',limit:1});sessions=page.data??page;}
    catch{providerErrors++;continue;}
    if(!Array.isArray(sessions)||!sessions.length)continue;
    activeOwners++;
    try{
      const token=await clerk.sessions.getToken(sessions[0].id);
      if(typeof token.jwt!=='string')throw Error('SESSION_TOKEN_MISSING');
      const claims=JSON.parse(Buffer.from(token.jwt.split('.')[1],'base64url').toString());
      const requestId='selfhost-clerk-auth-'+randomUUID();
      const response=await fetch(input.origin+'/api/v1/me',{headers:{authorization:'Bearer '+token.jwt,'x-request-id':requestId},redirect:'error',signal:AbortSignal.timeout(15000)});
      const profile=await response.json();
      records.push({subjectHash:hash(owner),status:response.status,requestId,sessionSubjectMatches:claims.sub===owner,roleAuthenticated:claims.role==='authenticated',profileIdentityMatches:response.ok&&profile.id===owner,...(!response.ok?{code:typeof profile.code==='string'&&/^[A-Z0-9_]{1,80}$/.test(profile.code)?profile.code:'AUTH_PROBE_FAILED'}:{})});
    }catch(error){records.push({subjectHash:hash(owner),status:0,errorHash:hash(String(error?.message??'unknown'))});}
    if(records.filter(r=>r.status===200&&r.profileIdentityMatches).length>=2)break;
  }
  const successful=records.filter(r=>r.status===200&&r.profileIdentityMatches&&r.roleAuthenticated&&r.sessionSubjectMatches).length;
  process.stdout.write(JSON.stringify({state:successful>=2?'passed':'requires-auth-investigation',eligibleProfiles:input.owners.length,activeOwners,providerErrors,successfulLogins:successful,records,sessionCreation:false,persistedTokens:false}));
  if(successful<2)process.exitCode=2;
}
main().catch(error=>{process.stdout.write(JSON.stringify({state:'failed',stage:'clerk-auth-probe',errorHash:hash(String(error?.message??'unknown'))}));process.exitCode=1;});
