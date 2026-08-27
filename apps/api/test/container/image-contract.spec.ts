import { dockerResult, imageUnderTest, inspectImage, runNode } from './docker-test.utils';

jest.setTimeout(180_000);

describe('production image contract', () => {
  it('is non-root, minimal, read-only, and exposes only the API port', () => {
    const inspection = inspectImage();
    const config = inspection.Config as {
      User?: string;
      ExposedPorts?: Record<string, unknown>;
      Env?: string[];
    };

    expect(config.User).toBe('65532:65532');
    expect(Object.keys(config.ExposedPorts ?? {})).toEqual(['3000/tcp']);
    expect(config.Env ?? []).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/(?:SECRET|TOKEN|PASSWORD|KEY)=.+/i)]),
    );

    const probe = JSON.parse(
      runNode(`
        const fs = require('node:fs');
        const forbidden = ['/bin/sh', '/bin/bash', '/usr/bin/npm', '/usr/local/bin/npm', '/app/src'];
        let readOnly = false;
        try { fs.writeFileSync('/app/spec-be-001-write-probe', 'x'); }
        catch (error) { readOnly = error && error.code === 'EROFS'; }
        let typescript = true;
        try { require.resolve('typescript'); } catch { typescript = false; }
        let nestCli = true;
        try { require.resolve('@nestjs/cli'); } catch { nestCli = false; }
        console.log(JSON.stringify({
          readOnly,
          forbiddenPresent: forbidden.filter((path) => fs.existsSync(path)),
          typescript,
          nestCli,
          supabaseCli: fs.existsSync('/app/node_modules/supabase') || fs.existsSync('/app/node_modules/@supabase/cli-linux-x64'),
          migrations: fs.existsSync('/app/supabase/migrations') && fs.existsSync('/app/supabase/migration-checksums.sha256'),
          pg: Boolean(require.resolve('pg')),
        }));
      `),
    ) as Record<string, unknown>;

    expect(probe).toEqual({
      readOnly: true,
      forbiddenPresent: [],
      typescript: false,
      nestCli: false,
      supabaseCli: false,
      migrations: true,
      pg: true,
    });

    const defaultRun = dockerResult(['run', '--rm', '--read-only', imageUnderTest]);
    expect(defaultRun.status).toBe(1);
    expect(`${defaultRun.stdout}${defaultRun.stderr}`).toContain('API_BOOTSTRAP_FAILED');
  });
});
