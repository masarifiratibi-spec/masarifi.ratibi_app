import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkFrontendQualityBoundaries } from './check-frontend-quality-boundaries.mjs';

const root = mkdtempSync(join(tmpdir(), 'frontend-quality-boundaries-'));

try {
  const write = (name, source) => {
    const file = join(root, name);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, source);
    return file;
  };

  write('app/accounts/direct-storage.tsx', "import { openDatabaseAsync } from 'expo-sqlite';\nimport { CoreFinanceRepository } from '../../src/storage/core-finance-repository';");
  write('src/features/home/direct-storage.tsx', "import { AppShellStorage } from '../../storage/app-shell-storage';");
  write('src/features/voice/provider.tsx', "import * as Notifications from 'expo-notifications';");
  write('src/services/platform/phone-ok.ts', "import * as Notifications from 'expo-notifications';");
  write('src/state/server-records.ts', "const transactions = [{ id: 'tx-1', amount: 25, accountId: 'acc-1' }];");
  write('src/features/home/secrets.tsx', "const key = 'sk_live_1234567890123456';");
  write('src/analytics/leak.ts', "analytics.track('x', { amount: 5, transcript: 'secret' });");
  write('src/features/onboarding/ios-claim.tsx', "const text = 'iOS SMS tracking permission';");
  write('src/features/home/colors.tsx', "const color = '#008577';");
  write('src/features/home/text.tsx', "export function Title() { return <Text>Welcome home</Text>; }");
  write('src/features/transactions/mutation.ts', "service.createTransaction(input);");
  write('src/features/transactions/guarded.ts', "service.createTransaction({ ...input, operationId });");
  write('src/features/home/component.test.tsx', "const color = '#008577'; console.log('amount');");

  const violations = checkFrontendQualityBoundaries(root);

  for (const expected of [
    'direct-storage.tsx: direct storage import',
    'provider.tsx: provider SDK import',
    'server-records.ts: server-shaped Zustand state',
    'secrets.tsx: production secret',
    'leak.ts: sensitive analytics/logging',
    'ios-claim.tsx: unsupported iOS SMS claim',
    'colors.tsx: raw brand color',
    'text.tsx: raw user-facing string',
    'mutation.ts: mutation without operationId'
  ]) {
    assert.ok(violations.some((item) => item.includes(expected)), `${expected} was not rejected`);
  }

  assert.ok(!violations.some((item) => item.includes('phone-ok.ts')));
  assert.ok(!violations.some((item) => item.includes('component.test.tsx')));
  assert.ok(!violations.some((item) => item.includes('guarded.ts')));
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log('Frontend-quality boundary regression passed.');
