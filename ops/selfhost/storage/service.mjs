import { createServer } from 'node:http';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, open, readFile, rename, rm, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';

const uuid = '[0-9a-f-]{36}';
const buckets = {
  'voice-temp': { key: new RegExp(`^voice/${uuid}/${uuid}$`), max: 12_582_912, types: ['audio/m4a','audio/mp4','audio/mpeg','audio/ogg','audio/wav','audio/webm'] },
  'support-attachments': { key: new RegExp(`^support/${uuid}/${uuid}$`, 'i'), max: 10_485_760, types: ['application/pdf','image/png','image/jpeg','text/plain'] },
  'tracking-imports': { key: new RegExp(`^tracking/${uuid}/${uuid}$`), max: 6_291_456, types: ['text/csv','application/json'] },
  'report-exports': { key: /^(?:reports\/[a-f0-9]{64}\/[0-9a-f-]{36}\.(?:json|csv|pdf)|exports\/[A-Za-z0-9-]{1,64}\/[A-Za-z0-9._/-]{1,256}\.zip)$/, max: 536_870_912, types: ['application/json','text/csv','application/pdf','application/zip'] },
};
class StorageError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
const fail = (status, code) => { throw new StorageError(status, code); };
const digest = value => createHash('sha256').update(value).digest('hex');
function equal(left, right) {
  const a = Buffer.from(left ?? ''), b = Buffer.from(right ?? '');
  return a.length === b.length && timingSafeEqual(a,b);
}
async function syncDirectory(path) {
  if (process.platform === 'win32') return;
  const file = await open(path, 'r');
  try { await file.sync(); } finally { await file.close(); }
}

