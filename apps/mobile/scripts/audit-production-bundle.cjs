/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const directory = path.resolve(
  process.argv[2] ?? '.expo/report-closure-live-bundle'
);
const files = fs
  .readdirSync(directory, { recursive: true })
  .map((name) => path.join(directory, name));
const mapFile = files.find(
  (file) =>
    file.endsWith('.js.map') && file.includes(`${path.sep}android${path.sep}`)
);
if (!mapFile) throw Error('ANDROID_SOURCE_MAP_REQUIRED');
const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
const sources = map.sources.map((source) => source.replaceAll('\\', '/'));
const forbidden = sources.filter((source) =>
  /\/src\/(?:services\/mocks\/|test-utils\/|domain\/demo-session)|\/src\/features\/(?:foundation\/|design-system\/|subscriptions\/Subscription(?:Checkout|Manage)Screen)|\/app\/(?:foundation\/|design-system\/|tracking\/demo)/.test(
    source
  )
);
const entrypoints = sources.filter((source) =>
  source.includes('/src/services/production/')
);
if (forbidden.length || entrypoints.length < 11)
  throw Error('PRODUCTION_GRAPH_NOT_ISOLATED:' + forbidden.join(','));
const bundle = mapFile.slice(0, -4);
console.log(
  JSON.stringify(
    {
      diagnosticOnly: true,
      bundleSHA256: crypto
        .createHash('sha256')
        .update(fs.readFileSync(bundle))
        .digest('hex'),
      sources: sources.length,
      productionEntrypoints: entrypoints,
      forbiddenSources: forbidden
    },
    null,
    2
  )
);
