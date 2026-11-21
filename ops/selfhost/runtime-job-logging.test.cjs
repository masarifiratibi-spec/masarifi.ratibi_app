'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {AsyncLocalStorage}=require('node:async_hooks');
const {accepted,completion,job}=require('./runtime-job-logging.cjs');
const id='99000000-0000-4000-8000-000000000001';
test('links only accepted UUID identifiers without touching payload accessors',()=>{
 const records=[],response={statusCode:202,json(body){this.body=body;return this;}};
 class Logger{info(message,fields){records.push({message,...fields});}}
 accepted(response,'parent-request',Logger);
 const body={attempt:{id},payload:'financial-sentinel',get job(){throw Error('must not access');}};
 assert.equal(response.json(body),response);assert.equal(response.body,body);
 assert.deepEqual(records,[{message:'task.accepted',requestId:'parent-request',resourceId:id,code:'OK'}]);
});
test('retains swallowed job failure and scopes the database completion to its durable ID',async()=>{
 const context=new AsyncLocalStorage(),records=[];
 class Logger{info(message,fields){records.push({message,...fields});}error(message,fields){this.info(message,fields);}}
 class Repository{async complete(...args){assert.equal(context.getStore().requestId,id);return true;}}
 class Worker{async execute(claim){await new Repository().complete(claim.attemptId,'lease-token','failed','JOB_TIMEOUT',{});return 'unchanged';}}
 completion(Repository,'complete',2,3,context);job(Worker,'execute',['attemptId'],'operations.job',context,Logger,()=>({}));
 assert.equal(await new Worker().execute({attemptId:id,payload:'private-sentinel'}),'unchanged');
 assert.equal(records.at(-1).outcome,'failure');assert.equal(records.at(-1).code,'JOB_TIMEOUT');
 assert.equal(context.getStore(),undefined);assert.ok(!JSON.stringify(records).includes('sentinel'));
});
test('reports success is logged after the repository commits and preserves thrown errors',async()=>{
 const context=new AsyncLocalStorage(),records=[];let committed=false;
 class Logger{info(message,fields){if(message==='job.finished')assert.ok(committed);records.push({message,...fields});}error(...args){this.info(...args);}}
 class Repository{async withWorkLock(kind,value,action){await action({id:value});committed=true;return true;}}
 job(Repository,'withWorkLock',[],'report.work',context,Logger,()=>({code:'SAFE'}),{reports:true});
 assert.equal(await new Repository().withWorkLock('report.generate',id,async()=>({status:'ready',storageRef:'private-sentinel'})),true);
 const error=Error('private-sentinel');await assert.rejects(new Repository().withWorkLock('report.generate',id,async()=>{throw error;}),value=>value===error);
 assert.equal(records.at(-1).code,'SAFE');assert.ok(!JSON.stringify(records).includes('sentinel'));
});
test('AI claim id creates the same durable correlation without an operationId field',async()=>{
 const context=new AsyncLocalStorage(),records=[];
 class Logger{info(message,fields){records.push({message,...fields});}error(...args){this.info(...args);}}
 class AiWorker{async process(claim){assert.equal(context.getStore().requestId,claim.id);return true;}}
 job(AiWorker,'process',['operationId','id'],'ai.process',context,Logger,()=>({}),{booleanResult:true});
 assert.equal(await new AiWorker().process({id,kind:'voice.transcribe_extract',user_id:'fixture-owner',claim_token:'private-token',attempt_count:1}),true);
 assert.equal(records.at(-1).requestId,id);assert.ok(!JSON.stringify(records).includes('private-token'));
});
