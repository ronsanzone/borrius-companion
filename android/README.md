# Borrius Courier

Native Android 8+ companion. The Retroid uses Android 14. The app reads one selected 128 KiB Pokémon Unbound cartridge save, keeps stable copied snapshots in private app storage, and uploads on Wi-Fi to an HTTPS device endpoint. It never opens the game save for writing, asks for broad storage permission, or touches emulator settings/save states.

## Build

Requires JDK 17, Android SDK platform/build tools 35, and Gradle 8.13. This workspace has a local SDK and Gradle under ignored `.tooling/` and Homebrew JDK 17. Run:

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
./.tooling/gradle-8.13/bin/gradle assembleDebug testDebugUnitTest lintDebug
```

Run `./sign-release.sh` to produce the non-debug, locally signed sideload APK at `dist/borrius-courier.apk`. Its private signing key and password are generated once under ignored `.tooling/signing/` with restrictive file permissions. Preserve this directory securely for compatible future app updates; never commit it. The debug APK is separately available at `app/build/outputs/apk/debug/app-debug.apk` for development only.

## Setup

1. Install the APK with ADB or Android's package installer.
2. On the dashboard create a one-time pairing code. Enter its HTTPS upload origin and code into Courier.
3. Choose the RetroArch save folder using Android's picker. Grant folder access, then select Unbound's `.srm`/`.sav` file (not a state).
4. Tap **Sync now**. Check `ready` on the device and a matching snapshot on the dashboard.

The app requests only a persisted **read** URI grant even if the platform file picker's generic wording mentions folder access. The manifest has internet/network-state permissions and library scheduling permissions only. Android owns the permission dialog and it must be completed on the device.

## Operation and limits

- Periodic WorkManager runs at approximately 15-minute intervals with an unmetered network and battery-not-low constraint. Runtime additionally requires validated Wi-Fi transport. Android may defer checks; no exact or continuous sync claim.
- Manual sync captures before checking Wi-Fi, so a captured save is safely queued offline. Periodic work is deferred offline; saves made between checks are not individually captured.
- A save must be exactly 128 KiB and identical across two reads 600 ms apart. Changed bytes generate a SHA-256 identity and atomic private queue entry (up to 128 pending snapshots). IDs and sequence numbers survive retries/restarts.
- Original save files are never modified. Internal snapshots are retired after a `ready` receipt; failed analysis is retained in private `failed/` storage and surfaced to the user/dashboard.
- Tokens use AES-GCM with an Android Keystore key; backup is disabled. Redirects and cleartext HTTP are prohibited. Device revocation pauses upload until re-pairing. Pairing resets old receipt references on pending copies.
- Checkpoints are observed when captured, not guaranteed to be the instant an in-game save was written. Save states, inferred rewinds, foreground session mode, and existing-template migration are intentionally omitted.

## Verification

JUnit tests cover file extensions, 128 KiB shape/stability, HTTPS origin restrictions, and SHA-256. Android lint checks manifest/runtime use. End-to-end validation additionally requires the real Android document picker, pairing service, upload and ready receipt, app restart, and revocation.

Build verification completed: debug and release assembled, four JUnit tests passed, lint passed with advisory warnings for intentional synchronous durability writes, English-only status strings, and pinned dependency versions. Signed release verification passed. Real-device end-to-end results are recorded by the coordinating task.
