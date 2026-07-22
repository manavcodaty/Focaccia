import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = (async () => {
  const {
    prepareNativeNetwork,
    shouldPrepareNativeNetwork,
  } = await import('../../scripts/gate-network-bootstrap.mjs');
  if (shouldPrepareNativeNetwork()) {
    await prepareNativeNetwork({ appName: 'enrollment' });
  }

  const resolvedConfig = getDefaultConfig(projectRoot);
  resolvedConfig.resolver.assetExts.push('tflite');
  resolvedConfig.watchFolders = resolvedConfig.watchFolders ?? [];

  if (!resolvedConfig.watchFolders.includes(workspaceRoot)) {
    resolvedConfig.watchFolders.push(workspaceRoot);
  }

  resolvedConfig.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ];

  return resolvedConfig;
})();

export default config;