/** Private object service. Only opaque signed capabilities are public; minting needs the service key. */
export function createStorageServer({root, secret, publicOrigin, release = 'unknown', origins = [], now = Date.now, log = () => {}}) {
  if (!isAbsolute(root) || typeof secret !== 'string' || secret.length < 32) throw Error('STORAGE_CONFIG_INVALID');
  const base = new URL(publicOrigin);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw Error('STORAGE_CONFIG_INVALID');
  const directory = resolve(root);
  const signature = data => createHmac('sha256',secret).update(data).digest('base64url');
  function sign(claim) {
    const data = Buffer.from(JSON.stringify(claim)).toString('base64url');
    return `${data}.${signature(data)}`;
  }
  function verify(token, mode, bucket, key) {
    if (typeof token !== 'string' || token.length > 4096) fail(403,'STORAGE_CAPABILITY_INVALID');
    const parts = token.split('.');
    if (parts.length !== 2 || !equal(parts[1],signature(parts[0]))) fail(403,'STORAGE_CAPABILITY_INVALID');
    let claim;
    try { claim = JSON.parse(Buffer.from(parts[0],'base64url').toString()); } catch { fail(403,'STORAGE_CAPABILITY_INVALID'); }
    if (claim.mode !== mode || claim.bucket !== bucket || claim.key !== key || !Number.isSafeInteger(claim.exp) || claim.exp <= now()) fail(403,'STORAGE_CAPABILITY_INVALID');
    return claim;
  }
  const sendJson = (res,status,value) => {
    res.writeHead(status,{'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'});
    res.end(JSON.stringify(value));
  };
  async function json(req) {
    const chunks=[]; let size=0;
    for await (const chunk of req) { size+=chunk.length; if(size>8192) fail(413,'STORAGE_REQUEST_TOO_LARGE'); chunks.push(chunk); }
    try { return size ? JSON.parse(Buffer.concat(chunks).toString()) : {}; } catch { fail(400,'STORAGE_REQUEST_INVALID'); }
  }
  async function put(req, target, bucket, claim) {
    const rule=buckets[bucket];
    const contentType=req.headers['content-type'] ?? '';
    const mime=contentType.split(';')[0].trim();
    if(!rule.types.includes(mime) || (claim && contentType !== claim.contentType)) fail(415,'STORAGE_CONTENT_TYPE_INVALID');
    const declared=req.headers['content-length'];
    if(declared !== undefined && (!/^\d+$/.test(declared) || Number(declared)>rule.max)) fail(413,'STORAGE_LIMIT_EXCEEDED');
    await mkdir(directory,{recursive:true,mode:0o700});
    const temp=await mkdtemp(join(directory,'.upload-'));
    let published=false;
    try {
      const file=await open(join(temp,'body'),'wx',0o600);
      let size=0; const hash=createHash('sha256');
      try {
        for await (const chunk of req) {
          size+=chunk.length;
          if(size>rule.max) fail(413,'STORAGE_LIMIT_EXCEEDED');
          hash.update(chunk); await file.writeFile(chunk);
        }
        if(!size || (declared !== undefined && Number(declared)!==size)) fail(400,'STORAGE_BODY_INVALID');
        await file.sync();
      } finally { await file.close(); }
      const sha256=hash.digest('hex');
      if(claim?.sha256 && claim.sha256 !== sha256) fail(422,'STORAGE_CHECKSUM_MISMATCH');
      const meta=await open(join(temp,'meta.json'),'wx',0o600);
      try {await meta.writeFile(JSON.stringify({size,contentType,sha256}));await meta.sync();} finally {await meta.close();}
      await syncDirectory(temp);
      try {await rename(temp,target);published=true;await syncDirectory(directory);} catch(error) {
        if(['EEXIST','ENOTEMPTY','EPERM'].includes(error.code) && await stat(target).then(()=>true,()=>false)) fail(409,'STORAGE_OBJECT_EXISTS');
        throw error;
      }
    } finally { if(!published) await rm(temp,{recursive:true,force:true}); }
  }
  const server=createServer(async(req,res)=>{
    const started=performance.now();
    const requestId=/^[A-Za-z0-9._:-]{1,128}$/.test(req.headers['x-request-id'] ?? '') ? req.headers['x-request-id'] : randomUUID();
    let operation='storage.request', code='OK';
    res.setHeader('x-request-id',requestId);
    res.setHeader('cache-control','private, no-store');
    res.setHeader('x-content-type-options','nosniff');
    const origin=req.headers.origin;
    if(origin && origins.includes(origin)) {
      res.setHeader('access-control-allow-origin',origin);res.setHeader('vary','Origin');
      res.setHeader('access-control-allow-methods','GET, HEAD, PUT, POST, OPTIONS');
      res.setHeader('access-control-allow-headers','content-type, x-content-sha256, x-request-id');
    }
    res.once('finish',()=>log({timestamp:new Date(now()).toISOString(),service:'storage',version:release,requestId,operation,outcome:res.statusCode<400?'success':'failure',durationMs:Math.round(performance.now()-started),httpStatus:res.statusCode,code}));
    try {
      if(origin && !origins.includes(origin)) fail(403,'STORAGE_ORIGIN_INVALID');
      if(req.method==='OPTIONS') {res.writeHead(204);res.end();return;}
      if(req.url==='/health/ready' && req.method==='GET') {await mkdir(directory,{recursive:true,mode:0o700});sendJson(res,200,{status:'ready'});return;}
      const url=new URL(req.url,'http://storage.invalid');
      const prefix='/storage/v1/object/';
      if(!url.pathname.startsWith(prefix)) fail(404,'STORAGE_ROUTE_NOT_FOUND');
      let path=url.pathname.slice(prefix.length), mode='private';
      if(path.startsWith('upload/sign/')) {mode='upload';path=path.slice(12);}
      else if(path.startsWith('authenticated/')) path=path.slice(14);
      else if(path.startsWith('sign/')) {mode='download';path=path.slice(5);}
      let decoded;
      try {decoded=path.split('/').map(p=>decodeURIComponent(p));} catch {fail(400,'STORAGE_KEY_INVALID');}
      const bucket=decoded.shift(),key=decoded.join('/');
      const rule=Object.hasOwn(buckets,bucket) ? buckets[bucket] : undefined;
      if(!rule || decoded.some(p=>!p || p==='.' || p==='..' || /[\\/\0]/.test(p)) || !rule.key.test(key)) fail(400,'STORAGE_KEY_INVALID');
      const target=join(directory,`${bucket}-${digest(key)}`);
      const service=equal(req.headers.authorization,`Bearer ${secret}`) && equal(req.headers.apikey,secret);
      const token=url.searchParams.get('token');
      if((mode==='upload'||mode==='download') && req.method==='POST' && service && !token) {
        operation=`storage.sign.${mode}`;
        const input=await json(req);
        const seconds=input.expiresIn ?? (mode==='upload'?7200:300);
        if(!Number.isSafeInteger(seconds) || seconds<1 || seconds>(mode==='upload'?7200:900)) fail(400,'STORAGE_EXPIRY_INVALID');
        const claim={mode,bucket,key,exp:now()+seconds*1000};
        if(mode==='upload') {
          if(typeof input.contentType!=='string' || !rule.types.includes(input.contentType.split(';')[0])) fail(400,'STORAGE_CONTENT_TYPE_INVALID');
          claim.contentType=input.contentType;
          if(input.sha256 !== undefined) {if(!/^[a-f0-9]{64}$/.test(input.sha256)) fail(400,'STORAGE_CHECKSUM_INVALID');claim.sha256=input.sha256;}
        }
        const signed=sign(claim);
        const encoded=[bucket,...decoded].map(encodeURIComponent).join('/');
        const pathname=`${prefix}${mode==='upload'?'upload/sign/':'sign/'}${encoded}`;
        const signedURL=`${base.origin}${pathname}?token=${signed}`;
        sendJson(res,200,mode==='upload'?{url:signedURL,token:signed}:{signedURL});return;
      }
      let claim;
      if(!service) {
        if(mode==='private') fail(401,'STORAGE_AUTH_REQUIRED');
        claim=verify(token,mode,bucket,key);
        if((mode==='upload' && !['PUT','POST'].includes(req.method)) || (mode==='download' && !['GET','HEAD'].includes(req.method))) fail(403,'STORAGE_CAPABILITY_INVALID');
      } else if(mode!=='private') fail(403,'STORAGE_CAPABILITY_INVALID');
      if(['PUT','POST'].includes(req.method)) {
        operation='storage.upload';await put(req,target,bucket,claim);sendJson(res,200,{Key:`${bucket}/${key}`});return;
      }
      if(['GET','HEAD'].includes(req.method)) {
        operation='storage.download';
        const meta=JSON.parse(await readFile(join(target,'meta.json'),'utf8'));
        const actual=await stat(join(target,'body'));
        if(actual.size!==meta.size) fail(500,'STORAGE_INTEGRITY_FAILED');
        res.writeHead(200,{'content-length':meta.size,'content-type':meta.contentType,etag:`"${meta.sha256}"`,'content-disposition':'attachment'});
        if(req.method==='HEAD') res.end(); else await pipeline(createReadStream(join(target,'body')),res);
        return;
      }
      if(req.method==='DELETE' && service) {
        operation='storage.delete';await rm(target,{recursive:true});await syncDirectory(directory);sendJson(res,200,{});return;
      }
      fail(405,'STORAGE_METHOD_INVALID');
    } catch(error) {
      const missing=error.code==='ENOENT';
      const status=missing?404:error instanceof StorageError?error.status:500;
      code=missing?'NoSuchKey':error instanceof StorageError?error.code:'STORAGE_IO_ERROR';
      if(!res.headersSent) {req.resume();sendJson(res,status,{code,statusCode:String(status),requestId});} else res.destroy();
    }
  });
  server.requestTimeout=60_000;server.headersTimeout=15_000;server.maxHeadersCount=40;
  return server;
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const secret=(await readFile(process.env.MASARIFI_STORAGE_KEY_FILE ?? '/run/secrets/storage-key','utf8')).trim();
  const server=createStorageServer({root:process.env.MASARIFI_STORAGE_ROOT,secret,publicOrigin:process.env.MASARIFI_STORAGE_URL,release:process.env.MASARIFI_RELEASE_VERSION,origins:(process.env.MASARIFI_CORS_ORIGINS??'').split(',').filter(Boolean),log:r=>process.stdout.write(JSON.stringify(r)+'\n')});
  server.listen(Number(process.env.PORT??8080),'0.0.0.0');
  process.once('SIGTERM',()=>{server.close();setTimeout(()=>process.exit(1),30_000).unref();});
}
