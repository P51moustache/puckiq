#if DEBUG
import ActivityKit
import React
import SwiftUI
import UIKit
import os

/// DEBUG builds only, and only with the launch flag:
///
///     xcrun simctl launch <device> com.zlce.hockeystats -PuckIQSelfTest YES
///
/// Publishes a sample snapshot and starts a sample Live Activity through PuckIQNative (the same
/// calls JavaScript makes), logs the results (subsystem com.zlce.hockeystats, category
/// SelfTest), and renders every widget and Live Activity layout to PNG contact sheets in
/// Documents/NativePreviews.
enum NativeSelfTest {
  static let launchFlag = "PuckIQSelfTest"

  /// Fallback when the first didBecomeActive is missed (seen right after `simctl install`).
  private static let fallbackDelay: TimeInterval = 4

  private static let log = Logger(subsystem: "com.zlce.hockeystats", category: "SelfTest")
  private static var activeObserver: NSObjectProtocol?
  private static var started = false

  /// Runs once the app is active (Live Activities can only start from the foreground).
  static func scheduleIfRequested() {
    guard UserDefaults.standard.bool(forKey: launchFlag) else { return }
    activeObserver = NotificationCenter.default.addObserver(
      forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
    ) { _ in startOnce() }
    DispatchQueue.main.asyncAfter(deadline: .now() + fallbackDelay) { startOnce() }
  }

  private static func startOnce() {
    guard !started else { return }
    started = true
    if let observer = activeObserver { NotificationCenter.default.removeObserver(observer) }
    activeObserver = nil
    Task { @MainActor in await run() }
  }

  @MainActor
  private static func run() async {
    let module = PuckIQNative()
    let now = Date()

    let snapshot = WidgetSamples.snapshot(now: now)
    let published = await call { module.setWidgetSnapshot(json(snapshot), resolver: $0, rejecter: $1) }
    let readBack = WidgetSnapshotStore().read() == snapshot
    log.notice("setWidgetSnapshot: \(published, privacy: .public); App Group read-back matches: \(readBack, privacy: .public)")

    let rejected = await call { module.setWidgetSnapshot("{\"bad\":true}", resolver: $0, rejecter: $1) }
    log.notice("setWidgetSnapshot(invalid): \(rejected, privacy: .public)")

    log.notice("liveActivitiesEnabled: \(module.liveActivitiesEnabled(), privacy: .public)")
    if #available(iOS 16.2, *) {
      // End first: clears the "dismissed tonight" guard a reinstall leaves behind.
      let ended = await call { module.endLiveActivity(nil, resolver: $0, rejecter: $1) }
      log.notice("endLiveActivity(nil): \(ended, privacy: .public)")
      let attributes = json(WidgetSamples.attributes(now: now))
      let start = await call { module.startOrUpdateLiveActivity(attributes, stateJson: json(WidgetSamples.liveState), resolver: $0, rejecter: $1) }
      // An update landing mid-presentation drew the simulator's compact island clipped; let it settle.
      try? await Task.sleep(nanoseconds: 1_500_000_000)
      var next = WidgetSamples.liveState
      next.points += 2
      let update = await call { module.startOrUpdateLiveActivity(attributes, stateJson: json(next), resolver: $0, rejecter: $1) }
      let running = Activity<PuckIQNightAttributes>.activities.filter { $0.activityState == .active }.count
      log.notice("startOrUpdateLiveActivity: start \(start, privacy: .public), update \(update, privacy: .public); active activities: \(running, privacy: .public)")
      let directory = renderPreviews(now: now)
      log.notice("Previews: \(directory?.path ?? "failed", privacy: .public)")
    }
  }

  @MainActor
  private static func call(_ body: (@escaping RCTPromiseResolveBlock, @escaping RCTPromiseRejectBlock) -> Void) async -> String {
    await withCheckedContinuation { continuation in
      body(
        { value in continuation.resume(returning: "resolved \(value.map { "\($0)" } ?? "nil")") },
        { code, message, _ in continuation.resume(returning: "rejected \(code ?? "") \(message ?? "")") }
      )
    }
  }

  private static func json<T: Encodable>(_ value: T) -> String {
    (try? JSONEncoder().encode(value)).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
  }

  // MARK: - PNG previews

  @available(iOS 16.2, *)
  @MainActor
  private static func renderPreviews(now: Date) -> URL? {
    guard let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else { return nil }
    let directory = documents.appendingPathComponent("NativePreviews", isDirectory: true)
    try? FileManager.default.removeItem(at: directory)
    try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

    let cases = PreviewCase.all(now: now)
    let sheets: [(String, AnyView)] = [
      ("widgets-small.png", AnyView(WidgetSheet(cases: cases, layout: .small, now: now))),
      ("widgets-medium.png", AnyView(WidgetSheet(cases: cases, layout: .medium, now: now))),
      ("widgets-lockscreen.png", AnyView(LockScreenSheet(cases: cases, now: now))),
      ("live-activity.png", AnyView(LiveActivitySheet(now: now))),
    ]
    for (name, sheet) in sheets {
      let renderer = ImageRenderer(content: sheet)
      renderer.scale = 3
      guard let data = renderer.uiImage?.pngData() else {
        log.error("Could not render \(name, privacy: .public)")
        continue
      }
      try? data.write(to: directory.appendingPathComponent(name))
    }
    return directory
  }
}

