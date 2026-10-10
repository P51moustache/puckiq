import Foundation
import PhotosUI
import React
import UIKit
import Vision

/// Roster import from screenshots: the system photo picker (no photo-library permission; only the
/// images the user picks reach the app) and on-device text recognition with Vision. Nothing is
/// uploaded. Lines come back with positions so JS can rebuild rows
/// (services/rosterImport/ocrRows.ts); matching to NHL players happens in JS.
final class RosterScanner: NSObject, PHPickerViewControllerDelegate {
  struct Line: Encodable {
    let text: String
    /// Normalised 0...1, origin top-left (Vision's boxes are bottom-left; flipped here).
    let x: Double
    let y: Double
    let width: Double
    let height: Double
  }

  enum ScanError: LocalizedError {
    case busy
    case noScreen

    var errorDescription: String? {
      switch self {
      case .busy: return "A screenshot import is already open."
      case .noScreen: return "Couldn't open the photo picker."
      }
    }
  }

  /// `nil` when the user cancels; otherwise one array of lines per picked image, in pick order.
  typealias Completion = (Result<[[Line]]?, Error>) -> Void

  private var completion: Completion?
  private let work = DispatchQueue(label: "com.zlce.hockeystats.roster-scanner", qos: .userInitiated)

  func scan(maxImages: Int, completion: @escaping Completion) {
    DispatchQueue.main.async {
      guard self.completion == nil else {
        completion(.failure(ScanError.busy))
        return
      }
      guard let presenter = RCTPresentedViewController() else {
        completion(.failure(ScanError.noScreen))
        return
      }
      var configuration = PHPickerConfiguration()
      configuration.filter = .images
      configuration.selectionLimit = max(1, maxImages)
      let picker = PHPickerViewController(configuration: configuration)
      picker.delegate = self
      self.completion = completion
      presenter.present(picker, animated: true)
    }
  }

  func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
    picker.dismiss(animated: true)
    guard let completion = completion else { return }
    self.completion = nil
    guard !results.isEmpty else {
      completion(.success(nil))
      return
    }
    work.async {
      completion(Result<[[Line]]?, Error> {
        try results.map { try self.recognize(self.loadImage(from: $0.itemProvider)) }
      })
    }
  }

  /// Blocks the work queue until the picked image loads (the picker hands it over asynchronously).
  private func loadImage(from provider: NSItemProvider) throws -> UIImage? {
    guard provider.canLoadObject(ofClass: UIImage.self) else { return nil }
    let done = DispatchSemaphore(value: 0)
    var image: UIImage?
    var failure: Error?
    provider.loadObject(ofClass: UIImage.self) { object, error in
      image = object as? UIImage
      failure = error
      done.signal()
    }
    done.wait()
    if let failure { throw failure }
    return image
  }

  private func recognize(_ image: UIImage?) throws -> [Line] {
    guard let image, let cgImage = image.cgImage else { return [] }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    // Player names aren't dictionary words; correction "fixes" them into the wrong ones.
    request.usesLanguageCorrection = false
    let handler = VNImageRequestHandler(cgImage: cgImage, orientation: CGImagePropertyOrientation(image.imageOrientation))
    try handler.perform([request])
    return (request.results ?? []).compactMap { observation in
      guard let text = observation.topCandidates(1).first?.string else { return nil }
      let box = observation.boundingBox
      return Line(text: text, x: box.minX, y: 1 - box.maxY, width: box.width, height: box.height)
    }
  }
}

private extension CGImagePropertyOrientation {
  init(_ orientation: UIImage.Orientation) {
    switch orientation {
    case .up: self = .up
    case .upMirrored: self = .upMirrored
    case .down: self = .down
    case .downMirrored: self = .downMirrored
    case .left: self = .left
    case .leftMirrored: self = .leftMirrored
    case .right: self = .right
    case .rightMirrored: self = .rightMirrored
    @unknown default: self = .up
    }
  }
}
