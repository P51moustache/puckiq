# PuckIQ — Bench Games, version 2

**Finished ad:** `puckiq-bench-games-v2-15s.mp4`

15 seconds · vertical 1080 × 1920 · 60 fps · H.264/AAC

This rebuild adds a generated hockey opening, a 48-to-41 game counter with seven falling tiles, moving phone and app close-ups, and a three-phone closing reveal. A new original soundtrack follows the scene transitions and counter clicks.

The hockey artwork was created with built-in image generation and animated with **LTX-2.5 in Comfy Cloud**. The app screens use the original captures, with separate motion and highlights. Sample roster figures are identified on screen. The first ad is preserved in `../01-bench-games/`.

## Timeline

| Time | Scene |
| --- | --- |
| 0–1.875 s | Cinematic hockey opener: Your bench is costing you. |
| 1.875–4.688 s | 48 scheduled games; seven fall away, leaving 41 usable. |
| 4.688–7.5 s | Move into the real Week screen and its lost-to-bench figure. |
| 7.5–11.25 s | Pickups: one candidate fits two open nights. |
| 11.25–15 s | Three app screens, brand line and download CTA. |

`source/` contains the editable native composition, music source, generated opening image and video, and a generation manifest with the prompt and confirmed Comfy job ID. `review/` contains proof frames. The cover is `puckiq-bench-games-v2-cover.png`.

To rebuild on this Mac, compile `source/render.swift` with `swiftc -O` and run the executable with `all`. Sources currently reference this project's absolute path. The generated footage is already saved locally; rebuilding does not submit another generation.

Comfy template overrides required the documented interior-node workaround. [Comfy Cloud beta feedback](https://links.comfy.org/cloudmcpbeta).
