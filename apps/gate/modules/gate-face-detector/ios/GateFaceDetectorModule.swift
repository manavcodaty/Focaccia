import ExpoModulesCore

public class GateFaceDetectorModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GateFaceDetector")
    AsyncFunction("detect") { (uri: String) -> [String: Any] in
      try GateFaceDetector.detect(uri)
    }
  }
}