/// One labelled widget state for the contact sheets.
private struct PreviewCase {
  let name: String
  let snapshot: WidgetSnapshot?

  static func all(now: Date) -> [PreviewCase] {
    let hour: TimeInterval = 60 * 60
    let tonight = WidgetSamples.snapshot(now: now)
    return [
      PreviewCase(name: "Countdown, under an hour", snapshot: tonight),
      PreviewCase(name: "Countdown, later", snapshot: WidgetSamples.snapshot(now: now, firstPuckIn: 3 * hour + 14 * 60)),
      PreviewCase(name: "Underway, no live data", snapshot: WidgetSamples.snapshot(now: now, firstPuckIn: -10 * 60)),
      PreviewCase(name: "Live", snapshot: WidgetSamples.snapshot(now: now, firstPuckIn: -hour, live: WidgetSamples.liveNight)),
      PreviewCase(name: "Final", snapshot: WidgetSamples.snapshot(now: now, firstPuckIn: -4 * hour, live: WidgetSamples.finishedNight)),
      PreviewCase(name: "No games", snapshot: tonight.with(playing: 0)),
      PreviewCase(name: "Stale (earlier game day)", snapshot: WidgetSamples.snapshot(now: now.addingTimeInterval(-24 * hour))),
      PreviewCase(name: "Empty (never set up)", snapshot: nil),
    ]
  }
}

private extension WidgetSnapshot {
  func with(playing: Int) -> WidgetSnapshot {
    WidgetSnapshot(updatedAt: updatedAt, date: date, teamName: teamName, playing: playing, total: total,
                   firstPuckUTC: nil, players: [], live: nil)
  }
}

private enum PreviewSize {
  /// iPhone 17 Pro Max widget sizes, in points.
  static let small = CGSize(width: 170, height: 170)
  static let medium = CGSize(width: 364, height: 170)
  static let rectangular = CGSize(width: 172, height: 76)
  static let inline = CGSize(width: 257, height: 26)
  static let lockScreenActivity = CGFloat(408)
  static let paper = Color(red: 0xF2 / 255, green: 0xF0 / 255, blue: 0xEC / 255)
  static let wallpaper = LinearGradient(colors: [Color(red: 0.16, green: 0.20, blue: 0.32), Color(red: 0.05, green: 0.06, blue: 0.10)],
                                        startPoint: .top, endPoint: .bottom)
}

@available(iOS 16.2, *)
private struct SheetLabel: View {
  let text: String
  var body: some View {
    Text(text.uppercased()).font(.system(size: 11, weight: .heavy)).tracking(1).foregroundStyle(Color.black.opacity(0.55))
  }
}

@available(iOS 16.2, *)
private struct WidgetSheet: View {
  let cases: [PreviewCase]
  let layout: TonightLayout
  let now: Date

