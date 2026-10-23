# Admin Dashboard recovery verification

Branch: `codex/voice-promoted-operating-2026-10-13`. Workspace: `D:/Masarifi-integration-2026-10-10`.

Tasks2/3 are published to GitHub remote `ratibi` through `c7ccd6711d84bd47b3f46dd9e1633cef8b2060aa`. Task4 is implemented in `f669ce3a`, `6740b8fc` and `4e1729ea`; Task5 in `47a36df3`; Task6 code in `2f7887907e3de390e031c73903c82ab00d9054b8`. All six implementation tasks have passed their recorded local completion gates, with the baseline/external concerns below. No subsequent push, PR, merge or deployment was performed.

Task1 remained accepted. Tasks2/3 retain their recorded independent reviews. Tasks4–6 implementation, verification and review were performed by the main agent only, following the user's explicit prohibition on Astra and other agents. Their review is author self-review.

## Repaired findings

| Priority | Finding and resulting behavior |
| --- | --- |
| Important | Overview activity now comes from bounded native-session observations with collection coverage. Missing history remains unknown; UTC/reporting-zone boundaries and exports use a coherent observed scope. |
| Important | Governance mutations use durable principal-bound replay and safe provider outcome receipts. Ambiguous external outcomes remain unavailable/pending rather than claiming successful delivery or issuing a new effect. |
| Important | Operations filters apply before limits; maintenance order and cursor rank agree. Unsupported provider measurements remain unavailable. |
| Important | AI filters use recorded event attribution, preserve unknown platform and respect date/provider/model scope. Evaluated test corpora are immutable; prompt clones retain source provenance and fresh evaluations are required before publication. Parser actions use the parent revision. |
| Important | Customer APIs return masked identities and measured device/lifecycle data. Suspension is locally authoritative and queues worker-only provider revocation with original snapshots/cutoffs. Admin targets are protected, and unmeasured session history stays null. |
| Important | Support uses server filtering/counts, bounded messages and CAS mutations. Customer replies and staff notes stay separate. Clean attachment signing requires permission and ticket linkage. Mobile support consumes the actual owner contract and retains drafts on conflict. |
| Important | Express transport params with a null prototype no longer break the session bootstrap hash. A failed bootstrap displays an error and retry instead of endless loading. |
| Important | Live shell authority comes from the server session. Simulation tools require explicit fixture mode. Customer, support, access-request and import action controls use the granted permission set; access requests start without fixture customer/ticket IDs. |
| Important | Mobile navigation is a native modal dialog with initial focus, inert background, Tab wrapping, Escape/return focus and resize cleanup. Environment reflects configured deployment/known host independently of mocks and remains visible on narrow screens. |
| Minor | Removed the disconnected shell date filter, repaired controlled custom-date expansion, exposed supported page filters only, and marked cursor totals as lower bounds where appropriate. |
| Minor | Reconciled customer audit labels, localized touched controls, reduced unavailable-card height and added support form/card spacing without replacing brand fonts/colors. |

## Page → API → source capability matrix

All paths below are under `/api/v1`. Live navigation exposes completed destinations permitted to the session. Browser evidence is local candidate evidence with an explicit identity boundary.

| Page/capability | API and authoritative source | Scope/limitations |
| --- | --- | --- |
| Overview/activity/exports | `/admin/overview`, `/admin/overview/platform-analytics`, `/admin/overview/activity`, `/admin/exports`; ReportsService/Repository; `private.read_admin_report_measurements`, `read_admin_overview_activity_at`, mobile activity buckets/collection | Platform and7/30/90-day periods; collection coverage, stable observation and bounded export metadata. No invented historical DAU/MAU or billing. |
| Customer directory/detail | `/admin/users`, `/admin/users/:id`, devices/sessions; CustomerAdminService/Repository; `private.customer_admin` | Server filters/pages, customer-only masked projection. Provider list is bounded/active-only; historical counts and absent diagnostics are null. |
| Customer lifecycle/revocation | Customer suspend/reactivate/device/session POST routes; `private.customer_session_commands`; CustomerSessionRevoker worker | Canonical permissions, recent login, replay/hash conflict, local suspension, original target/cutoff and durable provider state. Command success HTTP201. |
| Support overview/tickets | `/admin/support/overview`, `/admin/support/tickets` and detail/message/action/attachment projections; EngagementService/Repository; support tables and `private.support_admin_workload` | Search/status/priority/assignment/category/UTC dates before cursor limit; exact count. Notes are staff-only, messages paginated, internal notes bounded100. Clean signed links use existing Storage adapter. |
| Mobile support | Owner `/support/categories`, `/support/tickets`, detail/messages and existing attachment API | Live creation/history/replies; retained conflict drafts. No live rating or advanced campaign claim. |
| Imports/parsers | `/admin/imports/*`, `/admin/parsers/*`; TrackingService/Repository; `private.read_tracking_admin` and existing mutation functions | Server filters/cursors and parent CAS revision. Operational import evidence does not grant financial access. |
| AI administration | `/admin/ai/*`; AiService/Repository; `private.read_admin_ai_filtered`, `mutate_admin_ai`, event-platform capture/corpus guards | Recorded event scope, bounded reads, explicit unknown attribution, versioned publication/evaluation. No new Voice behavior. |
| Health/jobs/operations | `/admin/system-health/*`, `/admin/jobs/*`, `/admin/incidents`, `/admin/maintenance`, existing settings/flags routes; OperationsService/Repository; `private.read_operations` | Bounded filtered runs/incidents/maintenance/settings/flags; actual data or explicit unavailable. |
| Admin team/roles/support access | Existing security controller and canonical RBAC/support functions; replay/provider receipt functions | Exact server permissions, last-owner fences, separate approval, scope/expiry/revocation and recent login retained. Test identity is not hosted Clerk acceptance. |
| Audit/privacy/retention | Existing security audit/export/deletion/retention APIs and allowlisted projections | Immutable sanitized evidence, bounded cursor reads and lower-bound totals. No raw provider tokens or export links persisted in fixture evidence. |
| Billing/advanced marketing | Explicit unavailable/deferred live surfaces | Excluded from live navigation. No simulated action is presented as a completed capability. |

