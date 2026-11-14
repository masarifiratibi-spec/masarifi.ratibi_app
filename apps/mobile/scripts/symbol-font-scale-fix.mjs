import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// expo-symbols 55.0.9 renders Android/web icon glyphs in fixed-size Text boxes.
// Keep glyphs at the requested icon size while surrounding labels still scale.
const files = [
  {
    path: 'build/SymbolView.js',
    pristine: 'd3e3393bf989d2d6d417dac041d726dc1500b0c24a78f9ec02ea8c65a1d24405',
    patched: 'ce479614179db9f07507e7e3884a87f34dbcbb72d1855df5cb0ce52d0cfb5066'
  },
  {
    path: 'src/SymbolView.tsx',
    pristine: '713ce76875fc92790202f3089f47fdc7d170d5b27b919f7b84264ba66340c7d5',
    patched: 'ba616753ad63aa224d8852b9a30b372d8e0f872d5573edbb0697bba219e43c12'
  }
];
const digest = source => createHash('sha256').update(source).digest('hex');

function inspect(packageRoot) {
  const installed = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
  if (installed.version !== '55.0.9') throw new Error('SYMBOL_VERSION_MISMATCH');
  return files.map(file => {
    const target = resolve(packageRoot, file.path);
    const source = readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
    const hash = digest(source);
    if (hash !== file.pristine && hash !== file.patched)
      throw new Error('SYMBOL_SOURCE_MISMATCH: ' + file.path);
    const patched = hash === file.patched
      ? source
      : source.replace(/<Text(?=\s)/, '<Text allowFontScaling={false}');
    if (digest(patched) !== file.patched) throw new Error('SYMBOL_PATCH_INTEGRITY_MISMATCH');
    return { target, patched, applied: hash === file.patched };
  });
}

export function verifySymbolFontScaleFix(packageRoot) {
  if (inspect(packageRoot).some(source => !source.applied))
    throw new Error('SYMBOL_FONT_SCALE_FIX_NOT_APPLIED');
}

export function applySymbolFontScaleFix(packageRoot) {
  // Inspect both pinned inputs before changing either dependency file.
  const sources = inspect(packageRoot);
  for (const source of sources) {
    if (!source.applied) writeFileSync(source.target, source.patched);
  }
  verifySymbolFontScaleFix(packageRoot);
}
