# PuckIQ UI concepts — September 9, 2026

Status: Arena Club is selected, with readable GAME NIGHT lettering, complete team-dependent palettes, and Game Preview replacing Shot Lab. See the adopted [vision](vision.md) and [32-team palette catalog](arena-team-palettes.json). Native implementation has not begun.

## Product direction

Build a personal season companion around “Know what changed before puck drop.” The daily loop is following teams and players, checking relevant changes, opening a game sheet, receiving a useful alert, and reviewing the outcome. Visual identity should make this loop recognizable and enjoyable without obscuring freshness, uncertainty, or model provenance.

## Three directions

| Concept | Visual identity | Working preview interaction | Best role |
| --- | --- | --- | --- |
| Pressbox | Cool paper, dark ink, condensed sports typography, ruled rows | Unfold a forecast into its calculation; save a matchup | Daily briefing and readable lists |
| Rinkside | Petroleum blue, ice geometry, quiet cyan shot marks | Inspect individual attempts, filter goals, replay the sequence | Postgame exploration and team detail |
| Replay | Arena instrument panel, split-flap probability figures, chronological tape | Scrub four saved snapshots or play the pregame sequence | Distinctive game sheet and forecast history |

Initial recommendation, now superseded: use Replay as the primary identity, Pressbox's hierarchy for Today, and Rinkside as an optional game-detail tool. The owner's feedback requires a substantially more expressive visual identity.

## Arena Club revision

The selected concept uses original hockey-player collage artwork, oversized jersey typography, team identity, halftone printing, dimensional buttons, and a game card that flips into the forecast analysis. Royal blue and orange were the initial Edmonton treatment; every active team now has a complete concept palette. The live app's existing screen styles have not yet been changed.

Headline correction: “GAME NIGHT” sits above the artwork in solid high-contrast lettering, with a smaller responsive size and space above the forecast badge. Preserve the player illustration and tactile controls; essential words must remain readable through the layered composition.

The concept has three working views:

- **Tonight:** a layered game poster with gentle pointer tilt, a physical card flip into forecast snapshots, and a stamped save action.
- **Game Preview:** starting-goalie comparison, special teams with visible sample sizes, and saved forecast changes. The geometry-only Shot Lab was rejected as insufficiently useful and removed.
- **Season book:** saving tonight's matchup adds a ticket showing its pregame forecast and pending result. This is a proposed retention feature, with state local to the preview.

The skater is original generated concept artwork depicting a fictional player. The palette exploration uses the approved color treatment for Edmonton and a neutral presentation for other themes. It must not be labeled as an actual NHL player's portrait. Production team and player views should use the appropriate identified imagery.

Browser checks verified all 32 palette selections and all three views at a 320 px viewport, with no horizontal overflow or script errors. Game Preview snapshot selection, saving games from two different teams, embedded artwork, and the reduced-motion card flip also passed. The palette catalog passed 192 primary text/background contrast checks, with a minimum ratio of 4.55:1. This is targeted concept validation, not a complete native accessibility audit. Native implementation and real data integration have not begun.

Pressbox deliberately explores a light appearance. Replay remains closest to the current navy/cyan identity. All three use typographic hierarchy and relevant data as their visual material. Team names remain readable without depending on crest assets.

## Motion and useful tools

- **Forecast tape:** step through actual stored snapshots. Animate only changed digits. Each stop identifies the time, model, information available, and resulting estimate. Unchanged checks remain visible; never interpolate an invented forecast between snapshots.
- **Unfolding calculation:** reveal the weighted model's contribution breakdown from the forecast itself. Motion establishes the relationship between the headline and the calculation. Do not reuse weighted-model contributions as explanations of server ML predictions.
- **Shot atlas:** inspect real located attempts, filter by outcome, and play a finite sequence. Show location coverage and normalize rink direction before displaying real games. A line toward the goal is a direction aid, not a measured puck trajectory.
- **Native detail transition, proposed:** expand the selected matchup into its game sheet while retaining team and probability positions. Collapse back into the originating row to preserve orientation.
- **Native haptics, proposed:** light detents when the selected forecast snapshot changes, and restrained confirmation when following or saving. No continuous haptic feedback while dragging.

Animations should respond to user input, finish predictably, and be cancellable. Honor reduced motion; retain equivalent static states and keyboard/screen-reader access. No automatic looping on the daily screen.

## Data and implementation dependencies

The preview uses explicitly illustrative games, shot attempts, events, and probabilities. It is an interaction study, not a live NHL forecast or a validated model explanation.

The installed app already includes Reanimated, Gesture Handler, and React Native SVG. These support the proposed native mechanics without requiring a new animation dependency. Browser motion is not evidence of native performance; profile on both supported platforms during implementation.

The sync code already stores play-by-play coordinates. Validate coverage, coordinate orientation, event classification, and game state before exposing a real shot atlas. Do not invent expected-goal values or a heat map from unavailable data.

Replay requires a reliable history of timestamped predictions and their input/status snapshots. A screen cannot reconstruct what was known earlier from the current prediction alone. The probability-change example is a controlled weighted-model illustration; a production explanation must distinguish attributed contributions from coincident news.

## Implementation order after a direction is selected

1. Resolve the visual system and document the adopted changes to the current vision.
2. Apply it to a complete Today → Game sheet → Following flow, including loading, stale, empty, error, and offseason states.
3. Connect trusted prediction snapshots and model-specific explanations; make alert links open the relevant game or player.
4. Add the shot atlas after data coverage and orientation checks.
5. Carry the same system through Players, League, onboarding, and the actual purchase flow.

Keep the commercial promise focused on personal relevance, timely changes, and retained history. Animation helps people understand and enjoy those capabilities; it does not establish willingness to pay on its own.

## Preview validation

Browser checks covered concept switching, saving, calculation expansion, shot stepping and goal filtering, replay controls, and forecast selection. Layout checks found no horizontal overflow at a 320 px viewport. The preview includes reduced-motion handling. Native implementation, device performance, real data, notification delivery, and purchasing remain outside this concept validation.
