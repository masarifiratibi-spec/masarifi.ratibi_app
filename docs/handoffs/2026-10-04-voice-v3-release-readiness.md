# Voice v3 release-readiness verification

This continuation uses `codex/voice-auto-batches` from accepted baseline `bb9235f094b7b795f6debf25fe5f42ceca46ae16`. The product contract is automatic independent expense/income commits with silent terminal skips, without v3 Review/Save/Confirm/resolution. No final branch integration or Production action is authorized. Stop before real-provider or financial Staging canaries; preserve the disabled automatic policy.

## Verification sequence

1. Inspect the unchanged 1,200-token/basic Vertex output contract and ten-event capacity without generation or budget changes. Retain only a demonstrated bound, with whole-envelope rejection rather than prefix posting.
2. Trace native recorder and durable handoff dependencies; reproduce any lifecycle defect before fixing it. Verify readiness is independent of recovery, provider processing and cleanup. Physical Samsung timings require a connected device.
3. Verify full migrations, atomic financial execution, owner/grant isolation, cancellation, privacy and accounting in an isolated real Supabase/PostgreSQL 17 CI environment. Hosted Staging inspection is read-only.
4. Independently review the complete candidate, resolve blocking findings with regression tests, create a clean commit, and run the complete CI workflow on that exact SHA. CI may publish its scanned candidate image; no application deployment is performed.
5. Record candidate SHA, immutable image evidence, CI results, capacity decision, lag evidence and a bounded recommended first acceptance test. Retain the branch/worktree without integration.

## Initial evidence

October 4 read-only Staging inspection: PostgreSQL 17.6, pgmq 1.5.1 and pgcrypto 1.3; latest migration `20261003083000_staging_voice_owner_quota`. Neither `private.voice_automatic_policy` nor `private.voice_batches` exists on hosted Staging. Security advisor returned no findings. No hosted writes were performed.

`adb devices -l` returned no connected devices. Docker's local Linux engine is unavailable. Full real Supabase verification will use the repository's isolated CI database job rather than pretend the prior loopback PostgreSQL 18 scaffolding was hosted/PostgreSQL 17 acceptance.

## Five versus ten decision

Ruling: retain the enforced five-event candidate bound and do not certify ten under the unchanged output contract — exact-model capacity and sufficient bilingual headroom have not been demonstrated. This preserves financial safety but means the desired ten-event product target is **not delivered by this candidate**. Five is an enforced, fail-closed software limit, not a claimed real-provider capacity proof.

Offline analysis used the official Google Gemma3 SentencePiece model, verified SHA-256 `1299c11d7cf632ef3b4e11937501358ada021bbdf7c47638d13c0ee982f2e79c`, with compact synthetic current-schema JSON. It made no generation or token-count API requests. Google's current SDK loader has no exact `gemini-3.5-flash-lite` mapping, so these measurements are **proxy evidence only** and cannot certify its tokenization. [Official loader/mapping](https://github.com/googleapis/python-genai/blob/main/google/genai/_local_tokenizer_loader.py).

| Fixture | Five proxy tokens | Ten proxy tokens | Unchanged cap |
| --- | --- | --- | --- |
| English, merchant omitted | 351 | 691 | 1,200 |
| English, merchant present | 386 | 761 | 1,200 |
| Arabic, merchant present | 416 | 821 | 1,200 |
| Forty-character Arabic merchant, maximal amount/aliases, literal Unicode | 601 | 1,191 | 1,200 |
| Same Arabic fixture serialized with JSON Unicode escapes | 1,641 | 3,271 | 1,200 |

These results show why typical-ten examples alone are insufficient: serialization and permitted fields can consume the cap, even at five. Provider refusal, truncation, incomplete interpretation and envelope overflow remain **whole-batch failure**, with no accepted decision set or prefix financial posting. Tests explicitly reject a ten-item envelope; a fully parsed prefix marked `length` is also rejected by the gateway. The automatic gate must remain disabled until the real extraction acceptance passes.

