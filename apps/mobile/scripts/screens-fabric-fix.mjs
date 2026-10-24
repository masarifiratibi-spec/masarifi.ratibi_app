import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const vendorRoot = new URL('../vendor/react-native-screens-fabric-fix/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', vendorRoot), 'utf8'));
const canonicalSource = source => Buffer.from(source.toString('utf8').replace(/\r\n/g, '\n'));
const digest = source => createHash('sha256').update(canonicalSource(source)).digest('hex');

function inspectedSources(packageRoot) {
  const installed = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
  if (installed.version !== manifest.version) throw new Error('SCREENS_VERSION_MISMATCH');
  return manifest.files.map(file => {
    const target = resolve(packageRoot, file.path);
    const currentHash = digest(readFileSync(target));
    const patched = canonicalSource(readFileSync(new URL('patched/' + file.path, vendorRoot)));
    if (digest(patched) !== file.patched) throw new Error('FABRIC_PATCH_INTEGRITY_MISMATCH');
    if (currentHash !== file.pristine && currentHash !== file.patched) {
      throw new Error('SCREENS_SOURCE_MISMATCH: ' + file.path);
    }
    return { target, patched, applied: currentHash === file.patched };
  });
}

export function verifyScreensFabricFix(packageRoot) {
  if (inspectedSources(packageRoot).some(source => !source.applied)) {
    throw new Error('FABRIC_FIX_NOT_APPLIED');
  }
}

export function applyScreensFabricFix(packageRoot) {
  // Validate every input before touching any dependency file, preserving other work.
  const sources = inspectedSources(packageRoot);
  for (const source of sources) {
    if (!source.applied) writeFileSync(source.target, source.patched);
  }
  verifyScreensFabricFix(packageRoot);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const operation = process.argv[2];
  if (!['--apply', '--check'].includes(operation) || process.argv.length !== 3) {
    throw new Error('EXPECTED_APPLY_OR_CHECK');
  }
  if (process.env.MASARIFI_APP_VARIANT !== 'staging-development') {
    throw new Error('STAGING_DEV_BUILD_REQUIRED');
  }
  const packageRoot = fileURLToPath(new URL('../node_modules/react-native-screens/', import.meta.url));
  if (operation === '--apply') applyScreensFabricFix(packageRoot);
  else verifyScreensFabricFix(packageRoot);
  console.log('Staging DEV Fabric native sources verified; native rebuild required.');
}
