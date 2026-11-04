# Owner-scoped Tracking integration — 4 November 2026

Status: source integration qualified locally. Production installation enrollment, hosted qualification, APK/signing qualification and actual Redmi acceptance remain open. No APK, phone data, hosted service or signing configuration changed in this task.

## Resulting behavior

Verified SDK/profile bootstrap prepares an independent Tracking namespace and acknowledges it only after authoritative account admission. A durable JS intent precedes native prepare, followed by JS commit and exact native acknowledgment. Interrupted preparation/acknowledgment reuses its generation. A consent change overtaking preparation first revokes intake, preserves the consent, reconciles the exact disabled intent, then creates its successor. An unrelated owner/session/generation cannot substitute for that intent.

Source settings and notification destination use strict owner envelopes. Fresh sources are disabled; reading settings or opening the screen cannot enable capture. Approval requires activation boundaries; SMS uses the native observed timestamp and row ID. Consent/configuration changes rotate capabilities; unchanged configuration stays stable. Native SMS queries and scanning clamp old cursors to activation, including messages in the same millisecond.

Notifications, acknowledgment, SMS pages, follow-ups, headless work, push callbacks and verified Ledger confirmation use the admitted owner/generation and SDK session. Cold headless admission rechecks the authoritative profile. Normal financial account admission remains separate from retained foreign Tracking. Existing owner-keyed Tracking controls become available after acknowledgment; no interface redesign or Benchmark enablement was introduced.

Schema17 adds a separate SQLite queue. Only proven same-owner work is copied, retaining operation/session IDs; legacy SQL/plaintext bytes remain unchanged. An empty committed destination prevents old operations resurrecting after terminal processing or clear. Pending assessment reads the current queue. Local clear, shell release, cancellation and pinned cold logout recovery retain unrelated data. Off-only suspension during uncertain revocation grants no read admission. SDK-absent cleanup requires the exact durable approved logout record; generic capture/read access still requires its SDK session.

## Verification

- Final full Mobile suite: **608 suites / 4,806 tests passed**, runner exit0, after the last application-source change. Earlier failed runs and corrected fixtures remain recorded separately.
- Complete native module suite: **10 classes / 78 tests**, zero failures/errors/skips, Gradle exit0. Real preferences/AES execute with only the unavailable host AndroidKeyStore boundary supplied.
- Mobile TypeScript, ESLint and complete frontend-quality/Firebase/runtime/boundary checks: exit0. Whitespace verification passed.
- New real SQLite tests execute actual migration17, SQL statements and transactions using Node24 SQLite. They verify foreign/malformed legacy preservation, one-time same-owner copy, terminal nonresurrection, destination attribution, pending counts and local cleanup. This is not physical SQLCipher or Android filesystem proof.
- Real session-controller/state integration tests exercise native/storage/SDK boundaries, including profile-before-commit, interrupted prepare/commit, source isolation, concurrent approvals, changed identity during reads, consent/configuration races, cold headless admission, cancellation/recovery, scoped purge, push and accepted Ledger presentation. Reproduced defects were observed RED before their corrections.
- Private receipts, archived native XML, exact changed-source hashes and normalized Git blobs are retained under this plan's private evidence workspace. The qualified full run exited naturally; no test process or protected Metro was terminated.

## Remaining acceptance

Implement the explicit production installation consent API without DEV enrollment; qualify server-side generation/worker fences and pending receipt compatibility. Then complete the app/Voice001 acceptance ledger, isolated current restore/hosted rollout package, production signer transition/rollback qualification and exact APK Redmi tests. The current phone still contains the previously verified Staging APK; these automated results do not establish customer-production readiness.
