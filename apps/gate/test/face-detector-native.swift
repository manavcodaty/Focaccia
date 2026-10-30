// Run with swiftc modules/gate-face-detector/ios/GateFaceDetector.swift test/face-detector-native.swift -o /tmp/gate-face-test
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

@main
struct FaceDetectorNativeTest {
  static func main() throws {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".png")
    defer { try? FileManager.default.removeItem(at: url) }
    let context = CGContext(data: nil, width: 640, height: 480, bitsPerComponent: 8,
                            bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    for textured in [false, true] {
      context.setFillColor(CGColor(gray: 1, alpha: 1))
      context.fill(CGRect(x: 0, y: 0, width: 640, height: 480))
      if textured {
        context.setFillColor(CGColor(gray: 0.2, alpha: 1))
        for y in stride(from: 30, through: 450, by: 30) {
          context.fill(CGRect(x: 40, y: y, width: 560, height: 3))
        }
      }
      let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
      CGImageDestinationAddImage(destination, context.makeImage()!, nil)
      precondition(CGImageDestinationFinalize(destination))
      do {
        _ = try GateFaceDetector.detect(url.absoluteString)
        fatalError("A face-free image was accepted")
      } catch {
        let failure = error as NSError
        precondition(failure.domain == "GateFaceDetector" && failure.code == 2,
                     "Expected face rejection, got \(error)")
      }
    }
    do {
      _ = try GateFaceDetector.detect("file:///nonexistent-gate-photo.png")
      fatalError("A missing photo was accepted")
    } catch {
      precondition((error as NSError).code == 1)
    }
    print("Native face detector rejects blank paper, lined paper, and missing photos")
  }
}
