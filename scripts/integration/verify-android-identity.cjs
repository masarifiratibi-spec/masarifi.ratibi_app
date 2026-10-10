'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const root = resolve(__dirname, '../..');
const base = '3bd0c5d3149259ad69fb6a5e86083a820052b7f4';
function baseFile(path) {
  return execFileSync('git', ['show', `${base}:${path}`], {
    cwd: root,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }
  });
}
const path = 'apps/mobile/app.json';
const expected = JSON.parse(baseFile(path).toString('utf8'));
expected.expo.name = 'Masarifi.Ratibi';
const actual = JSON.parse(readFileSync(resolve(root, path), 'utf8'));
assert.deepEqual(actual, expected, 'Only the approved display name may change from pinned Tracking app configuration.');
assert.equal(actual.expo.android.package, 'com.masarifi.mobile');
assert.equal(actual.expo.slug, 'masarifiratibi');
assert.equal(actual.expo.extra.eas.projectId, 'c8cc3dd3-a7e9-4737-ac4d-32f076107600');
for (const file of ['apps/mobile/eas.json', 'apps/mobile/google-services.json', 'apps/mobile/app.config.js', 'apps/mobile/index.js']) {
  const normalize = bytes => bytes.toString('utf8').replace(/\r\n/g, '\n');
  assert.equal(normalize(readFileSync(resolve(root, file))), normalize(baseFile(file)), `${file} must retain the existing identity/native configuration.`);
}
console.info('Approved Android display name verified; package, slug, EAS, Firebase and native entry/configuration preserved.');
