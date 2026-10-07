import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { validateClientBuildEnvironment } from './check-client-runtime.mjs';

const require = createRequire(import.meta.url);
const mobileRoot = fileURLToPath(new URL('..', import.meta.url));
const command = process.argv[2] ?? 'start';
if (!['start', 'prebuild', 'config'].includes(command)) throw new Error('Unsupported development command');
let publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) {
  const publicConfig = readFileSync(new URL('../.env.staging-development.local', import.meta.url), 'utf8');
  publishableKey = publicConfig.match(/^EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=(pk_live_[A-Za-z0-9_-]+)\s*$/m)?.[1];
}
const env = {
  ...process.env,
  EAS_BUILD_PROFILE: 'development-staging',
  MASARIFI_APP_VARIANT: 'staging-development',
  EXPO_PUBLIC_CLIENT_MODE: 'live',
  EXPO_PUBLIC_API_URL: 'https://api.staging.masarifiratibi.com',
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey,
  EXPO_PUBLIC_APP_LOCK_ENABLED: 'false',
  EXPO_PUBLIC_VOICE_TIMING_ENABLED: 'true',
  EXPO_PUBLIC_VOICE_DIAGNOSTICS_ENABLED: 'true',
  EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED: 'true'
};
// USB reverse uses IPv4; Windows otherwise resolves the localhost listener to IPv6.
if (process.platform === 'win32') {
  env.NODE_OPTIONS = [env.NODE_OPTIONS, '--dns-result-order=ipv4first'].filter(Boolean).join(' ');
}
validateClientBuildEnvironment({ ...env, NODE_ENV: 'production' });
const args = command === 'start'
  ? ['start', '--dev-client', '--localhost', '--port', '8081']
  : command === 'prebuild' ? ['prebuild', '--platform', 'android', '--no-install']
    : ['config', '--type', 'public', '--json'];
const child = spawn(process.execPath, [require.resolve('expo/bin/cli'), ...args, ...process.argv.slice(3)], {
  cwd: mobileRoot, env, stdio: 'inherit', windowsHide: true
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