## Verification receipts

Detailed logs, failed attempts, JSON reports and native databases are preserved in `.superpowers/sdd/2026-10-23-admin-dashboard-recovery/`. They are intentionally ignored local evidence; this report and representative synthetic screenshots are tracked.

| Gate | Result/receipt |
| --- | --- |
| API regression in11 bounded batches | 156 suites;750 passed;5 guarded legacy tests skipped. `task-6-api-batches.json` and per-batch JSON/logs. No batch failed. |
| Exact-source fresh functional regression | 165 migrations;64/64 tests passed before any pgTAP harness grants. `task-6-fresh-replay.json`, `task-6-final-fresh-accepted.json`. |
| Historical150→165 upgrade functional regression | 15 additive source candidates;64/64 tests passed. `task-6-upgrade-replay.json`, `task-6-final-upgrade-accepted.json`. |
| SQL/RLS, pristine source-fresh and historical-upgrade | Each52/64 suites passed,1384 passing assertions in those suites. The same12 failures occur on the restored historical150 baseline; no newly failing suite. `task-6-admin_recovery_rls-{fresh,upgrade,baseline}-nativecompat-rls.json`. This is not an all-green SQL claim. |
| Actual Next shell browser | 2 passed;2 viewport-inapplicable cases skipped. Keyboard modal and page-only period filter. `task-6-shell-final.log`. |
| HTTP→selected Nest→real SQL browser matrix | 24/24 passed at1440/1280/768/390. Includes owner/staff conversation, private-note exclusion, lifecycle, audit page2, filter beyond25 and bootstrap error/retry. `task-6-live-final.log`. |
| Visual recheck | 4/4 Arabic/English × light/dark checks after spacing; separate1280→640CSS/double-DPR200% reflow check passed and screenshot inspected. `task-6-visual-reflow.log`, `task-6-zoom-final.log`. |
| Mobile compatibility | 8 suites;57/57 passed; TypeScript passed. `task-6-mobile-compatibility.log`, `task-6-mobile-types.log`. |
| Mobile scoped lint | 0errors;18 existing require-import warnings across the checked support test modules. `task-6-mobile-lint.log`. |
| API/Admin static checks | TypeScript and full ESLint passed; migration checksums verified. Final static receipts carry `task-6-*-complete`, checksums `task-6-checksums.log`. |
| Builds | Next production build passed with temporary synthetic runtime-shaped values and `.test` hosts; API/worker/migration builds passed. `task-6-admin-build.log`, `task-6-api-build.log`. No credentials saved. |
| Full Admin completion gate | 100 files;988/988 passed in158.04s. `task-6-tests.log`; `task-done` recorded47a36df3..2f788790. No production code changed after this run. |

The attempted single broad API run is **not accepted**: it selected unrelated suites, exposed additional failures and exhausted Node's2GiB heap before producing a final receipt. Its log is retained as `task-6-api-regression.log`. The accepted batch set covers the plan's changed API tests, prior Task4/5 gates, reports/operations and security tests, plus combined OpenAPI drift and tracking contract. It does not assert the entire repository is green. Within recovery scope, stale invitation persistence mocks and controller-specific contract ownership were repaired; tracking uniqueness no longer depends on obsolete endpoint-count literals. The report measurement regression now checks exact contribution deltas, so other suites' committed synthetic customers cannot invalidate its deduplication assertion.

## Review, rulings and remaining gates

The final author integration review covers `5781c488..2f788790`, including accepted Task1 behavior and connections between the15 additive migrations, API projections/contracts, authority, cursor scopes, provider receipts, customer worker and Admin/mobile clients. No new Critical/Important recovery finding remains open after the recorded fix waves. This is neither an independent review nor a whole-repository audit. Owned HTTP test listeners and the plan-local database cluster were stopped after verification; every database and receipt remains on disk.

