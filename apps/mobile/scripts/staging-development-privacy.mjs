import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { validateClientBuildEnvironment } from './check-client-runtime.mjs';

const require = createRequire(import.meta.url);

export function createPrivacyDevelopmentLaunch(command = 'start', environment = process.env) {
  if (!['start', 'config'].includes(command))
    throw new Error('Unsupported privacy development command');
  const publishableKey = environment.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!/^pk_test_[A-Za-z0-9_-]{10,}$/.test(publishableKey ?? ''))
    throw new Error('Privacy development requires an externally supplied test publishable key');
  const env = {
    ...environment,
    EAS_BUILD_PROFILE: 'development-staging-privacy',
    MASARIFI_APP_VARIANT: 'staging-development-privacy',
    EXPO_PUBLIC_APP_VARIANT: 'staging-development-privacy',
    EXPO_PUBLIC_CLIENT_MODE: 'live',
    EXPO_PUBLIC_API_URL: 'https://api.staging.masarifiratibi.com/dev-privacy',
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey,
    EXPO_PUBLIC_APP_LOCK_ENABLED: 'false',
    EXPO_PUBLIC_VOICE_AUTOMATIC_POSTING: 'true',
    EXPO_NO_DOTENV: '1'
  };
  if (process.platform === 'win32') {
    env.NODE_OPTIONS = [env.NODE_OPTIONS, '--dns-result-order=ipv4first'].filter(Boolean).join(' ');
  }
  validateClientBuildEnvironment({ ...env, NODE_ENV: 'production' });
  const args = command === 'start'
    ? ['start', '--dev-client', '--localhost', '--port', '8082', '--max-workers', '1']
    : ['config', '--type', 'public', '--json'];
  return { env, args, cwd: fileURLToPath(new URL('..', import.meta.url)) };
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  if (process.argv.length > 3) throw new Error('Unsupported privacy development command arguments');
  const launch = createPrivacyDevelopmentLaunch(process.argv[2]);
  const child = spawn(process.execPath, [require.resolve('expo/bin/cli'), ...launch.args], {
    cwd: launch.cwd, env: launch.env, stdio: 'inherit', windowsHide: true
  });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
}
