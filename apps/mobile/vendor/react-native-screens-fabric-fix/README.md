# Android Fabric mounting-listener backport

This is a pinned, four-file backport for **react-native-screens 4.23.0**.
It does not change dependency versions, Java/Kotlin interfaces, navigation,
authentication, financial operations, or Voice behavior.

Upstream: [Software Mansion PR #4413](https://github.com/software-mansion/react-native-screens/pull/4413),
reviewed revision `204d36b45f2a718c6f86e00cfc70765cbde06565`.
Upstream `cpp/legacy/RNSScreenRemovalListener.*` maps to this version's `cpp/`.
The MIT license is included. `pristine/` freezes the original four files for
regression tests; `patched/` contains the reviewed replacement sources.

The upstream change replaces the racy per-proxy shared-pointer initialization
with a thread-safe process listener. A mutex protects callback replacement,
the callback retains its JNI receiver by value, and ownership tokens prevent
an old proxy's teardown from clearing a newer callback. Our additional guard,
under `installMutex_`, rejects setup after invalidation so a queued resume
cannot reinstall a null receiver or replace a newer owner's callback.

## Applying to Android builds

Ordinary and DEV Android builds share the pinned repair. From `apps/mobile`:

```text
npm run prepare:android
npm run check:android-native-fixes
node --test scripts/screens-fabric-fix.test.mjs
```

The command validates the version and all four original/replacement hashes
before writing (normalizing only CRLF/LF). Unknown edits fail without changing any file. Reapplication
is safe. Postinstall applies both native repairs. Android prebuild repeats the
preparation when installation scripts were skipped, and the generated Gradle
configuration refuses a build with missing or unrecognized patches. The older
single-patch command remains a DEV-only manual entry point. No app data is read
or removed. A native build must compile all affected objects together.
JavaScript reload alone cannot activate this change.

## Native lifecycle regression

`scripts/fixtures/screens-fabric` compiles the actual two implementation files
against small JNI/renderer boundary fixtures. Its CMake target accepts
`SCREENS_ROOT` pointing to `pristine/`, `patched/`, or the installed package.
Use the Android NDK toolchain, `ANDROID_ABI=arm64-v8a`, `ANDROID_PLATFORM=android-28`,
and `ANDROID_STL=c++_static` to build a standalone fixture executable. It has no
app/database/network access. Run that fixture independently of the app.

The pristine implementation fails on a callback after invalidation. The
unmodified upstream backport also fails invalidate-before-setup. The hardened
backport checks removal filtering and unchanged transactions, invalidation,
late setup after invalidation, stale-owner teardown/late setup, 200 concurrent
double installs, and 200 setup/invalidate races. Separately compile `rnscreens`
against the real installed React Native/JNI headers; boundary fixtures do not
establish ABI or device UI correctness.

The app uses a single ReactHost. General simultaneous multi-host operation is
not established: the upstream callback is process-wide and coordinator
registration remains per proxy. Do not claim multi-host isolation from these
tests. Reload stability still requires an authorized updated DEV binary,
unchanged owner/session/draft checks, native exit attribution, and bounded
foreground reload/navigation observations with Voice ON Posting.

When removing the backport, restore the four dependency files from the pinned
package before rebuilding. Never clear app data or drafts as part of rollback.
