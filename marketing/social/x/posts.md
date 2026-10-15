# X post queue

Each post has a spec in `specs/` (caption, timed subtitles, overlay). Raw generations live in
`marketing/videos/x/raw/` and rendered posts in `marketing/videos/x/posts/` (both gitignored).
Render with:

```bash
swiftc -O scripts/social/caption/*.swift -o /tmp/caption_clip
/tmp/caption_clip marketing/social/x/specs/*.json
```

Status: `draft` → `approved` (by Zach) → `posted` (with link).

No words or branding on the video (Zach, Oct 5): the joke goes in the post text, and the clips earn the
follow so the profile can sell PuckIQ. Each clip gets its format's own graphics instead: news lower third
and ticker, bodycam timestamp and REC, doorbell live view. Clips are upscaled to 1440×2560 first
(`bytedance_video_upscale`, 0.2 credits) and rendered at 1080×1920. Dialogue clips also get an `.srt`
beside the video; attach it on upload so muted viewers can turn on captions. 🤖 at the end of the post
text marks the video as AI-generated.

| # | Clip | Post text | Format graphics | Status |
|---|---|---|---|---|
| 6 | `06-breaking-news` | me after setting my fantasy hockey lineup 🤖 | news banner and ticker, .srt | approved, post first (keep the Veo take) |
| 4 | `04-bodycam-bag` | got pulled over on the way home from my son's hockey tournament 🤖 | bodycam, .srt | approved (v3: 15 s Seedance 2.5 draft, upscaled. v2 Veo had the dad appear from nowhere; v1 put his line on the officer's face. Jacket shows a North Face logo) |
| 3 | `03-hockey-bag` | opening my kid's hockey bag after a 4-game weekend tournament 🤖 | none | approved |
| 5 | `05-sold-the-house` | asked a hockey dad how much he spent this season 🤖 | none, .srt | approved (keep the Veo take) |
| 7 | `07-hoa-rink` | the HOA said no backyard rink 🤖 | doorbell cam | approved |
| 9 | `09-zamboni-chase` | the zamboni driver's rec league went 2 minutes over ice time 🤖 | news banner and ticker, .srt | cut (Zach dropped it; the vehicle never looked like a Zamboni) |
| 10 | `10-airport-bag` | they opened the hockey bag at airport security 🤖 | none, .srt | approved (locked by Zach; kid's jersey shows an NHL shield, accepted) |
| 11 | `11-ref-eye-exam` | the ref from my kid's game getting his eyes checked 🤖 | none, .srt | approved (locked) |
| 12 | `12-nature-doc-goalie` | the beer league goalie in his natural habitat 🤖 | none | draft |
| 8 | `08-400-stick` | my kid's first slapshot with the new $400 stick 🤖 | — | hold: CCM logos and a Kings-like crest; regenerate |
| 1–2 | lineup panic, goalie stakeout | — | — | cut |

Generation: 3, 7 and 8 Seedance 2.5 (56 credits each); 5–6 Veo 3.1 Fast (32 each); 4 Seedance 2.5 15 s 480p draft (45) upscaled.
Default model from now on: Seedance 2.5 only (Zach, Oct 5). Existing Veo clips 5 and 6 stay as they are. See the bake-off notes in content-plan.md. Dialogue was transcribed
with ElevenLabs Scribe (44 ElevenLabs credits per clip) for subtitle timing.
