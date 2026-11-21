import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import test from 'node:test';

const script = new URL('./screens-fabric-fix.mjs', import.meta.url);
const pristine = new URL('../vendor/react-native-screens-fabric-fix/pristine/', import.meta.url);
const sourcePaths = [
  'android/src/main/cpp/NativeProxy.cpp', 'android/src/main/cpp/NativeProxy.h',
  'cpp/RNSScreenRemovalListener.cpp', 'cpp/RNSScreenRemovalListener.h'
];

function fixture(context) {
  const root = mkdtempSync(join(tmpdir(), 'masarifi-screens-fix-'));
  context.after(() => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(root.startsWith(join(tmpdir(), 'masarifi-screens-fix-')));
    rmSync(root, { recursive: true });
  });
  cpSync(pristine, root, { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '4.23.0' }));
  return root;
}

function probe(root, operation = 'applyScreensFabricFix') {
  return spawnSync(process.execPath, ['--input-type=module', '-e', `
    const patcher = await import(${JSON.stringify(script.href)});
    patcher[${JSON.stringify(operation)}](${JSON.stringify(root)});
  `], { encoding: 'utf8', timeout: 5000 });
}

function sources(root) {
  return sourcePaths.map(path => readFileSync(join(root, path), 'utf8'));
}

test('the pinned backport installs all four native files and is repeatable', context => {
  const root = fixture(context);
  const applied = probe(root);
  assert.equal(applied.status, 0, applied.stderr);
  const patched = sources(root);
  const expected = sources(fileURLToPath(new URL('../vendor/react-native-screens-fabric-fix/patched/', import.meta.url)));
  assert.deepEqual(patched, expected.map(source => source.replace(/\r\n/g, '\n')));
  assert.notDeepEqual(patched, sources(fileURLToPath(pristine)));
  assert.equal(probe(root).status, 0);
  assert.deepEqual(sources(root), patched);
  assert.equal(probe(root, 'verifyScreensFabricFix').status, 0);
});

test('verification refuses pristine native sources without modifying them', context => {
  const root = fixture(context);
  const before = sources(root);
  const checked = probe(root, 'verifyScreensFabricFix');
  assert.equal(checked.status, 1);
  assert.match(checked.stderr, /FABRIC_FIX_NOT_APPLIED/);
  assert.deepEqual(sources(root), before);
});

test('Windows checkout line endings preserve the pinned source comparison', context => {
  const root = fixture(context);
  for (const path of sourcePaths) {
    const original = readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
    writeFileSync(join(root, path), original.replace(/\n/g, '\r\n'));
  }
  const applied = probe(root);
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(probe(root, 'verifyScreensFabricFix').status, 0);
});

test('a different dependency version is rejected before any source write', context => {
  const root = fixture(context);
  const before = sources(root);
  writeFileSync(join(root, 'package.json'), '{"version":"4.28.0"}');
  const checked = probe(root);
  assert.equal(checked.status, 1);
  assert.match(checked.stderr, /SCREENS_VERSION_MISMATCH/);
  assert.deepEqual(sources(root), before);
});

test('an unexpected source edit rejects the entire patch before any write', context => {
  const root = fixture(context);
  writeFileSync(join(root, sourcePaths[3]), '// other work\n');
  const before = sources(root);
  const checked = probe(root);
  assert.equal(checked.status, 1);
  assert.match(checked.stderr, /SCREENS_SOURCE_MISMATCH/);
  assert.deepEqual(sources(root), before);
});

test('the command refuses to mutate dependencies outside the DEV build workflow', () => {
  const checked = spawnSync(process.execPath, [fileURLToPath(script), '--apply'], {
    encoding: 'utf8', timeout: 5000,
    env: { ...process.env, MASARIFI_APP_VARIANT: '' }
  });
  assert.equal(checked.status, 1);
  assert.match(checked.stderr, /STAGING_DEV_BUILD_REQUIRED/);
});
