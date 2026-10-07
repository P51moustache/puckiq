import Foundation

/// The NHL *game day*, mirroring `services/nhlDate.ts`: the Eastern calendar date, rolling over
/// at 6:00 AM ET instead of midnight so a late Pacific game still counts toward the night it
/// started. Like the JS, it shifts the instant by six hours, so on the two DST nights the
/// rollover lands at 5 or 7 AM — never near a game.
enum NhlGameDay {
  /// `GAME_DAY_ROLLOVER_HOUR_ET` in services/nhlDate.ts.
  static let rolloverHourET = 6

  private static let rolloverOffset = TimeInterval(rolloverHourET * 60 * 60)

  private static let eastern: Calendar = {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "America/New_York")!
    return calendar
  }()

  /// The game day at `now`, as YYYY-MM-DD.
  static func id(at now: Date) -> String {
    let parts = eastern.dateComponents([.year, .month, .day], from: now.addingTimeInterval(-rolloverOffset))
    return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
  }

  /// The first instant after `now` that belongs to the next game day.
  static func nextRollover(after now: Date) -> Date {
    let shiftedDayStart = eastern.startOfDay(for: now.addingTimeInterval(-rolloverOffset))
    let nextShiftedDay = eastern.date(byAdding: .day, value: 1, to: shiftedDayStart) ?? shiftedDayStart.addingTimeInterval(24 * 60 * 60)
    return nextShiftedDay.addingTimeInterval(rolloverOffset)
  }
}
