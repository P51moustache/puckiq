# Looper progress

## 2026-08-27 — hole 6: never crash on launch

RevenueCat (`react-native-purchases`) was still a dependency and `SubscriptionProvider` called `Purchases.configure` on every launch. That is the 2.1(a) TurboModule abort. Removed the SDK, took SubscriptionProvider / onboarding / notification init off the launch path. Open is Lines. Did not bump the store build. Did not submit.
