# Cold Tracking owner preservation

The approved Redmi scope `5f1b7278` stopped before MainActivity because retained
JS and native Tracking contexts were present. Presence does not establish an
owner mismatch, corruption, or permission to delete either context. The original
client remains installed and stopped; this source change has not reached Redmi.

Source investigation found that cold authentication restoration could delete a
different retained owner's native notification queue and context, then delete
the JS background context. That behavior is unsafe when SDK restoration changes
or cannot prove owner continuity without an explicit account-reset action.

The smallest fix rejects a different JS owner before calling native restoration,
accepts only PRESERVED/EMPTY native outcomes, and removes the restoration-time
SecureStore deletion. Native restoration still suspends intake first, but now
returns BLOCKED for every different retained owner without clearing its context,
encrypted queue, or legacy records. Same-owner restoration and empty first login
remain supported. Explicit sign-out/reset retains its existing cleanup behavior.
Blocked restoration prevents later Tracking configuration and owner/database
binding through the existing generation and authentication guards.

This must be qualified and shipped as one combined JS/native client. Rejecting
an older native CLEARED result cannot undo deletion that older native code has
already performed; JS-only publication is insufficient. The existing admission
gates and consumed device controllers remain unchanged.

Verification retained under `E:/Masarifi-local-readiness-2026-10-12/`:

- `tracking-cold-owner-red.log`: two new JS regression assertions failed before
  the fix because restoration incorrectly resolved.
- `tracking-cold-owner-native-red-online.log` and
  `tracking-cold-owner-preservation/native-red.xml`: the native regression failed
  before the fix, expecting BLOCKED but receiving CLEARED.
- `tracking-cold-owner-green.log`: 43 tests in two suites passed, including
  authentication restoration and explicit sign-out paths.
- `tracking-cold-owner-typecheck.log`: full mobile type checking passed.
- `tracking-cold-owner-lint.log`: changed TS files passed with zero errors and one
  pre-existing require-import warning.
- `tracking-cold-owner-native-green-bounded.log` and
  `tracking-cold-owner-preservation/native-green-results/`: full native suite
  passed, 17 tests across three suites, zero failures/errors/skips.

Initial native attempts hit local JVM capacity or missing cached dependencies.
These logs remain preserved and are not counted as test passes. A local external
Gradle init script bounded test memory and concurrency; it changed no production
source or test assertions. The final native run completed successfully offline.

Full exact-commit CI, signed-artifact qualification and new explicit device
approval are still required before installation or launch. This is not full
application acceptance and grants no financial activation or deployment authority.
