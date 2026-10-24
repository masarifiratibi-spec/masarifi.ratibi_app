/* global __dirname */
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'src');
const production = path.join(source, 'services', 'production');
const replacements = new Map();
for (const name of [
  'financial-planning-service',
  'reports-service',
  'automatic-tracking-service',
  'voice-analyzer-service',
  'assistant-service',
  'engagement-service'
]) {
  replacements.set(
    path.join(source, 'services', `${name}.ts`),
    path.join(production, `${name}.ts`)
  );
}
for (const name of [
  'core-finance-service',
  'subscription-settings-service',
  'client-demo-locale'
]) {
  replacements.set(
    path.join(source, 'services', 'mocks', `${name}.ts`),
    path.join(production, `${name}.ts`)
  );
}
replacements.set(
  path.join(source, 'features', 'auth', 'auth-flow.ts'),
  path.join(production, 'auth-flow.ts')
);
replacements.set(
  path.join(source, 'domain', 'core-finance-seeds.ts'),
  path.join(production, 'core-finance-seeds.ts')
);
replacements.set(
  path.join(source, 'domain', 'demo-session.ts'),
  path.join(production, 'demo-session.ts')
);
for (const name of ['index', 'manage', 'checkout']) {
  replacements.set(
    path.join(root, 'app', 'subscriptions', `${name}.tsx`),
    path.join(production, 'deferred-subscription-route.tsx')
  );
}

exports.productionFile = (filename) =>
  replacements.get(path.normalize(filename)) ?? filename;
const escaped = root
  .split(/[\\/]/)
  .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('[\\\\/]');
exports.developmentRoutes = new RegExp(
  `${escaped}[\\\\/]app[\\\\/](?:(?:foundation|design-system)[\\\\/]|tracking[\\\\/]demo\\.tsx$)`
);
exports.isLiveProduction = (environment) =>
  environment.EXPO_PUBLIC_CLIENT_MODE === 'live' &&
  (environment.NODE_ENV === 'production' ||
    environment.EAS_BUILD_PROFILE === 'production');
