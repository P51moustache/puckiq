import Foundation

// Compiled into both the PuckIQ app and the PuckIQWidgets extension (see ios/Shared/).

/// The App Group the app and the PuckIQWidgets extension share. `identifier` must match
/// `com.apple.security.application-groups` in PuckIQ.entitlements and PuckIQWidgets.entitlements.
enum AppGroup {
  static let identifier = "group.com.zlce.hockeystats"

  /// Shared defaults. Reads and writes stay app-local when the entitlement is missing.
  static var defaults: UserDefaults? { UserDefaults(suiteName: identifier) }
}

/// Deep links the widgets and the Live Activity open. `puckiq://` (no path) lands on Expo
/// Router's index route, which is Tonight.
enum PuckIQLink {
  static let tonight = URL(string: "puckiq://")!
}
