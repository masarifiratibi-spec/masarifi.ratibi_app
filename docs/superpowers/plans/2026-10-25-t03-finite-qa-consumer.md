# T03 finite automatic QA consumer implementation plan

**Goal:** Prepare a reviewed, disabled-by-default finite consumer/package that automatically applies only the six ordered QA note phases while the general worker remains off.

**Execution:** Sole native Sol High writer, as explicitly selected. No helpers, commits, branches, worktrees or hosted actions. Root owns private hosted binding/connection inspection. Existing mobile15 and baseline21 remain byte-identical. The architect's supplied design is the approved specification; this plan records implementation choices rather than reopening that decision.

**Architecture:** Separate data-only worker configuration and migration/bootstrap credentials. Ship the actual compiled runtime/transitive dependency closure, not an application bootstrap. A finite public controller observes authoritative state, persists exact operation bindings before claims, invokes only the independently chosen fixed-snapshot guard/shared executor, and advances only on applied/correlated authoritative evidence. The old bootstrap role-transfer path is replaced outright: a dedicated global RR READ ONLY reader exports its verified snapshot to a dedicated ordinary RR READ WRITE worker importer, whose first command after BEGIN is SET TRANSACTION SNAPSHOT. The exporter stays alive through acknowledged claim COMMIT. No permission fallback or grant is permitted.

**Spec:** Root architecture brief forwarded after corrected PG17 qualification on2026-10-25; latest human authorization covers understood, independently reviewed narrow reversible staging fixes. Local preparation only until independent artifact review.

## Files and interfaces

- `scripts/qa/t03-session-consumer/config.cjs`: `parseEnvData`, `preparePrivateConfiguration`; immutable worker-only config and a separate bootstrap connection object, strict TLS/CA/config pins, generic error codes.
- `scripts/qa/t03-session-consumer/host_reader.py`: metadata checks and explicitly piped FD3 secret frame; no shell sourcing, secret arguments/environment/normal logs.
- `scripts/qa/t03-session-consumer/session.cjs`: `validateSession`, `runSession`; six ordered phases, at most6 queued claims, one inflight, bounded poll/deadline, private binding journal, direct API cleanup reconciliation.
- `scripts/qa/t03-session-consumer/adapter.cjs`: actual runtime/DB readers and selected guarded claim path; read-only preflight before any mutable claim, sanitized granular stages.
- `scripts/qa/t03-session-consumer/package.cjs`: compile explicit runtime/config entry closure using installed TypeScript; collect/pin real package dependencies; generate a fresh local artifact and content manifest. No installs.
- `scripts/qa/t03-session-consumer/session.template.json`, `README.md`, public-seam tests, fixture regression: safely incomplete/disabled manifest, concrete reviewed operational commands and verification.
- Existing exact runner/shared executor remain behavior-preserving; any guard extraction/change retains real PG17 regression and receives focused checks.

## Review focus

1. Migration URL accidentally reaches normal configuration, arguments, Docker environment/metadata or error output: parser/reader tests at private input/output boundaries.
2. URI TLS parsing overwrites CA/verification options: preserve verify-full and pin CA before any connection; reject weak/missing/mismatched inputs.
3. Later cleanup occurs as direct PATCH without queue row: require a new correlated completed API receipt plus exact authoritative version/note and unchanged financial/posting state.
4. Unknown/replayed/out-of-order/financially changed operations appear: stop without claiming; fixed global snapshot still excludes independently later insertions.
5. Claim commits then response/handler/state verification fails, or a retry/conflict/reject/lease loss occurs: stop uncertain, never rebind/retry or claim another operation.

## Tasks

- [ ] **1. Configuration/secret boundary:** Write failing public parser/FD reader tests; implement data-only parsing, worker/bootstrap separation, metadata/hash/TLS/CA checks and generic diagnostics; run focused red→green. Never read hosted credentials in this task.
- [ ] **2. Real package closure:** Compile the existing `prepareClaimedMutationRuntime` and required config/idempotency entry modules without Nest/app bootstrap; pin compiled files, source files, dependency package versions/files and image/runtime expectations. Verify imports start no jobs and package tampering fails before connection. Existing image Node24.20.0 versus local24.16.0 remains a runtime compatibility gate until a reviewed probe verifies the closure.
- [ ] **3. Finite state controller:** Public controller tests cover automatic later valid submission, strict identities/ordered notes/base versions, private durable binding before claim, unrelated/replayed work, financial/posting invariants, direct cleanup receipt correlation, claim/deadline limits, stale auth, uncertain outcomes and graceful shutdown. Implement only enough for each vertical slice.
- [ ] **4. Chosen guard and actual adapter:** After the explicit architectural ruling, implement exactly that strategy; no silent privilege/role/lock fallback. Verify bootstrap RO target/visibility/provenance and ordinary worker independently, then use the shared guarded claim/executor. Run actual PG17 role/concurrency/session cases using the reviewed same-cluster lifecycle and strict owned shutdown.
- [ ] **5. Freeze/review package:** Run focused unit/PG17/compile/lint/format checks appropriate to executable changes. Apply Clean Code Guard/Test Guard, preserve red/failure history and exact executed manifests, regenerate safe evidence/disabled templates and report. Return concrete artifacts for independent Astra review before hosted installation/start.

## Operational invariants

Stages are original NULL→warm note for operation10de16e6-a966-41b4-a583-1716314b285b, ordinary restoration→NULL, fresh final-candidate warm note with offline restart/reconnect, ordinary restoration→NULL, cold-local note with reconnect, ordinary restoration→NULL. The fixed cap is6; direct PATCH cleanup may reduce actual queued claims. Later operation IDs may be discovered only under exact session bindings and persisted before claim. `processed-once` is insufficient; require applied receipt and authoritative unchanged finance/postings. Direct cleanup may use correlated API receipt/state. No manufactured cleanup, auth refresh, operation replacement, lease edits, queue purge, data reset/deletion, scheduler, outbox, general worker, production, billing or T04. General staging availability remains isolated outside this finite QA session and is not misreported as restored.
