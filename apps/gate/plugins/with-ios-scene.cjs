const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

// SDK 55 has no scene delegate; iPadOS 27 requires one with the Xcode 27 SDK.
const sceneDelegate = `
class GateSceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
             options connectionOptions: UIScene.ConnectionOptions) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else { return }
    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    var launchOptions = appDelegate.gateLaunchOptions ?? [:]
    if let context = connectionOptions.urlContexts.first {
      launchOptions[.url] = context.url
      launchOptions[.sourceApplication] = context.options.sourceApplication
    }
    if let activity = connectionOptions.userActivities.first {
      launchOptions[.userActivityDictionary] = [
        "UIApplicationLaunchOptionsUserActivityKey": activity
      ]
    }
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: launchOptions)
    self.scene(scene, openURLContexts: connectionOptions.urlContexts)
    for activity in connectionOptions.userActivities {
      self.scene(scene, continue: activity)
    }
  }

  func scene(_ scene: UIScene, openURLContexts contexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    let application = UIApplication.shared
    for context in contexts {
      var options: [UIApplication.OpenURLOptionsKey: Any] = [
        .openInPlace: context.options.openInPlace
      ]
      options[.sourceApplication] = context.options.sourceApplication
      options[.annotation] = context.options.annotation
      _ = appDelegate.application(application, open: context.url, options: options)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    _ = appDelegate.application(UIApplication.shared, continue: userActivity,
                               restorationHandler: { _ in })
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?.applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?.applicationWillResignActive(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?.applicationDidEnterBackground(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?.applicationWillEnterForeground(UIApplication.shared)
  }
}
`;

function migrateAppDelegate(source) {
  if (source.includes('class GateSceneDelegate:')) return source;
  const windowProperty = '  var window: UIWindow?';
  const startup = /    window = UIWindow\(frame: UIScreen.main.bounds\)\s+factory.startReactNative\(\s+withModuleName: "main",\s+in: window,\s+launchOptions: launchOptions\)/;
  if (!source.includes(windowProperty) || !startup.test(source)) {
    throw new Error('Gate scene migration: unexpected AppDelegate template; review startup before prebuilding.');
  }
  return source
    .replace(windowProperty, `${windowProperty}\n  var gateLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?`)
    .replace(startup, '    gateLaunchOptions = launchOptions') + sceneDelegate;
}

module.exports = function withIosScene(config) {
  config = withAppDelegate(config, (config) => {
    config.modResults.contents = migrateAppDelegate(config.modResults.contents);
    return config;
  });
  return withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [{
          UISceneConfigurationName: 'Gate',
          UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).GateSceneDelegate',
        }],
      },
    };
    return config;
  });
};
module.exports.migrateAppDelegate = migrateAppDelegate;
