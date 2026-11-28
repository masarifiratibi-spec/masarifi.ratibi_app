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

test('allows provider disclosure text in the two static translation catalogs', () => {
  for (const locale of ['ar', 'en']) {
    const result = checkFixture("const catalog = { 'privacy': 'OpenAI through OpenRouter' };\n", `src/localization/messages/${locale}.ts`);
    assert.equal(result.status, 0, result.stderr);
  }
});

test('still rejects provider imports, requires and executable expressions inside catalogs', () => {
  for (const source of [
    "import OpenAI from 'openai';\n",
    "const catalog = { 'privacy': require('openai') };\n",
    "const catalog = { 'privacy': import('openai') };\n"
  ]) {
    const result = checkFixture(source, 'src/localization/messages/en.ts');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /provider SDK or production-provider import/);
  }
});

test('static catalog copy does not bypass production secret checks', () => {
  const result = checkFixture("const catalog = { 'privacy': 'sk-fixture_for_secret_detection_123456' };\n", 'src/localization/messages/en.ts');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /production secret/);
});
