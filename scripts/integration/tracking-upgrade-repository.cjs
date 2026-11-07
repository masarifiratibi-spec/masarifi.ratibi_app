'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// This commit introduced the 110 -> 111 fixture and its compatible capture/claim
// implementation. HEAD acquired reset and worker-generation RPCs in 56af8e04
// that do not exist on either historical schema.
const source = 'a3d65c0364fd5e37bfe5caa4a10ab0b23a91e848:apps/api/src/tracking/tracking.repository.ts';

function loadNominalTrackingRepository() {
  const root = path.resolve(__dirname, '../..');
  const api = path.join(root, 'apps/api');
  const ts = require(path.join(api, 'node_modules/typescript'));
  const repository = execFileSync('git', ['show', source], { cwd: root, encoding: 'utf8' });
  const { outputText } = ts.transpileModule(repository, { compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2023,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
  } });
  // A sibling of the built tracking directory resolves the normal API imports.
  // Use a per-invocation module so parallel fixtures cannot replace each other.
  const directory = fs.mkdtempSync(path.join(api, 'dist/src/tracking-upgrade-'));
  const modulePath = path.join(directory, 'tracking.repository.cjs');
  try {
    fs.writeFileSync(modulePath, outputText);
    return require(modulePath).TrackingRepository;
  } finally {
    delete require.cache[modulePath];
    fs.rmSync(modulePath, { force: true });
    fs.rmdirSync(directory);
  }
}

module.exports = { loadNominalTrackingRepository };
