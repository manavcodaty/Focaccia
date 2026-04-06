#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const checkOnly = process.argv.includes('--check');
const rootDir = process.cwd();
const swiftShim = `${readFileSync(new URL('./expo-sqlite-swift-shim.swiftfrag', import.meta.url), 'utf8').trimEnd()}\n`;

function collectExpoSqlitePackageDirs() {
  const packageDirs = new Set();
  const pnpmStoreDir = path.join(rootDir, 'node_modules', '.pnpm');

  if (existsSync(pnpmStoreDir)) {
    for (const entry of readdirSync(pnpmStoreDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const packageJsonPath = path.join(
        pnpmStoreDir,
        entry.name,
        'node_modules',
        'expo-sqlite',
        'package.json'
      );

      if (existsSync(packageJsonPath)) {
        packageDirs.add(path.dirname(packageJsonPath));
      }
    }
  }

  const hoistedPackageJsonPath = path.join(rootDir, 'node_modules', 'expo-sqlite', 'package.json');
  if (existsSync(hoistedPackageJsonPath)) {
    packageDirs.add(path.dirname(hoistedPackageJsonPath));
  }

  return [...packageDirs];
}

function removeBrokenLinkIfNeeded(filePath) {
  try {
    const stats = lstatSync(filePath);
    if (stats.isSymbolicLink() && !existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch {
    // Nothing to remove.
  }
}

function syncExpoSqliteSources(packageDir) {
  const repairedPaths = [];
  const vendorDir = path.join(packageDir, 'vendor', 'sqlite3');
  const iosDir = path.join(packageDir, 'ios');

  for (const fileName of ['sqlite3.c', 'sqlite3.h']) {
    const sourcePath = path.join(vendorDir, fileName);
    const destinationPath = path.join(iosDir, fileName);

    if (!existsSync(sourcePath)) {
      throw new Error(`Missing Expo SQLite vendor source: ${sourcePath}`);
    }

    if (existsSync(destinationPath)) {
      continue;
    }

    repairedPaths.push(destinationPath);

    if (!checkOnly) {
      removeBrokenLinkIfNeeded(destinationPath);
      copyFileSync(sourcePath, destinationPath);
    }
  }

  return repairedPaths;
}

function ensureSQLiteModuleShim(packageDir) {
  const modulePath = path.join(packageDir, 'ios', 'SQLiteModule.swift');

  if (!existsSync(modulePath)) {
    throw new Error(`Missing Expo SQLite Swift module: ${modulePath}`);
  }

  const currentContents = readFileSync(modulePath, 'utf8');
  if (currentContents.includes('// BEGIN FOCACCIA EXPO_SQLITE SHIM')) {
    return [];
  }

  const importLine = 'import ExpoModulesCore\n';
  if (!currentContents.includes(importLine)) {
    throw new Error(`Unable to locate ExpoModulesCore import in ${modulePath}`);
  }

  if (!checkOnly) {
    const patchedContents = currentContents.replace(importLine, `${importLine}\n${swiftShim}\n`);
    writeFileSync(modulePath, patchedContents);
  }

  return [modulePath];
}

const packageDirs = collectExpoSqlitePackageDirs();

if (packageDirs.length === 0) {
  console.log('ensure-expo-sqlite-ios-files: no expo-sqlite install found');
  process.exit(0);
}

const repairedPaths = [];

for (const packageDir of packageDirs) {
  repairedPaths.push(...syncExpoSqliteSources(packageDir));
  repairedPaths.push(...ensureSQLiteModuleShim(packageDir));
}

if (repairedPaths.length === 0) {
  console.log('ensure-expo-sqlite-ios-files: expo-sqlite iOS sources and shim already present');
  process.exit(0);
}

if (checkOnly) {
  console.error('ensure-expo-sqlite-ios-files: missing expo-sqlite iOS repairs:');
  for (const filePath of repairedPaths) {
    console.error(`- ${path.relative(rootDir, filePath)}`);
  }
  process.exit(1);
}

console.log('ensure-expo-sqlite-ios-files: restored expo-sqlite iOS files:');
for (const filePath of repairedPaths) {
  console.log(`- ${path.relative(rootDir, filePath)}`);
}
