# 13 · Man drops his goalie at 6:59 (news sequel)

Three 5-second Kling clips joined into one 15-second Action News report. Everything here is generated in
the Higgsfield web app on the unlimited plan (Nano Banana 2 images; Kling 3.0, 5 s, standard queue).
When the clips are done, tell Claude, who pulls them from your Higgsfield history and adds the news
graphics.

| Cut | Start frame | What happens | Who talks |
|---|---|---|---|
| 1 (0–5 s) | Frame A | Reporter sets it up | Reporter, on camera |
| 2 (5–10 s) | Frame B | The vigil on the lawn | Nobody |
| 3 (10–15 s) | Frame A | Punchline; the man slides down the window | Reporter, on camera |

## Step 1 · Images (Nano Banana 2, 9:16)

**Frame A.** Make this first.

```text
Photorealistic vertical 9:16 frame from a local TV news live report at night. A serious female reporter in her 30s in a dark winter coat holds a plain black microphone with no logo, standing on a snowy suburban sidewalk, facing the camera, framed from the knees up on the left side of the frame. Behind her is a two-story suburban house: through the large lit front window a middle-aged man in a bathrobe stands holding a TV remote, lit blue by the TV. On the front lawn, six neighbors in winter coats hold lit candles in a quiet vigil. Light snow falling, warm streetlight, broadcast camera look. No text, no logos, no graphics.
```

**Frame B.** Attach Frame A as a reference image so the house, man and neighbors match.

```text
Same house, same man, same neighbors as the reference image. Closer vertical 9:16 shot of the front-lawn candlelight vigil at night: neighbors in winter coats and hats hold lit candles, faces glowing, looking solemnly toward the house. A bouquet of flowers and a framed photo of a hockey goalie mask sit on the snowy front steps. Through the lit window the man in the bathrobe stares at his TV. Light snow, candlelight, broadcast camera look. No text, no logos.
```

## Step 2 · Clips (Kling 3.0, 5 s, 9:16, standard queue, sound on)

**Clip 1.** Start frame: Frame A.

```text
Static news camera. The reporter speaks to camera, serious and calm: "A local man dropped his starting goalie at 6:59 tonight." Behind her the man at the window keeps staring at his TV and the neighbors' candles flicker. Light snow. Only the reporter speaks.
```

**Clip 2.** Start frame: Frame B.

```text
Slow push-in on the candlelight vigil. A neighbor gently places a bouquet on the front steps and pats another neighbor on the shoulder. Through the window, the man in the bathrobe slowly presses his forehead against the glass. Soft wind, quiet sniffles, candles flickering. No one speaks.
```

**Clip 3.** Start frame: Frame A.

```text
Static news camera. The reporter lowers her voice, completely deadpan: "That goalie just posted a shutout." Behind her, the man in the window slowly slides down the glass and out of view. Only the reporter speaks.
```

Generate a few takes of any clip if needed; unlimited takes are free. Pick the best take of each.

## Step 3 · Claude assembles

Joins clips 1–3, adds Action News graphics (LIVE · Maple Street, a BREAKING NEWS banner, a ticker),
checks frames and logos, and renders a 1080×1920 post with an .srt caption file.

- Banner: "Local man drops goalie at 6:59. Goalie posts shutout."
- Ticker: "Candlelight vigil continues on Maple Street • Neighbors ask for privacy • Lineups lock at 7 PM •
  Experts: always check who's starting"
- Post text: "thoughts and prayers to everyone who benched a goalie tonight 🤖"
