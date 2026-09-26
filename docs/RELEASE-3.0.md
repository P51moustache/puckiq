# PuckIQ 3.0 — subscription launch checklist

Goal: ship before opening night (NHL regular season starts the week of Oct 5, 2026). Order matters.

## 1. App Store Connect

- [ ] Create a subscription group **PuckIQ Pro** with two auto-renewable products:
  - `puckiq_pro_annual` — 1 year, **$19.99** (display name "Season"), 7-day free trial intro offer
  - `puckiq_pro_monthly` — 1 month, **$4.99** (no trial — the trial lives on annual to steer people there)
- [ ] Add a **Privacy Policy URL** and **Terms of Use (EULA)** link to the app record (required for subscriptions).
- [ ] Update App Privacy answers: no ads, no tracking. Purchases (RevenueCat), optional email (Sign in with Apple/Google), no location.
- [ ] Review notes: subscriptions are optional; free tier works without an account. Demo: add any NHL players on the Roster tab.

## 2. RevenueCat

- [ ] Add both products, entitlement **`pro`**, current offering with `$rc_annual` and `$rc_monthly` packages.
- [ ] Copy the iOS public SDK key into EAS env `EXPO_PUBLIC_REVENUECAT_IOS_KEY`.

## 3. Supabase

- [ ] Deploy the account-deletion function: `supabase functions deploy delete-account` (uses the service role key already in the project).
- [ ] (Optional) Nothing else — team backup uses the existing `user_data` table and RLS.

## 4. EAS build env

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | from RevenueCat |
| `EXPO_PUBLIC_FREEMIUM_CUTOVER` | ISO date you flip the price to Free (e.g. `2026-10-02`). Earlier original purchases keep Pro. |
| `EXPO_PUBLIC_PRIVACY_URL` / `_SUPPORT_URL` / `_SUPPORT_EMAIL` | already defaulted in `constants/legal.ts` (GitHub Pages + zlce.app@gmail.com) |
| `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | existing values |
| `EXPO_PUBLIC_POSTHOG_KEY` | set in `eas.json` (preview + production). US project, so no host needed. Write-only public key. |

## 5. Price change + release

1. Submit 3.0 for review with the subscription products attached.
2. When approved, set the app price to **Free** on the date you used for `EXPO_PUBLIC_FREEMIUM_CUTOVER`, then release 3.0.
3. Update the listing (docs/app-store-listing.md): title, subtitle, description, screenshots of Tonight / Week / Pickups.

## 6. After launch

- Watch RevenueCat for trial starts and conversion by paywall source (`tonight_lineup`, `pickups`, `week_planner`, …).
- Native analytics are not wired (Firebase in this repo is web-only) — add one before tuning the paywall.
