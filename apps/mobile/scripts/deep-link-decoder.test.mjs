import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, URL } from 'node:url';
import test from 'node:test';

const require = createRequire(import.meta.url);
const mobileRoot = fileURLToPath(new URL('../', import.meta.url));

function decoderProbe(guarded) {
  return spawnSync(
    process.execPath,
    [
      '--input-type=commonjs',
      '-e',
      `
      const { readFileSync } = require('node:fs');
      const Module = require('node:module');
      const ts = require('typescript');
      const filename = require('node:path').resolve('app/+native-intent.tsx');
      const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS }
      }).outputText;
      const intent = new Module(filename);
      intent.filename = filename;
      intent.paths = Module._nodeModulePaths(require('node:path').dirname(filename));
      intent._compile(compiled, filename);
      const queryString = require('query-string');
      const { extractExpoPathFromURL } = require('expo-router/build/fork/extractPathFromURL');
      const malformed = '%C0'.repeat(2000);
      if (${guarded}) {
        for (const initial of [true, false]) {
          for (const query of [malformed, encodeURIComponent(malformed)]) {
            const path = intent.exports.redirectSystemPath({ path: 'masarifi://reports?label=' + query, initial });
            if (path !== '/') throw new Error('Malformed link escaped the native boundary');
            extractExpoPathFromURL([], path);
          }
          for (const query of [encodeURIComponent(encodeURIComponent(malformed)), '100%2525']) {
            const original = 'masarifi://reports?label=' + query;
            const path = intent.exports.redirectSystemPath({ path: original, initial });
            if (path !== original) throw new Error('Router-compatible encoding changed');
            const extracted = extractExpoPathFromURL([], path);
            new URL(extracted, 'masarifi://app').searchParams.get('label');
          }
          const arabic = 'masarifi://reports?label=%D9%85%D8%B5%D8%B1%D9%88%D9%81';
          if (intent.exports.redirectSystemPath({ path: arabic, initial }) !== arabic) throw new Error('Valid Arabic link changed');
        }
      } else {
        queryString.parse('label=' + malformed);
      }
    `
    ],
    { cwd: mobileRoot, encoding: 'utf8', timeout: 2000 }
  );
}

test('installed decoder remains vulnerable in an isolated bounded control', () => {
  assert.equal(require('decode-uri-component/package.json').version, '0.2.2');
  const control = decoderProbe(false);
  assert.equal(control.error?.code, 'ETIMEDOUT', control.stderr);
});

test('native guard bounds malformed extraction and preserves safe percent/Arabic inputs', () => {
  const guarded = decoderProbe(true);
  assert.equal(guarded.error, undefined, guarded.stderr);
  assert.equal(guarded.status, 0, guarded.stderr);
});
