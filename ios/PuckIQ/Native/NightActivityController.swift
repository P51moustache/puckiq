import ActivityKit
import Foundation
import os

/// Starts, updates and ends the fantasy-night Live Activity. One at a time, keyed by *night*
/// (game day + team name): an update for the running night updates it; a new night ends the
/// others and requests a fresh one. Below iOS 16.2 every call is a no-op.
actor NightActivityController {
  /// Without an update for this long the activity reads stale ("open PuckIQ to refresh"): the
  /// app only updates it while running until server pushes exist.
  static let staleAfter: TimeInterval = 15 * 60

  /// The night this app last started an activity for. When that night's activity is gone
  /// without the app ending it, the user swiped it away, so score updates don't bring it back.
  private static let startedNightKey = "PuckIQ.liveActivityNight"

  private let defaults: UserDefaults
  private let log = Logger(subsystem: "com.zlce.hockeystats", category: "LiveActivity")

  init(defaults: UserDefaults = .standard) {
    self.defaults = defaults
  }

  /// Live Activities are supported and allowed for this app.
  nonisolated var isEnabled: Bool {
    guard #available(iOS 16.2, *) else { return false }
    return ActivityAuthorizationInfo().areActivitiesEnabled
  }

  /// Shows `stateJSON` for the night in `attributesJSON`. Returns false when ActivityKit is
  /// unavailable or declines; throws only for JSON that doesn't match widgetBridge.ts.
  func startOrUpdate(attributesJSON: String, stateJSON: String) async throws -> Bool {
    guard #available(iOS 16.2, *) else { return false }
    let attributes = try JSONDecoder().decode(PuckIQNightAttributes.self, from: Data(attributesJSON.utf8))
    let state = try JSONDecoder().decode(PuckIQNightAttributes.ContentState.self, from: Data(stateJSON.utf8))
    return await show(state, for: attributes)
  }

  /// Ends every activity: with `finalStateJSON` it stays on the Lock Screen showing the final
  /// score (system default dismissal), without it disappears now.
  func end(finalStateJSON: String?) async throws {
    guard #available(iOS 16.2, *) else { return }
    let state = try finalStateJSON.map {
      try JSONDecoder().decode(PuckIQNightAttributes.ContentState.self, from: Data($0.utf8))
    }
    defaults.removeObject(forKey: Self.startedNightKey)
    await end(Activity<PuckIQNightAttributes>.activities, with: state.map { ActivityContent(state: $0, staleDate: nil) })
  }

  @available(iOS 16.2, *)
  private func show(_ state: PuckIQNightAttributes.ContentState, for attributes: PuckIQNightAttributes) async -> Bool {
    let night = Self.night(of: attributes)
    let content = ActivityContent(state: state, staleDate: Date().addingTimeInterval(Self.staleAfter))
    let running = Activity<PuckIQNightAttributes>.activities.filter {
      $0.activityState == .active || $0.activityState == .stale
    }

    if let current = running.first(where: { Self.night(of: $0.attributes) == night }) {
      await current.update(content)
      await end(running.filter { $0.id != current.id }, with: nil)
      return true
    }
    if defaults.string(forKey: Self.startedNightKey) == night {
      log.info("Live Activity for \(night, privacy: .public) was dismissed; not starting it again")
      return false
    }
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
    do {
      // Request before ending the others: the request is synchronous, so a second call can't
      // slip in between and start a duplicate.
      let activity = try Activity.request(attributes: attributes, content: content, pushType: nil)
      defaults.set(night, forKey: Self.startedNightKey)
      log.info("Started Live Activity \(activity.id, privacy: .public) for \(night, privacy: .public)")
    } catch {
      log.error("Live Activity request failed: \(error.localizedDescription, privacy: .public)")
      return false
    }
    await end(running, with: nil)
    return true
  }

  @available(iOS 16.2, *)
  private func end(_ activities: [Activity<PuckIQNightAttributes>], with content: ActivityContent<PuckIQNightAttributes.ContentState>?) async {
    for activity in activities {
      await activity.end(content, dismissalPolicy: content == nil ? .immediate : .default)
    }
  }

  @available(iOS 16.1, *)
  private static func night(of attributes: PuckIQNightAttributes) -> String {
    "\(attributes.date)|\(attributes.teamName)"
  }
}
