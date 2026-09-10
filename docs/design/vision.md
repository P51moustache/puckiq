# PuckIQ Design Vision — Arena Club

**Selected:** 2026-09-09, after the owner approved the illustrated Arena Club concept and requested team-dependent colors.
**Replaces:** [Stat Sheet](archive/2026-04-26-stat-sheet.md), which was too restrained for the desired personality.
**Implementation status:** implemented in the native Expo app: Tonight, Following, Players, League, Settings, and onboarding. Verified in Expo Go 57 on iOS; see the [implementation verification](2026-09-09-arena-club-verification.md).

## The experience

A personal hockey-season companion with the visual character of a game poster and a collectible trading card. Lead with identifiable hockey imagery, expressive jersey typography, team colors, and tactile controls. Keep the information useful before puck drop and worth revisiting after the game.

The core questions are who is starting, how the teams compare, what changed, and how the forecast compares with the final result. Preserve the stats focus; the product is not an article feed.

## Team identity

Use the person's **home team** to select the whole UI palette: game-poster background, headline treatment, primary buttons, navigation, highlights, tinted surfaces, and borders. A tiny team-colored stripe is insufficient.

- The first followed team becomes the default home team. Following more teams does not silently change the palette.
- Let people select a different home team from their followed teams. This choice controls appearance without changing what they follow.
- For existing users without a home-team choice, use the earliest followed team as the deterministic initial default.
- If the home team is unfollowed, use the earliest remaining followed team. With no followed teams, use a neutral PuckIQ palette and invite the first selection.
- Keep the app's home-team identity stable while browsing other teams. Opponent logos, jerseys, and comparison marks retain their own identities.

The [32-team palette catalog](arena-team-palettes.json) defines the concept's token sets. The current team list follows the [NHL team directory](https://www.nhl.com/info/teams/). The catalog uses the existing project colors plus role-specific UI treatments; it is not a certified official brand-color specification. Legacy team colors remain available for historical data but do not add defunct teams to the active selector.

## Visual rules

1. **Art is part of the identity.** Use hockey photography, player cutouts, or deliberately commissioned illustrations in the primary game card. Production player portraits must depict the identified player. Never label a fictional concept skater as a real NHL player.
2. **Legibility survives the collage.** Essential text sits above artwork when needed. Keep GAME NIGHT, team names, probabilities, and controls clear of bodies, badges, and crop edges at narrow widths. Decorative layering must not hide words.
3. **Use a complete palette.** Consume shared color roles rather than scattering team hex values through screens. Each theme needs hero and action colors, their text colors, frame colors, neutral surfaces, readable links, and focus treatment.
4. **Separate team identity from data meaning.** Positive, negative, warning, and confirmation states retain consistent semantics across all teams. Pair status colors with text or symbols. Charts must label opponents and remain distinguishable when team colors are similar.
5. **Make controls tactile.** Raised buttons, shaped corners, stamped saves, and a game-card flip are signature interactions. Use the same control grammar across teams.
6. **Typography carries hierarchy.** Use expressive condensed display type for short hockey headlines and major numbers, with a readable sans serif for controls and explanations. Align numerical comparisons with tabular figures. Avoid turning every label into a display headline.
7. **Keep useful information readable.** Neutral surfaces support comparisons, lists, and explanations. The dominant art belongs to the game card; secondary screens should not become competing posters.
8. **Preserve trust.** Show freshness, source/model context, sample sizes where useful, and honest empty, stale, or unavailable states. Do not fabricate confirmations, player portraits, forecasts, model attribution, or shot-quality measures.
9. **Premium stays understandable.** Show the actual feature and a clear upgrade path. Do not black out entire tabs or substitute decorative effects for recurring value.
10. **No decorative emoji system.** Use intentional artwork and a coherent icon family.

## Motion and feature boundaries

The game card can tilt gently and flip into its analysis. Saving can stamp the card and add it to the season book. Native transitions and restrained haptics should preserve context and respond to deliberate actions. Respect reduced motion and equivalent accessible controls.

**Shot Lab was removed.** A draggable puck that only reports geometry does not justify a standalone feature. **Game Preview** replaces it, focusing on starting goalies, team comparisons, and saved forecast changes. Real shot maps can be explored inside the relevant game when the data supports them.

The original HTML concept uses illustrative data. The native implementation reads the existing Supabase feed and labels missing schedules, forecasts, and unconfirmed starters. Expo Go verification does not establish production data quality, working native purchases/push delivery, or store readiness.
