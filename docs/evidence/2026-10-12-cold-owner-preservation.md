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

Combined client source `eea4bca27462d94c347598fedd22f74191e1adc5` subsequently
passed exact-source CI `38254168481`: 481 mobile suites / 3,009 tests, 17 native
tests, type checking, lint, dependency-security checks and the signed universal
APK build. Artifact `41100c383f0cd52ab2170d435fcb487d8f42b50d45a1bd1e5b3bc339953c9932`
passed independent packaged qualification. The retained certificate, Staging
endpoint/public auth configuration, four ABIs and 92 native libraries were
verified; both 64-bit ABIs passed 16 KB alignment checks. Evidence is in
`E:/Masarifi-local-readiness-2026-10-12/client-eea4bca2/`.

Probe binding source `e8350c286f68de91dd98af6b6389204ec01c74a0` permits ordinary
read-only diagnostics for the historical exact APKs and the new candidate, but
admits only the new candidate to this diagnostic build's admission extension.
It does not change local classification or relax any launch gate. Reviewed
identity/build tests passed, followed by CI `38257879199` including all nine
disposable Android 15 encrypted phases (57 scenarios and 38 v2/v3 observations
per phase), and posting-boundary CI `38257879148`. Offline signed diagnostic
`0dd3203caa92fb4f65b3e6badb4c2632a33a71d06425fe2f798ee9a6cec89ed3` and exact-source
receipts are in `E:/Masarifi-staging-acceptance-2026-10-12/cold-owner-probe-qualification/`;
its independent qualification passed, with report SHA256
`735ae45bad23653df64210c11860502277010101640a5fb3ce2b90183bc65eca`.

The new installation-only preparation strictly binds the consumed `5f1b7278`
result and independent review, exact retained Voice facts, the new client, and
disabled-state/cleanup safeguards. Twenty-five offline tests pass normally and
with Python optimization. Independent review confirmed the cleanup test rejects
a deliberately renewed cleanup budget. No new scope approval, device command,
installation or launch has occurred. Fresh read-only Staging verification passed
with posting OFF, healthy candidate, zero restarts and unchanged history.

The prepared installation-only scope is
`9b9221813c3821802217a6d2a7d86aa0546fe746726611bf9e7ba84c6dc20330`, with 45 file
pins, one diagnostic/client installation each, two private observations and zero
launches. Its directory is
`E:/Masarifi-staging-acceptance-2026-10-12/cold-owner-client-upgrade-preparation/`.
Final immutable-packet review passed, report SHA256
`0786b652e1d09a7effd0b3e99c73bc72f32de162bce878acd17fb44796129f2f`.
New explicit device approval remains required. This is not full application
acceptance and grants no financial activation or deployment authority.
