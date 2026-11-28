const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const test = require('node:test');
const root = resolve(__dirname, '../..');
const mobileRequire = createRequire(resolve(root, 'apps/mobile/package.json'));
const yaml = mobileRequire('js-yaml');
const workflow = yaml.load(readFileSync(resolve(root, '.github/workflows/ios-native-qualification.yml'), 'utf8'));

function eligible(job, event, ref, inputs = {}) {
  if (!job.if) return true;
  // Evaluate the repository's own restricted GitHub condition, never event payload text.
  const condition = job.if.replace(/^\s*\$\{\{|\}\}\s*$/g, '');
  assert.doesNotMatch(condition, /[^a-zA-Z0-9_./\s'"=!&|()-]/);
  return Boolean(Function('github', 'inputs', `return (${condition});`)({ event_name: event, ref }, inputs));
}

test('main and PRs qualify iOS without signing or exporting', () => {
  assert.deepEqual(workflow.on.push.branches, ['main']);
  assert.deepEqual(workflow.on.pull_request.branches, ['main']);
  for (const [event, ref] of [['push', 'refs/heads/main'], ['pull_request', 'refs/pull/1/merge']]) {
    assert.equal(eligible(workflow.jobs['device-compile'], event, ref), true);
    assert.equal(eligible(workflow.jobs['ad-hoc-export'], event, ref), false);
    for (const job of Object.values(workflow.jobs).filter(j => eligible(j, event, ref))) {
      assert.equal(job.environment, undefined);
      assert.doesNotMatch(JSON.stringify(job), /secrets\.|export-ios-ad-hoc-on-mac|eas\s+(?:update|submit)|expo\s+publish/);
    }
  }
  assert.match(JSON.stringify(workflow.jobs['device-compile']), /CODE_SIGNING_ALLOWED=NO/);
});
test('signed exports are manual, main-only and require a reviewed source SHA', () => {
  const job = workflow.jobs['ad-hoc-export'];
  assert.equal(job.environment, 'ios-ad-hoc-signing');
  for (const ref of ['refs/heads/iOS', 'refs/heads/codex/example', 'refs/tags/archive-example']) {
    assert.equal(eligible(job, 'workflow_dispatch', ref, { export_app_store: true }), false);
  }
  assert.equal(eligible(job, 'push', 'refs/heads/main', { export_app_store: true }), false);
  assert.equal(eligible(job, 'workflow_dispatch', 'refs/heads/main', { export_app_store: true }), true);
  const pin = job.steps.find(s => /reviewed.*source/i.test(s.name ?? ''));
  assert.ok(pin);
  assert.equal(pin.if, undefined, 'both Ad Hoc and Store exports must check the reviewed source');
  assert.match(pin.run, /EXPECTED_SOURCE_SHA/);
  assert.match(pin.run, /GITHUB_SHA/);
});
test('no workflow introduces a mobile OTA or store submission command', () => {
  for (const name of readdirSync(resolve(root, '.github/workflows'))) {
    if (!/\.ya?ml$/.test(name)) continue;
    const text = readFileSync(resolve(root, '.github/workflows', name), 'utf8');
    assert.doesNotMatch(text, /\beas(?:-cli)?\s+(?:update|submit)\b|\bexpo\s+publish\b|--auto-submit\b|upload-testflight-build/, name);
  }
});
