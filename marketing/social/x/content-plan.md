# PuckIQ on X — content plan

Goal: a hockey-humor account that people follow for the jokes and that points back to PuckIQ.
About 1 in 4 posts mentions the app. The rest are hockey and fantasy-hockey culture.

## House rules

- **No real people in AI video.** No NHL players, coaches or broadcasters, and no imitated
  voices. Use made-up characters in plain jerseys. A real player's face is a likeness and
  publicity problem, and X can label or remove misleading synthetic media.
- **No NHL or team logos, and no exact team jersey designs** in generated footage. Real stats
  and player names are fine in data posts that come from the app.
- **Say it's AI** when a clip could pass as real footage ("AI" in the caption or a 🤖).
- Real engagement only: no follow/unfollow churn, bought followers or automated mass replies.
  X suspends accounts for those.
- Each post: one 6–10 s vertical clip (9:16), a single on-screen line, sound on, under 200 characters of copy.

## Cadence

- 1–2 posts a day. Post around 6–7 pm ET on game nights, when fantasy players are setting lineups.
- Save the best joke for the busiest NHL nights (Tue/Thu/Sat).
- Reply to fantasy-hockey threads as the account, with jokes rather than ads.

## What makes a clip spread

- **Hook in frame one.** The absurd thing is already happening when the clip starts. No slow builds.
- **A true thing pushed to absurd.** The hockey bag smell, what hockey costs, 5 AM practices, fantasy
  regret. Everyone who's lived it tags someone.
- **Wide hockey audience first.** Players, parents and beer leaguers outnumber fantasy players.
  Fantasy jokes work when the visual explains them (the news report), not when they need an explanation.
- **Formats that feel real:** bodycam, doorbell cam, local news, street interviews, nature documentaries.
  Realistic footage of something impossible is what AI does better than any film crew.
- **A payoff in the last two seconds,** delivered deadpan. The straight face sells it.
- **It has to work muted.** X autoplays without sound, so the header sets up the joke and burned-in
  subtitles carry the punchline.

Round 1 (lineup panic, goalie stakeout) failed on all of these: niche setups with no payoff.
Round 2 results and status are in `posts.md`.

## Models (bake-off, Oct 5)

Same 15 s bodycam script on each. Credits are for 15 s, vertical, with sound.

| Model | Cost | Verdict |
|---|---|---|
| Seedance 2.5 | 45 as a 480p draft (105 at 720p) | **Default.** One continuous shot, consistent people, all lines in order. Upscale drafts for 0.2 credits; finishing at 1080p costs 180. |
| Kling 3.0 | 26 | Cheapest, but rewrote the scene (the minivan became a cop car) and garbled text. |
| Veo 3.1 | 32 (Fast) or 80 (full) per 8 s, 8 s max | Lip-sync and continuity misses (a person appearing from nowhere); can't go past 8 s. |

Staging rules: every character is in frame from the first second. Only the person on camera talks, or
the speaker is off-screen. Never write "camera swings to reveal" a new person.

## Next ideas

1. **Zamboni slow-speed chase.** News-helicopter footage of an ice resurfacer on the highway with
   cruisers behind it. "Rec league ran two minutes over ice time."
2. **Baby podcast.** Two babies in headphones arguing that goalies aren't real people.
3. **Grandma beer-league goalie.** Robs a breakaway, then goes back to knitting in the crease.
4. **Ref eye exam.** "The ref from my kid's game getting his eyes checked." He reads the chart from the wrong wall.
5. **Minivan detail ASMR.** A detailer works through layers of tape balls, a 2019 mouthguard, and a raccoon.
6. **5 AM rink parents as a war film.** Frozen bleachers, steam, a parent whispering "I can't feel my legs, Linda."
7. **Nature doc: the beer-league goalie.** "He has not stretched since 2009." Drops to a butterfly and
   can't get up.
8. **Breaking news sequels** (fantasy, app-adjacent): "Man drops his goalie at 6:59, goalie posts a shutout."
9. **Bodycam sequels:** the officer finds the hockey bag again, this time at the airport.

## Recurring formats

- **Pain of the week:** one fantasy disaster from that week's real games, told as a joke clip.
- **Schedule edge (data):** "Teams with 4 games this week" and "Best off-night streamers", made
  from the real NHL schedule with PuckIQ's own week planner. These are the posts that sell the app.
- **Stages of grief:** a 4-panel series (denial → bargaining → waivers → acceptance).

## Pinned post and profile

- Name: PuckIQ. Handle ideas, availability unchecked: @PuckIQ, @PuckIQapp, @PuckIQhq.
- Bio: "Fantasy hockey coach in your pocket. Mostly here for the chirps. 🏒" plus the App Store link.
- Pinned: the 15-second Bench Games ad (`marketing/finished/social/bench-games/`), already
  approved and 9:16.
