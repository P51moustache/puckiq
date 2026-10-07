import ActivityKit
import SwiftUI
import WidgetKit

/// The fantasy-night Live Activity the app starts and updates (PuckIQNative, NightActivityController).
struct NightLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: PuckIQNightAttributes.self) { context in
      NightLockScreenView(teamName: context.attributes.teamName, state: context.state, isStale: context.isStale)
        .activityBackgroundTint(Broadcast.carbon)
        .activitySystemActionForegroundColor(Broadcast.white)
        .widgetURL(PuckIQLink.tonight)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          NightIslandExpandedPoints(state: context.state)
            .padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          NightIslandExpandedCounts(state: context.state)
            .padding(.trailing, 4)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 6) {
            BroadcastKicker(text: context.attributes.teamName, size: 10)
            NightTopLine(state: context.state, isStale: context.isStale)
          }
          .padding(.horizontal, 4)
        }
      } compactLeading: {
        NightIslandPoints(state: context.state)
      } compactTrailing: {
        NightIslandStatus(state: context.state)
      } minimal: {
        NightIslandPoints(state: context.state, size: 12)
      }
      .widgetURL(PuckIQLink.tonight)
      .keylineTint(Broadcast.red)
    }
  }
}
