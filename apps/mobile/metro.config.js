// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('node:path');
config.watchFolders = [
  path.resolve(__dirname, '../../packages/transaction-parser')
];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

config.resolver.assetExts.push('wasm');

const originalResolveRequest = config.resolver.resolveRequest;
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
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
