# Task 4 report — Home, Book, League and navigation

## Implemented

- Added validated game/team origin helpers. Home and Season Book game previews return to their originating section, warm deep links use the real navigation stack, and cold entries fall back to Home or League/Following without pushing a new copy of the source route.
- Scoped Android hardware Back handling to the focused Home tab. Preview returns to Home or Book; Book returns to Home. The four visible tabs use history back behavior and explicit 1-of-4 accessibility labels while hidden routes remain hidden.
- Preserved Home and Season Book scroll offsets while opening and closing previews. Existing League comparison selection remains mounted when entering a team detail and returning through the actual stack.
- Added confirmation before immutable Season Book removal. The mutation remains serialized and only notifies after a successful persisted write; failed writes keep the card and show retry guidance. Final games with absent/invalid scores say `Final score unavailable`; integer zero remains valid.
- Added visible preview Back actions, safe invalid-game recovery, team-detail retry, League retry/refresh controls, and request generation protection for team comparisons.
- Made comparison slots and clear controls accessible actions with entity/slot labels and 48-point targets. Team picker entries now have explicit accessible selection labels.
- Applied the approved PuckIQ AI provenance copy and renamed the destination `My model experiments`; local model choice is not persisted as published AI.
- Routed League team links with `from=league` and consumed the existing Following `from=following` contract. Replaced the generic not-found page with an Arena-styled safe Home fallback.
- Routed offseason/preseason watched-player CTAs to Following, where the watched collection lives. Settings remains available through the shared Arena header.

## Changed files

- `components/arena/TonightScreen.tsx`
- `components/arena/GamePreview.tsx`
- `components/arena/SeasonBook.tsx`
- `components/arena/SeasonHub.tsx`
- `app/(tabs)/teams.tsx`
- `app/(tabs)/stats.tsx`
- `app/(tabs)/_layout.tsx`
- `app/+not-found.tsx`
- `components/TeamHeadToHead.tsx`
- `utils/navigationOrigins.ts` (new)
- `services/__tests__/entityReliability.test.ts`

`services/seasonBook.ts` was reviewed; its existing serialized read-update-write behavior already preserves stored data on failed writes, so no production edit was needed.

## Verification

- `npm test -- --runInBand services/__tests__/entityReliability.test.ts services/__tests__/seasonBook.test.ts` — PASS, 2 suites / 16 tests.
- `npx eslint components/arena/TonightScreen.tsx components/arena/GamePreview.tsx components/arena/SeasonBook.tsx components/arena/SeasonHub.tsx services/seasonBook.ts 'app/(tabs)/teams.tsx' 'app/(tabs)/stats.tsx' app/+not-found.tsx components/TeamHeadToHead.tsx 'app/(tabs)/_layout.tsx' utils/navigationOrigins.ts services/__tests__/entityReliability.test.ts` — PASS, no output.
- `npx tsc --noEmit` — blocked by concurrent Task 5 work: `components/MyTeamScreen.tsx(26,27): Cannot find module './RosterBuilder'`. No TypeScript error was reported in a Task 4 file. Controller should rerun after Task 5 restores/completes that owned file.

## Remaining validation / gaps

- Native VoiceOver/TalkBack, Android hardware Back, 200% text, and 320-wide visual checks require the integrated runtime pass in Task 6.
- Cold/warm notification and OAuth/referral routing remain limited to supported entity parameters and the safe not-found fallback. No backend alert/referral behavior was enabled because there is no verified delivery/consumer contract.
- Models still needs its dedicated visual exit in the Task 2-owned surface; this was reported to the controller to avoid an ownership overlap.
