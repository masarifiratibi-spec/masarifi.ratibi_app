import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const manifest = JSON.parse(
  readFileSync(
    new URL('../vendor/expo-sqlite-cleanup-fix/manifest.json', import.meta.url),
    'utf8'
  )
);
const canonical = (source) => source.toString().replace(/\r\n/g, '\n');
const digest = (source) =>
  createHash('sha256').update(canonical(source)).digest('hex');

function inspectedSource(packageRoot) {
  const installed = JSON.parse(
    readFileSync(resolve(packageRoot, 'package.json'), 'utf8')
  );
  if (installed.version !== manifest.version)
    throw new Error('SQLITE_VERSION_MISMATCH');
  const target = resolve(packageRoot, manifest.path);
  const current = canonical(readFileSync(target));
  const currentHash = digest(current);
  if (currentHash === manifest.patched)
    return { target, source: current, applied: true };
  if (currentHash !== manifest.pristine)
    throw new Error('SQLITE_SOURCE_MISMATCH');
  let patched = current;
  for (const { before, after } of manifest.replacements) {
    if (patched.split(before).length !== 2)
      throw new Error('SQLITE_PATCH_HUNK_MISMATCH');
    patched = patched.replace(before, () => after);
  }
  if (digest(patched) !== manifest.patched)
    throw new Error('SQLITE_PATCH_INTEGRITY_MISMATCH');
  return { target, source: patched, applied: false };
}

export function verifySqliteCleanupFix(packageRoot) {
  if (!inspectedSource(packageRoot).applied)
    throw new Error('SQLITE_CLEANUP_FIX_NOT_APPLIED');
}

export function applySqliteCleanupFix(packageRoot) {
  const inspected = inspectedSource(packageRoot);
  if (!inspected.applied) writeFileSync(inspected.target, inspected.source);
  verifySqliteCleanupFix(packageRoot);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const operation = process.argv[2];
  if (!['--apply', '--check'].includes(operation) || process.argv.length !== 3)
    throw new Error('EXPECTED_APPLY_OR_CHECK');
  if (
    process.env.MASARIFI_APP_VARIANT !== 'staging-development' ||
    process.env.EXPO_PUBLIC_CLIENT_MODE !== 'live' ||
    process.env.EXPO_PUBLIC_API_URL !== 'https://api.staging.masarifiratibi.com'
  )
    throw new Error('STAGING_DEV_BUILD_REQUIRED');
  const packageRoot = fileURLToPath(
    new URL('../node_modules/expo-sqlite/', import.meta.url)
  );
  if (operation === '--apply') applySqliteCleanupFix(packageRoot);
  else verifySqliteCleanupFix(packageRoot);
  console.log(
    'Staging DEV SQLite cleanup sources verified; native rebuild required.'
  );
}
