# PuckIQ — Stop leaving games on the bench

Finished vertical commercial: **puckiq-bench-games-15s.mp4**

- 15 seconds, 1080 × 1920, 30 fps, H.264 picture and stereo AAC sound.
- Real app screenshots with separate animated headlines, crops, highlights, and transitions.
- Original synthesized instrumental soundtrack and sound effects; no external music samples.
- Demo numbers are identified on screen as an example roster.
- Rendered locally; no Higgsfield generation credits were used.

## Edit

| Time | Message | App screen |
| --- | --- | --- |
| 0–3.75 s | 48 games. Only 41 count. | Week summary |
| 3.75–6.56 s | Stop leaving games on the bench. | 7 lost to bench |
| 6.56–9.38 s | Find pickups that fit. | Fills 2 empty |
| 9.38–12.19 s | Be ready. Before lock. | Tonight |
| 12.19–15 s | PuckIQ. Your fantasy hockey coach. | Logo and CTA |

Sources are the existing `04-week.png`, `05-pickups.png`, and `02-tonight.png` in `marketing/screenshots/raw-iphone`, plus `assets/images/art/logo-mark.png`. Original source files were not changed.

`puckiq-bench-games-cover.png` is a matching cover frame. `review/contact-sheet.png` shows representative moments. `source/` contains the editable native composition and original soundtrack source.

To reproduce on this Mac, compile `source/render.swift` with `swiftc -O` and run the resulting executable with `all`. The soundtrack already exists; `source/make_soundtrack.py` can regenerate it using Python with NumPy. The renderer currently references this project's absolute location.
