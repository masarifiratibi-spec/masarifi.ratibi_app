"""Stage narrow changes to effective live JS and validate without deploying it."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess as sp

ROOT=Path('/var/tmp/masarifi-selfhost-20261113')
HELPER="require('/app/selfhost/runtime-adapter.cjs')"
PIN=re.escape('https://qcffvfbpzvpwcwxwjyro.supabase.co')
STORAGE={'ai/ai.storage.js','engagement/support.storage.js','reports/reports.storage.js','security/export-storage.js','tracking/tracking.storage.js','reports/reports.smtp.js'}
NODE=r"""
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
Object.assign(process.env,input.environment);
for(const [name,text] of Object.entries(input.files))new vm.Script(text,{filename:name});
function evaluate(text,requireFunction){const mod={exports:{}};new Function('require','module','exports',text)(requireFunction,mod,mod.exports);return mod.exports;}
const scope=evaluate(input.scope,require);
const adapter=evaluate(input.adapter,name=>{if(name==='./runtime-scope.js')return scope;throw Error('UNEXPECTED_ADAPTER_IMPORT');});
const requireRuntime=require('node:module').createRequire(input.root+'/main.js');
requireRuntime('reflect-metadata');
class ProbeLogger {info(){} error(){}}
adapter.hookDatabasePool(requireRuntime('./platform/database/pool.service.js').PoolService,ProbeLogger,()=>({}));
adapter.hookIdempotent(requireRuntime('./ai/ai.repository.js').AiRepository,ProbeLogger);
adapter.hookException(requireRuntime('./platform/http/safe-exception.filter.js').SafeExceptionFilter,ProbeLogger,()=>({}));
for(const [file,type,methods] of [['ai/ai.worker.js','AiWorker',['process']],['operations/operations.worker.js','OperationsWorker',['execute']],['operations/operations.repository.js','OperationsRepository',['complete']],['tracking/tracking.worker.js','TrackingWorker',['process','processCorpus']],['tracking/tracking.repository.js','TrackingRepository',['completeImport']],['reports/reports.repository.js','ReportsRepository',['withWorkLock']]]){
 const implementation=requireRuntime('./'+file)[type];for(const method of methods)assert.equal(typeof implementation?.prototype[method],'function',file+':'+method);
}
const original=require(input.root+'/platform/config/environment.schema.js').validateEnvironment;
const baseline=original({...process.env});
const environment={...process.env,MASARIFI_RUNTIME_SCOPE:'project-server',MASARIFI_STORAGE_PROVIDER:'filesystem',MASARIFI_STORAGE_URL:'https://api.masarifiratibi.com',MASARIFI_STORAGE_SERVICE_KEY:Buffer.alloc(32,1).toString('base64url'),MASARIFI_LOG_SERVICE:input.service};
delete environment.SUPABASE_URL;delete environment.SUPABASE_SERVICE_ROLE_KEY;
const validated=adapter.wrapEnvironment(original)(environment);
for(const [key,value] of Object.entries(baseline))if(!['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'].includes(key))assert.deepEqual(validated[key],value,key);
assert.equal(validated.SUPABASE_URL,undefined);assert.equal(validated.SUPABASE_SERVICE_ROLE_KEY,undefined);
assert.equal(scope.isProjectRuntimeEnvironment(validated),true);
assert.throws(()=>adapter.wrapEnvironment(original)({...environment,SUPABASE_URL:'https://stale.example.test'}));
process.stdout.write(JSON.stringify({state:'passed',modules:Object.keys(input.files).length,configurationFencesPreserved:true}));
"""


def substitute(text,pattern,replacement,count=1):
    changed,n=re.subn(pattern,replacement,text)
    assert n==count,'RUNTIME_PATTERN_DRIFT: '+pattern
    return changed


def patch(name,text):
    if name=='platform/config/environment.schema.js':
        assert text.count('exports.validateEnvironment = validateEnvironment;')==1
        return text+'\nexports.validateEnvironment = '+HELPER+'.wrapEnvironment(exports.validateEnvironment);\n'
    for base in ('this.config','config'):
        pattern=re.escape(base)+r"\.get\('SUPABASE_URL'\)\s*(===|!==)\s*'"+PIN+"'"
        text=re.sub(pattern,lambda m:('!' if m[1]=='!==' else '')+HELPER+'.isProjectRuntime('+base+')',text)
    for base in ('config','process.env'):
        pattern=re.escape(base)+r"\.SUPABASE_URL\s*(===|!==)\s*'"+PIN+"'"
        text=re.sub(pattern,lambda m:('!' if m[1]=='!==' else '')+HELPER+'.isProjectRuntimeEnvironment('+base+')',text)
    if name in STORAGE:
        assert "config.getRequired('SUPABASE_URL')" in text
        text=text.replace("config.getRequired('SUPABASE_URL')","config.getRequired('MASARIFI_STORAGE_URL')")
        text=text.replace("config.getRequired('SUPABASE_SERVICE_ROLE_KEY')","config.getRequired('MASARIFI_STORAGE_SERVICE_KEY')")
        if name!='reports/reports.smtp.js':
            text=substitute(text,re.escape("this.credential = config.getRequired('MASARIFI_STORAGE_SERVICE_KEY');"),lambda m:m[0]+"\n        this.fetcher = "+HELPER+".correlatedFetch(this.fetcher, () => require('../platform/observability/log-context').logContext.getStore()?.requestId);")
    if name=='ai/ai.storage.js':
        text=substitute(text,r'body: JSON.stringify\(\{\s*upsert: false\s*\}\)',"body: JSON.stringify({ upsert: false, contentType, expiresIn: _seconds })")
        text=substitute(text,r'Date\.now\(\)\s*\+\s*7_200\s*\*\s*1_000','Date.now() + _seconds * 1_000')
    if name=='engagement/support.storage.js':
        text=substitute(text,r'(`/storage/v1/object/upload/sign/support-attachments/\$\{this\.encoded\(key\)\}`,\s*)\{\s*method: \'POST\',?\s*\}',r"\1{method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({contentType, sha256, expiresIn: this.ttl})}")
    if name=='platform/http/request-id.middleware.js':
        text=substitute(text,r"response.setHeader\('X-Request-Id', requestId\);",lambda m:m[0]+"\n        require('/app/selfhost/runtime-job-logging.cjs').accepted(response, requestId, require('../observability/platform-logger').PlatformLogger);")
        text=substitute(text,r"response.setHeader\('X-Request-Id', requestId\);",lambda m:m[0]+"\n        const selfhostStarted = performance.now();\n        response.once('finish', () => new (require('../observability/platform-logger').PlatformLogger)().info('http.completed', {requestId, operation: 'http.'+request.method.toLowerCase(), httpStatus: response.statusCode, durationMs: Math.round(performance.now()-selfhostStarted), code: response.statusCode<400?'OK':'HTTP_'+response.statusCode}));")
        text=substitute(text,r'use = \(request, response, next\) => \{',lambda m:m[0]+"\n        const selfhostNext = next;\n        next = (...args) => require('../observability/log-context').logContext.run({requestId: request.requestId}, () => selfhostNext(...args));")
    if name=='platform/http/safe-exception.filter.js':
        text+='\n'+HELPER+".hookException(exports.SafeExceptionFilter, require('../observability/platform-logger').PlatformLogger, require('/app/selfhost/worker-error.js').workerErrorFields);\n"
    if name=='platform/database/pool.service.js':
        text+='\n'+HELPER+".hookDatabasePool(exports.PoolService, require('../observability/platform-logger').PlatformLogger, require('/app/selfhost/worker-error.js').workerErrorFields);\n"
    if name=='ai/ai.repository.js':
        assert 'async idempotent(' in text
        text+='\n'+HELPER+".hookIdempotent(exports.AiRepository, require('../platform/observability/platform-logger').PlatformLogger);\n"
    if name=='ai/assistant-agent.worker.js':
        text=text.replace("this.logger.info('AI_PROVIDER_ATTEMPT', fields);","this.logger.info('AI_PROVIDER_ATTEMPT', {...fields,requestId:claim.operationId,jobName:'assistant.respond'});")
        for event,level in [('ASSISTANT_AGENT_STAGE','info'),('ASSISTANT_AGENT_FINISHED','info'),('ASSISTANT_AGENT_FAILED','error')]:
            needle="this.logger."+level+"('"+event+"', {"
            assert text.count(needle)==1,'ASSISTANT_LOG_SHAPE_DRIFT'
            text=text.replace(needle,needle+"requestId:claim.operationId,jobName:'assistant.respond',")
    job_prefix="\nconst selfhostJobs=require('/app/selfhost/runtime-job-logging.cjs'),selfhostContext=require('../platform/observability/log-context').logContext,selfhostLogger=require('../platform/observability/platform-logger').PlatformLogger,selfhostDiagnose=require('/app/selfhost/worker-error.js').workerErrorFields;\n"
    jobs={
        'ai/ai.worker.js':"selfhostJobs.job(exports.AiWorker,'process',['operationId','id'],'ai.process',selfhostContext,selfhostLogger,selfhostDiagnose,{booleanResult:true});",
        'operations/operations.worker.js':"selfhostJobs.job(exports.OperationsWorker,'execute',['runId','attemptId'],'operations.job',selfhostContext,selfhostLogger,selfhostDiagnose);",
        'operations/operations.repository.js':"selfhostJobs.completion(exports.OperationsRepository,'complete',2,3,selfhostContext);",
        'tracking/tracking.worker.js':"selfhostJobs.job(exports.TrackingWorker,'process',['id'],'import.parse',selfhostContext,selfhostLogger,selfhostDiagnose);selfhostJobs.job(exports.TrackingWorker,'processCorpus',['id'],'parser.corpus',selfhostContext,selfhostLogger,selfhostDiagnose);",
        'tracking/tracking.repository.js':"selfhostJobs.completion(exports.TrackingRepository,'completeImport',2,3,selfhostContext);",
        'reports/reports.repository.js':"selfhostJobs.job(exports.ReportsRepository,'withWorkLock',[],'report.work',selfhostContext,selfhostLogger,selfhostDiagnose,{reports:true});",
    }
    if name in jobs:text+=job_prefix+jobs[name]+'\n'
    assert 'SUPABASE_URL' not in text and 'SUPABASE_SERVICE_ROLE_KEY' not in text and '.supabase.co' not in text,'UNPATCHED_PROVIDER_REFERENCE: '+name
    return text


def main():
    os.umask(0o077)
    assert json.loads((ROOT/'catalog-comparison-qualified.json').read_text())['state']=='passed'
    consumers=json.loads((ROOT/'runtime-originals.json').read_text())
    adapter=(ROOT/'runtime-adapter.cjs').read_text()
    build=ROOT/'compiled'
    scope=(build/'platform/config/runtime-scope.js').read_text()
    report=[]
    for consumer in consumers:
        assert consumer['root']=='/app/dist/src','UNRECOGNIZED_RUNTIME_ROOT'
        directory=ROOT/'runtime-candidates'/consumer['id'][:12]
        directory.mkdir(mode=0o700,parents=True,exist_ok=True)
        files={};manifest={}
        for name,metadata in consumer['files'].items():
            original=(ROOT/'runtime-originals'/consumer['id'][:12]/name).read_bytes()
            assert hashlib.sha256(original).hexdigest()==metadata['sha256']
            updated=patch(name,original.decode())
            if name=='platform/observability/platform-logger.js':updated=(build/name).read_text()
            if updated!=original.decode():files[name]=updated
        files['platform/observability/log-context.js']=(build/'platform/observability/log-context.js').read_text()
        for name,updated in files.items():
            target=directory/name;target.parent.mkdir(mode=0o700,parents=True,exist_ok=True);target.write_text(updated)
            manifest[name]={'sha256':hashlib.sha256(updated.encode()).hexdigest(),'bytes':len(updated.encode())}
        live=json.loads(sp.check_output(['docker','inspect',consumer['id']]))[0]
        environment=dict(value.split('=',1) for value in live['Config']['Env'])
        payload={'root':consumer['root'],'files':files,'scope':scope,'adapter':adapter,'service':consumer['name'].lstrip('/'),'environment':environment}
        result=sp.run(['docker','run','--rm','--log-driver=none','-i','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges:true','--memory=384m','--pids-limit=64','--volumes-from',consumer['id']+':ro','--entrypoint=/nodejs/bin/node',consumer['image'],'-e',NODE],input=json.dumps(payload).encode(),capture_output=True,timeout=45)
        assert result.returncode==0,'CANDIDATE_QUALIFICATION_FAILED: '+consumer['name']+' errorHash='+hashlib.sha256(result.stderr).hexdigest()
        qualification=json.loads(result.stdout)
        report.append({**{k:consumer[k] for k in ('id','name','image','startedAt','root')},'files':manifest,'qualification':qualification})
        print(json.dumps({'name':consumer['name'],'state':qualification['state'],'patchedModules':len(files)}),flush=True)
    (ROOT/'runtime-candidates.json').write_text(json.dumps(report,indent=2))
    print(json.dumps({'state':'staged-and-validated','consumers':len(report),'sourceChanged':False,'deployed':False}),flush=True)


if __name__=='__main__':main()
