/* eslint-disable @typescript-eslint/no-var-requires -- Metro loads CommonJS configuration. */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('node:path');
const {
  productionFile,
  developmentRoutes,
  isLiveProduction
} = require('./scripts/production-entrypoints.cjs');
const liveProduction = isLiveProduction(process.env);
config.watchFolders = [
  path.resolve(__dirname, '../../packages/transaction-parser')
];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

config.resolver.assetExts.push('wasm');

const originalResolveRequest = config.resolver.resolveRequest;
if (liveProduction) {
  const prior = config.resolver.blockList;
  config.resolver.blockList = [
    ...(Array.isArray(prior) ? prior : prior ? [prior] : []),
    developmentRoutes
  ];
}
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('zustand')) {
    try {
      const resolved = require.resolve(moduleName, { paths: [__dirname] });
      return {
        filePath: resolved,
        type: 'sourceFile'
      };
    } catch {
      // fallback
    }
  }
  const resolved = originalResolveRequest
    ? originalResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
  return liveProduction && resolved.type === 'sourceFile'
    ? { ...resolved, filePath: productionFile(resolved.filePath) }
    : resolved;
};

module.exports = config;
