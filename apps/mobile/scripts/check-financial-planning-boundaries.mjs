import fs from 'node:fs';
import path from 'node:path';

const files = ['app', 'src'].flatMap(collect);
const findings = [];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const normalized = file.replaceAll('\\', '/');
  const isTest = /\.(test|spec)\.(ts|tsx|mjs)$/.test(normalized);
  const isStorage = normalized.startsWith('src/storage/');
  const isPlanning =
    normalized.includes('financial-planning') ||
    normalized.includes('/salary/') ||
    normalized.includes('/budgets/') ||
    normalized.includes('/obligations/') ||
    normalized.includes('/savings/') ||
    normalized.startsWith('app/salary/') ||
    normalized.startsWith('app/budgets/') ||
    normalized.startsWith('app/obligations/') ||
    normalized.startsWith('app/savings/');

  if (!isStorage && !isTest) {
    report(
      file,
      source,
      /from ['"]expo-sqlite['"]/g,
      'direct SQLite import outside storage'
    );
  }

  if (isPlanning && !isTest) {
    report(file, source, /#[0-9a-f]{3,8}\b/gi, 'feature-local raw color');
    report(
      file,
      source,
      /console\.(?:log|info|warn|error)\([^)]*(?:amount|balance|merchant|account|note|conflict)/gi,
      'sensitive financial logging'
    );
    report(
      file,
      source,
      /(?:SMS|sms|short message)/g,
      'unsupported iOS SMS claim'
    );
  }

  if (
    normalized === 'src/state/financial-planning-view-state.ts' &&
    /from ['"]@\/domain\/financial-planning['"]/.test(source)
  ) {
    findings.push(`${file}:1 planning entity stored in Zustand`);
  }

  if (
    normalized.includes('/savings/') &&
    /createTransaction|saveTransaction|accountBalance|openingBalanceMinor/.test(source)
  ) {
    findings.push(`${file}:1 goal movement can mutate account balances`);
  }
}

if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Financial-planning boundaries passed (${files.length} files checked).`);
}

function collect(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    return entry.isDirectory()
      ? collect(entryPath)
      : /\.(ts|tsx|mjs)$/.test(entry.name)
        ? [entryPath]
        : [];
  });
}

function report(file, source, pattern, label) {
  for (const match of source.matchAll(pattern)) {
    findings.push(
      `${file}:${source.slice(0, match.index).split(/\r?\n/).length} ${label}`
    );
  }
}
