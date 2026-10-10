# Engagement: simple, longer sessions

*Started 2026-10-10. Goal (Zach): more engagement; sessions stay simple but run longer. This doc is the contract
between the two work streams; change a contract here first, then in code.*

## What the data says (15 App Store users, Oct 5–10)

- Return visits are glances: 20 of 36 lasted under a minute (open Tonight, maybe My Team, close).
- Long sessions (8–21 min) come from player cards (one 16-minute session opened 69), flipping Pickups between
  today / tomorrow / this week / next week, and player search.
- New users who browse every tab without doing anything never come back.
- No crashes reported; search answers in ~0.2 s. Live nights: 1 view. Game-time reminders: on for 2 of 15.

## Streams and file ownership

| Stream | Owns (only these paths) |
|---|---|
| **Main** | `components/screens/**` (except `PlayerSheet`), `components/tonight/**`, `components/onboarding/**`, `components/settings/**`, `components/RemindersProvider.tsx`, `components/AlertsProvider.tsx`, `app/**`, `services/lineupReminders.ts`, `services/fantasy/nextUp.ts`, `services/fantasy/matchupTag.ts`, `services/engagement/**`, `hooks/useFirstNight.ts`, `hooks/useReminderPrompt.ts`, `constants/**`, `docs/**`, `PRODUCT.md` |
| **Player card** | `components/sheets/PlayerSheet.tsx`, `components/player/**` (new), `services/fantasy/playerVerdict.ts` (new), `services/fantasy/similarPlayers.ts` (new), `hooks/usePlayerDetail.ts`, `hooks/usePlayerCard.ts` (new), and tests beside them |

Shared read-only for both: `services/fantasy/*` (other files), `services/nhl/*`, `hooks/useCoach.ts`,
`hooks/useResource.ts`, `components/coach/*`, `types/*`, `services/analytics/track.ts`.

## Contracts

- `openPlayer(playerId, context = 'browse', source: PlayerOpenSource = 'other')` (in place). `context` decides the
  card's actions; `source` is analytics only and is sent with `player_open`. Card-to-card opens use `source: 'similar'`.
- Matchup tags: `matchupTagFor(form, opponentRanks)` in `services/fantasy/matchupTag.ts` (moved out of Tonight).
- Pro gating stays as today. Free users already see matchup tags and hot/cold badges on Tonight; the best-lineup slot,
  last-14-day numbers, start share, telemetry and the full game log stay Pro.

## Main stream

1. **Next up** card at the end of Tonight: one tap to the single most useful next step (`services/fantasy/nextUp.ts`
   picks it; `components/tonight/NextUpCard.tsx` shows it). Events `next_up_view` / `next_up_tap` (`kind`).
2. **Game-night reminder, asked when it matters**: the first time someone views Tonight on a game day with reminders
   off, a small card offers them. Turning it on also adds a "your night is live" notification at the first puck drop.
   Tapping any reminder opens Tonight. Events `reminder_prompt_view` / `reminder_prompt_answer` (`answer`).
3. **First night**: after setup, a short guided path on Tonight: see who plays, one pickup idea, the reminder.
   Events `first_night_step` (`step`), `first_night_done`, `first_night_dismiss`.

## Player card stream

1. **Verdict line** near the top: one short call about his next game with one or two reasons.
2. **This week** strip: opponent strength on each game (soft / tough), from the same team-strength data as Tonight.
3. **Similar players**: up to three players at his position with a similar value who are probably available; tapping
   one opens his card in place (`openPlayer(id, 'pickup', 'similar')`).
4. Split `PlayerSheet.tsx` (829 lines) into section components under `components/player/` while doing the above,
   with existing behaviour unchanged.
