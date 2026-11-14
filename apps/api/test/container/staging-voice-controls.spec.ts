import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { docker, dockerResult, imageUnderTest } from './docker-test.utils';

describe('nonroot Staging Voice control files', () => {
  it('reads immutable packet, epoch and approval after root publication in the actual image', () => {
    const volume = 'voice-controls-' + randomUUID();
    const scripts = resolve(__dirname, '../../../../scripts/staging-voice');
    docker(['volume', 'create', volume]);
    const run = (user: string, source: string) =>
      dockerResult([
        'run',
        '--rm',
        '--read-only',
        '--network',
        'none',
        '--user',
        user,
        '--mount',
        `type=volume,source=${volume},target=/controls`,
        '--mount',
        `type=bind,source=${scripts},target=/scripts,readonly`,
        '--entrypoint',
        '/nodejs/bin/node',
        imageUnderTest,
        '-e',
        source,
      ]);
    try {
      const created = run(
        '0:0',
        `
        const fs=require('node:fs');
        for(const name of ['packet','epoch','approval'])fs.writeFileSync('/controls/'+name+'.json',JSON.stringify({name}),{mode:0o600,flag:'wx'});
      `,
      );
      expect(created.status).toBe(0);
      const read = `
        const fs=require('node:fs'),assert=require('node:assert/strict');
        assert.equal(process.getuid(),65532);
        for(const name of ['packet','epoch','approval'])assert.equal(JSON.parse(fs.readFileSync('/controls/'+name+'.json','utf8')).name,name);
      `;
      expect(run('65532:65532', read).status).not.toBe(0);
      const published = run(
        '0:0',
        `
        require('/scripts/controls.cjs').makeControlsReadable('/controls',['packet.json','epoch.json','approval.json']);
      `,
      );
      expect(published.status).toBe(0);
      const result = run('65532:65532', read);
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
      expect(
        run('65531:65531', "require('node:fs').readFileSync('/controls/epoch.json')").status,
      ).not.toBe(0);
    } finally {
      docker(['volume', 'rm', volume]);
    }
  });
});
