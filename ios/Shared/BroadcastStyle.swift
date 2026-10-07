import SwiftUI

/// PuckIQ's F1 broadcast look for the widgets and the Live Activity, from components/coach/ui.tsx:
/// carbon panels, one hot red, white type, heavy italic numerals, uppercase kickers with a red dot.
enum Broadcast {
  /// `colors.ink`
  static let carbon = rgb(0x15151E)
  /// `colors.inkRaised`
  static let carbonRaised = rgb(0x24242E)
  /// `colors.accent`
  static let red = rgb(0xE10600)
  /// `colors.onInk`
  static let white = Color.white
  /// `colors.onInkSub`
  static let sub = rgb(0xA6A6B0)

  /// Heavy italic numerals: `display()` in ui.tsx.
  static func numerals(_ size: CGFloat) -> Font {
    .system(size: size, weight: .black).italic().monospacedDigit()
  }

  /// Uppercase kickers and labels.
  static func label(_ size: CGFloat) -> Font {
    .system(size: size, weight: .heavy)
  }

  private static func rgb(_ hex: UInt32) -> Color {
    Color(
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255
    )
  }
}

/// Red dot + uppercase kicker, like the Tonight hero's date line.
@available(iOS 16.1, *)
struct BroadcastKicker: View {
  let text: String
  var dot: Color = Broadcast.red
  var size: CGFloat = 11

  var body: some View {
    HStack(spacing: 5) {
      Circle().fill(dot).frame(width: size * 0.64, height: size * 0.64)
      Text(text.uppercased())
        .font(Broadcast.label(size))
        .tracking(1)
        .foregroundStyle(Broadcast.white)
        .lineLimit(1)
    }
  }
}

/// The app's "Team Lock Deadline" bar (`CountdownBar` in ui.tsx), stacked (label over value) so
/// an hours-long countdown fits a widget column.
@available(iOS 16.1, *)
struct BroadcastBar<Value: View>: View {
  let label: String
  let fill: Color
  let value: Value

  init(label: String, fill: Color = Broadcast.red, @ViewBuilder value: () -> Value) {
    self.label = label
    self.fill = fill
    self.value = value()
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text(label.uppercased())
        .font(Broadcast.label(9))
        .tracking(0.8)
      value
        .font(Broadcast.numerals(20))
    }
    .lineLimit(1)
    .foregroundStyle(Broadcast.white)
    .padding(.horizontal, 10)
    .padding(.vertical, 6)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(RoundedRectangle(cornerRadius: 9, style: .continuous).fill(fill))
  }
}

/// A value over a small uppercase label, like `StatCell` in ui.tsx.
@available(iOS 16.1, *)
struct BroadcastStat: View {
  let value: String
  let label: String
  var valueColor: Color = Broadcast.white
  var size: CGFloat = 18

  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      Text(value).font(Broadcast.numerals(size)).foregroundStyle(valueColor).lineLimit(1)
      Text(label.uppercased()).font(Broadcast.label(8)).tracking(0.5).foregroundStyle(Broadcast.sub).lineLimit(1)
    }
  }
}

/// A live countdown that ticks without timeline reloads ("37:12", "2:14:05").
@available(iOS 16.1, *)
func countdownText(from now: Date, to end: Date) -> Text {
  Text(timerInterval: min(now, end)...end, countsDown: true)
}
