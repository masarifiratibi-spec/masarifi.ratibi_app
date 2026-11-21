"""Build a reviewed overlay on a specified running service image, without restarting it."""
import hashlib
import json
import pathlib
import subprocess
import sys
import tempfile

def run(*args):
    return subprocess.check_output(args)

def main(folder, container):
    spec = json.loads((folder / 'modules.json').read_text())
    base = run('docker', 'inspect', '--format', '{{.Image}}', container).decode().strip()
    if not base.startswith('sha256:') or len(base) != 71:
        raise ValueError('Invalid serving image')
    alias = 'masarifi-reset-base:' + base[7:23]
    tag = 'masarifi-financial-reset:' + spec['source'][:12] + '-' + base[7:19]
    run('docker', 'tag', base, alias)
    with tempfile.TemporaryDirectory() as temp:
        ctx = pathlib.Path(temp)
        lines = ['FROM ' + alias]
        for name, hashes in spec['modules'].items():
            path = pathlib.PurePosixPath(name)
            if path.is_absolute() or '..' in path.parts or path.suffix != '.js':
                raise ValueError('Invalid module path')
            data = (folder / 'modules' / path).read_bytes()
            if hashlib.sha256(data).hexdigest() != hashes['after']:
                raise ValueError('Changed candidate module: ' + name)
            # Probe the parent's bytes through its Node runtime. Never consult container env.
            probe = "const fs=require('node:fs'),c=require('node:crypto');let p=process.argv[1];process.stdout.write(fs.existsSync(p)?c.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):'absent')"
            dest = '/app/dist/src/' + name
            old = run('docker','exec',container,'/nodejs/bin/node','-e',probe,dest).decode()
            if old not in (hashes['before'], hashes['after']):
                raise ValueError('Reconcile serving module before activation: ' + name)
            target = ctx / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            lines.append('COPY --chown=65532:65532 ' + name + ' ' + dest)
        (ctx/'Dockerfile').write_text('\n'.join(lines)+'\n')
        run('docker','build','--network=none','--pull=false','-t',tag,str(ctx))
    image = run('docker','image','inspect','--format','{{.Id}}',tag).decode().strip()
    print(json.dumps(dict(container=container,base=base,candidate=image,tag=tag)))

if __name__ == '__main__':
    main(pathlib.Path(sys.argv[1]),sys.argv[2])
