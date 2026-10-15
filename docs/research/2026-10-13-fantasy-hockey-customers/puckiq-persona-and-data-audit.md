# PuckIQ audit: dependable decisions before more features

Prepared October 13, 2026. Audit of the local working tree at HEAD `870ac4a01e4cc4b17327458156f1ded91db874e7`, including pre-existing modified and untracked files. This is a source and focused behavior-test audit, not verification of the released App Store binary or a native usability study. No product code, subscription, deployment or data source was changed.

## The first decisions

**First business decision: treat commercial data permission as unverified. First engineering change: make incomplete and stale checks visible before reassuring a user. First workflow investment: keep the roster accurate and close the loop when a move is made in the host.**

The busy competitor needs to trust a short answer and act once. Today PuckIQ has much of the right coaching machinery, but it maintains its own roster and plan, can hide information failures, and asks the user to complete and reconcile transactions elsewhere. That combination risks turning a time-saving companion into a second team to administer.

The user’s current answer about having a written data agreement is **“Not sure.”** This audit found no commercial grant in the reviewed repository. That does not prove a separate contract does not exist. It means permission is not established by the evidence available here. I would resolve this before increasing paid acquisition or expanding source-dependent paid promises.

## What is already present

Do not build these again:

- Screenshot and pasted-name import, with on-device OCR, ambiguity review and NHL identity matching. The personal-import wrapper can replace a demo roster with matched personal players.
- A free lineup call with a local save and an explicit instruction to make the real move in the host app.
- Free safety information and one non-safety coach decision; a targeted empty-slot CTA now passes date and slot to Pickups without immediately opening a paywall.
- A “since your last visit” brief for observed scratch, injury, goalie-outlook and slot-gap changes.
- Slot-aware planning, usable-game pickup ranking, custom points/category configuration, goalie start estimates, smart reminders, recaps and sharing.

These are observed in current source. They are not proof that the corresponding changes are installed, released, easy to use or producing retention. Seven relevant existing test suites passed: **67 tests** across import, free decisions, coach/pickup behavior, the brief and the NHL client.

Relevant files: `hooks/useRosterImport.ts`, `components/rosterImport/PersonalRosterImportSheet.tsx`, `components/lineup/FreeLineupCallCard.tsx`, `components/screens/TonightScreen.tsx`, `services/fantasy/coach.ts`, `hooks/useRosterBrief.ts`.

## Priority 1 — Make the short answer dependable

**Finding, high source confidence:** the information layer can obscure failure. `fetchJson` returns cached data after a failed refresh without returning its fetch time or stale state. `fetchScratchIds` returns an empty set on failure. `loadNight` also turns a news failure into an empty news array. A player with no scratch/news signal becomes `ok` with unknown confidence, and the coach can produce “Lineup is clean” when there are no higher-priority moves.

This is a reachable failure path, not evidence that a particular customer received a wrong message. The coach’s detail does say “no … scratches posted,” but the stronger title is still an unsafe shortcut for someone relying on a quick answer.

**Change:** carry a narrow, typed provenance result from each critical fetch: source, fetched time, fresh/stale/unavailable state and relevant coverage. Preserve cached schedules and historical stats where useful. For time-sensitive lineup checks, use a freshness policy and show a degraded state when those checks cannot complete. Never interpret an unavailable check as a successful empty result.

**Busy-competitor presentation:** one short status such as “Your PuckIQ plan has no slot conflicts; scratch check unavailable.” Include a clear retry and verification action. Label the local plan as local; the app cannot certify the host lineup.

**Acceptance:** simulate failed and aged scratch responses, stale schedule data, partial news failure and successful fresh checks. The first three must not produce an unconditional all-clear. Retrying must replace the degraded state only after a successful check. The since-last-visit brief must not stamp old source data as newly checked merely because it was observed now.

Evidence: `services/nhl/client.ts:155`, `services/nhl/gamecenter.ts:89`, `services/fantasy/loaders.ts:136`, `services/fantasy/coach.ts:209`, `hooks/useRosterBrief.ts:27`.

## Priority 2 — Stop asking users to maintain two rosters

**Finding, high source confidence:** the ordinary screenshot-import confirmation calls `addPlayers`; that merges additions and does not reconcile players who have left the real roster. A generic `updatedAt` changes for many edits and is not a last-host-confirmed timestamp. The app has no automatic host read in the reviewed path.

**Change:** add a roster check that compares a newly imported, explicitly complete host snapshot against PuckIQ. Show additions, possible removals, IR and eligibility differences for review. Treat partial screenshots as partial; never automatically drop a player because they were outside a crop. Record the confirmation time and coverage separately from a general edit time.

For actions, preserve a pending plan until the user confirms what actually happened. A host-open result is not confirmation of a successful claim. When the user returns, make “Done,” “Unavailable” and “I changed my mind” easy to resolve. These are user-reported states until an authorized integration can verify them.

**Acceptance:** after a host transaction, a single reviewed update makes the personal roster agree; failed/pending waivers do not silently mutate it. A partial import preserves unseen players. Data and plan timestamps cannot imply an authorized host sync that did not occur.

