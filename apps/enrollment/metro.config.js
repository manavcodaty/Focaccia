import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
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

export default config;
