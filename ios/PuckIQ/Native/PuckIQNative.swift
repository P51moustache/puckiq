import Foundation
import React
import WidgetKit

/// `NativeModules.PuckIQNative`: the native side of services/native/widgetBridge.ts (keep the
/// two in step). A legacy bridge module, declared to React Native in PuckIQNative.m and served
/// under the New Architecture by the TurboModule interop layer. Every method is a safe no-op
/// where the OS can't do it.
@objc(PuckIQNative)
final class PuckIQNative: NSObject {
  private let snapshots: WidgetSnapshotStore
  private let activities: NightActivityController
  private let reloadWidgets: () -> Void

  /// React Native creates the module with `init()`.
  override convenience init() {
    self.init(
      snapshots: WidgetSnapshotStore(),
      activities: NightActivityController(),
      reloadWidgets: { WidgetCenter.shared.reloadAllTimelines() }
    )
  }

  init(snapshots: WidgetSnapshotStore, activities: NightActivityController, reloadWidgets: @escaping () -> Void) {
    self.snapshots = snapshots
    self.activities = activities
    self.reloadWidgets = reloadWidgets
    super.init()
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }

  /// Stores the `WidgetSnapshot` JSON in the App Group and reloads every widget timeline.
  /// Rejects (without writing) when the JSON doesn't match the snapshot shape.
  @objc(setWidgetSnapshot:resolver:rejecter:)
  func setWidgetSnapshot(_ json: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    do {
      try snapshots.write(json: json)
      reloadWidgets()
      resolve(nil)
    } catch {
      reject("E_WIDGET_SNAPSHOT", error.localizedDescription, error)
    }
  }

  /// Synchronous: whether this device and the user allow Live Activities (false below iOS 16.2).
  @objc func liveActivitiesEnabled() -> NSNumber {
    NSNumber(value: activities.isEnabled)
  }

  /// Resolves true when tonight's activity shows the state, false when unsupported or declined.
  @objc(startOrUpdateLiveActivity:stateJson:resolver:rejecter:)
  func startOrUpdateLiveActivity(_ attributesJson: String, stateJson: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task {
      do {
        let showing = try await activities.startOrUpdate(attributesJSON: attributesJson, stateJSON: stateJson)
        resolve(NSNumber(value: showing))
      } catch {
        reject("E_LIVE_ACTIVITY", error.localizedDescription, error)
      }
    }
  }

  /// Ends the activity: on the final state when given, immediately when null.
  @objc(endLiveActivity:resolver:rejecter:)
  func endLiveActivity(_ stateJson: String?, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task {
      do {
        try await activities.end(finalStateJSON: stateJson)
        resolve(nil)
      } catch {
        reject("E_LIVE_ACTIVITY", error.localizedDescription, error)
      }
    }
  }
}
