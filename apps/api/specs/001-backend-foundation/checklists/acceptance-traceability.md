# SPEC-BE-001 Acceptance Traceability

**Evidence date**: 2026-08-27  
**Branch**: `codex/backend-spec-be-001`  
**Rule**: `VERIFIED` means the named local command passed on this branch.
`BLOCKED` remains release-blocking and is not waived by documentation.

## Spec Kit Analysis

The cross-artifact analysis found complete ownership and requirement coverage.
It corrected the historical ordering of `T172` and the obsolete positional k6
command in `T159`. No Constitution rule, requirement, acceptance criterion, or
release blocker was removed or waived.

## Functional Requirements

| ID | Single owner | Concrete evidence | Status |
|---|---|---|---|
| FR-001 | T009 | `package.json`; entrypoint tests; build | VERIFIED |
| FR-002 | T119 | one image; API/worker/migration container tests | VERIFIED |
| FR-003 | T119 | image UID `65532:65532`; runtime contract | VERIFIED |
| FR-004 | T029 | official `supabase/config.toml`; local-foundation E2E | VERIFIED |
| FR-005 | T038 | local/test Compose and production boundary | VERIFIED |
| FR-006 | T017 | environment schema and fail-fast bootstrap tests | VERIFIED |
| FR-007 | T118 | image layer/history/environment sentinel tests | VERIFIED locally; remote secret scan pending AC-010 |
| FR-008 | T035 | exact liveness contract | VERIFIED |
| FR-009 | T034 | bounded readiness and cache tests | VERIFIED |
| FR-010 | T122 | production ingress boundary | VERIFIED |
| FR-011 | T151 | fail-closed meta verifier contract | VERIFIED |
| FR-012 | T144 | request-ID middleware and HTTP contracts | VERIFIED |
| FR-013 | T146 | strict validation contracts | VERIFIED |
| FR-014 | T145 | safe error-envelope contracts | VERIFIED |
| FR-015 | T155 | generated OpenAPI drift contract | VERIFIED |
| FR-016 | T067 | immutable migration checksums | VERIFIED |
| FR-017 | T162 | migration-only ownership and scope gates | VERIFIED |
| FR-018 | T069 | pre-traffic migration advisory-lock tests | VERIFIED |
| FR-019 | T071 | schema/default-privilege migration and pgTAP | VERIFIED |
| FR-020 | T072 | outbox table/function/index structure pgTAP | VERIFIED |
| FR-021 | T074 | negative privilege matrix | VERIFIED |
| FR-022 | T104 | enqueue commit/rollback integration | VERIFIED |
| FR-023 | T105 | disjoint bounded claims and indexed EXPLAIN | VERIFIED |
| FR-024 | T097 | retry, outage, restart, and recovery tests | VERIFIED |
| FR-025 | T098 | lease expiry/reassignment/stale completion | VERIFIED |
| FR-026 | T100 | terminal exhaustion and alert tests | VERIFIED |
| FR-027 | T066 | hardened function owner/signature/search path pgTAP | VERIFIED |
| FR-028 | T073 | private bucket and deny-by-default pgTAP | VERIFIED |
| FR-029 | T056 | graceful shutdown and clean E2E process exit | VERIFIED |
| FR-030 | T128 | pinned blocking CI workflow | VERIFIED configuration; remote CI evidence pending AC-010 |
| FR-031 | T130, T169 | dependency audit and local production-image scan are clean | VERIFIED: Docker Scout reports 0 Critical/High |
| FR-032 | T123 | minimal production image contract | VERIFIED |
| FR-033 | T047 | structured logger, telemetry, and redaction tests | VERIFIED |
| FR-034 | T109 | bounded platform/outbox metrics | VERIFIED |
| FR-035 | T111 | one-million-row indexed EXPLAIN and k6 claim budgets | VERIFIED |
| FR-036 | T157 | HTTP k6 P95/P99/payload/runtime artifacts | VERIFIED |
| FR-037 | T163 | forbidden-technology scope gate | VERIFIED |
| FR-038 | T162 | owned-resource allowlist | VERIFIED |
| FR-039 | T163 | Mobile/Admin untouched scope gate | VERIFIED |
| FR-040 | T170 | migration, recovery, replay, and backup tests | VERIFIED locally |
| FR-041 | T177, T181 | local pre-PR review passed; final Definition of Done review | BLOCKED only on T180 remote evidence and T181 final review |

## Acceptance Criteria

