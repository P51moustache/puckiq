# PuckIQ loyalty access and update delivery

The replacement build includes a welcome-back tour and a 30-day Pro gift for eligible existing free users. Earlier paid customers keep permanent Pro. These changes are implemented locally and need a replacement App Store build; no customer announcement has been sent.

## Access rules

| Customer | Access |
|---|---|
| Original app purchase before September 27, 2026 at 01:00 UTC | Existing permanent Pro, preserved |
| Original free download from that cutover through October 3, 2026 UTC | 30-day Pro gift |
| New download on or after October 4, 2026 at 00:00 UTC | Normal free tier and eligible Apple introductory offer |
| Active subscriber | Subscription continues with the existing Apple billing schedule |

Eligibility uses the original app purchase/download date returned by RevenueCat after receipt sync. The gift expires 30 days after the later of RevenueCat `firstSeen` and October 4, 2026 at 00:00 UTC. For a returning 2.2 user first introduced to RevenueCat when upgrading, that means 30 days from the upgrade. A beta customer already known to RevenueCat begins at campaign launch. The date anchor belongs to RevenueCat's customer record, not a locally reset claim flag.

The gift is client-side access to the app's Pro features. It does not create an Apple subscription, grant a RevenueCat promotional entitlement, defer an existing charge, or extend the App Store's seven-day introductory offer. On expiry the app returns to Free unless the user has permanent Pro or an active subscription. Access is rechecked on foreground and while open. [RevenueCat paid-app migration guidance](https://www.revenuecat.com/blog/engineering/converting-a-paid-ios-app-to-subscriptions/)

Keep the original paid-to-free cutoff in `eas.json`. Campaign dates and gift duration have one source of truth in `constants/release.ts`. A missing receipt never invents access: the app syncs it, offers user-initiated Restore, and points to support if still unavailable. Reinstall/restore identity behavior must be verified in production; this implementation is not a server-side per-Apple-ID grant ledger.

## Update message

The one-time welcome-back screen explains Tonight, the slot-aware lineup, week planning, pickups, player scouting, matchup, and sharing. It explicitly explains that fantasy coaching replaces the earlier prediction and pick-tracking screens. It displays the appropriate loyalty or subscription status. It can be reopened from Settings > What’s new in PuckIQ 3.0.

Existing users are identified from the original download receipt, earlier onboarding or roster data, or older saved pick activity. Users without an earlier coach setup complete the new roster onboarding before the tour appears. No new notification permission is requested and no marketing push is scheduled.

## Launch announcement copy

Use only once 3.0 is live, through an audience/channel that is already authorized to receive it:

**Title:** Your new PuckIQ coach is here

**Body:** Update for lineup coaching, games that count, and pickups for your empty nights. Open PuckIQ to see your early-user Pro benefits.

**Paid-customer message:** You helped us get started. Your original PuckIQ purchase now includes the full Pro coach, with no end date and no new subscription.

**Existing-free-user message:** Thanks for being here early. Eligible existing users get 30 days of PuckIQ Pro. Open the update to see your gift and its end date. No automatic charge.

## Release checks

- Upgrade from a real production 2.2 download; inspect the original receipt date and verify the correct access source.
- Confirm the notice appears after setup, dismisses, stays dismissed after relaunch, and reopens from Settings.
- Restore with the original Apple ID and verify access, including on a second device.
- Verify the exact expiry boundary, offline behavior, foreground refresh, and removal of Pro access after gift expiry.
- Test eligible and ineligible Apple subscription trials; the paywall must not promise an unavailable trial.
- Never describe this gift as postponing a subscriber's next payment.
