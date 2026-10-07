import SwiftUI

/// The Tonight widget's layouts. The extension maps `WidgetFamily` onto these; the DEBUG
/// self-test renders them straight to PNG. Views take plain values (no WidgetKit environment),
/// so they draw the same anywhere.
enum TonightLayout: CaseIterable {
  case small
  case medium
  case rectangular
  case inline
}

@available(iOS 16.1, *)
struct TonightWidgetView: View {
  let layout: TonightLayout
  let snapshot: WidgetSnapshot?
  /// The timeline entry's date.
  let now: Date

  /// Home Screen widgets pad themselves (content margins are off) so iOS 16, 17+ and the PNG
  /// previews lay out the same.
  static let homeScreenPadding: CGFloat = 14

  var body: some View {
    let phase = TonightPhase.resolve(snapshot, at: now)
    switch layout {
    case .small:
      TonightHeroColumn(phase: phase, now: now)
        .padding(Self.homeScreenPadding)
    case .medium:
      TonightMediumView(phase: phase, snapshot: snapshot, now: now)
        .padding(Self.homeScreenPadding)
    case .rectangular:
      TonightRectangularView(phase: phase, now: now)
    case .inline:
      TonightInlineView(phase: phase, now: now)
    }
  }
}

// MARK: - Home screen

/// Kicker, the big number and the bar: all of the small widget, the left half of the medium.
@available(iOS 16.1, *)
struct TonightHeroColumn: View {
  let phase: TonightPhase
  let now: Date
  /// The medium widget lists the top performer in its own column.
  var showsTop = true

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      BroadcastKicker(text: kicker)
      Spacer(minLength: 6)
      content
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  private var kicker: String {
    switch phase {
    case .setup, .stale: return "PuckIQ"
    case .noGames, .countdown, .underway, .finished: return "Tonight"
    case .live: return "Live"
    }
  }

  @ViewBuilder private var content: some View {
    switch phase {
    case .setup:
      TonightMessage(title: "Open PuckIQ to set up your team", detail: nil)
    case .stale(let teamName):
      TonightMessage(title: "Open PuckIQ for tonight", detail: teamName)
    case .noGames(_, let total):
      TonightMessage(title: "No games tonight", detail: total > 0 ? "All \(total) of your players rest" : nil)
    case .countdown(let playing, let total, let firstPuck, let urgent):
      PlayingCount(playing: playing, total: total)
      Spacer(minLength: 8)
      BroadcastBar(label: "First lock", fill: urgent ? Broadcast.red : Broadcast.carbonRaised) {
        countdownText(from: now, to: firstPuck)
      }
    case .underway(let playing, let total):
      PlayingCount(playing: playing, total: total)
      Spacer(minLength: 8)
      BroadcastBar(label: "Games on") { Text("LIVE") }
    case .live(let live):
      PointsCount(points: live.points, top: showsTop ? live.top : nil)
      Spacer(minLength: 8)
      NightCountsRow(live: live.live, final: live.final, upcoming: live.upcoming)
    case .finished(let live):
      PointsCount(points: live.points, top: showsTop ? live.top : nil)
      Spacer(minLength: 8)
      BroadcastBar(label: "All games", fill: Broadcast.carbonRaised) { Text("FINAL") }
    }
  }
}

/// The medium widget: the hero column plus who plays when (or the top performer once live).
@available(iOS 16.1, *)
struct TonightMediumView: View {
  let phase: TonightPhase
  let snapshot: WidgetSnapshot?
  let now: Date

