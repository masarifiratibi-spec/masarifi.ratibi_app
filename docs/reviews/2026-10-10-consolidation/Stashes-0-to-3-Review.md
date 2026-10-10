# Stashes 0–3 semantic recovery review

Candidate: `3bd0c5d3149259ad69fb6a5e86083a820052b7f4` (Tracking). Date: 2026-10-10.

**Result: no verified missing application functionality requires integration from these four stashes.** Preserve Tracking, current Savings, and current UI. Do not apply any stash or copy older whole files. One intentionally removed operational readiness capability needs an explicit monitoring decision; it is not a safe transplant.

The complete per-path ledger is `Stashes-0-to-3-Review.json`: 690 path occurrences, 486 distinct paths, each with origin, saved/current blob, functionality, current evidence, status and safe action. `Stashes-0-to-3-Review.inventory.json` retains the raw inventory/comparison. Status means semantic recovery disposition; SUPERSEDED evidence artifacts still remain in the approved backup and are not to be deleted.

| Stash | Exact object | Base | Tracked delta | Untracked third parent | Already included | Superseded | Needs decision | Integrate |
|---|---|---|---:|---:|---:|---:|---:|---:|
| 0 | cd236fc2f1150ff10b9fcc8f7d272fb78c938c55 | 4d1f0dd1373f87500c3a075823d74262683e0a52 | 0 | 379 | 0 | 379 | 0 | 0 |
| 1 | 920a79d6e625359e6adbbbd1ed4719dd2bd16384 | 3e685e0a19cfa6854c15728b47854ce74be7391e | 24 | 83 | 42 | 63 | 2 | 0 |
| 2 | 2f6aa0a68f14524ba14bac3001046b32b07ee5d7 | 3e685e0a19cfa6854c15728b47854ce74be7391e | 20 | 82 | 10 | 90 | 2 | 0 |
| 3 | e15936b964ac4a260aaf751f0d7fd57657fbf908 | 3e685e0a19cfa6854c15728b47854ce74be7391e | 20 | 82 | 10 | 90 | 2 | 0 |

All four second parents have zero staged delta relative to their first parent. No hidden staged-only source change was omitted. Stashes 2 and 3 have identical tracked snapshots; their third parents differ in six sync controller/test files. Those variants were compared semantically, not dismissed by age.

## Stash 0: archival device evidence and data captures

The third parent contains 259 PNGs, 118 XML captures, one `.db` and one `.phone` data capture. It contains no TS/TSX/JS/Kotlin source, package/config/test implementation or plugin code despite the stash label mentioning a local plugin.

PNG files include historical account, Home, onboarding, category, salary, obligations, tracking, Savings and settings screenshots, plus obligations concept images under `design/obligations-concepts*`. XML files are historical captured Android UI hierarchies, not AndroidManifest configuration. They do not implement UI functionality and cannot be substituted for current device acceptance evidence. Preserve them in the backup; do not restore old layouts or infer that present visuals must match every old screenshot.

`apps/mobile/device-masarifi.db` and `apps/mobile/RKStorage.phone` are local application-data captures, not migrations or seed fixtures. Their private contents were not extracted or printed. They must remain outside candidate source and must not be loaded into a database. Their absence from Tracking is not missing application code.

## Stashes 1–3: Phase06 offline sync

The three stashes represent successive versions of one Phase06 implementation. The latest stashed implementation is already represented in Tracking and later improvements. Important source/config/test decisions follow; the JSON lists every individual path, including documents and evidence.

