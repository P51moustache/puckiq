# PuckIQ marketing assets

Everything here was captured from the real app on real NHL data (the 2026-27 schedule for Tue Oct 13,
37 minutes before first puck), using the sample team plus an opponent roster. Binaries are gitignored
(`screenshots/`, `videos/`); regenerate with the scripts in `scripts/store/`.

## Upload to App Store Connect

| Folder | What | Size |
|---|---|---|
| `screenshots/app-store/iphone-6.9/` | 8 framed iPhone screenshots, in upload order | 1320×2868 |
| `screenshots/app-store/ipad-13/` | 5 framed iPad screenshots | 2064×2752 |
| `videos/app-preview/01–04` | iPhone app previews (15–30 s, 30 fps, silent audio track) | 886×1920 |
| `videos/app-preview/05-ipad-tour.mp4` | iPad app preview | 1200×1600 |

App Store Connect takes up to 3 previews per device size. Suggested iPhone order: `01-tonight`,
`03-pickups`, `04-share-card`. The poster frame is the first frame unless you pick one.

## Social

| Folder | Use |
|---|---|
| `screenshots/social/square/` | 1080×1080 — Instagram feed, X, Reddit, Discord |
| `screenshots/social/story/` | 1080×1920 — Instagram/TikTok stories, Reels covers |
| `videos/raw/` | Full-resolution screen recordings to cut into Reels/TikToks |

## Raw screenshots (`screenshots/raw-iphone/`, `screenshots/raw-ipad/`)

Unframed, full-resolution captures of every screen, for press kits, the website, and new frames.

- **Pro, game night:** welcome, Tonight (hero, lock calls, goalie calls, player cards), best lineup,
  Tomorrow's empty slots, Week (totals, next week), matchup vs an opponent, Pickups (all, goalies,
  tomorrow, "lineup full" empty state), player sheets (skater + goalie, NHL Edge telemetry, game-log chart),
  roster, league + scoring settings, team switcher, player search, share card + iOS share sheet.
- **Free tier:** Tonight upsell, locked lineup, locked pickups, locked telemetry, paywall, Settings.
- **iPad:** Tonight (Pro + free), Week, Pickups grid, Roster split, Settings, player sheets (Pro + free).

## Videos (`videos/raw/`)

| File | Shows |
|---|---|
| `01-tonight-tour.mp4` | Tonight: countdown, lock calls, lineup grid, player cards → player sheet with NHL Edge |
| `02-week-matchup.mp4` | Week grid → matchup vs opponent → next week |
| `03-pickups.mp4` | Streamer list, position filters, one-tap add |
| `04-onboarding.mp4` | First run: welcome → league → add McDavid → reminders → Tonight (free tier) |
| `05-share-card.mp4` | Share card preview → iOS share sheet with the PNG |
| `06-ipad-tour.mp4` | iPad: Tonight, Week, Pickups, Roster, player sheet |

## Regenerate

```bash
python3 scripts/store/frame_screenshots.py marketing/screenshots/raw-iphone marketing/screenshots/app-store/iphone-6.9 phone
python3 scripts/store/frame_screenshots.py marketing/screenshots/raw-ipad marketing/screenshots/app-store/ipad-13 ipad
python3 scripts/store/social_posts.py marketing/screenshots/raw-iphone marketing/screenshots/social
swiftc -O scripts/store/vidtool.swift -o /tmp/vidtool   # then: /tmp/vidtool export <in> <out> 886 1920 <start> <seconds>
```

Captures use a dev build with `EXPO_PUBLIC_DEV_DATE=2026-10-13 EXPO_PUBLIC_DEV_NOW=2026-10-13T21:22:00Z`
(add `EXPO_PUBLIC_DEV_PRO=1` for Pro), the simulator launched with `TZ=America/New_York`, and the
status bar overridden to 9:41.