Evaluate an authorized host integration after this lower-dependency workflow proves valuable. Technical API availability and OAuth support do not themselves establish commercial permission for that integration.

Evidence: `components/rosterImport/RosterImportSheet.tsx:64`, `services/teams.ts:264`, `types/fantasy.ts:75`, `services/fantasy/hostLinks.ts:61`.

## Priority 3 — Show and complete the actual add/drop transaction

**Finding, high source confidence:** `rankPickups` computes the benefit of adding a candidate to the existing plan, including displacement on crowded nights. Its input does not include a chosen player to drop, weekly acquisition limits or waiver timing. The Pickups add handler immediately adds the player to the local bench. The host disclaimer and link are in the list footer.

Displacing a starter on one night is not equivalent to losing the dropped player’s value across the rest of the week. A busy user should not have to discover that distinction after opening their host.

**Change:** compare the complete proposed transaction: remove the selected drop, add the candidate, recompute the remaining schedule, and show net usable starts/value. Support “no drop needed” explicitly. Keep availability unknown unless genuinely known; an ownership heuristic is not a waiver list. Put the reason, tradeoff, availability status and host action on the recommendation itself.

**Acceptance:** a candidate whose apparent gain disappears after the drop is downgraded or rejected. An unavailable player produces an alternative without corrupting the roster. Acquisition limits and transaction timing are either represented or explicitly unknown. Keep projected scoring value separate from promised fantasy points.

Evidence: `services/fantasy/pickups.ts:55`, `services/fantasy/pickups.ts:90`, `components/screens/PickupsScreen.tsx:201`.

## Priority 4 — Put the important decision first

**Finding, source confidence high; usability impact unmeasured:** Tonight places two navigation cards above its main content. Depending on state, first-night guidance, sample notice, the return brief, recap, hero, format and reminder prompts may precede the free lineup call and coach moves.

**Change:** make the most consequential current action the primary home-screen unit. Combine or subordinate duplicative guidance. Let an established manager see the short answer first, then inspect the reasoning and player list. Preserve a useful, honestly qualified no-action state. Keep setup, a real first decision and its host handoff available before asking the user to pay for more depth.

**Acceptance:** in observed native tasks, a returning user can identify the important action without hunting through unrelated cards, understand its basis and reach the relevant host destination. Test a quiet night, a scratch, a busy slate and a stale-data state. This is a layout hypothesis until reviewed in the actual app; source order alone does not establish screen-fit or conversion impact.

Evidence: `components/screens/TonightScreen.tsx:239` and the existing persona research.

## Fit across the six personas

| Persona | Existing fit | Most important remaining gap | Decision |
| --- | --- | --- | --- |
| Busy competitor | Personal coaching, import, reminders and a return brief | Reliable checks, roster drift and unfinished host transactions | Lead customer hypothesis; priorities 1–4 |
| Streaming tactician | Strong slot-aware, usable-game planning foundation | Full add/drop cost, availability and transaction constraints | Use as a demanding test cohort |
| Category strategist | Category configuration and tallies | Generalized normalized weights are not live category-win strategy or ratio protection | Describe the present scope accurately; defer broader claims |
| Social learner | Demo path, screenshot review, free advice and explanations | Setup comprehension and confidence in what “save/add” changes | Test the complete first personal decision |
| League steward | League Room and social/recap mechanics | Benefits depend on participation; member data is not automatic host truth | Validate voluntary adoption before more administration features |
| Long-horizon GM | Basic roster and daily planning | No keeper, salary or prospect constraints in the reviewed team/pickup contract | Defer specialization; avoid long-horizon promises |

The categories and keeper findings come from `types/fantasy.ts`, `services/fantasy/categories.ts` and the pickup input contract. The row labels are qualitative audit judgments, not measured customer satisfaction scores.

## Where the current data goes

| Source family | Observed use in the app | Storage/output and scope |
| --- | --- | --- |
| `api-web.nhle.com/v1` | Schedules, scores, player details/logs, rosters, standings, gamecenter scratches/box scores/scoring summaries and EDGE | Device caching; local forms, coaching and scores; player/EDGE views. EDGE can fall back to the prior season. |
| `api.nhle.com/stats/rest/en` | Skater/goalie statistical reports, recent periods, bios and team identities | Cached inputs for form, category weights and pickup candidates. |
| `search.d3.nhle.com/api/v1/search/player` | Search and identity resolution, including unmatched imported names | Roster construction and correction. |
| `assets.nhle.com/mugs/nhl/...` and profile headshot URLs | Player photos via `PlayerAvatar` | Disk-cached display. `USE_NHL_HEADSHOTS` is currently true. The reviewed TeamChip uses text, not a team-logo image. |
| ESPN NHL RSS | Feed titles, summaries, URLs and dates; roster matching and tentative injury interpretation | Five-minute in-memory feed cache; news displayed with source/date and external links. This is more than an outgoing link. |
| NHL gamecenter through the backend poller | Source defines periodic score, scratch and play-by-play reads | Alert state and scratch/goal push logic. The repository does not prove deployment or current cron execution. |

