const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
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

module.exports = config;
