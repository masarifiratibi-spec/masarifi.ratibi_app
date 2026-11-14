import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import test from 'node:test';

const checker = fileURLToPath(new URL('./check-app-shell-boundaries.mjs', import.meta.url));
const optionalNativeExport =
  "export { MasarifiSmsInbox as trackingNativeRuntime } from '../../../modules/masarifi-sms-inbox';\n";

function checkFixture(source, file = 'src/services/platform/tracking-native-runtime.ts') {
  const root = mkdtempSync(path.join(tmpdir(), 'app-shell-boundaries-'));
  try {
    mkdirSync(path.join(root, 'app'), { recursive: true });
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), source);
    return spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('allows the optional native facade shared by non-Android ownership services', () => {
  const result = checkFixture(optionalNativeExport);
  assert.equal(result.status, 0, result.stderr);
});

test('still rejects SMS operations added to the optional native facade', () => {
  const result = checkFixture(optionalNativeExport + "const permission = 'READ_SMS';\n");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /:2 SMS behavior outside Android boundary/);
});

test('still rejects the native export outside its explicit platform facade', () => {
  const result = checkFixture(optionalNativeExport, 'src/features/home/native.ts');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /SMS behavior outside Android boundary/);
});
