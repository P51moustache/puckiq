import Foundation

// Pure presentation core for the Tonight widget: phase, timeline schedule and text formatting.

/// What the Tonight widget shows at one instant: a pure function of the snapshot and the time,
/// so the timeline, the previews and the self-test agree.
enum TonightPhase: Equatable {
  /// Nothing published yet.
  case setup
  /// The snapshot is from an earlier game day (the app hasn't run today).
  case stale(teamName: String)
  /// Nobody on the roster plays tonight.
  case noGames(teamName: String, total: Int)
  /// Before the first puck drop; `urgent` inside the last hour (the app's red lock bar).
  case countdown(playing: Int, total: Int, firstPuck: Date, urgent: Bool)
  /// Games have started but the app hasn't published live points yet.
  case underway(playing: Int, total: Int)
  /// The night is on: points so far, as of the last publish.
  case live(WidgetSnapshot.Live)
  /// Every one of my games is over.
  case finished(WidgetSnapshot.Live)

  /// TonightScreen turns the first-lock bar red inside the last hour.
  static let urgentWindow: TimeInterval = 60 * 60

  static func resolve(_ snapshot: WidgetSnapshot?, at now: Date) -> TonightPhase {
    guard let snapshot else { return .setup }
    guard snapshot.date == NhlGameDay.id(at: now) else { return .stale(teamName: snapshot.teamName) }
    if let live = snapshot.live {
      if live.live == 0 && live.upcoming == 0 && live.final > 0 { return .finished(live) }
      if live.live > 0 || live.final > 0 { return .live(live) }
    }
    guard snapshot.playing > 0 else { return .noGames(teamName: snapshot.teamName, total: snapshot.total) }
    if let firstPuck = snapshot.firstPuck, firstPuck > now {
      let urgent = firstPuck.timeIntervalSince(now) <= urgentWindow
      return .countdown(playing: snapshot.playing, total: snapshot.total, firstPuck: firstPuck, urgent: urgent)
    }
    return .underway(playing: snapshot.playing, total: snapshot.total)
  }
}

/// When the Tonight timeline changes on its own and when WidgetKit should ask for a new one.
enum TonightSchedule {
  /// Reload at least this often: about 48 a day, inside WidgetKit's daily budget.
  static let refreshInterval: TimeInterval = 30 * 60

  /// Now, plus each later instant where the phase flips without new data: the urgent mark an
  /// hour before first puck, first puck itself, and the game-day rollover.
  static func entryDates(for snapshot: WidgetSnapshot?, now: Date) -> [Date] {
    guard let snapshot else { return [now] }
    var flips = [NhlGameDay.nextRollover(after: now)]
    if let firstPuck = snapshot.firstPuck {
      flips.append(firstPuck.addingTimeInterval(-TonightPhase.urgentWindow))
      flips.append(firstPuck)
    }
    return [now] + Set(flips.filter { $0 > now }).sorted()
  }

  /// At first puck (so live mode picks up fresh data) or after `refreshInterval`, whichever
  /// comes first.
  static func nextReload(for snapshot: WidgetSnapshot?, now: Date) -> Date {
    let regular = now.addingTimeInterval(refreshInterval)
    guard let firstPuck = snapshot?.firstPuck, firstPuck > now else { return regular }
    return min(firstPuck, regular)
  }
}

/// Points the way the app prints them (`toFixed(1)` in services/fantasy/scoring.ts).
enum PointsText {
  static func format(_ points: Double) -> String {
    let rounded = (points * 10).rounded() / 10
    return String(format: "%.1f", rounded == 0 ? 0 : rounded)
  }
}

/// "Connor McDavid" → "C. McDavid", so four rows fit the medium widget. Single names stay.
enum ShortName {
  static func of(_ name: String) -> String {
    let parts = name.split(separator: " ")
    guard parts.count > 1, let initial = parts.first?.first else { return name }
    return "\(initial). " + parts.dropFirst().joined(separator: " ")
  }
}

extension WidgetSnapshot.Live.Top {
  /// "McDavid · 2G 1A", or just the name before the line has any stats.
  var summary: String { line.isEmpty ? name : "\(name) · \(line)" }
}
