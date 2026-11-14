'use strict';
// Instrument the existing methods only. Never inspect job payloads or lease tokens.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const identifier=/^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/;
const completions=new WeakMap();
function own(object,key){try{return Object.getOwnPropertyDescriptor(object??{},key)?.value;}catch{return undefined;}}
function accepted(response,requestId,Logger){
  const original=response.json;
  response.json=function(body){
    const result=original.call(this,body);
    if(this.statusCode!==202)return result;
    const ids=new Set();
    for(const value of [body,...['attempt','operation','job','run','import'].map(key=>own(body,key))])
      for(const key of ['id','operationId','attemptId','jobId','runId','importJobId']){
        const id=own(value,key);if(typeof id==='string'&&uuid.test(id))ids.add(id);
      }
    for(const resourceId of ids)new Logger().info('task.accepted',{requestId,resourceId,code:'OK'});
    return result;
  };
}
function install(Type,name,wrapper){
  const original=Type?.prototype[name];
  if(typeof original!=='function')throw Error('LIVE_JOB_METHOD_MISSING:'+name);
  Type.prototype[name]=wrapper(original);
}
function completion(Type,name,statusIndex,codeIndex,context){
  install(Type,name,original=>async function(...args){
    const result=await original.apply(this,args),store=context.getStore();
    if(store&&result!==false){
      const status=args[statusIndex],code=args[codeIndex];
      if(typeof status==='string')completions.set(store,{failed:['failed','rejected','cancelled','conflict'].includes(status),code:typeof code==='string'&&identifier.test(code)?code:undefined});
    }
    return result;
  });
}
function job(Type,name,idFields,jobName,context,Logger,diagnose,{booleanResult=false,reports=false}={}){
  install(Type,name,original=>function(...args){
    const claim=args[0];
    const id=reports?args[1]:idFields.map(key=>own(claim,key)).find(value=>typeof value==='string'&&uuid.test(value));
    if(typeof id!=='string'||!uuid.test(id))return original.apply(this,args);
    const kind=reports?args[0]:(own(claim,'jobKey')??jobName);
    const scope={requestId:id,jobName:typeof kind==='string'&&identifier.test(kind)?kind:jobName,resourceId:id};
    return context.run(scope,async()=>{
      const started=performance.now(),logger=new Logger();logger.info('job.started',scope);
      try{
        const call=[...args];
        if(reports){const action=call[2];call[2]=async function(...values){const result=await action.apply(this,values);completions.set(scope,{failed:own(result,'status')==='failed',code:own(result,'errorCode')});return result;};}
        const result=await original.apply(this,call),outcome=completions.get(scope);
        const failed=outcome?.failed||(booleanResult&&result===false);
        logger[failed?'error':'info']('job.finished',{...scope,outcome:failed?'failure':'success',code:typeof outcome?.code==='string'&&identifier.test(outcome.code)?outcome.code:failed?'JOB_FAILED':'OK',durationMs:Math.round(performance.now()-started)});
        return result;
      }catch(error){logger.error('job.failed',{...scope,...diagnose(error),durationMs:Math.round(performance.now()-started)});throw error;}
      finally{completions.delete(scope);}
    });
  });
}
module.exports={accepted,completion,job};
