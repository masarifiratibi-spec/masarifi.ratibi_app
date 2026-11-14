ARG BASE_IMAGE
FROM ${BASE_IMAGE}
COPY --chown=65532:65532 service.mjs /app/selfhost/storage.mjs
USER 65532:65532
HEALTHCHECK --interval=10s --timeout=2s --start-period=10s --retries=3 CMD ["/nodejs/bin/node", "-e", "const r=require('http').get({host:'127.0.0.1',port:Number(process.env.PORT??8080),path:'/health/ready',timeout:900},s=>{let b='';s.on('data',c=>{b+=c;if(b.length>1024)r.destroy()});s.on('end',()=>{try{process.exitCode=s.statusCode===200&&JSON.parse(b).status==='ready'?0:1}catch{process.exitCode=1}})});r.on('timeout',()=>r.destroy());r.on('error',()=>{process.exitCode=1})"]
ENTRYPOINT ["/nodejs/bin/node"]
CMD ["/app/selfhost/storage.mjs"]