  var body: some View {
    let size = layout == .small ? PreviewSize.small : PreviewSize.medium
    VStack(alignment: .leading, spacing: 14) {
      ForEach(Array(cases.enumerated()), id: \.offset) { _, item in
        VStack(alignment: .leading, spacing: 6) {
          SheetLabel(text: item.name)
          TonightWidgetView(layout: layout, snapshot: item.snapshot, now: now)
            .frame(width: size.width, height: size.height)
            .background(Broadcast.carbon)
            .clipShape(RoundedRectangle(cornerRadius: 23, style: .continuous))
        }
      }
    }
    .padding(20)
    .background(PreviewSize.paper)
  }
}

@available(iOS 16.2, *)
private struct LockScreenSheet: View {
  let cases: [PreviewCase]
  let now: Date

  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      ForEach(Array(cases.enumerated()), id: \.offset) { _, item in
        VStack(alignment: .leading, spacing: 8) {
          Text(item.name.uppercased()).font(.system(size: 11, weight: .heavy)).tracking(1).foregroundStyle(.white.opacity(0.6))
          TonightWidgetView(layout: .inline, snapshot: item.snapshot, now: now)
            .font(.system(size: 15, weight: .semibold))
            .lineLimit(1)
            .frame(width: PreviewSize.inline.width, height: PreviewSize.inline.height, alignment: .leading)
          TonightWidgetView(layout: .rectangular, snapshot: item.snapshot, now: now)
            .frame(width: PreviewSize.rectangular.width, height: PreviewSize.rectangular.height)
        }
        .foregroundStyle(.white)
      }
    }
    .padding(20)
    .background(PreviewSize.wallpaper)
  }
}

@available(iOS 16.2, *)
private struct LiveActivitySheet: View {
  let now: Date

  private var finalState: PuckIQNightAttributes.ContentState {
    PuckIQNightAttributes.ContentState(points: 31.0, live: 0, final: 6, upcoming: 0, topName: "McDavid", topLine: "2G 2A", clock: "Final")
  }

  var body: some View {
    let attributes = WidgetSamples.attributes(now: now)
    let live = WidgetSamples.liveState
    VStack(alignment: .leading, spacing: 14) {
      SheetLabel(text: "Lock Screen, live")
      lockScreen(attributes.teamName, live, stale: false)
      SheetLabel(text: "Lock Screen, stale (no update for 15 min)")
      lockScreen(attributes.teamName, live, stale: true)
      SheetLabel(text: "Lock Screen, final")
      lockScreen(attributes.teamName, finalState, stale: false)
      SheetLabel(text: "Dynamic Island, compact")
      HStack {
        NightIslandPoints(state: live)
        Spacer()
        NightIslandStatus(state: live)
      }
      .padding(.horizontal, 18)
      .frame(width: 250, height: 37)
      .background(Capsule().fill(Color.black))
      SheetLabel(text: "Dynamic Island, minimal")
      NightIslandPoints(state: live, size: 12)
        .frame(width: 37, height: 37)
        .background(Circle().fill(Color.black))
      SheetLabel(text: "Dynamic Island, expanded")
      VStack(alignment: .leading, spacing: 10) {
        HStack(alignment: .top) {
          NightIslandExpandedPoints(state: live)
          Spacer()
          NightIslandExpandedCounts(state: live)
        }
        BroadcastKicker(text: attributes.teamName, size: 10)
        NightTopLine(state: live, isStale: false)
      }
      .padding(22)
      .frame(width: PreviewSize.lockScreenActivity)
      .background(RoundedRectangle(cornerRadius: 44, style: .continuous).fill(Color.black))
    }
    .padding(20)
    .background(PreviewSize.paper)
  }

  private func lockScreen(_ teamName: String, _ state: PuckIQNightAttributes.ContentState, stale: Bool) -> some View {
    NightLockScreenView(teamName: teamName, state: state, isStale: stale)
      .frame(width: PreviewSize.lockScreenActivity)
      .background(Broadcast.carbon)
      .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
  }
}
#endif