| Paths / behavior | Disposition and Tracking evidence |
|---|---|
| `apps/api/src/sync/sync.codec.ts` | Stash1 matches Tracking. Signed-v2 HMAC cursor payload, type, owner/device/domain scope and signature are validated at lines32,55,75,93. Older unsigned stash2/3 cursors are superseded. |
| `sync.controller.ts`, mobile `contracts/sync-service.ts`, OpenAPI | Tracking keeps authenticated `private, no-store` routes and canonical `PATCH /api/v1/conflicts/:id` (`controller:144`). Older `/sync/conflicts` and POST `/resolve` variants must not be reintroduced. |
| `sync.dto.ts`, `sync.types.ts` | Tracking retains UUID device, exact fields, payload/schema/resource checks and dependency topological ordering, and adds registered Planning/Savings mutations. Bootstrap remains limited to implemented current-state account/category/transaction snapshots; blindly widening it to planning would break queries. |
| `sync.repository.ts`, `sync.service.ts` | Tracking retains repeatable-read bounded snapshots/deltas, signed continuations, issued-cursor fencing, acceptance-time auth age, ordered idempotent receipts, atomic conflict completion, and current account/card-term projections. Stash1 `sync.service.ts` matches exactly. |
| `sync.handlers.ts`, `sync.module.ts` | Tracking keeps authoritative ReferenceService/LedgerService dispatch and adds PlanningService. Savings goal creation and movement reversal are explicit at handler lines98/110. Older whole files would remove Savings dispatch and module dependencies. |
| `sync.worker.ts`, `worker.module.ts`, `worker.ts` | Tracking retains fenced completion, original accepted auth age (`sync.worker:118`), capped retries and atomic conflict receipt (`:143`). It adds permanent planning-version rejection. Worker ownership is centralized under OperationsWorker/JobRegistry (`job-registry:42–45,111`), so old direct start/stop wiring must not create a second loop. |
| `platform/config/environment.schema.ts`, `.types.ts`, `.env.example` | All ten sync variables, bounds/defaults and max-delay>=base validation are retained. Configuration files also contain later feature controls; no old whole-file restoration. |
| `platform/http/http-validation.ts`, `main.ts` | Larger bounded JSON parsing for sync mutation/conflict routes is retained, with newer raw-import, report webhook and streaming support. |
| `safe-exception.filter.ts`, `platform-metrics.ts`, `reference.module.ts` | Stable safe sync HTTP errors, bounded/redacted metrics and reference exports are retained. |
| `.github/workflows/backend-foundation.yml`, `package.json`, `jest.config.ts`, workflow tests | Sync logic/integration/security/recovery/load commands and mobile/image dependency gates remain. Tracking retains checkout-scoped Jest roots and adds a performance project. Older pin/dependency/package snapshots would regress later security and build work. |
| `apps/mobile/src/storage/database.ts`, `.test.ts` | Schema10 sync tables/mappings/resource versions and exact legacy minor-unit conversion/quarantine remain (`database:320–381`). Tracking advances to schema15 and currency repairs (`:865–924`) with owner SQLCipher lifecycle. Reverting to old schema10 would drop later tracking/security behavior. |
| `core-finance-sync-adapter.ts` | Tracking retains transactional versioned apply/mappings/pending-edit conflicts and adds final-page bootstrap cursor (`:94`), unresolved conflict protection (`:197`), favorites (`:231,630`), hydrated tombstone payloads (`:310`), accurate account/card terms and signed opening adjustments. Older adapters would lose current financial/UI correctness. |
| `sync-repository.ts` | Durable queue/cursor/map/resource-state behavior remains; current `json_each(depends_on)` prerequisite filter (`:81–84`) prevents uploading dependants before durable parent application. |
| `supabase/migrations/20260831061405_phase06_sync_schema.sql` | Stash1 and Tracking blob are exactly identical: `a83c079cf721685ca7b9834a64d72101aea3557a`. Older stash2/3 signatures, grant lists and schemas are superseded. Never overwrite this historical migration or its current checksum. |
| Phase06 pgTAP/unit/contract/e2e/integration/performance/mobile tests | Assertions use current signatures/device/cursor/dependency/schema contracts. Tracking additionally verifies high-water cursor survival after retention, Planning/Savings dispatch, permanent version conflict, account/card projections, dependency gating, favorites, hydration/tombstones and restart isolation. No unique older regression was identified for recovery. |
| `.specify/feature.json`, Phase06 docs and `BACKEND_MASTER_PLAN.md` | Current Phase14 feature pointer and updated signed cursor/PATCH/current schema/implemented governance documents supersede old Phase06 pointer and unfinished historical checklists. Preserve old evidence only in backup. |

Stash2→stash1 changes were reviewed for real loss as well as additions: signed owner/device cursors replace unsigned ones; bootstrap becomes keyset-paged/repeatable-read; auth age is no longer fabricated as zero; resource/schema/dependency fields are enforced; worker conflict creation and receipt completion become atomic; mutation hash mismatch becomes an individual rejected receipt within an idempotent batch; mobile per-resource versions/conflict state/relationship mappings become durable. Tracking retains these stronger semantics.

Stash3→stash2 controller/test variants are superseded by current canonical contract. In particular, the older whole-batch 409 mismatch test does not describe current individual receipt semantics, and its removal is not missing functionality.

## One unresolved operational capability

`apps/api/src/platform/health/queue-health.indicator.ts` used to mark queue readiness unhealthy when any processing lease was more than five minutes expired or when over100 mutations were rejected within five minutes. The corresponding query-shape assertions lived in `apps/api/test/integration/health/queue-health.spec.ts`.

Tracking intentionally removed those row queries in `e55d9a13802d8dc3f2a463c8a859fbe681df7025` (`fix(staging): honor runtime database roles`). Current lines14–22 check queue tables/claim function existence, and the current test forbids direct selection from private planning job claims. Therefore the probe no longer establishes processing progress/stall/rejection health. This is a verified absent capability, not a verified missing safe patch: restoring direct cross-owner/private SELECT can break least-privilege runtime readiness, expose inappropriate data access or widen grants.

The two paths are NEEDS DECISION, repeated in stashes1–3 (six ledger rows, one decision). Recovery default: keep current role-compatible probe. If operational stall visibility is required, implement a new bounded role-safe helper or worker metric in an isolated later change, using additive grants/migration as necessary; do not replace current probe wholesale.

Meaningful tests for such a new change: exact runtime role with no broad SELECT grants; stalled claim becomes unhealthy/alerts; >100 bounded rejection threshold; healthy empty queue; API never receives mutation contents or cross-owner identifiers; missing helper fails closed; current planning/Savings readiness still works. These are proposed checks, not executed or passing evidence.

## Verification limits and preservation

Every Git read used `GIT_OPTIONAL_LOCKS=0`. No repository/ref/index/stash/service/database mutation, package install, source helper or test command was run. Only this report and JSON inventories were written under the authorized visualization folder. Blob equality was used for exact inclusion; differing source/config/test semantics and current paths were inspected, including both parent snapshots and third-parent content. Historical images/XML were classified as archival artifacts without claiming their pixels prove current visuals; local database contents were not inspected.

No source delta or test needs recovery from stashes0–3. The report does not claim existing sync/Tracking runtime tests or physical acceptance passed in this audit. Keep all original stashes and approved backups intact. Parent's dirty Voice/design recovery and candidate edits were not touched.
