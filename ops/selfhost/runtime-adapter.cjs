'use strict';

const scope = require('./runtime-scope.js');
const addedKeys = ['MASARIFI_RUNTIME_SCOPE','MASARIFI_STORAGE_PROVIDER','MASARIFI_STORAGE_URL','MASARIFI_STORAGE_SERVICE_KEY','MASARIFI_LOG_SERVICE'];
const identifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const invalid = key => { throw Error('Invalid environment variables: '+key); };

/** Keep each live validator's process, owner, epoch and provider fences intact. */
function wrapEnvironment(original) {
  if (typeof original !== 'function') throw Error('LIVE_VALIDATOR_MISSING');
  return input => {
    const local=input.MASARIFI_STORAGE_PROVIDER==='filesystem';
    const service=input.MASARIFI_LOG_SERVICE;
    if(service!==undefined && (typeof service!=='string' || !identifier.test(service)))invalid('MASARIFI_LOG_SERVICE');
    const legacy={...input};
    for(const key of addedKeys)delete legacy[key];
    if(!local) {
      if((input.MASARIFI_STORAGE_PROVIDER!==undefined && input.MASARIFI_STORAGE_PROVIDER!=='supabase') ||
         (input.MASARIFI_RUNTIME_SCOPE!==undefined && input.MASARIFI_RUNTIME_SCOPE!=='supabase-staging') ||
         input.MASARIFI_STORAGE_URL!==undefined || input.MASARIFI_STORAGE_SERVICE_KEY!==undefined)invalid('MASARIFI_STORAGE_PROVIDER');
      return {...original(legacy),MASARIFI_RUNTIME_SCOPE:'supabase-staging',MASARIFI_STORAGE_PROVIDER:'supabase',...(service?{MASARIFI_LOG_SERVICE:service}:{})};
    }
    if(input.SUPABASE_URL!==undefined || input.SUPABASE_SERVICE_ROLE_KEY!==undefined || !scope.isProjectRuntimeEnvironment(input))invalid('MASARIFI_RUNTIME_SCOPE');
    const credential=input.MASARIFI_STORAGE_SERVICE_KEY;
    const migration=input.MASARIFI_PROCESS_KIND==='migration';
    if(migration ? credential!==undefined : typeof credential!=='string' || credential.length<32 || credential.length>4096)invalid('MASARIFI_STORAGE_SERVICE_KEY');
    // Only the legacy validator sees this inert compatibility input. No runtime
    // client receives a Supabase origin or credential after validation.
    legacy.SUPABASE_URL='https://qcffvfbpzvpwcwxwjyro.supabase.co';
    if(!migration)legacy.SUPABASE_SERVICE_ROLE_KEY='selfhost-validation-placeholder-only';
    const validated=original(legacy);
    delete validated.SUPABASE_URL;delete validated.SUPABASE_SERVICE_ROLE_KEY;
    return {...validated,MASARIFI_RUNTIME_SCOPE:'project-server',MASARIFI_STORAGE_PROVIDER:'filesystem',MASARIFI_STORAGE_URL:input.MASARIFI_STORAGE_URL,...(!migration?{MASARIFI_STORAGE_SERVICE_KEY:credential}:{}),...(service?{MASARIFI_LOG_SERVICE:service}:{})};
  };
}

function hookIdempotent(Type,Logger) {
  const original=Type?.prototype.idempotent;
  if(typeof original!=='function')throw Error('LIVE_IDEMPOTENT_METHOD_MISSING');
  Type.prototype.idempotent=async function(...args){
    const result=await original.apply(this,args);
    if(args[4]===202 && typeof result?.operationId==='string' && identifier.test(result.operationId))
      new Logger().info('task.accepted',{operation:'ai.operation.accepted',resourceId:result.operationId,code:'OK'});
    if(args[4]===202 && typeof result?.resource?.id==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.resource.id))
      new Logger().info('task.accepted',{operation:'ai.resource.accepted',resourceId:result.resource.id,code:'OK'});
    return result;
  };
}

function hookException(Type,Logger,diagnose) {
  const original=Type?.prototype.catch;
  if(typeof original!=='function')throw Error('LIVE_EXCEPTION_METHOD_MISSING');
  Type.prototype.catch=function(error,host){
    const result=original.call(this,error,host);
    const http=host.switchToHttp();const response=http.getResponse();const request=http.getRequest();
    if(response.statusCode>=500)new Logger().error('http.failed',{requestId:request.requestId,httpStatus:response.statusCode,...diagnose(error)});
    return result;
  };
}

function correlatedFetch(fetcher,getRequestId) {
  return function(input,init){
    const requestId=getRequestId();
    if(!requestId)return fetcher.call(this,input,init);
    const headers=new Headers(init?.headers ?? (input instanceof Request?input.headers:undefined));
    headers.set('x-request-id',requestId);
    return fetcher.call(this,input,{...init,headers});
  };
}

function hookDatabasePool(Type,Logger,diagnose) {
  for(const name of ['connect','query','withClient']){
    const original=Type?.prototype[name];
    if(name==='connect' && typeof original!=='function')continue;
    if(typeof original!=='function')throw Error('LIVE_DATABASE_METHOD_MISSING');
    Type.prototype[name]=async function(...args){
      try{return await original.apply(this,args);}
      catch(error){new Logger().error('database.failed',{operation:'database.'+name,failureStage:name,...diagnose(error)});throw error;}
    };
  }
}

module.exports={...scope,wrapEnvironment,hookIdempotent,hookException,correlatedFetch,hookDatabasePool};
