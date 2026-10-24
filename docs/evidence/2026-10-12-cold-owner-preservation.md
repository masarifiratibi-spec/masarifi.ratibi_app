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


## 12 October 2026, 14:07 UTC — approved installation scope consumed without device operations

The user approved scope `9b922181` once. Its exclusive execution stopped at
`STAGING_PREFLIGHT` (`NONZERO_EXIT`), verdict INDETERMINATE. All device command,
installation and instrumentation counters are zero. No restoration was needed;
no new physical preservation or authentication finding is claimed. The scope
must never be rerun. Independent result review passed the failure accounting.

Read-only SSH investigation returned timeout. The computer's current public IPv4
is 188.48.81.79. The provider console showed exact host srv2006836, active UFW,
19 existing rules and kernel UFW BLOCK records for this source to
187.77.81.97 TCP/22. This confirms the changed-IP firewall obstacle. No security
rule was changed. Previous Staging verification remains historical.

Two fresh approval packets are prepared: firewall `a1bad713` under
`E:/Masarifi-staging-acceptance-2026-10-12/ssh-current-ip-188-recovery/`, and
installation-only `a6f5d1f6` under
`E:/Masarifi-staging-acceptance-2026-10-12/cold-owner-upgrade-after-ip-188-recovery/`.
The latter retains byte-identical qualified host tools, APKs and test evidence.
It may start only after separately approved SSH recovery AND fresh external
read-only posting-OFF Staging verification PASS; its controller rechecks Staging.
Both need independent final review and new explicit approval before operations.
The legacy Voice session remains untouched by this attempt. No launch, deployment,
financial action or Production change occurred. Full acceptance remains open.

Independent final packet reviews now PASS: firewall report SHA256
`f2a36c68c8fede4dd483e7d8f17bdc50c23417e26f6b61425c78a0b1e3984101`;
installation report SHA256
`64e6715d00c76a4e9039922334d14168e6c9b7178c3ff5b1a5eb0538799e4e44`.
External pre-consumption Staging PASS is an operator gate; the unchanged controller
performs its additional internal preflight after consuming approval. Both gates
are required. All new protected operations still await direct user approval.


## 12 October 2026, 14:22 UTC — approved preservation installation passed

After explicit approvals, firewall scope a1bad713 added exactly one TCP/22 rule
for 188.48.81.79/32. Strict pinned-key SSH succeeded; active UFW retained all 19
prior rules (20 total). Fresh external Staging verification passed before device
approval consumption, with posting OFF and historical/financial baseline unchanged.

Installation scope a6f5d1f6 executed once, 14:21:43–14:22:11 UTC, verdict
PASS_INSTALLATION_PRESERVATION_ONLY: 66 device commands, one diagnostic install,
one client install, two read-only private observations, no MainActivity launch.
Installed client SHA256 41100c383f0cd52ab2170d435fcb487d8f42b50d45a1bd1e5b3bc339953c9932;
diagnostic 0dd3203caa92fb4f65b3e6badb4c2632a33a71d06425fe2f798ee9a6cec89ed3.
Both captured Voice receipts match apart from the approved client identity:
fingerprint b1298fa6ddcd588ad44301292865fb4436868226442dd3f7f2a7ee965ce3bf4c,
116 frames, nine rows, eight terminal, one pending and one owned audio item.
The legacy pending work remains BLOCKED. No replay, cancellation or submission.

Original client and diagnostic enabled/stopped states were restored, exact
identities checked and processes verified quiet. This proves captured Voice
fingerprint/summary preservation and final package state, not whole-device,
authentication-cache or audio-byte equality. No private snapshot follows cleanup.
The new APKs remain installed; old archives and evidence remain preserved.

Post-installation v2 admission observed zero finance/Tracking/prunable rows,
current schema, no legacy cleanup and inactive sources/intake. It still reports
BLOCKED_EXTERNAL_ASSURANCES_REQUIRED and does not grant launch authority.
The next launch preparation must assess retained owner contexts under the new
combined JS/native fix, preserve v3 observations and all other gates, and pass
independent review before a new exact device approval. No launch/deployment or
financial approval remains unused. Post-installation read-only Staging also passed.


Independent result reviews passed: firewall report SHA256
69e808425be6e9c6e2c7d88ddf72290963d74a694d88aef7bdaaece3229d8598;
installation report SHA256
99ed9a914b48e6829529565a1b1afb34e86508752622c53665efbf45df6b794e.
Source review supports a narrowly bound first-launch host exception for known
ABSENT/PRESENT owner contexts only on exact client 41100c38. Fresh v3 facts remain
mandatory; raw BLOCKED classification, all other gates and explicit approval stay.

New host-only preparation reuses the installed diagnostic and performs zero
installations. Independent review found an inherited double cleanup-reserve bug;
a RED regression reproduced it, and ordinary stop/disable now stays within the
original primary deadline. Sixteen offline tests pass normally and optimized;
a deliberately restored double reserve fails outside the controller catch.
No Android/product/collector/parser code changed or device action followed the
completed installation. Evidence: cold-owner-first-launch-preparation on E:.
Final host and frozen packet qualification remain pending at this entry.


First-launch preparation is now independently qualified and frozen as
1ddb06a951d63d7b6fdc297c627ddca50a684543f3ec11b18b0f9a8fd52e1b27 (61 pins).
Source review: ffe372b84ea1e72292f8e9405e815a20ed24b462104a163a5d8725af89b06cf9;
host review: 6a785f5ad795a1a2592fffdf3b8754cf17938c91585fa4f794fc48fa12ef55c9;
final packet review: a254990da554d98c2214b869108681fceadaeb53f338e69c19fc3920a05f3de9.
Exact scope/limits: E:/Masarifi-staging-acceptance-2026-10-12/cold-owner-first-launch-preparation/REVIEW.md.
This allows no installation, at most two private observations, one 45-second
no-tap launch trial, one private PNG and original package-state restoration.
Fresh external Staging PASS must precede consumption, and the controller repeats
its own preflight. Start before 13 October 2026 12:00 Riyadh. Explicit new device
approval is still required. No first launch, financial activation or full client
acceptance is claimed; all completed installation and firewall approvals are consumed.
