const { appendFileSync } = require('node:fs');
const { build } = require('../eas.json');

const profile = build['ios-ad-hoc'];
if (profile.extends !== 'production' || profile.distribution !== 'internal') {
  throw new Error('Unexpected iOS Ad Hoc profile');
}

const lines = Object.entries({ ...build.production.env, ...profile.env }).map(
  ([name, value]) => {
    if (
      !/^(EXPO_PUBLIC_|MASARIFI_)[A-Z0-9_]+$/.test(name) ||
      typeof value !== 'string' ||
      /[\r\n]/.test(value)
    ) {
      throw new Error('Unexpected iOS Ad Hoc profile variable');
    }
    return `${name}=${value}\n`;
  }
);
appendFileSync(process.env.GITHUB_ENV, lines.join(''));
