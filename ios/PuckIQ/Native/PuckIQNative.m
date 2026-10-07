#import <React/RCTBridgeModule.h>

// Declares the Swift module in PuckIQNative.swift to React Native as `NativeModules.PuckIQNative`.
// Selectors must match the Swift @objc names; the JS contract is services/native/widgetBridge.ts.
@interface RCT_EXTERN_MODULE(PuckIQNative, NSObject)

RCT_EXTERN_METHOD(setWidgetSnapshot:(NSString *)json
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN__BLOCKING_SYNCHRONOUS_METHOD(liveActivitiesEnabled)

RCT_EXTERN_METHOD(startOrUpdateLiveActivity:(NSString *)attributesJson
                  stateJson:(NSString *)stateJson
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(endLiveActivity:(nullable NSString *)stateJson
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
