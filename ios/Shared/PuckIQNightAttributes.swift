import ActivityKit
import Foundation

/// The Lock Screen / Dynamic Island Live Activity for one fantasy night. Compiled into the app,
/// which starts and updates it through PuckIQNative, and into PuckIQWidgets, which draws it.
/// The JSON shapes are `startOrUpdateLiveActivity(attrs, state)` in
/// services/native/widgetBridge.ts; future APNs pushes must use the same `content-state` keys.
@available(iOS 16.1, *)
struct PuckIQNightAttributes: ActivityAttributes {
  /// `LiveActivityState` in widgetBridge.ts.
  struct ContentState: Codable, Hashable {
    var points: Double
    var live: Int
    var `final`: Int
    var upcoming: Int
    var topName: String?
    var topLine: String?
    /// "P2 10:15", "INT 1", "Final": the most advanced clock among my games.
    var clock: String?
  }

  var teamName: String
  /// NHL game day, YYYY-MM-DD.
  var date: String
}

@available(iOS 16.1, *)
extension PuckIQNightAttributes.ContentState {
  var isLive: Bool { live > 0 }

  var pointsText: String { PointsText.format(points) }

  /// Compact status: "3 LIVE", then "2 TO GO" between games, then "FINAL".
  var statusText: String {
    if live > 0 { return "\(live) LIVE" }
    if upcoming > 0 { return "\(upcoming) TO GO" }
    return "FINAL"
  }
}