To deliver ten without raising budgets, first prove a bounded compact provider representation and exact-model bilingual outputs with sufficient headroom, preserving required omission/ambiguity/independence evidence and canonical normalization. If that fails, the alternative requires an explicitly approved output/reservation budget change; no additional extraction calls or limit increase is authorized here. Once proven, change the complete set of bounds together: prompt/envelope, SQL ordinals/decision count/finalization iteration limits, API contract and Mobile receipt count bounds, plus bilingual fixtures and full partial-success/exactly-once tests. Never simply change the prompt or slice the first ten events.

## Recorder evidence and remaining physical gate

The prior v3 implementation removes the verified software dependencies on startup-recovery completion and previous-session cleanup/provider processing. Focused tests hold prior batch processing and legacy recovery unresolved and still start the next recorder after durable handoff. Handoff ownership tests prevent an old capture's cleanup from deleting its journal-owned audio. Native recorder tests cover allocation, completion, timeout release and repeated Stop identity. The focused selections passed the runtime suite (36 tests), batch service suite (10 tests), native recorder suite (12 tests) and actual SQLite pruning test (one test). A reproduced background-during-handoff failure originally left v3 in legacy `recovering`; the fix excludes handoff from that branch and defers transport while backgrounded. Ready no longer depends on legacy recovery. Foreground transport resumes via the durable batch journal.

No arbitrary delay was added. Timing-only samples distinguish native preparation/start/stop/completion/release, file validation, SQLite handoff and publishing Ready. With no connected Samsung, the physical blocking boundary and the 250 ms post-handoff target remain **unverified**. The candidate fixes/guards the known software dependency; it does not claim that this was the measured first Samsung boundary.

Independent review found and corrected stale pgTAP job inventory counts: v3's independent `voice.finalize` job increases the accepted inventory from 52 to 53. No existing job was removed or provider work enabled.

Exact-SHA CI and final review evidence will be returned with the candidate and retained separately so recording a run result does not change the SHA it verifies.

## Independent review repairs

The whole-candidate independent review identified six issues, resolved in one repair pass with regression evidence:

- Backgrounding during durable handoff no longer sends v3 into legacy recovery or blocks another capture.
- Infrastructure retry budgets are per occurrence. Healthy siblings execute in the same finalization pass even when an earlier occurrence persistently fails; exhausted failures preserve committed receipts and an honest failed batch result.
- Existing media purge capabilities cover v3 unacknowledged uploads at their upload expiry, preserving leases and tombstones.
- Recovery discovery is bounded to recent sessions plus unresolved work and advances a cursor. Terminal history is not downloaded every polling interval; local pruning preserves pending captures and media cleanup ownership.
- New OpenAPI operations inherit the defined bearer authentication scheme; undefined `ClerkBearer` references were removed and contract-tested.
- pgTAP job inventory includes the additional finalization job.

A fresh full-migration disposable PostgreSQL 18 database passed five Voice integration suites / 54 tests, including all-item atomicity, persistent per-item infrastructure failure, late reference invalidation, cancellation, receipts and v2 compatibility. This local result supplements, rather than replaces, the official Supabase/PostgreSQL 17 exact-SHA CI gate.

The first official Supabase run additionally exposed a migration-role error: `RESET ROLE` occurred before replacing the existing upload/input/media functions. A non-superuser migration connection reproduced the exact `permission denied for schema private` failure. Keeping the established migration role until the end applied the complete migration successfully under that restricted connection; no extra schema grants or customer/Worker privileges were added. The updated checksum and full exact-SHA CI must verify the repaired candidate.

The next run successfully applied/reset/linted the migration set, then the existing foundation security test detected the new migration's missing temporary-role revocation. The final migration follows the accepted sequence: keep the migration role for every capability update, reset it, and revoke the self-granted membership. The original pgTAP security assertion remains intact.

