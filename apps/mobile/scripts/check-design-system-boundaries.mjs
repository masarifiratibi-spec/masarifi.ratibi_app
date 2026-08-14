import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const roots = ['app', 'src'];
const files = roots.flatMap((root) => collectSourceFiles(root));
const findings = [];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = file.replaceAll('\\', '/');
  const isTokenSource = relative.endsWith('src/design-system/tokens.ts');
  const isTestSource = /\.(test|spec)\.(ts|tsx)$/.test(relative);

  if (!isTokenSource && !isTestSource) {
    reportMatches(file, source, /#[0-9a-f]{3,8}\b/gi, 'raw color outside tokens.ts');
  }

  inspectAst(file, source, relative, isTokenSource, isTestSource);
}

if (findings.length > 0) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Design-system boundaries passed (${files.length} files checked).`);
}

function collectSourceFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

function inspectAst(file, source, relative, isTokenSource, isTestSource) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const inGallery = /\/(?:app\/design-system|src\/features\/design-system)\//.test(
    `/${relative}`
  );

  const visit = (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      /admin-web|apps\/admin|@admin/i.test(node.moduleSpecifier.text)
    ) {
      addFinding(file, sourceFile, node, 'Admin import in mobile design system');
    }

    if (!isTokenSource && !isTestSource && isLocalTokenMap(node)) {
      addFinding(file, sourceFile, node, 'feature-local token map');
    }

    if (inGallery) {
      if (ts.isJsxText(node) && /[\p{L}]/u.test(node.text)) {
        addFinding(file, sourceFile, node, 'hard-coded gallery JSX text');
      }
      if (
        ts.isJsxAttribute(node) &&
        node.initializer &&
        ['accessibilityLabel', 'title', 'placeholder'].includes(node.name.text) &&
        ts.isStringLiteral(node.initializer)
      ) {
        addFinding(file, sourceFile, node, 'hard-coded gallery string attribute');
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

function isLocalTokenMap(node) {
  if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name)) return false;
  if (!/tokens?|palette|semanticColors/i.test(node.name.text)) return false;
  return node.initializer && ts.isObjectLiteralExpression(node.initializer);
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
