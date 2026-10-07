import Foundation

/// What the widgets show: the JSON `WidgetSnapshot` that `services/native/widgetBridge.ts`
/// publishes. Field names are that file's contract. Timestamps stay ISO strings and are parsed
/// on read, so one odd timestamp never blanks the widget.
struct WidgetSnapshot: Codable, Equatable {
  struct Player: Codable, Equatable {
    let name: String
    /// Team abbreviation, e.g. "EDM".
    let team: String
    /// Opponent abbreviation, e.g. "LAK".
    let opponent: String
    let home: Bool
    /// ISO puck drop, or nil when unknown.
    let startUTC: String?

    var puckDrop: Date? { ISODate.parse(startUTC) }
    /// "@LAK" away, "vs LAK" at home.
    var matchup: String { home ? "vs \(opponent)" : "@\(opponent)" }
  }

  struct Live: Codable, Equatable {
    struct Top: Codable, Equatable {
      let name: String
      /// Stat line, e.g. "2G 1A"; may be empty.
      let line: String
    }

    let points: Double
    let live: Int
    let `final`: Int
    let upcoming: Int
    let top: Top?
  }

  let updatedAt: String
  /// NHL game day, YYYY-MM-DD (see NhlGameDay).
  let date: String
  let teamName: String
  let playing: Int
  let total: Int
  let firstPuckUTC: String?
  /// Up to 8, earliest puck drop first.
  let players: [Player]
  let live: Live?

  var firstPuck: Date? { ISODate.parse(firstPuckUTC) }
  var updated: Date? { ISODate.parse(updatedAt) }

  static func decode(json: String) throws -> WidgetSnapshot {
    try JSONDecoder().decode(WidgetSnapshot.self, from: Data(json.utf8))
  }
}

/// ISO-8601 timestamps from JavaScript (`toISOString()`, with milliseconds) and the NHL API
/// (whole seconds).
enum ISODate {
  private static let fractional: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()

  private static let whole: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]
    return formatter
  }()

  static func parse(_ value: String?) -> Date? {
    guard let value, !value.isEmpty else { return nil }
    return fractional.date(from: value) ?? whole.date(from: value)
  }

  static func string(from date: Date) -> String {
    fractional.string(from: date)
  }
}