With those repairs, official pgTAP passed. Compiled migration application then exposed its separate stale private-object inventory. Its explicit table/function allowlist now includes only the five intended v3 tables and intended capability/wrapper names. The assertion still rejects unexpected objects, and the full idempotent migration inventory test passed locally against the migrated database.

An additional retry/cancellation race regression failed because retry metadata did not acquire the owner cancellation lock. Item retry now locks owner, session and batch in the established order and shares the policy gate lock. The restricted Worker regression proves cancellation can hold that boundary without consuming an attempt; five fresh PostgreSQL Voice suites / 55 tests passed after the repair. No arbitrary recorder delay or provider change was introduced.

The full integration-to-end-to-end sequence also caught two fault-injection helper functions left behind by tests. Their cleanup now removes both triggers and helper functions. The strict production inventory is unchanged; a reproduced dirty-inventory failure passes after rerunning the full Voice integration selection followed by migration application.

## Performance fixture cleanup

The full CI run exposed an inherited AI load-fixture race: the plan test inserts and rolls back a million usage rows, then immediately times quota admission before autovacuum necessarily reclaims them. Quota p95 reached 377 ms against the unchanged 300 ms gate, with all 2,677 functional checks passing. A local post-rollback query traversed 50,806 buffers for ten live usage rows and took 537 ms. The runner now explicitly vacuums/analyzes its three discarded plan-fixture tables before measuring admission. The million-row plan/index checks, workload, budgets, locks, accounting and latency/error thresholds remain unchanged. Official exact-SHA CI must verify this harness repair; the local full fixture rerun encountered disk exhaustion and is not acceptance evidence.

## Inherited dependency security findings

The backend high-severity audit gate passes. An additional Mobile `npm audit --omit=dev` inspection reported 43 high and 22 moderate affected dependency nodes, not 65 distinct advisories. The Mobile dependency manifest and lockfile are identical to the accepted baseline. High root advisories include `braces` stack exhaustion and `node-forge` signature verification; their inspected paths run through the Metro/Jest toolchain and Expo CLI code-signing certificates. This is not evidence that all affected code ships or is reachable in the native Voice flow; runtime/bundle reachability still needs an explicit security disposition before public release. [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [node-forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv).

Neither advisory lists a patched version at inspection time. Do not claim a clean Mobile dependency audit or force incompatible Expo/React Native/Jest upgrades merely to suppress transitive audit labels. This continuation preserves the accepted native/provider stack and records the inherited security gate separately from Voice financial integrity and the scanned backend candidate.

## Recommended next acceptance (not performed)

After the exact-SHA infrastructure gates pass, first use a controlled non-posting provider probe to settle capacity. Keep the automatic policy disabled. A shadow harness must invoke the accepted Gemini 3.5 Flash-Lite / `google-vertex/global` transport and basic structured schema with the same 60-second M4A, 1,200-token cap, ZDR, reservation and accounting controls. It must not accept a batch or call the ledger finalizer. Since the candidate enforces five, the ten-event probe needs an explicit shadow-only prompt/envelope variant; the normal production bound must not be changed merely to conduct the probe.

Use known fictional accounts/taxonomy and a natural ten-event English story, then its Arabic counterpart, within a checked quota/budget reservation. Assert all ten independent expected events, complete `stop` finish, no truncation/refusal/overflow, sufficient token headroom, correct amounts/context/date/defaults, and an authoritative provider cost receipt. Include bounded worst-case field/serialization cases before claiming ten supported. Any incomplete envelope rejects as a whole with zero financial writes. If capacity fails, report the demonstrated bound and propose a compact representation or an explicitly approved budget change.

Only after extraction acceptance should a separately controlled financial/device test enable execution for the test operation: the four-event story must add three normal cards and skip the unsupported repayment, with exact receipt/balance reconciliation. Samsung must then repeat recordings while earlier batches remain pending, exercise backgrounding/termination/offline cancellation, and measure native preparation separately from release/handoff-to-Ready. The 250 ms handoff target and ten-event product target remain release blockers until demonstrated. Do not touch Production or integrate this branch as part of either preparation step.
