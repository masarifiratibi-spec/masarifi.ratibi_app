import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import test from 'node:test';

const script = new URL('./sqlite-cleanup-fix.mjs', import.meta.url);
const pristine = readFileSync(
  new URL(
    '../vendor/expo-sqlite-cleanup-fix/pristine/SQLiteModule.kt',
    import.meta.url
  ),
  'utf8'
);
const sourcePath = 'android/src/main/java/expo/modules/sqlite/SQLiteModule.kt';
function fixture(context) {
  const root = mkdtempSync(join(tmpdir(), 'masarifi-sqlite-fix-'));
  context.after(() => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(root.startsWith(join(tmpdir(), 'masarifi-sqlite-fix-')));
    rmSync(root, { recursive: true });
  });
  mkdirSync(dirname(join(root, sourcePath)), { recursive: true });
  writeFileSync(join(root, sourcePath), pristine);
  writeFileSync(join(root, 'package.json'), '{"version":"55.0.20"}');
  return root;
}
function probe(root, operation = 'applySqliteCleanupFix') {
  return spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    const patcher = await import(${JSON.stringify(script.href)});
    patcher[${JSON.stringify(operation)}](${JSON.stringify(root)});
  `
    ],
    { encoding: 'utf8', timeout: 5000, windowsHide: true }
  );
}
test('the pinned cleanup patch applies once and repeated application preserves the same source', (context) => {
  const root = fixture(context);
  assert.equal(probe(root).status, 0);
  const patched = readFileSync(join(root, sourcePath), 'utf8');
  assert.notEqual(patched, pristine);
  assert.equal(probe(root).status, 0);
  assert.equal(readFileSync(join(root, sourcePath), 'utf8'), patched);
  assert.equal(probe(root, 'verifySqliteCleanupFix').status, 0);
});
for (const change of ['version', 'source']) {
  test(`an unexpected ${change} is rejected without rewriting the dependency`, (context) => {
    const root = fixture(context);
    if (change === 'version')
      writeFileSync(join(root, 'package.json'), '{"version":"55.0.21"}');
    else writeFileSync(join(root, sourcePath), pristine + '\n// other work\n');
    const before = readFileSync(join(root, sourcePath), 'utf8');
    const result = probe(root);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      change === 'version'
        ? /SQLITE_VERSION_MISMATCH/
        : /SQLITE_SOURCE_MISMATCH/
    );
    assert.equal(readFileSync(join(root, sourcePath), 'utf8'), before);
  });
}
test('verification rejects pristine source without modifying it', (context) => {
  const root = fixture(context);
  const result = probe(root, 'verifySqliteCleanupFix');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /SQLITE_CLEANUP_FIX_NOT_APPLIED/);
  assert.equal(readFileSync(join(root, sourcePath), 'utf8'), pristine);
});
test('canonical source verification accepts Windows line endings', (context) => {
  const root = fixture(context);
  writeFileSync(
    join(root, sourcePath),
    pristine.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')
  );
  assert.equal(probe(root).status, 0);
  assert.equal(probe(root, 'verifySqliteCleanupFix').status, 0);
});
test('the command refuses dependency mutation outside the live Staging DEV build', () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(script), '--apply'],
    {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
      env: {
        ...process.env,
        MASARIFI_APP_VARIANT: '',
        EXPO_PUBLIC_API_URL: 'https://example.invalid'
      }
    }
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /STAGING_DEV_BUILD_REQUIRED/);
});
