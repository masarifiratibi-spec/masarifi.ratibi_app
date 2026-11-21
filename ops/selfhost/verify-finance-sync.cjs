'use strict';
// Disposable rehearsal writes only. Receipts contain no balances, amounts or tokens.
const {createRequire}=require('node:module');
const {createHash,randomUUID}=require('node:crypto');
const http=require('node:http');
const https=require('node:https');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const load=createRequire('/app/dist/src/main.js');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const {createClerkClient}=load('@clerk/backend');
const clerk=createClerkClient({secretKey:process.env.CLERK_SECRET_KEY,...(process.env.CLERK_PUBLISHABLE_KEY?{publishableKey:process.env.CLERK_PUBLISHABLE_KEY}:{}),telemetry:{disabled:true,debug:false,samplingRate:0}});
let stage='sessions',lastStatus,lastCode,lastShape;
const requestIds=[];

async function main(){
  const owners=[];
  for(const owner of input.owners){
    const page=await clerk.sessions.getSessionList({userId:owner,status:'active',limit:1}).catch(()=>({data:[]}));
    const session=(page.data??page)[0];
    if(session)owners.push({owner,session:session.id});
    if(owners.length===2)break;
  }
  assert.equal(owners.length,2);
  const generations=new Map();
  async function headers(who,key,device){
    const jwt=(await clerk.sessions.getToken(owners[who].session)).jwt;
    const requestId='selfhost-finance-'+randomUUID();requestIds.push(requestId);
    return {authorization:'Bearer '+jwt,'x-request-id':requestId,...(key?{'idempotency-key':key}:{}),...(device?{'x-device-id':device}:{}),...(generations.get(who)?{'x-financial-generation':generations.get(who)}:{})};
  }
  async function api(who,path,method='GET',body,key=randomUUID(),device){
    const response=await fetch(input.origin+path,{method,headers:{...await headers(who,method==='GET'?undefined:key,device),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(20000)});
    lastStatus=response.status;
    const value=response.status===204?null:await response.json();
    lastShape=value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,item&&typeof item==='object'&&!Array.isArray(item)?Object.keys(item):typeof item])):typeof value;
    lastCode=typeof value?.code==='string'&&/^[A-Z0-9_]{1,80}$/.test(value.code)?value.code:undefined;
    if(response.headers.get('x-financial-generation'))generations.set(who,response.headers.get('x-financial-generation'));
    return {status:response.status,value};
  }
  async function ok(who,path,method='GET',body,key,device){
    const result=await api(who,path,method,body,key,device);
    assert.ok(result.status>=200&&result.status<300,'FIXTURE_API_REJECTED');return result.value;
  }
  async function loseBody(who,path,body,key,device,expectedStatus){
    const text=JSON.stringify(body);
    const h={...await headers(who,key,device),'content-type':'application/json','content-length':String(Buffer.byteLength(text))};
    await new Promise((resolve,reject)=>{
      const url=new URL(input.origin+path);
      const request=(url.protocol==='https:'?https:http).request(url,{method:'POST',headers:h},response=>{
        const status=response.statusCode;response.destroy();
        status===expectedStatus?resolve():reject(Error('LOST_RESPONSE_STATUS_UNEXPECTED'));
      });
      request.setTimeout(20000,()=>request.destroy(Error('FIXTURE_TIMEOUT')));request.on('error',reject);request.end(text);
    });
  }
  async function balance(id){const value=await ok(0,'/api/v1/accounts/'+id+'/summary');return Number(value.balance?.confirmedMinor);}
  if(!input.fixture){
  stage='profile-and-home';
  await ok(0,'/api/v1/me');await ok(1,'/api/v1/me');
  for(const who of [0,1]){
    const state=await ok(who,'/api/v1/me/financial-reset/state');
    assert.ok(Number.isSafeInteger(state.generation)&&state.generation>=0);
    generations.set(who,String(state.generation));
  }
  await ok(0,'/api/v1/dashboard/home?period=monthly');
  stage='device-and-bootstrap';
  const registered=await ok(0,'/api/v1/me/devices/register','POST',{deviceFingerprint:'selfhost-rehearsal-'+randomUUID(),platform:'android',appVersion:'selfhost.20261113',deviceName:'Selfhost rehearsal'});
  const device=registered.deviceId;assert.ok(typeof device==='string');
  const bootstrap=await ok(0,'/api/v1/sync/bootstrap?domains=accounts&limit=1','GET',undefined,undefined,device);
  const generation=bootstrap.financialGeneration??bootstrap.generation??bootstrap.metadata?.financialGeneration;
  if(typeof generation==='string')generations.set(0,generation);
  stage='accounts';
  const suffix=randomUUID().slice(0,8);
  const first=await ok(0,'/api/v1/accounts','POST',{name:'Selfhost QA A '+suffix,type:'cash',currency:'SAR',openingBalanceMinor:0});
  const second=await ok(0,'/api/v1/accounts','POST',{name:'Selfhost QA B '+suffix,type:'cash',currency:'SAR',openingBalanceMinor:0});
  const a=first.account?.id??first.id,b=second.account?.id??second.id;assert.ok(a&&b);
  await ok(0,'/api/v1/accounts');
  stage='income';
  await ok(0,'/api/v1/transactions','POST',{kind:'income',amountMinor:1000,currency:'SAR',accountId:a,title:'Selfhost QA income',occurredAt:new Date().toISOString()});
  stage='lost-response-replay';
  const expense={kind:'expense',amountMinor:100,currency:'SAR',accountId:a,title:'Selfhost QA expense',occurredAt:new Date().toISOString()};
  const expenseKey=randomUUID();
  await loseBody(0,'/api/v1/transactions',expense,expenseKey,undefined,201);
  const replay=await ok(0,'/api/v1/transactions','POST',expense,expenseKey);
  assert.ok(replay.transaction?.transaction?.id);
  stage='transfer';
  await ok(0,'/api/v1/transfers','POST',{sourceAccountId:a,destinationAccountId:b,amountMinor:200,currency:'SAR',feeMinor:0,title:'Selfhost QA transfer',occurredAt:new Date().toISOString()});
  assert.equal(await balance(a),700);assert.equal(await balance(b),200);
  stage='sync-lost-response-replay';
  const batch={mutations:[{operationId:randomUUID(),domain:'transactions',resourceType:'transaction',schemaVersion:1,dependsOn:[],operation:'create',payload:{kind:'expense',amountMinor:7,currency:'SAR',accountId:a,title:'Selfhost QA offline replay',occurredAt:new Date().toISOString()}}]};
  const batchKey=randomUUID();
  await loseBody(0,'/api/v1/sync/mutations',batch,batchKey,device,200);
  await ok(0,'/api/v1/sync/mutations','POST',batch,batchKey,device);
  await ok(0,'/api/v1/sync/mutations','POST',batch,randomUUID(),device);
  process.stdout.write(JSON.stringify({state:'queued-for-worker',home:true,accounts:true,transaction:true,transfer:true,lostResponseReplayWithoutDuplicates:true,syncBatchReplayedWithSameAndNewBatchKey:true,requestIds,_private:{owner:owners[0].owner,a,b,transactionId:replay.transaction.transaction.id,device,mutationOperationId:batch.mutations[0].operationId,batch,generation:generations.get(0)}}));
  return;
  }
  const {a,b,transactionId,batch,device}=input.fixture;
  assert.equal(owners[0].owner,input.fixture.owner,'FIXTURE_OWNER_CHANGED');
  generations.set(0,input.fixture.generation);
  stage='sync-final-replay';
  const receipt=await ok(0,'/api/v1/sync/mutations','POST',batch,randomUUID(),device);
  assert.equal(receipt.data?.receipts?.[0]?.status,'applied','SYNC_FIXTURE_NOT_APPLIED');
  assert.equal(await balance(a),693);assert.equal(await balance(b),200);
  stage='two-owner-isolation';
  const denied=await api(1,'/api/v1/accounts/'+a);assert.ok([403,404].includes(denied.status));
  const other=await ok(1,'/api/v1/accounts');assert.ok(!(other.items??[]).some(account=>account.id===a||account.id===b));
  assert.ok([403,404].includes((await api(1,'/api/v1/transactions/'+transactionId)).status));
  process.stdout.write(JSON.stringify({state:'passed',home:true,accounts:true,transaction:true,transfer:true,balancesVerified:true,lostResponseReplayWithoutDuplicates:true,syncBatchReplayedWithSameAndNewBatchKey:true,twoOwnerIsolation:true,requestIds,rehearsalOnly:true,externalMessagesSent:false}));
}
main().catch(error=>{process.stdout.write(JSON.stringify({state:'failed',stage,lastStatus,lastCode,responseShape:lastShape,errorHash:hash(String(error?.message??'unknown')),requestIds,rehearsalOnly:true}));process.exitCode=1;});
