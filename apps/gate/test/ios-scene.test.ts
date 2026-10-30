import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);

test('iOS prebuild migrates startup to a scene and is safe to repeat', () => {
  const { migrateAppDelegate } = require('../plugins/with-ios-scene.cjs');
  const source = readFileSync(new URL('../ios/FacePassGate/AppDelegate.swift', import.meta.url), 'utf8');
  const migrated = migrateAppDelegate(`class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?
  func start() {
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
  }
}`);
  assert.equal(migrateAppDelegate(source), source);
  assert.equal(migrateAppDelegate(migrated), migrated);
  assert.doesNotMatch(migrated, /UIWindow\(frame: UIScreen.main.bounds\)/);
  assert.match(migrated, /UIWindow\(windowScene: windowScene\)/);
  assert.equal(migrated.match(/factory.startReactNative\(/g)?.length, 1);
  assert.match(migrated, /appDelegate.application\(application, open: context.url/);
  assert.match(migrated, /launchOptions\[.url\]/);
  assert.match(migrated, /applicationDidEnterBackground/);
  assert.throws(() => migrateAppDelegate('changed template'), /template/);
});

test('prebuild registers the scene delegate and keeps single-window behavior', () => {
  const withIosScene = require('../plugins/with-ios-scene.cjs');
  const config = withIosScene({ name: 'Gate', slug: 'gate' });
  const result = config.mods.ios.infoPlist({ modResults: {}, modRequest: {} });
  return Promise.resolve(result).then(({ modResults }) => {
    const manifest = modResults.UIApplicationSceneManifest;
    assert.equal(manifest.UIApplicationSupportsMultipleScenes, false);
    assert.equal(manifest.UISceneConfigurations.UIWindowSceneSessionRoleApplication[0]
      .UISceneDelegateClassName, '$(PRODUCT_MODULE_NAME).GateSceneDelegate');
  });
});
