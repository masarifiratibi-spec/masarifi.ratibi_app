const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} = require('node:fs');
const { join, resolve, sep } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const xcode = require('xcode');
const withBankSmsIntent = require('../plugins/with-bank-sms-intent.cjs');
const {
  bundleBankSmsParser
} = require('../modules/masarifi-bank-sms/bundle-parser.cjs');

const root = resolve(__dirname, '..');
const captureAt = Date.parse('2026-11-17T10:00:00.000Z');

test('standalone parser handles a synthetic expense and salary, and rejects OTP and failed payments', () => {
  const context = vm.createContext({});
  vm.runInContext(bundleBankSmsParser(root), context);
  const parse = (text) =>
    context.masarifiClassifyBankSms(text, captureAt, 'Asia/Riyadh');
  const expense = parse('Purchase SAR 12.34 at QA SHOP card XX4242');
  assert.equal(expense.amountMinor, 1234);
  assert.equal(expense.currency, 'SAR');
  assert.equal(expense.kind, 'expense');
  assert.equal(expense.occurredAt, new Date(captureAt).toISOString());
  const salary = parse('Salary SAR 5500.00 credited to account XX4242');
  assert.equal(salary.amountMinor, 550000);
  assert.equal(salary.kind, 'income');
  assert.equal(
    parse('Your OTP is 654321 for purchase SAR 12.34 with card XX4242'),
    null
  );
  assert.equal(
    parse('Declined purchase SAR 12.34 at QA SHOP card XX4242'),
    null
  );
  assert.equal(parse('A purchase of 12.34 with card XX4242'), null);
  assert.equal(parse('x'.repeat(2001)), null);
});

test('the parser exposes separate stable identities for two purchases with different bank references', () => {
  const context = vm.createContext({});
  vm.runInContext(bundleBankSmsParser(root), context);
  const parse = (text, time = captureAt) => context.masarifiClassifyBankSms(text, time, 'Asia/Riyadh');
  const text = 'Purchase SAR 12.34 at QA SHOP card XX4242 Ref: QA0001';
  const first = parse(text);
  assert.ok(first.referenceIdentity);
  assert.equal(parse(text, captureAt + 60000).referenceIdentity, first.referenceIdentity);
  assert.equal(parse(text.toUpperCase()).textIdentity, first.textIdentity);
  assert.notEqual(parse(text.replace('QA0001', 'QA0002')).referenceIdentity, first.referenceIdentity);
});

test('iOS config copies the intent and the parser into the main application build phases once', async () => {
  const fixtureRoot = resolve(root, '../../coverage');
  mkdirSync(fixtureRoot, { recursive: true });
  const temporary = mkdtempSync(join(fixtureRoot, 'bank-sms-xcode-'));
  try {
    const filename = join(temporary, 'project.pbxproj');
    writeFileSync(
      filename,
      execFileSync('tar', [
        '-xOf',
        join(root, 'node_modules/expo/template.tgz'),
        'package/ios/HelloWorld.xcodeproj/project.pbxproj'
      ])
    );
    const project = xcode.project(filename).parseSync();
    const config = withBankSmsIntent({ name: 'HelloWorld' });
    const input = {
      ...config,
      modResults: project,
      modRequest: {
        projectName: 'HelloWorld',
        projectRoot: root,
        platformProjectRoot: temporary,
        nextMod: (mod) => mod
      }
    };
    await config.mods.ios.xcodeproj(input);
    await config.mods.ios.xcodeproj(input);
    assert.equal(config.mods.android, undefined);
    const output = project.writeSync();
    assert.match(output, /ProcessBankSmsIntent\.swift in Sources/);
    assert.match(output, /MasarifiBankSmsParser\.js in Resources/);
    const files = Object.values(project.pbxFileReferenceSection());
    assert.equal(
      files.filter((file) => file.path?.includes('ProcessBankSmsIntent.swift'))
        .length,
      1
    );
    assert.equal(
      files.filter((file) => file.path?.includes('MasarifiBankSmsParser.js'))
        .length,
      1
    );
    const parser = readFileSync(
      join(temporary, 'HelloWorld/MasarifiBankSmsParser.js'),
      'utf8'
    );
    assert.equal(parser, bundleBankSmsParser(root));
    const intent = readFileSync(
      join(temporary, 'HelloWorld/ProcessBankSmsIntent.swift'),
      'utf8'
    );
    assert.match(intent, /ProcessBankSmsIntent: AppIntent/);
    assert.match(intent, /^internal import MasarifiBankSms$/m);
  } finally {
    assert.ok(resolve(temporary).startsWith(fixtureRoot + sep));
    rmSync(temporary, { recursive: true, force: true });
  }
});
