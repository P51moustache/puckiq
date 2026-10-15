# PuckIQ — refined dark concept

[View the refined board](dark-player-lineup-insights.png)

Generated with the built-in imagegen tool using the selected [dark concept](../purpose-and-red/concept-2.png) as the image reference. The user chose to refine the concept before implementation.

## Selected direction

- Dark charcoal surfaces with red highlights, restrained borders, white type and compact stat tiles.
- Player Details: a portrait that fades into the background; player identity alongside it; season stat tiles; a short personal insight; rest-of-season estimates; selectable Points / Goals / Assists charts; a prominent bottom action labeled “Add to starters”.
- Best Lineup: a central place for the proposed starters, improvement summary, start/sit coaching and useful alternatives, with a time scope and handoff to the user's fantasy platform.
- Insights: personal coaching cards and cinematic hockey artwork integrated at the bottom.

## Implementation follow-through

The board is a visual exploration with illustrative numbers, portraits, advice and availability claims.

The current player sheet already composes profile, season stats, coaching, week schedule, form, fantasy-value bars and roster actions. Relevant sources are `components/sheets/PlayerSheet.tsx` and `components/player/`.

The current recent-games chart shows fantasy value; Points / Goals / Assists selectors would add per-stat views. Rest-of-season estimates need a defined model and schedule inputs before presenting real predictions. “Add to starters” is a provisional concept label: current actions add players to the roster, while the lineup engine selects eligible starters. Its exact plan behavior should be defined during implementation. Fantasy host changes remain user actions.

The generated footer artwork is embedded in this concept board; a standalone production image has not been generated yet.

[Exact image prompt](prompt.txt)
