import SwiftUI
import WidgetKit

/// Home Screen (small, medium) and Lock Screen (rectangular, inline) widget for tonight:
/// how many of my players play, the first-lock countdown, then live points.
struct TonightWidget: Widget {
  static let kind = "PuckIQTonight"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: Self.kind, provider: TonightTimelineProvider()) { entry in
      TonightWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Tonight")
    .description("Who plays tonight, the countdown to first lock, then live points.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    .withoutContentMargins()
  }
}

struct TonightEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshot?
}

/// Reads the snapshot the app published. Entries cover the instants the phase flips on its own
/// (countdown turns red, first puck, game-day rollover); reloads run at first puck and every
/// 30 minutes. The app also reloads every timeline right after it publishes.
struct TonightTimelineProvider: TimelineProvider {
  private let store = WidgetSnapshotStore()

  func placeholder(in context: Context) -> TonightEntry {
    TonightEntry(date: Date(), snapshot: WidgetSamples.snapshot(now: Date()))
  }

  /// The widget gallery shows a sample night until the app has published a real one.
  func getSnapshot(in context: Context, completion: @escaping (TonightEntry) -> Void) {
    let now = Date()
    let published = store.read()
    let snapshot = context.isPreview ? (published ?? WidgetSamples.snapshot(now: now)) : published
    completion(TonightEntry(date: now, snapshot: snapshot))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TonightEntry>) -> Void) {
    let now = Date()
    let snapshot = store.read()
    let entries = TonightSchedule.entryDates(for: snapshot, now: now).map { TonightEntry(date: $0, snapshot: snapshot) }
    completion(Timeline(entries: entries, policy: .after(TonightSchedule.nextReload(for: snapshot, now: now))))
  }
}

struct TonightWidgetEntryView: View {
  @Environment(\.widgetFamily) private var family
  let entry: TonightEntry

  var body: some View {
    TonightWidgetView(layout: layout, snapshot: entry.snapshot, now: entry.date)
      .widgetBackground(isHomeScreen ? Broadcast.carbon : Color.clear)
      .widgetURL(PuckIQLink.tonight)
  }

  private var isHomeScreen: Bool {
    layout == .small || layout == .medium
  }

  private var layout: TonightLayout {
    switch family {
    case .systemMedium, .systemLarge, .systemExtraLarge: return .medium
    case .accessoryRectangular: return .rectangular
    case .accessoryInline: return .inline
    default: return .small
    }
  }
}

private extension View {
  /// iOS 17 requires the container background API; iOS 16 draws it behind the content.
  @ViewBuilder
  func widgetBackground<Background: View>(_ background: Background) -> some View {
    if #available(iOS 17.0, *) {
      containerBackground(for: .widget) { background }
    } else {
      self.background(background)
    }
  }
}

private extension WidgetConfiguration {
  /// The views pad themselves (`TonightWidgetView.homeScreenPadding`).
  func withoutContentMargins() -> some WidgetConfiguration {
    if #available(iOS 17.0, *) {
      return contentMarginsDisabled()
    } else {
      return self
    }
  }
}
