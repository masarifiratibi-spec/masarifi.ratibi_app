import fs from 'node:fs';
import path from 'node:path';

const roots = ['src/features/voice', 'src/domain/voice-capture.ts', 'src/services/mocks/voice-'];
const files = roots.flatMap(collectMatching);
const findings = [];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const normalized = file.replaceAll('\\', '/');
  if (!/\.(test|spec)\.(ts|tsx)$/.test(normalized)) {
    report(file, source, /from ['"]expo-sqlite['"]/g, 'direct SQLite import');
    report(file, source, /#[0-9a-f]{3,8}\b/gi, 'raw color');
    report(file, source, /(?:openai|anthropic|gemini|service[_-]?role|api[_-]?key)/gi, 'provider or secret reference');
    report(file, source, /console\.(?:log|info|warn|error)/g, 'console logging');
  }
}

if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Voice-capture boundaries passed (${files.length} files checked).`);
}

function collectMatching(root) {
  if (fs.existsSync(root) && fs.statSync(root).isFile()) return [root];
  if (fs.existsSync(root) && fs.statSync(root).isDirectory()) return collect(root);
  const directory = path.dirname(root);
  const prefix = path.basename(root);
  return fs.existsSync(directory)
    ? fs.readdirSync(directory).filter((name) => name.startsWith(prefix)).map((name) => path.join(directory, name))
    : [];
}

function collect(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    return entry.isDirectory() ? collect(entryPath) : /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

function report(file, source, pattern, label) {
  for (const match of source.matchAll(pattern))
    findings.push(`${file}:${source.slice(0, match.index).split(/\r?\n/).length} ${label}`);
}
