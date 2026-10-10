# Restore existing Voice automatic saving on Staging

This continues the original recovery. No Home design, transaction-entry implementation,
core ledger implementation, Tracking code, app bundle or native identity is changed.
Current Redmi APK remains 91213b443d51b3b2264468e660f9bf78a87e74d9.

## Proven mismatch

Original Samsung automatic acceptance used contract 3, financial API admission,
Posting ON and the scoped financial worker. Current Staging uses the same retained
v3 implementation but API `MASARIFI_VOICE_ANALYSIS_ONLY=true`, Posting OFF, no active
financial epoch and a stopped financial worker on 976dd92. A successful analysis-only
result intentionally has no transaction IDs and therefore no financial refresh.

Redmi's fresh analysis verified one 1000-minor SAR coffee expense, valid category and
owned default Test account. The approved Manual expense remains the only owned
transaction: confirmed -5000, pending 0, ledger version 1. Its October 10 date places
its card under Yesterday on October 11; Today filtering is intentional.

## Candidate preparation, no live activation

- Add forward migration `20261010221534_staging_voice_single_expense_canary.sql`.
  It replaces five existing runtime wrappers only. Version 1 remains two 25-SAR
  EN/AR captures; version 2 admits one Arabic 10-SAR expense and closes Posting
  after that single commit. There is no top-level financial/control DML or activation.
- Preserve owner/session binding, immutable fresh capture membership, account/category
  validation, leases, owner/epoch locks, original transaction executor, ledger uniqueness,
  receipt replay, post-lock deadline and deferred commit-time fence.
- Validate the worker lease before interpreting a canary response. Real database tests
  exposed an inherited stale-response path that could close admission before its lease
  was checked; the new wrapper rejects that response with `AI_WORK_FENCE_INVALID`.
- Accepted extraction replay returns the existing batch receipt before interpreting
  duplicate decisions, including after closure; it cannot fail the session or close
  an accepted scope. Version-2 activation is limited to 300 seconds by SQL itself.
- Separate pure `redmi-controls.cjs` binds the approval to the identities, amount,
  financial hashes, pinned image/source, APK, migration and controls. Only activation
  timestamps and baseline observation time can refresh after the human replies.
  It does not acquire approval, execute SQL or change services.
- Original Samsung controls and all historical migrations remain immutable.

## Exact approval scope to request after verification

1. Apply only this forward migration to project `qcffvfbpzvpwcwxwjyro`, after a fresh
   unchanged financial preflight and verified encrypted backup. Verify Posting remains OFF.
2. Prepare one version-2 canary using the verified Redmi owner/session, Test account
   and the coffee category from the successful fresh analysis. No historical recording
   can become a member. One capture, one expense, 1000 SAR minor units, Arabic,
   maximum 300-second window; no second attempt or additional transaction authorized.
3. Pause the app through ADB. Stop only the existing Analysis container after its queue
   and in-flight work are empty. Recreate only API using its existing compose files plus
   `MASARIFI_VOICE_ANALYSIS_ONLY=false`; provider enabled stays true and image stays
   `ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:a4f6c1ad71621b645d09880e943b5c15d27a8d8a4bd038ef4913fd3aebf3d383`
   (source `ac7bc92ab2e6e6c2e50a969de6c69463688febae`).
4. Start a separately named scoped financial Voice worker using that same image,
   `dist/src/staging-voice-worker.js`, financial mode, the new epoch ID, batch/concurrency
   1, poll 500ms, lease 120s and the existing approved provider routes/budgets.
   Preserve the old stopped financial container as evidence. Assistant/general worker,
   Nginx, firewall, provider credentials and SMS/Notification posting remain unchanged.
5. Install an independent bounded rollback watchdog before activation. Activate only
   once the user is beside the phone, runtime health and current financial hashes pass,
   and the exact direct human approval is retained. The Voice-only policy becomes ON
   while SQL canary fences exclude every other owner/session/account/amount and old audio.
   Other users cannot start new Voice analysis during this brief API financial-mode window.
6. Control a fresh recording through ADB on `f66a40694eca` only. Cue the user to say
   `مصروف عشرة ريالات سعودية على القهوة`; wait for their confirmation before stopping.
   No Retry, Save or Confirm; no reuse of the earlier analysis-only recording.

