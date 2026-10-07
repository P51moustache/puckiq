import Foundation

/// Reads and writes the widget snapshot JSON in the shared App Group defaults. The app writes
/// (via the PuckIQNative bridge); the widget extension reads.
struct WidgetSnapshotStore {
  /// UserDefaults key for the JSON string.
  static let key = "tonightSnapshot"

  enum StoreError: LocalizedError {
    case unavailable
    case invalid(Error)

    var errorDescription: String? {
      switch self {
      case .unavailable: return "App Group \(AppGroup.identifier) is unavailable"
      case .invalid(let error): return "Widget snapshot JSON is invalid: \(error)"
      }
    }
  }

  private let defaults: UserDefaults?

  init(defaults: UserDefaults? = AppGroup.defaults) {
    self.defaults = defaults
  }

  /// The snapshot, or nil when nothing (valid) has been published yet.
  func read() -> WidgetSnapshot? {
    guard let json = defaults?.string(forKey: Self.key) else { return nil }
    return try? WidgetSnapshot.decode(json: json)
  }

  /// Validates and stores `json` as published by JavaScript. Throws without writing when it
  /// does not decode, so a bad publish never replaces a good snapshot.
  func write(json: String) throws {
    guard let defaults else { throw StoreError.unavailable }
    do {
      _ = try WidgetSnapshot.decode(json: json)
    } catch {
      throw StoreError.invalid(error)
    }
    defaults.set(json, forKey: Self.key)
  }
}