- SQL runner compatibility grants `USAGE` on the pgTAP extension schema **inside each rollbackable test transaction only**, and sets the Supabase-style search path. Functional/API tests used exact source grants first. No product grant was widened. Native PostgreSQL18/PGMQ1.4.4/pgTAP1.3.3 and minimal Storage-table fixtures do not replace target Supabase PostgreSQL17/Storage HTTP.
- The12 historical SQL failures are001,004,005,010,014,027,031,034,035,036,050,052. Their baseline comparison is preserved. They concern native role-bootstrap assumptions and older profile/auth/financial/planning/tracking/content fixtures. Production policies were not weakened to satisfy them. Previously reported012/061 failures do pass on the pristine candidates with the correct harness; integration-fixture pollution had invalidated owner-count assumptions in a reused database.
- Task3 minor T3-R1 remains deferred: a populated provenance CHECK permits null `source_version`. The exposed clone workflow supplies a non-null version and remains covered. This is a schema-hardening follow-up, not an accepted wider write path.
- Security and engagement use narrow replay adapters because the financial helper deliberately excludes Admin commands. Financial/tracking receipt admission was preserved. Ambiguous provider recovery remains an operator-visible limitation; no external exactly-once guarantee is claimed.
- Authenticated Staging baseline inspection succeeded earlier and its observations are retained. This candidate has **not been deployed**. Candidate acceptance still needs target Supabase17 replay, actual Clerk delivery/revocation, Storage signing/download and deployed browser verification, plus physical-device mobile acceptance. No deployment/provider/phone action was inferred from local evidence.

Representative synthetic screenshots: [Arabic dark390](recovery-support-ar-dark-390.png), [English light1440](recovery-support-en-light-1440.png), [200% reflow emulation](recovery-support-zoom200.png).

## Decision ledger carried to delivery

These preserve the plan ledger's rulings in their original decision order. Historical delegation wording is superseded by the user's main-agent-only instruction; no new agent activity was used for Tasks4–6.

| Decision | Reason and cost/tradeoff |
| --- | --- |
| Reuse the specified linked worktree | Exact branch/isolation verified; choosing the wrong checkout would affect unrelated work. |
| Local test DB/provider boundaries, no deployment | External delivery requires its own acceptance; local evidence cannot prove hosted behavior. |
| Proceed without plan re-approval | User already approved this plan; an incorrect scope interpretation would require correction. |
| Execute the six subsystem tasks sequentially | Shared SQL/contracts and review gates; additional elapsed time avoids implementation collisions. |
| Security-only claim/complete adapter | Financial and tracking wrappers reject this scope; a wrong admission rule could weaken authorization. Denial/replay/hash tests cover it. |
| Minimal durable provider-outcome receipts | Persistence cannot prove external delivery; ambiguous pending work requires deliberate operator recovery. |
| Preserve ignored workspace/results/databases | Explicit user instruction overrides skill cleanup; retained local disk usage. |
| Nullable event-time AI platform attribution | No historical/current-device backfill; scoped historical measurements remain incomplete. |
| API persists customer commands; worker performs provider effects | API cannot assume a sibling role; provider revocation remains pending while the worker is unavailable. |
| Exclude ambiguous millisecond-boundary sessions from older commands | Their order cannot be proved; a possibly older same-millisecond session may need a later deliberate command. |
| Engagement-only receipt adapters reuse owner-erased storage | Preserve financial admission; other engagement callers must obey the same normalized scope contract. |
| Preserve brand instead of a new visual anchor | Approved typography/palette governs; alternative aesthetic was not applied. |
| Defer advanced campaign creation/live rating | No supported approved contract; those features remain absent rather than produce fake success. |
| Audit authorized attachment attempts before external signing | DB and Storage do not share a transaction; an audited attempt may fail to produce a usable link. |
| Separate real HTTP feature fixture and actual Next shell checks | Avoid production auth shortcuts/credentials; real Clerk, Next identity/routing integration and deployed acceptance remain separate gates. |
| Unknown badge for unconfigured unfamiliar hosts | Avoid guessing Production; custom hosts must configure their public deployment environment. |
| Rollback-only pgTAP schema lookup grants | Native switched-role SQL tests need pgTAP visibility; functional tests used exact source grants first. Native compatibility still cannot certify hosted Supabase17 behavior. |
| Author review only after the user's prohibition | Preserve the review checklist and test evidence without delegation; there is no fresh independent reviewer for Tasks4–6. |
| Accept scoped batch evidence, disclose broader failures | Batches cover the recovery surfaces and fit available memory; this does not certify unrelated legacy repository suites. |

Deferred minor: T3-R1 provenance `source_version` nullability hardening remains open with the workflow-safe limitation above. Earlier T2-R2 audit lower-bound presentation and Task4 audit-label minors are repaired in Task6.
