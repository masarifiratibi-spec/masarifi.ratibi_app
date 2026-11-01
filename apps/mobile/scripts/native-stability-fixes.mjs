import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import { resolve } from 'node:path';
import {
  applySqliteCleanupFix,
  verifySqliteCleanupFix
} from './sqlite-cleanup-fix.mjs';
import {
  applyScreensFabricFix,
  verifyScreensFabricFix
} from './screens-fabric-fix.mjs';
import {
  applySymbolFontScaleFix,
  verifySymbolFontScaleFix
} from './symbol-font-scale-fix.mjs';

const mobileRoot = fileURLToPath(new URL('..', import.meta.url));

export function prepareNativeStabilityFixes(root = mobileRoot) {
  applySqliteCleanupFix(resolve(root, 'node_modules/expo-sqlite'));
  applyScreensFabricFix(resolve(root, 'node_modules/react-native-screens'));
  applySymbolFontScaleFix(resolve(root, 'node_modules/expo-symbols'));
}

export function verifyNativeStabilityFixes(root = mobileRoot) {
  verifySqliteCleanupFix(resolve(root, 'node_modules/expo-sqlite'));
  verifyScreensFabricFix(resolve(root, 'node_modules/react-native-screens'));
  verifySymbolFontScaleFix(resolve(root, 'node_modules/expo-symbols'));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const operation = process.argv[2];
  if (process.argv.length !== 3 || !['--apply', '--check'].includes(operation))
    throw new Error('EXPECTED_APPLY_OR_CHECK');
  if (operation === '--apply') prepareNativeStabilityFixes();
  else verifyNativeStabilityFixes();
  console.log('Pinned SQLite, Screens and symbol stability fixes verified.');
}
