import SwiftUI

// The Live Activity's views as plain SwiftUI over the attributes and state, so the extension's
// ActivityConfiguration and the DEBUG self-test (PNG previews) draw exactly the same thing.

/// Lock Screen (and banner) presentation.
@available(iOS 16.1, *)
struct NightLockScreenView: View {
  let teamName: String
  let state: PuckIQNightAttributes.ContentState
  /// No update from the app for a while (ActivityKit stale date passed).
  let isStale: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(spacing: 8) {
        BroadcastKicker(text: teamName)
        Spacer(minLength: 8)
        if let clock = state.clock {
          NightClockTag(clock: clock, live: state.isLive)
        }
      }
      HStack(alignment: .bottom, spacing: 12) {
        HStack(alignment: .lastTextBaseline, spacing: 5) {
          Text(state.pointsText)
            .font(Broadcast.numerals(44))
            .foregroundStyle(Broadcast.white)
            .minimumScaleFactor(0.6)
          Text("PTS").font(Broadcast.numerals(16)).foregroundStyle(Broadcast.sub)
        }
        .lineLimit(1)
        Spacer(minLength: 8)
        NightCountsRow(live: state.live, final: state.final, upcoming: state.upcoming)
      }
      if state.topName != nil || isStale {
        NightTopLine(state: state, isStale: isStale)
      }
    }
    .padding(16)
  }
}

/// "P2 10:15" in a red tag while games are live; carbon once they're not.
@available(iOS 16.1, *)
struct NightClockTag: View {
  let clock: String
  let live: Bool

  var body: some View {
    Text(clock.uppercased())
      .font(Broadcast.numerals(13))
      .foregroundStyle(Broadcast.white)
      .lineLimit(1)
      .padding(.horizontal, 8)
      .padding(.vertical, 3)
      .background(Capsule().fill(live ? Broadcast.red : Broadcast.carbonRaised))
  }
}

/// "TOP  McDavid  2G 1A" plus a refresh hint when the activity has gone stale.
@available(iOS 16.1, *)
struct NightTopLine: View {
  let state: PuckIQNightAttributes.ContentState
  let isStale: Bool

  var body: some View {
    HStack(spacing: 6) {
      if let topName = state.topName {
        Text("TOP").font(Broadcast.label(10)).tracking(1).foregroundStyle(Broadcast.red)
        Text(topName).font(.system(size: 14, weight: .bold)).foregroundStyle(Broadcast.white)
        if let line = state.topLine {
          Text(line).font(.system(size: 13, weight: .semibold)).foregroundStyle(Broadcast.sub)
        }
      }
      Spacer(minLength: 0)
      if isStale {
        Text("OPEN PUCKIQ TO REFRESH").font(Broadcast.label(9)).foregroundStyle(Broadcast.sub)
      }
    }
    .lineLimit(1)
  }
}

// MARK: - Dynamic Island

/// Compact leading and minimal: the points.
@available(iOS 16.1, *)
struct NightIslandPoints: View {
  let state: PuckIQNightAttributes.ContentState
  var size: CGFloat = 15

  var body: some View {
    Text(state.pointsText)
      .font(Broadcast.numerals(size))
      .foregroundStyle(Broadcast.white)
      .lineLimit(1)
      .minimumScaleFactor(0.5)
  }
}

/// Compact trailing: red dot + "3 LIVE" ("2 TO GO", "FINAL" once nothing is live).
@available(iOS 16.1, *)
struct NightIslandStatus: View {
  let state: PuckIQNightAttributes.ContentState

  var body: some View {
    HStack(spacing: 4) {
      Circle()
        .fill(state.isLive ? Broadcast.red : Broadcast.sub)
        .frame(width: 6, height: 6)
      Text(state.statusText)
        .font(Broadcast.label(12))
        .foregroundStyle(Broadcast.white)
        .lineLimit(1)
    }
  }
}

/// Expanded leading: big points.
@available(iOS 16.1, *)
struct NightIslandExpandedPoints: View {
  let state: PuckIQNightAttributes.ContentState

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text(state.pointsText)
        .font(Broadcast.numerals(34))
        .foregroundStyle(Broadcast.white)
        .lineLimit(1)
        .minimumScaleFactor(0.6)
      Text("FANTASY PTS").font(Broadcast.label(9)).tracking(1).foregroundStyle(Broadcast.sub)
    }
  }
}

/// Expanded trailing: the clock tag over the counts.
@available(iOS 16.1, *)
struct NightIslandExpandedCounts: View {
  let state: PuckIQNightAttributes.ContentState

  var body: some View {
    VStack(alignment: .trailing, spacing: 6) {
      if let clock = state.clock {
        NightClockTag(clock: clock, live: state.isLive)
      }
      NightCountsRow(live: state.live, final: state.final, upcoming: state.upcoming, size: 15)
    }
  }
}
