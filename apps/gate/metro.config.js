const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

module.exports = (async () => {
  const {
    prepareGateNetwork,
    shouldPrepareGateNetwork,
  } = await import('../../scripts/gate-network-bootstrap.mjs');
  if (shouldPrepareGateNetwork()) {
    await prepareGateNetwork();
  }

  const config = getDefaultConfig(projectRoot);
  config.resolver.assetExts.push('tflite');
  config.watchFolders = config.watchFolders ?? [];

  if (!config.watchFolders.includes(workspaceRoot)) {
    config.watchFolders.push(workspaceRoot);
  }

  config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ];

  return withNativeWind(config, {
    input: path.join(projectRoot, 'global.css'),
    inlineRem: 16,
  });
})();
