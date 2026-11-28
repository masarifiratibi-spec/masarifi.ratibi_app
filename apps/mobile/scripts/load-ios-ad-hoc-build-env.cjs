const { appendFileSync } = require('node:fs');
const { build } = require('../eas.json');

const name = process.env.EAS_BUILD_PROFILE ?? 'ios-ad-hoc';
const distribution = { 'ios-ad-hoc': 'internal', 'ios-app-store': 'store' }[name];
const profile = build[name];
if (!distribution || profile?.extends !== 'production' || profile.distribution !== distribution) {
  throw new Error('Unexpected iOS distribution profile');
}

const lines = Object.entries({ ...build.production.env, ...profile.env }).map(
  ([name, value]) => {
    if (
      !/^(EXPO_PUBLIC_|MASARIFI_)[A-Z0-9_]+$/.test(name) ||
      typeof value !== 'string' ||
      /[\r\n]/.test(value)
    ) {
      throw new Error('Unexpected iOS distribution profile variable');
    }
    return `${name}=${value}\n`;
  }
);
appendFileSync(process.env.GITHUB_ENV, lines.join(''));