  /// Players listed in the medium widget.
  static let maxPlayers = 4
  /// Fits the stacked lock bar and "23.5 PTS" while leaving ~180 pt for the player rows.
  static let heroColumnWidth: CGFloat = 132

  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      TonightHeroColumn(phase: phase, now: now, showsTop: !hasDetail)
        .frame(width: hasDetail ? Self.heroColumnWidth : nil)
      if hasDetail {
        Rectangle().fill(Broadcast.carbonRaised).frame(width: 1)
        detail.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      }
    }
  }

  private var hasDetail: Bool {
    switch phase {
    case .setup, .stale, .noGames: return false
    case .countdown, .underway, .live, .finished: return true
    }
  }

  @ViewBuilder private var detail: some View {
    switch phase {
    case .live(let live), .finished(let live):
      TopPerformerBlock(top: live.top, updated: snapshot?.updated)
    default:
      PlayerList(players: Array((snapshot?.players ?? []).prefix(Self.maxPlayers)))
    }
  }
}

@available(iOS 16.1, *)
private struct TonightMessage: View {
  let title: String
  let detail: String?

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(title)
        .font(Broadcast.numerals(19))
        .foregroundStyle(Broadcast.white)
        .lineLimit(3)
        .minimumScaleFactor(0.8)
      if let detail {
        Text(detail)
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(Broadcast.sub)
          .lineLimit(2)
      }
    }
  }
}

/// "16" with "OF 17 / PLAYING" beside it, like the Tonight hero.
@available(iOS 16.1, *)
private struct PlayingCount: View {
  let playing: Int
  let total: Int

  var body: some View {
    HStack(alignment: .bottom, spacing: 6) {
      Text("\(playing)").font(Broadcast.numerals(46)).foregroundStyle(Broadcast.white)
      VStack(alignment: .leading, spacing: 1) {
        Text("OF \(total)").font(Broadcast.numerals(16)).foregroundStyle(Broadcast.sub)
        Text("PLAYING").font(Broadcast.label(9)).tracking(1).foregroundStyle(Broadcast.white)
      }
      .padding(.bottom, 7)
    }
    .lineLimit(1)
  }
}

/// "23.5 PTS" and the top performer under it.
@available(iOS 16.1, *)
private struct PointsCount: View {
  let points: Double
  let top: WidgetSnapshot.Live.Top?

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack(alignment: .lastTextBaseline, spacing: 4) {
        Text(PointsText.format(points))
          .font(Broadcast.numerals(42))
          .foregroundStyle(Broadcast.white)
          .minimumScaleFactor(0.6)
        Text("PTS").font(Broadcast.numerals(15)).foregroundStyle(Broadcast.sub)
      }
      if let top {
        Text(top.summary).font(Broadcast.label(10)).foregroundStyle(Broadcast.sub)
      }
    }
    .lineLimit(1)
  }
}

/// LIVE / FINAL / TO GO counts; the live count goes red while games are on.
@available(iOS 16.1, *)
struct NightCountsRow: View {
  let live: Int
  let `final`: Int
  let upcoming: Int
  var size: CGFloat = 18

  var body: some View {
    HStack(spacing: 12) {
      BroadcastStat(value: "\(live)", label: "Live", valueColor: live > 0 ? Broadcast.red : Broadcast.white, size: size)
      BroadcastStat(value: "\(`final`)", label: "Final", size: size)
      BroadcastStat(value: "\(upcoming)", label: "To go", size: size)
    }
  }
}

@available(iOS 16.1, *)
private struct PlayerList: View {
  let players: [WidgetSnapshot.Player]

  var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      Text("PUCK DROP").font(Broadcast.label(9)).tracking(1).foregroundStyle(Broadcast.sub)
      ForEach(Array(players.enumerated()), id: \.offset) { _, player in
        PlayerRow(player: player)
      }
    }
  }
}

/// "C. McDavid   @LAK  7:00 PM". The name gives way first.
@available(iOS 16.1, *)
private struct PlayerRow: View {
  let player: WidgetSnapshot.Player

  var body: some View {
    HStack(spacing: 5) {
      Text(ShortName.of(player.name))
        .font(.system(size: 12, weight: .bold))
        .foregroundStyle(Broadcast.white)
      Spacer(minLength: 2)
      Text(player.matchup)
        .font(Broadcast.label(9))
        .foregroundStyle(Broadcast.sub)
        .fixedSize()
      puckDrop
        .font(Broadcast.numerals(12))
        .foregroundStyle(Broadcast.white)
        .fixedSize()
    }
    .lineLimit(1)
  }

