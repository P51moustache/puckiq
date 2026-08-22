# PuckIQ — one job

PuckIQ is for **managing MY fantasy hockey team**. It is not a league-wide NHL briefing hub.

Left Wing Lock already owns generic goalie/line briefings. This app only answers: *who on my roster should I start tonight, and what news about those players can change that?*

## v1

- **Manual roster** — search official NHL players, add ~12 names, persist on device.
- **Tonight** — each of MY players: opponent, scratch/injury signal from public NHL data (`api-web.nhle.com`), start/sit leaning for roster players only.
- **News** — public RSS filtered to names on MY roster. No Left Wing Lock, Daily Faceoff, or RotoWire.
- **Yahoo / ESPN sync** — interface is in the app (`services/fantasySync.ts`) and stubbed. OAuth is next, not this release.

## Later

Other sports, Yahoo/ESPN OAuth import, and deeper category-vs-category tools. Not a second briefing product.
