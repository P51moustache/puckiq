# Trial welcome ("Pro is on") — concepts

Why: in the 30 days to Oct 22, 4 of 7 people who started a trial came back on at most one more day, and only 2 of 4 Pro
users had notifications on. A trial that isn't used rarely turns into a paid season. Right after the App Store sheet
closes, show the first move Pro unlocks and offer game-night reminders in one tap.

Data the app already has:
- First Pro move: the first of tonight's `view.moves` that `visibleMoves(moves, false)` hides from free users
  (`services/fantasy/coach.ts`). On a night with no such move, fall back to the best lineup or tomorrow.
- Trial end: `ProStatus.expiresAt` with `periodType: 'trial'` (`services/subscription.ts`).
- Reminders: `useReminders().enable({ source })` (needs a new `ReminderSource`) and `useAlerts().enable()` for goal and
  scratch alerts.
- The hook point: `ProPaywall` after `outcome.result === 'purchased'` (`journey.close('access_granted')`).

## Three concepts

- `concept-a.png` — **Welcome sheet.** "PRO IS ON" with a green check on the rink texture, a "Your first Pro move"
  sit/start card with "+1 game tonight", a "Never miss lock" reminders card, red "Turn on reminders", "Not now", trial
  line at the bottom.
- `concept-b.png` — **Two-step checklist.** "Pro is on — 2 things tonight" with a progress bar: ✓ trial started, step 1
  the move with red "Save this move", step 2 reminders with an outline button.
- `concept-c.png` — **Inline on Tonight, no popup.** A slim green "Pro is on · free until Oct 29" banner, the first Pro
  move highlighted with a red "NEW · PRO" tag, and a "Get a nudge before lock" card with "Remind me at 6:00 PM". (The
  drawn tab bar and header are invented; a build would keep the real Tonight layout.)

References passed to Codex `image_gen`: `reference-current-app.png` (import sheet, Oct 20 build) and
`reference-setup.png` (setup roster step). The simulator couldn't render a live Tonight screen on Oct 22.

## Selected: concept A (Oct 22)

`concept-a.png` is the canonical reference. Built as `components/tonight/TrialWelcomeSheet.tsx` (inside `PromptSheet`),
timed by `hooks/useTrialWelcome.ts`, with the rules in `services/engagement/trialWelcome.ts`. Differences from the
drawing: the move card shows the coach move's own title instead of a made-up "+1 game tonight"; on a night with no
hidden move it says what Pro covers instead; with reminders and alerts already on, the bell card and "Not now" drop out
and the button reads "Let's go". `render-web.jpg` is the built sheet rendered on Expo web at 393×852 (Oct 22), for
comparison with the concept. `render-ios.png` is the sheet in a Debug build on the iOS simulator (Oct 22): Pro from
`EXPO_PUBLIC_DEV_PRO=1` with a seeded welcome record rather than a sandbox purchase (the simulator's App Store returned
no products), on a night that had already locked, so it shows the "every move" card.
