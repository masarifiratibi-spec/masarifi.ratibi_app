import ts from 'typescript';

// Privacy copy may name providers. Keep imports, executable expressions,
// secret-like text and line positions visible to the existing boundary rules.
export function providerScanSource(source, file) {
  let scanned = source.replace(/^[ \t]*\/\/[^\r\n]*/gm, comment => ' '.repeat(comment.length));
  if (!/^src\/localization\/messages\/(ar|en)\.ts$/.test(file.replaceAll('\\', '/'))) return scanned;
  const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const spans = [];
  const visit = node => {
    if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name) && ts.isStringLiteral(node.initializer)) {
      spans.push([node.initializer.getStart(syntax), node.initializer.end]);
    }
    ts.forEachChild(node, visit);
  };
  visit(syntax);
  for (const [start, end] of spans.sort((a, b) => b[0] - a[0])) {
    scanned = scanned.slice(0, start) + scanned.slice(start, end)
      .replace(/\b(?:openai|stripe|supabase|firebase)\b/gi, name => ' '.repeat(name.length)) + scanned.slice(end);
  }
  return scanned;
}
