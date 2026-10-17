# PuckIQ 3.3.2 release receipt

Submitted on October 17, 2026 at 2026-10-17T22:30:49.949Z, with Zach's go-ahead. Apple reports **WAITING_FOR_REVIEW**. The release mode is **AFTER_APPROVAL**, so it goes live as soon as Apple approves it.

3.3.2 replaces 3.3.1, which never shipped. Zach asked to pull 3.3.1 from review so the "Open Yahoo" fix reaches users sooner. Its submission `21885021-a6d8-4ffb-a57d-aebc967ed0e8` was cancelled (DEVELOPER_REJECTED), and the same App Store version record was renamed to 3.3.2. What's New covers the 3.3.1 changes too.

- Commit `7c0d23c` on main: merges the Open Yahoo fix (`5cc1a86`, Linking.openURL was passed unbound so every host open threw) and the streamer insight fix (`a3f7acc`). Typecheck and 1,064 tests pass. Open Yahoo checked on the simulator: it opens Safari on fantasysports.yahoo.com.
- EAS build: [548816ca](https://expo.dev/accounts/zlce/projects/learning-project/builds/548816ca-eab6-43bb-a81b-90609d885ba0), version 3.3.2 (47), **FINISHED**. The auto-submit never reached App Store Connect; a manual resubmit, [70d945d6](https://expo.dev/accounts/zlce/projects/learning-project/submissions/70d945d6-e45e-4973-a7c0-f9da195846a6), uploaded it.
- Processed build `073a8767-10e0-46de-8ff5-4ecf08059192` is **VALID**. Export compliance: no non-exempt encryption.
- App Store version `af50365c-95c5-4f93-81f5-52c3bb001d81` (3.3.2) has build 47 attached. Review submission `3efc2189-56c2-4623-bd03-ce45824f380c`.
- What's New: `whats-new.txt`. Review notes: `review-notes.txt` (3,885 of 4,000 characters; the paywall path is Settings > See Pro). Description and keywords carried over.

Still to confirm in the App Store Connect web interface: App Privacy lists Crash Data, not linked to the user.
