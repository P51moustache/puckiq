# PuckIQ coach launch materials

This pack contains the final 15-second App Store preview with the supplied Suno music, six social cards, 13 audited screenshots, a Suno prompt, and the listing copy for PuckIQ 3.0. Created October 4, 2026. Listing text and screenshots are saved and verified in App Store Connect. PuckIQ 3.0 build 35, both Pro plans, and their subscription group were submitted together and are Waiting for Review. Automatic release after approval is enabled. The new preview file is accepted; Apple video conversion is still processing. See the audit and `review/submission-receipt.json` for verified status.

## Video and music

- `puckiq-coach-preview-15s-suno-x264.mp4`: final App Store cut, all six feature scenes, supplied Suno music with a clean ending fade.
- `puckiq-coach-preview-15s-x264-poster.png`: matching 3-second Best Lineup poster.
- `puckiq-coach-preview-25s-suno.mp4`: longer marketing master using the same Suno track, with an 800 ms ending fade.
- `puckiq-coach-preview-25s-original-music.mp4`: preview with the existing original synthesized music bed, edited to 25 seconds.
- `puckiq-coach-preview-25s-music-ready.mp4`: same picture with silent AAC audio, ready for the Suno replacement.
- `puckiq-coach-preview-poster.png`: 5-second poster for the longer marketing master.
- [Suno prompt](suno-prompt.md). Drop the downloaded track in `marketing/input/audio/`.

The untouched source is `marketing/input/audio/puckiq-suno-original.mp3`; the fitted music is `puckiq-suno-15s-48khz-stereo.wav` and `puckiq-suno-25s-48khz-stereo.wav`. The user's requested destination is the App Store listing. The source file itself does not verify the Suno account plan or licensing history.

The phone preview is 886 × 1920, H.264 at 30 fps, with 48 kHz stereo AAC encoded at a target 256 kbps. It uses actual app recordings, explanatory titles, Pro labels, and a sample-roster disclosure.

## Listing and audit

- [Submission audit](listing-audit.md) and [evidence snapshot](audit-evidence.json).
- `screenshots/iphone-6.9/`: 8 audited campaign images that match the current upload.
- `screenshots/ipad-13/`: 5 campaign images that match the current upload.
- `listing/`: description, promotional text, keywords, What’s New, review notes, and the original proposed metadata patch. The exact text has been saved to the pending 3.0 listing; `review/submitted-metadata.json` records the read-back verification.
- [Loyalty delivery plan](loyalty-release-plan.md).

## Social launch cards

Six exports live in `../../social/coach-launch/`: Tonight, Week, and Pickups in 1080 × 1350 feed and 1080 × 1920 story formats. They use real UI and label paid features. Publish launch claims after 3.0 is live.

Suggested caption: “Your bench is costing you games. PuckIQ helps you see who plays, which games fit your slots, and which pickups fill your empty nights. The new fantasy hockey coach. Free to download; Pro unlocks the full coach.”

## Recreate or replace music

```sh
swiftc scripts/store/preview_render.swift -o /tmp/puckiq-preview-render
/tmp/puckiq-preview-render "$PWD" marketing/finished/app-store/coach-launch/source/timeline.json marketing/finished/app-store/coach-launch/source/picture.mp4 marketing/finished/app-store/coach-launch/puckiq-coach-preview-poster.png
swiftc scripts/store/preview_audio.swift -o /tmp/puckiq-preview-audio
/tmp/puckiq-preview-audio marketing/finished/app-store/coach-launch/source/picture.mp4 marketing/input/audio/suno-final-48khz-stereo.wav marketing/finished/app-store/coach-launch/puckiq-coach-preview-25s-suno.mp4
python3 scripts/store/launch_cards.py "$PWD" marketing/finished/social/coach-launch
```

The audio helper accepts 48 kHz stereo WAV or `silence`. It preserves the H.264 picture and changes only the audio. Trim and fade the chosen music to the 25-second edit before the final mux.

## App Store upload

`puckiq-coach-preview-15s-suno-x264.mp4` is the final uploaded copy (1,031,912 bytes). It holds six captured feature screens for readability, with the original headlines, progress animation and Suno music: Tonight, Best Lineup, Week, Matchup, Pickups and the closing brand scene. It preserves 886 × 1920 pixels and 30 fps, uses H.264 High 4.0, and retains the stereo AAC audio and ending fade. Every decoded frame was compared against the held-screen master (average PSNR 49.12 dB, minimum 46.65 dB), and the UI/poster were visually reviewed. Exact plan: `source/timeline-15s-held.json`.

The longer 25-second marketing master remains available. Other compression variants are retained as alternatives; the uploaded file is identified above and in `review/uploaded-preview.json`. Current Apple processing and submission evidence is in `review/submission-progress.json`.