| ID | Single owner | Concrete evidence | Status |
|---|---|---|---|
| AC-001 | T042 | official Supabase plus API/worker local E2E | VERIFIED |
| AC-002 | T137 | same-digest image; non-root/read-only/secret contracts | VERIFIED locally |
| AC-003 | T056 | health, dependency failure, drain, and clean-exit tests | VERIFIED |
| AC-004 | T159 | HTTP/security/OpenAPI contracts | VERIFIED |
| AC-005 | T077 | reset, migrations, inventory, checksums, lock, pgTAP | VERIFIED |
| AC-006 | T078 | 65-test pgTAP structure/privilege/function matrix | VERIFIED |
| AC-007 | T115 | outbox logic and live recovery suites | VERIFIED |
| AC-008 | T115 | one-million-row EXPLAIN plus load/stress artifacts | VERIFIED |
| AC-009 | T159 | 26,835-request HTTP k6 and runtime artifact | VERIFIED |
| AC-010 | T137, T180 | CI SBOM, image scan, signing, provenance | Local image scan VERIFIED at 0 Critical/High; remote CI/SBOM/signature/provenance pending T180 |
| AC-011 | T164 | logs, bounded metrics, alerts, and runbooks | VERIFIED |
| AC-012 | T170 | migration/rollback/replay/backup reconciliation | VERIFIED locally |
| AC-013 | T163 | ownership and client-untouched security suites | VERIFIED |
| AC-014 | T161, T180 | OWASP traceability | Local OWASP and image-security gates VERIFIED; remote release evidence pending T180 |

## Success Criteria

| ID | Single owner | Concrete evidence | Status |
|---|---|---|---|
| SC-001 | T042 | documented official-stack startup and E2E | VERIFIED locally |
| SC-002 | T177 | deterministic local and CI evidence | BLOCKED: remote CI release evidence pending |
| SC-003 | T159 | dependency-failure liveness/readiness tests | VERIFIED |
| SC-004 | T115 | 0 lost rows and idempotent duplicate behavior | VERIFIED |
| SC-005 | T137 | image layer/environment/history sentinel inspection | VERIFIED locally |
| SC-006 | T167 | outbox and HTTP P95/P99 artifacts | VERIFIED |
| SC-007 | T160 | this table and ownership register | VERIFIED |

## Fresh Local Verification

| Command or artifact | Result |
|---|---|
| `npm run verify` | PASS: typecheck, lint, k6 parse, unit, contract, integration, E2E, build, checksums, audit, workflow pins |
| `npm run test:db` | PASS: 3 files, 65 pgTAP tests |
| live `npm run test:migration` | PASS: 4 suites, 4 tests including backup/restore and lock/checksum cases |
| live `npm run test:database:integration` | PASS: 4 suites, 4 tests |
| live `npm run test:foundation:e2e` | PASS: 1 suite, 3 tests; no open handle |
| `npm run test:outbox` | PASS: 13 logic suites/34 tests plus one-million-row EXPLAIN/load |
| outbox normal artifact | PASS: 206,036 published; 0 failures; claim P50/P95/P99 8/11/14 ms; publication 14/17/19 ms |
| outbox stress artifact | PASS: 204,620 published; 0 failures; claim P50/P95/P99 16/30/52 ms; publication 25/41/68 ms; 75 VUs |
| `outbox-explain.txt` | PASS: `outbox_events_claim_order_idx`; execution 2.558 ms |
| platform HTTP artifact | PASS: 26,835 requests; 0 failures; meta P95/P99 1.947/2.806 ms; body checks 100% |
| platform runtime artifact | PASS: cold start 290.489 ms; CPU user/system 4891/2203 ms; RSS peak 548,601,856 bytes; event-loop P95 32.899 ms |
| pool evidence | PASS: bounded 1..50 configuration, default 10, connection/timeout/close integration tests |
| `npm run test:container` | PASS: 3 suites, 6 tests |
| `npm run test:release-image` | PASS: multi-stage release image plus 3 suites/6 tests |
| image inspection | PASS: digest `sha256:bed027c597a7d84e51a172f64fb1aa627a8f9092b3518c5f78b1fd07869ebc0d`; UID `65532:65532`; only `3000/tcp` |
| `npm audit --audit-level=high` | PASS: 0 vulnerabilities |
| Docker Scout/Trivy-equivalent local image scan | PASS: 260 packages scanned; 0 Critical, 0 High, 0 Medium, 0 Low; production image 72 MB |
| release SBOM/signature/provenance | BLOCKED: generated only by the protected `backend-v*` GitHub tag workflow |

## Release Decision

Implementation and all locally executable functional, database, performance,
recovery, container, and security checks pass. The branch may be committed and
published in Draft PRs to collect remote evidence.
SPEC-BE-001 remains **incomplete** and unmergeable until remote CI,
SBOM/signature/provenance, AC-010, AC-014, and the final review pass.
