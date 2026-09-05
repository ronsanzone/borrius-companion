# Retroid verification

Validated on the connected Retroid Pocket Classic, Android 14, 2026-09-05 (UTC).

- Signed release `dev.borrius.courier` version 1.0.0 installed successfully; no `DEBUGGABLE` package flag.
- Activity launch recorded by Android as displayed in 613 ms. Courier process remained alive; no app startup crash.
- User completed Android folder selection. `dumpsys activity permissions` confirms the app holds a persisted grant to `primary:RetroArch/saves/mGBA` with `mode=0x1` and `persisted=0x1`: read access only. The provider reports read/write as potentially persistable, but the app persisted **only read**.
- Installed manifest requests no storage-write or broad filesystem permission. WorkManager contributes wake lock, boot-completed and foreground-service library permissions; this app does not start a foreground session service.
- Build verification: four unit tests passed; debug/release assemble and lint passed; release signature verified.

The coordinating task confirmed production pairing at 04:00:47 UTC and the first save uploaded and ready at 04:00:49 UTC. Independent read-only JobScheduler inspection after pairing confirmed a WorkManager job with battery-not-low and unmetered/validated network constraints. Its initial pending-analysis retry completed automatically. A subsequent inspection showed the next job scheduled with minimum latency **14m59.966s**, both battery/network constraints satisfied, and **Restricted due to: none**. This verifies the periodic work is registered and rescheduling correctly on the actual Retroid. The connected transport was Wi-Fi. No jobs were forced and no UI was manipulated for these checks.

Remaining real-world conditions to observe: a later automatic check while the app is backgrounded, a changed in-game save appearing as a new dashboard snapshot, survival across normal device reboot, and normal Wi-Fi disconnect/reconnect. These do not require changing emulator or save-state settings. Android may defer periodic jobs; the application does not promise exact 15-minute timing. Do not use Android's Force stop if background syncing is desired; relaunch Courier to resume after an intentional force-stop.