## Verification and closure

Expect one fresh epoch session, provider extraction, immutable account resolution,
one committed Voice event, one confirmed 1000-minor SAR expense, one -1000 posting,
Test confirmed -6000/pending 0/ledger version 2 and unchanged historical/other-owner rows.
Verify the result through normal app polling; capture immediate Home balance and the
original approved Today card, Transactions and Reports. Verify a committed receipt read
returns the same transaction and no extra effect. Do not retry old audio or simulate a
second financial request. Database replay/concurrency/failure checks run only in disposable CI.

Confirmation is separately observed, not assumed: v3 retained code has no positive saved
message in VoiceBatchStatus; legacy local Voice notifications are not called by that hook.
The transaction-created outbox exists, but phone notification delivery and its consumer
remain unverified. The general worker stays stopped; starting it is outside this scope.
Voice acceptance remains OPEN if Home, persistence, refresh or confirmation is missing.

## Rollback

On completion, mismatch, extraction/runtime/health failure, changed financial baseline,
lost worker heartbeat or deadline: close this epoch using the existing capability
`private.close_staging_voice_epoch(epochId, reason)` and verify policy OFF; stop only the
new scope-labelled worker; restore API with its exact pre-test compose files (analysis-only
true, AI provider still true, same ac7 image); start the preserved Analysis container and
verify API ready and authenticated analysis service. Treat expected completed/closed
worker health as closure, not a reason to restart or replay it. If DB closure fails, stop
the scope worker immediately and report unconfirmed closure; SQL deadline continues to
fence financial admission/execution. An independent watchdog must survive the chat/client.

Rollback restores runtime behavior; it does not delete or reverse the approved financial
transaction, revert the financial database from backup, remove evidence or downgrade
other services. Leave the default-disabled forward migration installed; reverting its
definitions is unnecessary for OFF analysis behavior. Any schema reversal needs a separate
reviewed forward migration. Production and main are excluded.

## Subsequent normal-user rollout

Only after complete Redmi financial acceptance, prepare a separate approved operating
epoch. Existing operating mode already admits ordinary eligible authenticated owners,
resolves their own defaults and excludes historical sessions, without per-user/account
allowlists. Verify another independent identity and owner isolation, runtime replacement,
Arabic/English, confirmation and provider capacity. General rollout is not authorized
by the single-effect test. SMS/Notification automatic posting remains a separate release.

## Evidence

Evidence directory: `E:/Masarifi-redmi-acceptance-2026-10-10/regression`.
Original dirty Voice archive SHA256: e5836532dcd4534903052dd022e930cef5f49ba0edb36442cbcab9443a8e9071.
Refreshed encrypted backup: `staging-stream-protected-backup-20261010T221050Z.dpapi`,
SHA256 f3c74e85715fc5442c9ab6832e174f2fac5395e52627cee468a57c727eb151fd;
139 tables/546955 rows, fresh schema and configuration. Decryption/entries/schema verified.
Financial restore reproduced accounts 5, transactions 30, postings 30 and balances 5;
all row hashes match, zero balance/ledger mismatches, isolated local PG18 stopped.
This is not a full Supabase platform/storage restore claim.

RED real database CI: 38090577773 (d7736cb), missing v2 contract.
First GREEN attempt: 38090847664 (37a360b4), 44/46 pass; stale lease and invalid expiry
fixture diagnosed above. Corrected actual database CI: 38091280680 (0dbed67e), 46/46 PASS.
Final exact-commit cross-feature CI and independent review are recorded in the release
packet before requesting deployment approval. No real financial test has run in preparation.

Independent review added four database regressions. RED CI 38091764474 (c1f21ddf)
passed 46 and failed all four new checks: 301/600-second v2 activation and duplicate
extraction acceptance before execution/after closure. The candidate now limits SQL
activation to 300 seconds and returns an immutable accepted-batch receipt before
lease/decision processing; complete exact-commit re-verification is required.

Gitleaks classified public pinned revision/image digests named API_SOURCE/API_IMAGE
as generic credentials at historical 0dbed67e lines 8/9. Those values were verified
against runtime/image provenance. The constants were renamed, and only these two
exact historical fingerprints were recorded as false positives; scanning remains active.
