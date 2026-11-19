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

test('the native capture pod reuses ClerkExpo’s single ClerkKit linkage', () => {
  const spec = readFileSync(
    join(root, 'modules/masarifi-bank-sms/ios/MasarifiBankSms.podspec'),
    'utf8'
  );
  assert.match(spec, /s\.dependency 'ClerkExpo'/);
  assert.doesNotMatch(spec, /\bspm_dependency\s*\(/);
  assert.match(spec, /'SWIFT_INCLUDE_PATHS'.+SYMROOT/);
});

test('parses supported text supplied by a financial app alert', () => {
  const context = vm.createContext({});
  vm.runInContext(bundleBankSmsParser(root), context);
  const expense = context.masarifiClassifyBankSms(
    'Card purchase SAR 17.26 at QA SHOP',
    captureAt,
    'Asia/Riyadh'
  );
  assert.equal(expense.amountMinor, 1726);
  assert.equal(expense.currency, 'SAR');
  assert.equal(expense.kind, 'expense');
});

test('native save alerts run after successful settlement and use the receipt ID', () => {
  const service = readFileSync(
    join(root, 'modules/masarifi-bank-sms/ios/BankSmsService.swift'),
    'utf8'
  );
  assert.match(
    service,
    /try settle\(delivery, enrollment: enrollment, notice: notice, receipt: receipt\)/
  );
  assert.match(service, /for key in batch\.notices\s*\{\s*await deliverNotice\(key, enrollment: enrollment\)/);
  const state = readFileSync(join(root, 'modules/masarifi-bank-sms/ios/BankSmsState.swift'), 'utf8');
  assert.match(service, /\.settle\(notice: notice, receipt: receipt\)/);
  assert.match(state, /pendingNotice = notice/);
  assert.equal([...service.matchAll(/await notifySaved\(/g)].length, 1);
  assert.match(service, /let identifier = "bank-sms-saved-\\\(transactionId\./);
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
    assert.match(output, /Localizable\.xcstrings in Resources/);
    const catalog = JSON.parse(readFileSync(join(temporary, 'HelloWorld/Localizable.xcstrings'), 'utf8'));
    assert.equal(catalog.strings['Income Category'].localizations.ar.stringUnit.value, 'تصنيف الدخل');
    assert.equal(catalog.strings['Account Number Ending'].localizations.ar.stringUnit.value, 'آخر أرقام الحساب');
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

test('routes same-currency card messages before delivery, with bank, role and shortcut conflicts checked', () => {
  const context = vm.createContext({});
  vm.runInContext(bundleBankSmsParser(root), context);
  const a = { id: 'a', currency: 'SAR', institution: 'QAALFA', lastFour: '4242', automaticRouting: true };
  const b = { id: 'b', currency: 'SAR', institution: 'QABETA', lastFour: '8181', automaticRouting: true };
  const purchase = 'Purchase SAR 18.41 at QA SHOP card XX4242 Ref: QA261118A01';
  const arabic = 'QABETA شراء بمبلغ ٢٤٫٦٢ SAR لدى متجر تجريبي بطاقة XX٨١٨١ الرقم المرجعي: QA261118B01';
  const salary = 'Salary SAR 51.13 credited to account XX7373 Ref: QA261118S01';
  const route = (text, options = {}) => context.masarifiClassifyBankSms(
    text, captureAt, 'Asia/Riyadh', { accounts: [a, b], ...options }
  )?.accountId ?? null;
  assert.equal(route(purchase), 'a');
  assert.equal(route(arabic), 'b');
  assert.equal(route(arabic, { accountId: 'a' }), null);
  assert.equal(route('QABETA ' + purchase), null);
  assert.equal(route(purchase.replace('SAR', 'USD')), null);
  assert.equal(route(purchase.replace('card XX4242', '')), null);
  assert.equal(route(purchase, { accounts: [a, { ...b, lastFour: '4242' }] }), null);
  assert.equal(route('QAALFA ' + purchase, { accounts: [a, { ...b, lastFour: '4242' }] }), 'a');
  assert.equal(route(purchase, { accounts: [{ ...a, automaticRouting: false }] }), null);
  assert.equal(route(salary), null);
  assert.equal(route(salary, { accountId: 'a', accountEnding: '7373' }), 'a');
  assert.equal(route(salary, { accountId: 'a', accountEnding: '٧٣٧٣' }), 'a');
  assert.equal(route(salary, { accountId: 'a', accountEnding: '4242' }), null);
  assert.equal(route(purchase, { accountId: 'a', accountEnding: '4242' }), null);
  assert.equal(route(purchase, { accounts: [{ id: 'old', currency: 'SAR' }], accountId: 'old' }), 'old');
});

test('routes configured Shortcuts with only SMS text, including accounting-specific paths', () => {
  const context = vm.createContext({});
  vm.runInContext(bundleBankSmsParser(root), context);
  const accounts = [
    { id: 'bank', currency: 'SAR', issuer: 'QAALFA', lastFour: '4242', accountEnding: '7373', cashAccountId: 'cash', automaticRouting: true },
    { id: 'other', currency: 'SAR', issuer: 'QABETA', lastFour: '8181', accountEnding: '9292', automaticRouting: true },
    { id: 'cash', currency: 'SAR', type: 'cash' },
    { id: 'uae', currency: 'AED', issuer: 'QAUAE', lastFour: '4242', accountEnding: '4242', automaticRouting: true },
    { id: 'egypt', currency: 'EGP', issuer: 'QAEG', accountEnding: '4242', automaticRouting: true }
  ];
  const categories = [
    ...['expense', 'fee', 'restaurant'].map(id => ({ id, kind: 'expense' })),
    ...['income', 'salary'].map(id => ({ id, kind: 'income' }))
  ];
  const preferences = { expenseId: 'expense', incomeId: 'income', feeId: 'fee', salaryId: 'salary', merchants: { 'qa cafe': 'restaurant', 'أرامكو': 'fee' } };
  const parse = (text, overrides = {}) => context.masarifiClassifyBankSms(
    text, captureAt, 'Asia/Riyadh', { accounts, categories, preferences, ...overrides }
  );
  const route = (text, kind, accountId, categoryId = null, destinationAccountId = null) => {
    const parsed = parse(text);
    assert.ok(parsed, text);
    assert.equal(parsed.kind, kind, text);
    assert.equal(parsed.accountId, accountId, text);
    assert.equal(parsed.categoryId, categoryId, text);
    assert.equal(parsed.destinationAccountId, destinationAccountId, text);
    return parsed;
  };
  const purchase = route('QAALFA Purchase SAR 12.34 at QA Cafe card XX4242 Ref: QA00001', 'expense', 'bank', 'restaurant');
  route('QAALFA Purchase SAR 12.34 at QA Cafe card 1111111199994242', 'expense', 'bank', 'restaurant');
  assert.equal(purchase.bankReference, 'QA00001');
  const recast = route('QAALFA Purchase SAR 12.34 at QA Cafe card XX4242 account XX7373 Ref: qa00001', 'expense', 'bank', 'restaurant');
  const fresh = route('QAALFA Purchase SAR 12.34 at QA Cafe card XX4242 Ref: QA00999', 'expense', 'bank', 'restaurant');
  const unrelated = route('QABETA Purchase SAR 12.34 at QA Cafe card XX8181 Ref: QA00001', 'expense', 'other', 'restaurant');
  assert.equal(purchase.stableReferenceIdentity, recast.stableReferenceIdentity);
  assert.notEqual(purchase.stableReferenceIdentity, fresh.stableReferenceIdentity);
  assert.notEqual(purchase.stableReferenceIdentity, unrelated.stableReferenceIdentity);
  route('QABETA شراء بمبلغ ١٢٫٣٤ SAR لدى متجر تجريبي بطاقة XX٨١٨١', 'expense', 'other', 'expense');
  route('QAALFA شراء SAR 18.41 لدى أرامكو بطاقة XX4242', 'expense', 'bank', 'fee');
  route('QAUAE Card purchase AED 12.34 at QA SHOP card XX4242', 'expense', 'uae', 'expense');
  route('QAUAE Bill payment AED 12.34 from account XX4242', 'expense', 'uae', 'expense');
  route('Bill payment SAR 12.34 using card XX4242', 'expense', 'bank', 'expense');
  route('Bill payment SAR 12.34 from account XX7373 to card XX8181', 'expense', 'bank', 'expense');
  route('Salary SAR 51.13 from account XX9292 to account XX7373', 'income', 'bank', 'salary');
  route('Salary SAR 51.13 credited to account XX7373', 'income', 'bank', 'salary');
  route('Fee SAR 3.11 card XX4242', 'expense', 'bank', 'fee');
  route('Cash withdrawal SAR 19.21 from account XX7373', 'transfer', 'bank', null, 'cash');
  route('Cash deposit SAR 19.22 to account XX7373', 'transfer', 'cash', null, 'bank');
  route('External deposit EGP 19.22 to account XX4242', 'income', 'egypt', 'income');
  route('QAEG إيداع من طرف خارجي ١٩٫٢٢ جنيه في حساب XX4242', 'income', 'egypt', 'income');
  const shortReference = route('QAALFA شراء SAR 12.34 بطاقة XX4242 مرجع: QA00007', 'expense', 'bank', 'expense');
  assert.equal(shortReference.bankReference, 'QA00007');
  const sender = route('QAALFA Outgoing transfer SAR 19.23 from account XX7373 to account XX9292 Ref: QA00002', 'transfer', 'bank', null, 'other');
  const receiver = route('QABETA Incoming transfer SAR 19.23 from account XX7373 to account XX9292 Ref: QA00002', 'transfer', 'bank', null, 'other');
  assert.equal(sender.referenceIdentity, receiver.referenceIdentity);
  assert.equal(sender.stableReferenceIdentity, receiver.stableReferenceIdentity);
  route('Outgoing external transfer SAR 19.23 from account XX7373 Ref: QA00004', 'expense', 'bank', 'expense');
  route('Incoming external transfer SAR 19.23 to account XX7373 Ref: QA00005', 'income', 'bank', 'income');
  const refund = route('Refund SAR 2.50 to card XX4242 original reference QA00001 Ref: QA00003', 'refund', 'bank');
  assert.equal(refund.originalReference, purchase.bankReference);
  route('Reversal SAR 12.34 to card XX4242 original reference QA00001 Ref: QA00006', 'reversal', 'bank');

  for (const expectedSkip of [
    'QABETA Purchase SAR 12.34 at QA SHOP card XX4242',
    'Purchase SAR 12.34 at QA SHOP',
    'Cash deposit EGP 19.22 to account XX4242',
    'Bill payment SAR 12.34 to account XX7373',
    'Bill payment SAR 12.34 for account XX7373',
    'Bill payment SAR 12.34 to card XX4242',
    'Bill payment SAR 12.34 for card XX4242',
    'Purchase SAR 12.34 card 1111111142429999',
    'Purchase SAR 12.34 card 4242-1234-8888-9999',
    'Purchase SAR 12.34 card 4242 123456 19999',
    'Purchase SAR 12.34 card XX4242 has not been approved',
    'Purchase SAR 12.34 card XX4242 not yet approved',
    'Cash deposit SAR 14 to account XX7373 sender: Ahmed',
    'Cash deposit SAR 14 to account XX7373 deposited on behalf of Ahmed',
    'Purchase SAR 12.34 card XX4242 was not approved',
    'Purchase SAR 12.34 card XX4242 never processed',
    'Purchase SAR 12.34 card XX4242 is awaiting approval',
    'شراء SAR 12.34 بطاقة XX4242 بانتظار الموافقة',
    'Cash deposit SAR 14 to account XX7373 depositor: Ahmed',
    'Fee SAR 12.34 to account XX7373',
    'Cash deposit SAR 20.35 from card XX4242',
    'Cash deposit SAR 20.35 from Ahmed to account XX7373',
    'Cash deposit SAR 20.35 by Ahmed to account XX7373',
    'External deposit SAR 20.35 from account XX7373',
    'External deposit SAR 20.35 from account XX7373 to account XX9292',
    'Salary SAR 51.13 from account XX7373',
    'Refund SAR 2.50 from card XX4242 original reference QA00001 Ref: QA00003',
    'Purchase SAR 12.34 at QA SHOP card XX4242 was not completed',
    'QAALFA شراء SAR 12.34 بطاقة XX4242 لم تكتمل العملية',
    'Cash deposit SAR 20.35 from third party to account XX7373 Ref: QA001236',
    'Cash deposit SAR 20.35 from account XX7373 Ref: QA001238',
    'QAALFA Outgoing external transfer SAR 19.23 from account XX7373 to account XX9292 Ref: QA001235',
    'Outgoing transfer SAR 19.23 from account XX7373 Ref: QA001237 not an external transfer',
    'Deposit EGP 19.22 to account XX4242',
    'Outgoing transfer SAR 19.23 from account XX7373 to account XX9292',
    'Outgoing transfer SAR 19.23 from account XX7373 Ref: QA00002',
    'Refund SAR 2.50 to card XX4242 Ref: QA00003',
    'Pending refund SAR 2.50 to card XX4242 original reference QA00001 Ref: QA00003',
    'Purchase SAR 12.34 at QA SHOP card XX4242 additional fee SAR 2.10',
    'Declined purchase SAR 12.34 at QA SHOP card XX4242',
    'Your OTP is 654321 for purchase SAR 12.34 with card XX4242',
    'Available balance SAR 500.00 on card XX4242',
    'Offer: purchase SAR 12.34 to get a discount'
  ]) assert.equal(parse(expectedSkip), null, expectedSkip);
  assert.equal(parse('Cash withdrawal SAR 19.21 from account XX7373', { accounts: accounts.filter(a => a.id !== 'cash') }), null);
  assert.equal(parse('QAALFA Purchase SAR 12.34 at QA Cafe card XX4242 Ref: QA00001', { categoryId: 'fee' }).categoryId, 'fee');
  assert.equal(parse('Salary SAR 51.13 credited to account XX7373', { accountId: 'bank', categoryId: 'expense' }), null);
  assert.equal(parse('Purchase SAR 12.34 at QA SHOP', { accounts: [accounts[0]], accountId: 'bank', categoryId: 'expense' }).accountId, 'bank');
});

test('checks the shared Saudi, Emirati, and Egyptian fixtures against enrolled account routing', () => {
  const fixtures = require('../../../packages/transaction-parser/corpus.json');
  const context = vm.createContext({});
  vm.runInContext(bundleBankSmsParser(root), context);
  const accounts = ['SAR', 'AED', 'EGP'].map(currency => ({
    id: currency, currency, lastFour: '4242', accountEnding: '4242', automaticRouting: true
  }));
  const expected = {
    'sa-pos-ar': ['expense', 'SAR'],
    'sa-online-ar': ['expense', 'SAR'],
    'ae-card-en': ['expense', 'AED'],
    'ae-card-spaced-en': ['expense', 'AED'],
    'sa-salary-en': ['income', 'SAR']
  };
  for (const fixture of fixtures) {
    const result = context.masarifiClassifyBankSms(fixture.text, captureAt, 'Asia/Riyadh', { accounts });
    assert.deepEqual(result && [result.kind, result.accountId], expected[fixture.id] ?? null, fixture.id);
  }
});
