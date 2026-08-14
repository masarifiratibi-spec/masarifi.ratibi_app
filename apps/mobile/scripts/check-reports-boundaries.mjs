import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const scanRoots = ['app', 'src'];
const violations = [];

for (const dir of scanRoots) {
  walk(join(root, dir));
}

if (violations.length) {
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log('reports boundary check passed');

function walk(path) {
  if (!statSync(path).isDirectory()) return check(path);
  for (const entry of readdirSync(path)) {
    if (entry === '__snapshots__') continue;
    walk(join(path, entry));
  }
}

function check(path) {
  if (!/\.(ts|tsx)$/.test(path)) return;
  const rel = relative(root, path).replaceAll('\\', '/');
  const text = readFileSync(path, 'utf8');
  if (rel.startsWith('src/features/reports/') || rel.startsWith('app/reports/') || rel === 'app/(tabs)/reports.tsx') {
    reject(rel, text, /expo-sqlite|sqlite/i, 'reports screens may not access SQLite directly');
    reject(rel, text, /from ['"]expo-file-system['"]|from ['"]expo-sharing['"]|MailComposer|Notifications|BackgroundFetch|TaskManager/i, 'reports may not import real file/share/email/background providers');
    reject(rel, text, /console\.(log|error|warn)/, 'reports may not log sensitive report data');
  }
  if (rel === 'src/state/reports-view-state.ts') {
    reject(rel, text, /FinancialReport|ReportSchedule|ReportOutputAttempt/, 'reports Zustand state stores only transient view context');
  }
}

function reject(rel, text, pattern, message) {
  if (pattern.test(text)) violations.push(`${rel}: ${message}`);
}
