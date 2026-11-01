// Prove each reset prefix is the exact recorded main history, not a synthetic schema.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const root = resolve(process.argv[3] ?? resolve(__dirname, '../..'));
const baselines = [
  { name: 'local-main', sha: '730aa8c459d27d3849a6001d827cfa231f7ce81b', count: 68, version: '20260915150000' },
  { name: 'canonical-main', sha: 'ecfba4d7de40555c122bd3b5e53e7e7fd71f6294', count: 70, version: '20260922220434' },
];
const git = (...args) => execFileSync('git', ['-C', root, ...args], { env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, encoding: 'utf8' });
const normalize = value => value.replace(/\r\n/g, '\n');
const digest = value => createHash('sha256').update(normalize(value)).digest('hex');
const candidatePaths = git('ls-tree', '-r', '--name-only', 'HEAD', 'supabase/migrations').trim().split('\n').filter(name => name.endsWith('.sql'));
for (const baseline of baselines) {
  const paths = git('ls-tree', '-r', '--name-only', baseline.sha, 'supabase/migrations').trim().split('\n').filter(name => name.endsWith('.sql'));
  assert.equal(paths.length, baseline.count);
  assert.deepEqual(candidatePaths.filter(name => name.split('/').at(-1).split('_')[0] <= baseline.version), paths);
  baseline.files = paths.map(name => {
    const historical = git('show', `${baseline.sha}:${name}`);
    const candidate = readFileSync(resolve(root, name), 'utf8');
    assert.equal(normalize(candidate), normalize(historical), `Historical migration differs: ${baseline.name}/${name}`);
    return { path: name, normalizedSHA256: digest(historical) };
  });
  console.log(`Verified ${baseline.name}: ${baseline.count} exact historical migrations through ${baseline.version}.`);
}
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify({ candidateSHA: git('rev-parse', 'HEAD').trim(), baselines }, null, 2) + '\n', { flag: 'wx' });
