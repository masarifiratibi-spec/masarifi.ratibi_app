import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { createStorageServer } from './service.mjs';

const secret = 'fixture-storage-secret-0123456789abcdef';
const key = 'voice/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222';
const support = key.replace('voice/', 'support/');
const authorization = { authorization: `Bearer ${secret}`, apikey: secret };

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'masarifi-storage-'));
  let time = Date.now();
  const lines = [];
  const server = createStorageServer({ root, secret, publicOrigin: 'https://files.example.test', now: () => time, log: r => lines.push(r) });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options = {}) => fetch(origin + path, options);
  const pathOf = url => { const u = new URL(url); return u.pathname + u.search; };
  const sign = async (bucket, object, body) => {
    const r = await request(`/storage/v1/object/upload/sign/${bucket}/${object}`, {method:'POST', headers: authorization, body: JSON.stringify(body)});
    assert.equal(r.status, 200);
    return r.json();
  };
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(root, {recursive:true, force:true}); });
  return {root, server, request, pathOf, sign, lines, advance: ms => {time += ms;}};
}

test('private reads require service credentials and signed upload retains installed-client contract', async t => {
  const f = await fixture(t);
  const signed = await f.sign('voice-temp', key, {contentType:'audio/mp4', expiresIn:60});
  assert.equal(new URL(signed.url).origin, 'https://files.example.test');
  assert.ok(signed.token.length > 16);
  const upload = await f.request(f.pathOf(signed.url), {method:'PUT', headers:{'content-type':'audio/mp4'}, body:Buffer.from('fixture-audio')});
  assert.equal(upload.status, 200);
  assert.equal((await f.request(`/storage/v1/object/authenticated/voice-temp/${key}`)).status, 401);
  const read = await f.request(`/storage/v1/object/authenticated/voice-temp/${key}`, {headers:authorization});
  assert.equal(read.status, 200);
  assert.equal(await read.text(), 'fixture-audio');
  assert.equal(read.headers.get('content-length'), '13');
  assert.equal(read.headers.get('cache-control'), 'private, no-store');
  assert.equal((await f.request(f.pathOf(signed.url), {method:'PUT', headers:{'content-type':'audio/mp4'}, body:'replacement'})).status, 409);
});

test('capabilities bind method, bucket, key, MIME, checksum and expiry', async t => {
  const f = await fixture(t);
  const body = 'support fixture';
  const checksum = createHash('sha256').update(body).digest('hex');
  const signed = await f.sign('support-attachments', support, {contentType:'text/plain', sha256:checksum, expiresIn:60});
  const path = f.pathOf(signed.url);
  assert.equal((await f.request(path.replace('support-attachments/support/', 'voice-temp/voice/'), {method:'PUT', headers:{'content-type':'text/plain'}, body})).status, 403);
  assert.equal((await f.request(path, {method:'GET'})).status, 403);
  assert.equal((await f.request(path, {method:'PUT', headers:{'content-type':'image/png'}, body})).status, 415);
  assert.equal((await f.request(path, {method:'PUT', headers:{'content-type':'text/plain'}, body:'wrong'})).status, 422);
  assert.equal((await f.request(path, {method:'PUT', headers:{'content-type':'text/plain'}, body})).status, 200);
  f.advance(61_000);
  assert.equal((await f.request(path, {method:'PUT', headers:{'content-type':'text/plain'}, body})).status, 403);
});

test('signed downloads expire and cannot cross object ownership paths', async t => {
  const f = await fixture(t);
  const path = `/storage/v1/object/voice-temp/${key}`;
  assert.equal((await f.request(path, {method:'POST', headers:{...authorization,'content-type':'audio/mp4'}, body:'fixture'})).status, 200);
  const r = await f.request(`/storage/v1/object/sign/voice-temp/${key}`, {method:'POST', headers:authorization, body:JSON.stringify({expiresIn:60})});
  assert.equal(r.status, 200);
  const signed = f.pathOf((await r.json()).signedURL);
  assert.equal(await (await f.request(signed)).text(), 'fixture');
  assert.equal((await f.request(signed.replace('22222222-2222', '33333333-3333'))).status, 403);
  assert.equal((await f.request(signed+'x')).status, 403);
  f.advance(60_001);
  assert.equal((await f.request(signed)).status, 403);
});

test('limits, invalid paths and invalid buckets cannot create files', async t => {
  const f = await fixture(t);
  for (const path of ['unknown/foo', 'voice-temp/voice/%2e%2e/x', 'voice-temp/voice/%2Fetc/passwd', 'voice-temp/voice/%5csecret']) {
    assert.equal((await f.request('/storage/v1/object/'+path, {method:'PUT',headers:{...authorization,'content-type':'audio/mp4'},body:'fixture'})).status, 400);
  }
  const signed = await f.sign('voice-temp', key, {contentType:'audio/mp4', expiresIn:60});
  assert.equal((await f.request(f.pathOf(signed.url), {method:'PUT', headers:{'content-type':'audio/mp4'}, body:Buffer.alloc(12_582_913)})).status, 413);
  assert.equal((await f.request(`/storage/v1/object/authenticated/voice-temp/${key}`, {headers:authorization})).status, 404);
});

test('concurrent uploads publish one complete object and persistence survives a new server', async t => {
  const f = await fixture(t);
  const path = `/storage/v1/object/voice-temp/${key}`;
  const responses = await Promise.all(['first','second'].map(body=>f.request(path,{method:'PUT',headers:{...authorization,'content-type':'audio/mp4'},body})));
  assert.deepEqual(responses.map(r=>r.status).sort(), [200,409]);
  const restarted = createStorageServer({root:f.root,secret,publicOrigin:'https://files.example.test'});
  restarted.listen(0,'127.0.0.1'); await once(restarted,'listening');
  t.after(async()=>{restarted.closeAllConnections();await new Promise(resolve=>restarted.close(resolve));});
  const response = await fetch(`http://127.0.0.1:${restarted.address().port}/storage/v1/object/authenticated/voice-temp/${key}`,{headers:authorization});
  assert.ok(['first','second'].includes(await response.text()));
  assert.equal((await f.request(path,{method:'DELETE',headers:authorization})).status,200);
  assert.equal((await f.request(path,{method:'DELETE',headers:authorization})).status,404);
});

test('logs correlate failures without capabilities, object keys or body content', async t => {
  const f=await fixture(t);
  await f.request(`/storage/v1/object/voice-temp/${key}?token=private-token`,{method:'PUT',headers:{'x-request-id':'fixture-request'},body:'private-financial-payload'});
  const record=f.lines.find(r=>r.requestId==='fixture-request');
  assert.equal(record.code,'STORAGE_AUTH_REQUIRED');
  assert.equal(record.outcome,'failure');
  assert.equal(typeof record.durationMs,'number');
  const encoded=JSON.stringify(f.lines);
  for(const value of [secret,key,'private-token','private-financial-payload'])assert.ok(!encoded.includes(value));
});
