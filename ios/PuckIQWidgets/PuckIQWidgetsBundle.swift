import SwiftUI
import WidgetKit

/// PuckIQWidgets extension entry point: the Tonight widget and the fantasy-night Live Activity.
@main
struct PuckIQWidgetsBundle: WidgetBundle {
  var body: some Widget {
    TonightWidget()
    NightLiveActivity()
  }
}
