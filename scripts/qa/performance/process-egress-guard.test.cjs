const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const guardFile = path.resolve(
  __dirname,
  "../../../apps/api/test/performance/qa-api/process-egress-guard.js",
);
function child(source) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) =>
      [
        "PATH",
        "WINDIR",
        "SYSTEMROOT",
        "COMSPEC",
        "PATHEXT",
        "PROCESSOR_ARCHITECTURE",
        "TEMP",
        "TMP",
        "USERPROFILE",
      ].includes(key.toUpperCase()),
    ),
  );
  return JSON.parse(
    execFileSync(process.execPath, ["-e", source], {
      env,
      encoding: "utf8",
      timeout: 15000,
    }),
  );
}

test("a fresh child refuses standard network/process escape paths before dispatch", () => {
  const result = child(`
    const assert=require('node:assert/strict');
    const priorUdpSocket=require('node:dgram').Socket;
    const guard=require(${JSON.stringify(guardFile)}).installQaEgressGuard();
    const net=require('node:net'),tls=require('node:tls'),dns=require('node:dns'),udp=require('node:dgram');
    const cp=require('node:child_process'),workers=require('node:worker_threads');
    function denied(error){for(let n=0;error&&n<5;n++,error=error.cause)if(error.code==='QA_EGRESS_DENIED')return true;return false;}
    const attempts=[
      ()=>net.connect(443,'203.0.113.1'),
      ()=>net.connect({host:'example.invalid',port:443}),
      ()=>new net.Socket().connect({host:'127.0.0.1',port:8082}),
      ()=>new net.Socket().connect({host:'::1',port:54332}),
      ()=>new net.Socket().connect('/tmp/masarifi-denied.sock'),
      ()=>net.connect({host:'127.0.0.1',port:54332,lookup:()=>{throw Error('UNEXPECTED_LOOKUP')}}),
      ()=>tls.connect({host:'127.0.0.1',port:54332}),
      ()=>new tls.TLSSocket(),
      ()=>dns.lookup('example.invalid',()=>{}),
      ()=>new dns.Resolver().resolve4('example.invalid',()=>{}),
      ()=>require('node:dns/promises').lookup('example.invalid'),
      ()=>new (require('node:dns/promises').Resolver)().resolve4('example.invalid'),
      ()=>udp.createSocket('udp4'),
      ()=>new udp.Socket('udp4'),
      ()=>cp.execFile(process.execPath,['-v']),
      ()=>cp.execFileSync(process.execPath,['-v']),
      ()=>new cp.ChildProcess().spawn({file:process.execPath,args:['-v'],envPairs:[]}),
      ()=>new workers.Worker('0',{eval:true}),
      ()=>new workers.Worker.prototype.constructor('0',{eval:true}),
      ()=>fetch('https://example.invalid'),
      ()=>require('node:http').get('http://127.0.0.1:54332'),
      ()=>require('node:https').get('https://127.0.0.1:54332'),
      ()=>{const socket=new priorUdpSocket('udp4');try{return socket.send(Buffer.from('qa'),5432,'203.0.113.1')}finally{socket.close()}},
    ];
    (async()=>{
      let rejected=0;
      for(const invoke of attempts){try{await invoke();throw Error('UNEXPECTED_EGRESS_ACCEPTANCE')}catch(error){assert.ok(denied(error),'Expected bounded denial');rejected++;}}
      const imported=await import('node:child_process');
      assert.throws(()=>imported.spawn(process.execPath,['-v']),error=>denied(error));
      const snapshot=guard.snapshot();assert.ok(Object.values(snapshot).every(Number.isSafeInteger));
      process.stdout.write(JSON.stringify({rejected,esmBlocked:true,counters:snapshot}));
    })().catch(error=>{process.stderr.write(error.stack);process.exitCode=1});
  `);
  assert.equal(result.rejected, 23);
  assert.equal(result.esmBlocked, true);
  assert.deepEqual(Object.keys(result.counters).sort(), [
    "dns",
    "process",
    "tcp",
    "tls",
    "udp",
    "worker",
  ]);
  assert.ok(Object.values(result.counters).every((value) => value > 0));
});

test("numeric local PostgreSQL dials and literal bind lookup remain allowed without sending application data", () => {
  const result = child(`
    const guard=require(${JSON.stringify(guardFile)}).installQaEgressGuard();
    const net=require('node:net'),dns=require('node:dns');
    function dial(args){return new Promise((resolve,reject)=>{
      const socket=net.connect(...args);const timeout=setTimeout(()=>{socket.destroy();reject(Error('DIAL_TIMEOUT'))},3000);
      function finish(outcome){clearTimeout(timeout);socket.destroy();resolve(outcome)}
      socket.once('connect',()=>finish('connected'));
      socket.once('error',error=>error.code==='ECONNREFUSED'?finish('refused'):reject(error));
    })}
    (async()=>{
      const outcomes=[await dial([{host:'127.0.0.1',port:54332}]),await dial([54332,'127.0.0.1'])];
      const lookup=await new Promise((resolve,reject)=>dns.lookup('127.0.0.1',(error,address)=>error?reject(error):resolve(address)));
      const promisedLookup=await require('node:dns/promises').lookup('127.0.0.1');
      process.stdout.write(JSON.stringify({outcomes,lookup,promisedLookup,counters:guard.snapshot()}));
    })().catch(error=>{process.stderr.write(error.stack);process.exitCode=1});
  `);
  assert.equal(result.lookup, "127.0.0.1");
  assert.equal(result.promisedLookup.address, "127.0.0.1");
  assert.ok(
    result.outcomes.every((outcome) =>
      ["connected", "refused"].includes(outcome),
    ),
  );
  assert.ok(Object.values(result.counters).every((value) => value === 0));
});
