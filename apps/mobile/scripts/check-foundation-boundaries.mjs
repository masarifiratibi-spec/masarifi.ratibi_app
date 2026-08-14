import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const roots = ['app', 'src'];
const sourceFiles = roots.flatMap((root) => collectSourceFiles(root));
const findings = [];

for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = file.replaceAll('\\', '/');

  if (!relative.endsWith('/design-system/tokens.ts')) {
    reportMatches(file, source, /#[0-9a-f]{3,8}\b/gi, 'raw color');
  }
  reportMatches(
    file,
    source,
    /(?:sk-[a-z0-9_-]{16,}|(?:api[_-]?key|client[_-]?secret)\s*[:=]\s*['"][^'"]+)/gi,
    'production secret'
  );
  if (!relative.includes('/localization/messages/')) {
    reportMatches(
      file,
      source,
      /(?:analytics\.\w+|\btrack|\blogEvent)\s*\([^\n]*(?:amount|balance|accountId)\b/gi,
      'sensitive analytics payload'
    );
  }

  if (relative.endsWith('.test.ts') || relative.endsWith('.test.tsx')) continue;
  inspectAst(file, source);
}

if (findings.length > 0) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Foundation boundaries passed (${sourceFiles.length} files checked).`
  );
}

function collectSourceFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

function inspectAst(file, source) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const visit = (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      if (
        /(?:^|[-/@])(camera|investment|openai|stripe|supabase)(?:$|[-/])/i.test(
          node.moduleSpecifier.text
        )
      ) {
        addFinding(
          file,
          sourceFile,
          node,
          'prohibited feature/provider import'
        );
      }
    }
    if (
      ts.isJsxText(node) &&
      /[\p{L}]/u.test(node.text) &&
      !isLocalizationKey(node.text.trim())
    ) {
      addFinding(file, sourceFile, node, 'hard-coded JSX text');
    }
    if (
      ts.isJsxAttribute(node) &&
      node.initializer &&
      isUserFacingAttribute(node)
    ) {
      if (
        ts.isStringLiteral(node.initializer) &&
        !isLocalizationKey(node.initializer.text)
      ) {
        addFinding(file, sourceFile, node, 'hard-coded accessibility string');
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

function isUserFacingAttribute(node) {
  return ['accessibilityLabel', 'title', 'placeholder'].includes(
    node.name.text
  );
}

function isLocalizationKey(value) {
  return /^[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_-]+)+$/.test(value);
}

function reportMatches(file, source, pattern, label) {
  for (const match of source.matchAll(pattern)) {
    const line = source.slice(0, match.index).split(/\r?\n/).length;
    findings.push(`${file}:${line} ${label}`);
  }
}

function addFinding(file, sourceFile, node, label) {
  const line =
    sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  findings.push(`${file}:${line} ${label}`);
}
