# PIN verification: device reproduction and local correction

Status: implementation, local checks and one real owner unlock after the update passed. No report acceptance unit is closed by this record.

## Reproduction

- Device: Xiaomi 23076RN8DY, Android 15; `com.masarifi.mobile.dev`.
- Source baseline: `5aa1267dccac67a8b95249dbddbf398c25d1bb49`.
- Two actual user PIN submissions took **33,987.63 ms** and **33,559.03 ms** inside `verifyPin()`, before lock-state persistence or navigation. Both resolved successfully.
- A temporary observer recorded only duration and completion state. It was restored before source edits. PINs, credentials, tokens and OTPs were not recorded.
- Earlier synthetic JS load did not yield a usable timing and is excluded from this result.

## Correction

The local `masarifi-pin-crypto` Expo module runs Android's `PBKDF2WithHmacSHA256` on Expo's asynchronous native queue. The existing salt, stored iteration count, 32-byte output, credential format and constant-time verification remain unchanged. New PINs still use 120,000 iterations. No PIN reset or credential migration is required.

The native boundary validates the six ASCII digits, 16-byte hex salt and existing 10,000–500,000 iteration bounds. Android API 24/25 and platforms without the module retain the existing JavaScript algorithm; their performance is not improved by this change. Native execution failures propagate rather than silently repeating the expensive JS computation.

## Verification

- A regression test first failed because native-capable verification still executed the JS KDF.
- Jest: the original privacy-lock and SecurityJourney suites passed (28 tests); the new native-boundary suite passed (4 tests). Independent Node/OpenSSL output validates credential compatibility, wrong-PIN rejection, stored cost, unsupported-platform fallback and error propagation.
- `:masarifi-pin-crypto:testDebugUnitTest --tests com.masarifi.pincrypto.PinKeyDerivationTest`: **6 passed**, no failures/skips, across API 25, 26 and 35. Independent vectors and malformed/unbounded input checks use the production Kotlin implementation.
- `npx tsc --noEmit`, focused ESLint, Prettier and `git diff --check` passed.
- `:app:assembleDebug -PreactNativeArchitectures=arm64-v8a` passed using the existing toolchain. DEV updated with `adb install -r -t`; no app data was cleared or app uninstalled.
- The existing native preservation workflow now includes the PIN module's tests and artifacts. It has not run on these uncommitted changes; prior green CI does not cover this correction.

Updated APK: `Masarifi-Dev-PIN-Fix-20261025.apk`.

- SHA-256: `5aa443428e94789d870b3d9514459091a6c94071529bd00c61da5dbfbfd011bf`.
- Existing development certificate SHA-256: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
- Package/version: `com.masarifi.mobile.dev`, 0.0.1 / 1, arm64-v8a.
- Artifact source: baseline above plus local PIN-module changes; this is not an exact committed release candidate. DEV obtains JavaScript from local Metro.

## Remaining acceptance

1. Installed native module confirmed: the independent synthetic vector matched on the actual phone in **658.77 ms**. This does not measure the user's unlock.
2. The unchanged owner PIN was submitted after the update: verification resolved in **641.88 ms**, and the owner lock became `unlocked` with zero invalid attempts. The temporary timing observer was restored. This confirms verification and lock-state transition; subsequent navigation was not separately observed in this recheck.
3. Preserve separate report checks for persistent escalation, restart, owner changes and offline behavior. A fast unlock does not complete finding 4.9.

No server, production infrastructure, signing keys or billing configuration changed. Billing remains deferred and open.