  private var puckDrop: Text {
    guard let date = player.puckDrop else { return Text("TBD") }
    return Text(date, style: .time)
  }
}

@available(iOS 16.1, *)
private struct TopPerformerBlock: View {
  let top: WidgetSnapshot.Live.Top?
  let updated: Date?

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text("TOP PERFORMER").font(Broadcast.label(9)).tracking(1).foregroundStyle(Broadcast.sub)
      Text(top?.name ?? "—")
        .font(Broadcast.numerals(24))
        .foregroundStyle(Broadcast.white)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
      if let line = top?.line, !line.isEmpty {
        Text(line).font(.system(size: 13, weight: .bold)).foregroundStyle(Broadcast.white).lineLimit(1)
      }
      Spacer(minLength: 4)
      if let updated {
        (Text("UPDATED ") + Text(updated, style: .time))
          .font(Broadcast.label(9))
          .foregroundStyle(Broadcast.sub)
          .lineLimit(1)
      }
    }
  }
}

// MARK: - Lock screen

/// accessoryRectangular. The system tints Lock Screen widgets, so this leans on weight, not color.
@available(iOS 16.1, *)
struct TonightRectangularView: View {
  let phase: TonightPhase
  let now: Date

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      content
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }

  @ViewBuilder private var content: some View {
    switch phase {
    case .setup:
      headline("PuckIQ")
      message("Open PuckIQ to set up your team")
    case .stale:
      headline("PuckIQ")
      message("Open PuckIQ for tonight")
    case .noGames:
      headline("PuckIQ · Tonight")
      message("No games tonight")
    case .countdown(let playing, let total, let firstPuck, _):
      headline("\(playing) of \(total) play")
      countdownText(from: now, to: firstPuck).font(Broadcast.numerals(24)).lineLimit(1)
      footnote("until first lock")
    case .underway(let playing, let total):
      headline("\(playing) of \(total) play")
      Text("LIVE").font(Broadcast.numerals(24))
      footnote("Games in progress")
    case .live(let live):
      headline("Live · \(live.live) in play")
      Text("\(PointsText.format(live.points)) PTS").font(Broadcast.numerals(24)).lineLimit(1).minimumScaleFactor(0.7)
      footnote(live.top?.summary ?? "\(live.final) final · \(live.upcoming) to go")
    case .finished(let live):
      headline("Final")
      Text("\(PointsText.format(live.points)) PTS").font(Broadcast.numerals(24)).lineLimit(1).minimumScaleFactor(0.7)
      footnote(live.top?.summary ?? "All games final")
    }
  }

  private func headline(_ text: String) -> some View {
    Text(text.uppercased()).font(Broadcast.label(12)).lineLimit(1)
  }

  private func message(_ text: String) -> some View {
    Text(text).font(.system(size: 14, weight: .semibold)).lineLimit(2)
  }

  private func footnote(_ text: String) -> some View {
    Text(text).font(.system(size: 12, weight: .semibold)).lineLimit(1)
  }
}

/// accessoryInline: one line of text.
@available(iOS 16.1, *)
struct TonightInlineView: View {
  let phase: TonightPhase
  let now: Date

  var body: some View {
    switch phase {
    case .setup:
      Text("PuckIQ · set up your team")
    case .stale:
      Text("PuckIQ · open for tonight")
    case .noGames:
      Text("PuckIQ · no games tonight")
    case .countdown(let playing, let total, let firstPuck, _):
      Text("\(playing)/\(total) play · lock ") + countdownText(from: now, to: firstPuck)
    case .underway(let playing, let total):
      Text("\(playing)/\(total) play · games on")
    case .live(let live):
      Text("LIVE \(PointsText.format(live.points)) pts · \(live.live) in play")
    case .finished(let live):
      Text("FINAL \(PointsText.format(live.points)) pts")
    }
  }
}
