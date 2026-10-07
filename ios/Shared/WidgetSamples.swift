import Foundation

/// Sample nights for the widget gallery preview and the DEBUG self-test.
enum WidgetSamples {
  static let liveNight = WidgetSnapshot.Live(points: 23.5, live: 3, final: 2, upcoming: 1, top: .init(name: "McDavid", line: "2G 1A"))

  static let finishedNight = WidgetSnapshot.Live(points: 31.0, live: 0, final: 6, upcoming: 0, top: .init(name: "McDavid", line: "2G 2A"))

  /// Tonight with 16 of 17 playing and first puck `firstPuckIn` seconds after `now`.
  static func snapshot(now: Date, firstPuckIn: TimeInterval = 37 * 60, live: WidgetSnapshot.Live? = nil) -> WidgetSnapshot {
    let firstPuck = now.addingTimeInterval(firstPuckIn)
    func player(_ name: String, _ team: String, _ opponent: String, home: Bool, laterBy minutes: Double) -> WidgetSnapshot.Player {
      WidgetSnapshot.Player(name: name, team: team, opponent: opponent, home: home,
                            startUTC: ISODate.string(from: firstPuck.addingTimeInterval(minutes * 60)))
    }
    return WidgetSnapshot(
      updatedAt: ISODate.string(from: now),
      date: NhlGameDay.id(at: now),
      teamName: "Ice Breakers",
      playing: 16,
      total: 17,
      firstPuckUTC: ISODate.string(from: firstPuck),
      players: [
        player("Connor McDavid", "EDM", "LAK", home: false, laterBy: 0),
        player("Nathan MacKinnon", "COL", "CHI", home: true, laterBy: 0),
        player("Kirill Kaprizov", "MIN", "WPG", home: false, laterBy: 30),
        player("Quinn Hughes", "VAN", "SEA", home: true, laterBy: 180),
      ],
      live: live
    )
  }
}

@available(iOS 16.1, *)
extension WidgetSamples {
  static let liveState = PuckIQNightAttributes.ContentState(
    points: 23.5, live: 3, final: 2, upcoming: 1, topName: "McDavid", topLine: "2G 1A", clock: "P2 10:15")

  static func attributes(now: Date) -> PuckIQNightAttributes {
    PuckIQNightAttributes(teamName: "Ice Breakers", date: NhlGameDay.id(at: now))
  }
}