The current app’s active source paths differ from the older Arena Club audit: the old `utils/teamLogo.ts` and `components/EdgeSpotlight.tsx` paths are absent. Current source still enables NHL headshots. Do not copy the old logo finding forward as a confirmed active path.

The client has deduplication, caching, concurrency limits, retry and 429 backoff. Those are useful engineering protections. They are not a license or an upstream service guarantee. Memory caches are per app process, not a fleet-wide cache. A foreground night refresh is scheduled every minute near/live games and can force cache bypass; the backend also defines a minute-based poller. Actual production request volume and deployed schedules were not queried. A future shared cache should follow a licensed provider’s permitted storage and access model, not act as a workaround for missing rights.

Evidence: `services/nhl/client.ts`, `services/nhl/schedule.ts`, `services/nhl/stats.ts`, `services/nhlPlayerSearch.ts`, `services/nhl/player.ts`, `services/rosterNews.ts`, `hooks/useCoach.ts:145`, `supabase/functions/live-poller/index.ts`.

## Can PuckIQ make money using these sources?

**The product can have a paid coaching business, but this audit cannot clear the current data supply for that business.** A publicly callable endpoint, attribution, independent analysis and prior App Store approval are not evidence of an actual commercial grant.

The narrow source findings are:

- NHL covered services: noncommercial personal use; commercial exploitation and marks require consent. [NHL terms, especially sections 1, 2 and 7](https://www.nhl.com/info/terms-of-service).
- ESPN RSS: unchanged feed items, ESPN attribution and original links required; advertising inside RSS content prohibited. [Feed FAQ](https://www.espn.com/espn/news/story?page=rssinfo).
- Apple requires permission under third-party service terms and may request authorization. Its rules also address third-party intellectual property. [Guidelines 5.2–5.2.2](https://developer.apple.com/app-store/review/guidelines/#intellectual-property).
- In U.S. copyright law, facts and protected expression are different; photographs and written expression can be protected. [U.S. Copyright Office](https://www.copyright.gov/help/faq/faq-protect.html).

**Interpretation and remaining legal question:** facts being outside copyright does not decide whether this particular access method, contract, jurisdiction, photo use or editorial transformation is permitted. Applying website terms to each endpoint requires attention to the service scope and any separate agreement. I found no endpoint-specific positive commercial permission in the reviewed material. Charging for a coaching layer does not by itself answer that question. This is an unresolved rights assessment, not a legal opinion that every factual use is prohibited.

For ESPN, distinguish linking to an article from ingesting/displaying the feed and deriving injury signals from it. The source shows the latter. The specific FAQ is not a verified license for PuckIQ’s paid model, and its indexed text was available while the direct page read was limited. Obtain confirmation of the intended use rather than assuming a public RSS URL settles it.

For imagery, the easiest exposure to remove is concrete: use the existing position-monogram fallback by disabling `USE_NHL_HEADSHOTS` unless rights are documented. That would not clear statistics, names, news or other rights on its own. Do not infer ownership of a photograph from owning the subject’s statistics.

**Practical commercial route:** verify any existing agreement first. If none covers the product, seek authorization or price a provider contract expressly covering the required uses. SportsDataIO publicly describes commercial licenses for storage, modeling, derived outputs and in-product display, subject to the agreement; its Discovery Lab is personal-use only. Its commercial pricing requires a quote. This is a candidate to evaluate, not a claim that an off-the-shelf plan covers PuckIQ or that photos/news are bundled. [Provider licensing FAQ](https://sportsdata.io/help/data-rights-and-licensing-questions).

The requirements packet should cover paid iOS subscriptions; public end-user display; caching and historical retention; rankings and derived coaching; widgets, notifications and share cards; territories; update frequency; player identity and headshots; editorial injury data; and post-termination rights. Separate NHL game data from actual fantasy-host roster/availability access. Have a qualified technology/IP lawyer resolve any proposed reliance on the present endpoints or an exception. Do not assume that switching the app to free resolves all source questions.

**Order of operations:** verify rights and obtain scoped pricing, then assess whether the net subscription revenue can support that supply. The simple breakeven comparison is annual data cost divided by actual net annual revenue per retained subscriber; neither input was established here. No provider inquiry, purchase, license acceptance, billing change or launch action was performed.

## Validation and what this audit does not establish

All seven selected suites passed, 67 tests total. They support the existing import/decision/brief/client behaviors tested, not commercial permission or the success of the proposed redesign. In particular, the client’s stale fallback is deliberately tested; the missing user-facing freshness contract is an audit finding despite that passing test.

The source snapshot records the exact hashes of reviewed files because the working tree includes concurrent work. The original persona hypotheses and public-source limits still apply. No native app was built, installed, launched or taken over, no production analytics/billing/API-volume logs were queried, and no production service or monetization state changed.

Once rights are addressed, the smallest product experiment is a complete busy-competitor task with an accurate personal roster: one qualified decision, the reason and tradeoff, host handoff, then a lightweight confirmation of the result. Observe task completion, correction burden and return on another relevant game day. Treat host opens, local plan saves, user-reported execution and settled billing as distinct evidence.
