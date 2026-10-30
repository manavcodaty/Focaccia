import Foundation
import ImageIO
import Vision

enum GateFaceDetector {
  static func detect(_ uri: String) throws -> [String: Any] {
  guard let url = URL(string: uri), url.isFileURL,
        let source = CGImageSourceCreateWithURL(url as CFURL, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    throw NSError(domain: "GateFaceDetector", code: 1,
                  userInfo: [NSLocalizedDescriptionKey: "Could not read the verification photo."])
  }
  // Input is an upright image produced by expo-image-manipulator.
  let request = VNDetectFaceLandmarksRequest()
  try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
  let faces = request.results ?? []
  guard faces.count == 1, let face = faces.first,
        face.confidence >= 0.9, let yaw = face.yaw, let roll = face.roll,
        let leftEye = face.landmarks?.leftEye, leftEye.pointCount > 0,
        let rightEye = face.landmarks?.rightEye, rightEye.pointCount > 0 else {
    throw NSError(domain: "GateFaceDetector", code: 2,
                  userInfo: [NSLocalizedDescriptionKey: "Keep exactly one clear face in the frame. No valid face was detected."])
  }
  let box = face.boundingBox
  let width = Double(image.width)
  let height = Double(image.height)
  func eyeCenter(_ eye: VNFaceLandmarkRegion2D) -> [String: Double] {
    let points = eye.normalizedPoints
    let x = points.reduce(0.0) { $0 + Double($1.x) } / Double(points.count)
    let y = points.reduce(0.0) { $0 + Double($1.y) } / Double(points.count)
    return ["x": (box.minX + x * box.width) * width,
            "y": (1 - box.minY - y * box.height) * height]
  }
  return [
    "bounds": ["x": box.minX * width, "y": (1 - box.maxY) * height,
               "width": box.width * width, "height": box.height * height],
    "faceCount": faces.count, "frameWidth": width, "frameHeight": height,
    "leftEye": eyeCenter(leftEye), "rightEye": eyeCenter(rightEye),
    "leftEyeOpenProbability": NSNull(), "rightEyeOpenProbability": NSNull(),
    "yawAngle": yaw.doubleValue * 180 / .pi,
    "rollAngle": -roll.doubleValue * 180 / .pi,
    "pitchAngle": face.pitch?.doubleValue ?? 0,
    "trackedAt": Date().timeIntervalSince1970 * 1000
  ]
  }
}
