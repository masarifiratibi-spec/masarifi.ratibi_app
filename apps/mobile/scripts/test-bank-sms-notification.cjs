const { execFileSync } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

if (process.env.EAS_BUILD_PLATFORM !== 'ios') {
  console.log('Native iOS notice fixtures: not an iOS build host.');
} else {
  const directory = mkdtempSync(join(tmpdir(), 'masarifi-notice-'));
  try {
    const root = resolve(__dirname, '..');
    const executable = join(directory, 'notice-tests');
    execFileSync(
      'xcrun',
      [
        'swiftc',
        join(root, 'modules/masarifi-bank-sms/ios/BankSmsSavedNotice.swift'),
        join(__dirname, 'fixtures/bank-sms-saved-notice.swift'),
        '-o',
        executable
      ],
      { stdio: 'inherit' }
    );
    execFileSync(executable, [], { stdio: 'inherit' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
