# Simplified execution strategy — 26 October 2026

**Status: APPROVED by the user on 26 October 2026.** This document governs execution efficiency and review cadence. The original plan's requirements, acceptance criteria, task IDs and dependencies remain in force.

**Current status, 28 October2026 after13:40UTC:** T01–T03 accepted. T04 source approved; hosted queued reauthentication/exactly-once and approved NULL-note/policy restoration completed. Full T04 remains BLOCKED on original R18 dedicated cursor-key API/configuration deployment; T05 NOT_STARTED/full T06 gated. Continue from [current safe checkpoint](../../handoffs/T04-reauth-complete-R18-checkpoint-2026-10-28.md). Old v7 remains inert; v8 and focused cleanup approvals were consumed successfully, temporary threshold is removed and the normal sync-only worker is healthy. Historical status below retains its timestamped scope.

- [Original 29-task readiness plan](2026-10-25-astra-readiness-remediation.md), preserved unchanged at SHA-256 `DDE83AFD481BB9D5F1F68E0BE12C39EAA1C5B221C33B4AD49CAF48F2B95BF189`.
- [Separate 62-client-requirement crosswalk](../../evidence/2026-10-25-astra-remediation-review/client-62-crosswalk.md).
- [69-original-reference / 88-acceptance-unit crosswalk](../../evidence/2026-10-25-astra-remediation-review/requirements-crosswalk.md). These are separate denominators from the 62 client requirements.

## Roles and one normal execution loop

**Latest user-requested routing, 28 October 2026:** **GPT-6.1 Sol Extra High** (`gpt-6.1-sol`, `xhigh`) is the sole responsible model for technical leadership, planning, analysis, implementation, automated testing, personal Xiaomi testing, infrastructure/Staging verification, task acceptance, evidence and handoffs. The current native interface advertises these exact settings and this Sol invocation succeeded before the routing update; CLI availability is not claimed. Pin model and effort. Future implementation, testing and review are Sol-only; no Terra/Astra or other-agent delegation is authorized.

This routing supersedes the original plan's and earlier handoffs' future planner/implementer/reviewer assignments. Preserve the original plan unchanged, all historical Astra approvals and evidence, the actual model attribution of completed work, and every task's scope, dependencies and acceptance criteria. T01–T03 remain accepted.

Sol analyzes the implementation and requirements, personally inspects applicable Xiaomi behavior, investigates root causes and prepares a focused correction plan. Sol implements the smallest evidenced fix, runs relevant automated tests/typechecks, builds/launches or reloads the correct candidate and retests the affected ordinary journey. Sol performs one focused self-review and evaluates each acceptance criterion. Label that review as self-review, never independent review. Reuse completed evidence; qualification-only and non-mobile work use the relevant parts of this loop.

Finish or reconcile any in-flight operation at a safe boundary before taking sole writer/device control. Preserve actual authorship, previously completed work and historical Astra/Terra/Sol approvals and evidence.

Where the conversation handoff workflow is supported, prepare a continuation handoff around the three-hour mark at a safe boundary. Record the exact checkpoint, in-flight operations and ownership; never interrupt or duplicate an active operation merely to meet the handoff interval. Future handoffs must use the current model routing and link the relevant timestamped evidence.

- Default to **one focused Sol self-review per task or compatible low-risk group**. Group compatible low-risk UI work while retaining every task and criterion mapping.
- Higher-risk changes involving financial effects, authentication/owner isolation, schema, credentials, signing or destructive/irreversible operations require an explicit independent verification gate using existing CI, automated checks, authoritative database evidence and human approval where required. Bind each result to the candidate and record its producer/source separately from Sol's conclusions; self-review does not satisfy that gate. State the concrete risk, required evidence and unresolved limits.
- Routine read-only diagnosis and already-approved technical steps proceed within existing authorization. This governance replaces duplicative microreviews; it does not remove safety gates or expand write authority.
- Reuse existing tools, tests, qualified artifacts and evidence. Repeat verification for changed behavior, a new failure or an unresolved concern; preserve completed results instead of restarting the task.
- Use existing capabilities when adequate. Avoid new infrastructure, temporary tooling and elaborate frameworks for a bounded repair.

## Essential delivery and bounded deferral

The following is the Astra-approved execution classification, not a replacement task plan or permission to skip dependencies. A group is accepted only against its constituent IDs and criteria.

| Existing IDs | Essential delivery scope | Boundary |
| --- | --- | --- |
| T01–T03 | Preserve admitted baseline, accepted T02 exceptions and accepted warm/cold save and sync journey | T01–T03 accepted; retain recorded exceptions and evidence |
| T04–T05 | Sync/logout/owner/key-loss safety, database compatibility and financial invariants | Strong isolation, replay and ledger evidence required |
| T06–T07 | Existing security/details navigation, budget recovery/onboarding and numeric boundaries | Compatible low-risk UI repairs may share a review |
| T07a–T07c | Preserve Savings/rich planning, card terms/calculator and category/remittance semantics | Focused regressions plus safe real journeys; payment execution remains deferred |
| T08–T14 | Existing reports, support/Admin recovery, export, deletion/security lifecycle, theme/localization and keyboard/draft journeys | Group compatible UI work without losing each acceptance ID |
| T15, T15a | Existing SMS discovery/parser/policy and merchant/account rules | Preserve existing behavior; expanded parser/provider features are deferrable |
| T16, T16a | Existing notification queue/preferences/OEM recovery and authenticated actions | Retain named platform boundaries and Gulf-time deduplication |
| T17, T17a | Existing assistant/provider contracts, narrative dates, tenant safety and confirmed actions | New providers or capabilities are deferrable |
| T18 | Existing Voice permission, capture and recovery journeys | Safe real-device behavior remains essential |
| T19, T19a | Existing Admin integration/dashboard and feedback moderation | Preserve approved UI and Admin-only boundaries |
| T20–T22 | Exact-candidate CI/native gates, standalone APK/AAB/signing qualification and integrated review | Separate explicit approval before merge into main |

New features, redesigns, expanded parser/provider scope and exhaustive cross-OEM coverage beyond the named requirements are deferrable. Existing specified OEM/API and release boundaries remain required or explicitly unverified. Billing, payments, checkout and subscriptions remain deferred; this strategy authorizes none of their activation or execution.

## Coverage and truthful outcomes

- Preserve **all 62 client requirements**, **all 69 original references** and **all 88 acceptance units**, with their original IDs and denominators. Keep the crosswalks separate and retain added findings outside their original denominators.
- Never delete a requirement to simplify execution. A grouped task still records the owning IDs, assertions, source/artifact identity, evidence and Sol verdict for each criterion.
- Deferred, accepted-exception, external-blocked, NOT_RUN and UNVERIFIED outcomes remain explicit. None becomes PASS through regrouping, a historical status or an aggregate count.
- Preserve all nine named business rules and the original plan's financial/security/owner/sync boundaries. Isolated fixtures establish their stated scope; real-owner destructive cases remain excluded or explicitly device-unverified.
- T02's user-accepted testing exceptions stand. Do not reopen the excepted 30/60-minute checks or relabel unperformed expiry cases as passed.

## Mandatory connected Xiaomi acceptance

Latest visibility instruction (28 October2026): intentionally hidden, disabled and deferred functionality is preserved, not classified as defective merely because it has no menu entry. Before a missing-route finding, inspect flags, capability guards, product decisions and prior instructions. Do not expose hidden features, remove flags, bypass visibility restrictions or alter deferred navigation. Unclear intent stays unchanged and documented. Only currently enabled intended journeys are eligible. The earlier two-entry T06 exception retains its historical scope; the expanded active-navigation proposal requires its own explicit approval.

Real Xiaomi testing is a primary acceptance requirement for every mobile-affecting task. Sol personally inspects and tests the existing functionality before implementation whenever device access is available, reproduces the defect, implements the correction, runs focused automated tests/typechecks, installs or reloads the relevant candidate and retests the complete ordinary user journey. Native changes require a matching rebuilt/installed APK. Record Sol's device results and self-review truthfully, and retain any required independent evidence gate before closure. Unavailable device access and unperformed journeys remain UNVERIFIED; they cannot establish full acceptance.

Check current device/package identity and candidate/runtime provenance. Verify applicable routes, tabs/back navigation, API connectivity and network recovery, authentication/session restoration/App Lock, offline transactions/sync, financial accuracy/owner isolation, Arabic/English RTL/LTR, buttons/forms/drafts and complete journeys. Default to the existing Xiaomi, testing account and Staging with safe QA scopes; preserve existing financial records, owner identity, authentication, PIN/biometric preferences and settings. No bypass, guessed credential, queue manipulation or custom submission substitutes for normal app behavior.

Record safe screenshots/receipts and source/APK/runtime provenance. Keep customer-bearing screenshots, XML and logs private. Restore approved temporary QA state and the exact pre-test network/device settings. Unit tests, mocks, emulators and DEV/Metro alone do not replace the required physical journey.

## Workspace, data and authority

- Use only `D:/Masarifi-integration-2026-10-10` on `codex/voice-promoted-operating-2026-10-13`. No extra branches/worktrees, branch switches or concurrent writers.
- Preserve inherited changes, frozen candidate manifests, historical failures and accepted evidence. Reconcile interrupted processes and partial files before resuming; never duplicate a still-running command.
- Preserve financial data, transactions, accounts, authentication and settings. Production remains untouched. No database reset, queue purge, destructive real-owner test or security weakening is implied.
- Existing service/signing infrastructure remains the default. A narrowly approved credential or operational exception retains its original scope and does not authorize unrelated changes.
- No staging, commit, push, merge or deployment is implied by this documentation change. Ask for explicit approval before merging the reviewed candidate into main; merge never implies deployment or publication approval.

## Current T04 continuation boundary

The user subsequently approved the expanded [active-navigation T06 exception](2026-10-28-t06-expanded-active-navigation-proposal.md), SHA-25651224a79dc271a35ede4b1e81f35e1e15eb48ed599c8d86a8c535f4ec20f8d81. It permits documented active client-navigation repairs and safe offline Xiaomi journeys, preserving all hidden/disabled/deferred gates and excluding financial submissions, unsafe reconnect, logout, security-setting/policy/worker/schema/service changes. Full T06 and T07+ progression retain their original gates. See [expanded audit and limits](../../evidence/2026-10-25-astra-remediation-review/execution/T06/expanded-navigation-audit.md).

On 28 October2026 the user explicitly approved the limited [T06 navigation dependency exception](2026-10-28-t06-navigation-dependency-exception-proposal.md), original proposal SHA-2563936bf2238ec33326b691dc292ebc78d614cac462bbf45272e3384596d84f370. Only Security→Events and transaction-list→Details entry points, focused tests and offline Xiaomi verification may proceed while T04/T05 stay BLOCKED. Full T06 acceptance and T07 progression remain gated by original dependencies and live evidence; no policy/worker/schema/financial action or online unknown-queue transmission is authorized by this exception. See [slice results](../../evidence/2026-10-25-astra-remediation-review/execution/T06/navigation-exception-results.md).

Continue bounded T04 analysis and applicable safe verification personally as Sol. Distinguish configured consumers, pooled connection metadata and enabled paths from evidence of actual financial operations. Preserve held policy-test v7 and its guard; do not repeat broad attribution audits or change policy merely to manufacture a rejection. Assess existing supported policy-free paths against the exact queued-operation and financial acceptance criteria. A temporary-policy proposal, if still necessary, needs a distinct concrete scope, all relevant financial-worker interference bounds, current quiet window, fresh financial/queue preimages, precise abort/restoration/reconciliation controls and separate specific user approval. Earlier quiet confirmation and draft review authorize no execution.

When required hosted/device evidence cannot be obtained safely, record the exact criterion BLOCKED. Later tasks may start only if the original dependencies actually permit it; T05 depends on T04 and the subsequent task chain cannot be bypassed. Preserve accepted source/tests and completed Xiaomi journeys rather than repeating them because model ownership changed.

## T03 checkpoint and approved controls

The following records the strategy's original T03 controls, not the current resume point. T03 was subsequently accepted; preserve its [historical checkpoint](../../../.superpowers/sdd/2026-10-25-astra-readiness-remediation/T03/session-consumer-prep/CURRENT.md), completed focused tests, actual PG17 product results and strict shutdown evidence. Do not repeat them unless the relevant implementation changes or new evidence requires it. The strategy itself did not establish T03 acceptance; later evidence did.

- Preserve immutable original-operation identity, raw mutation/resource anchors, owner/device/resource predicates, stored authentication, base version and financial/posting invariants. Never rewrite queued payloads or manufacture receipts.
- Keep the general worker OFF. The reviewed finite QA consumer retains one in-flight operation, six ordered phases and at most six first-time claims; persist its consumed budget and journal before claims.
- Old failed-session/private-file/journal/container evidence remains intact. No blind restart, budget reset, automatic restore or silent deadline extension is allowed. The original bound deadline is `2026-10-26T10:39:32Z`; an expired or insufficient window must be reported as unaccepted, not stretched to produce a pass.
- Native loaded-byte hash is explicitly **UNVERIFIED** and was an added tooling gate, not an essential T03 requirement. Preserve the failed inspector evidence. Use the approved bounded DEV provenance chain and actual ordinary warm/cold phone-to-staging agreement, receipts, exactly-once effects and final NULL restoration for T03 acceptance.
- T03's current approved operational controls and genuine financial/security gates remain mandatory. This strategy does not activate a consumer or advance T04 automatically.

## Final exact-candidate delivery

T20–T22 remain essential. Run effective CI/native checks against the final reviewed candidate and qualify the matching standalone APK on the connected phone. Bind source/dirty manifest, environment/API/Clerk/runtime flags, package/version, artifact hash and existing signer to the evidence.

Preserve the original signing/AAB requirements, upload-versus-Play signing distinction, non-debuggable/minified release checks and native ZIP/ELF **16 KB** boundary. Xiaomi's 4 KB pages do not establish 16 KB runtime compatibility; permitted supplemental platform evidence remains separately scoped. DEV/Metro proof does not qualify the standalone release.

Sol's integrated acceptance verdict must reconcile all original IDs and explicit exceptions/deferrals against that exact candidate, including publication-only blockers and required independent verification evidence. Record the code review as self-review. Present a concrete reviewed merge action for the user's explicit approval before merging into main. Preserve billing deferral and production isolation through completion.


## Permanent App Lock decision — 29 October2026 (current requirement overlay)

The user's explicit attachment permanently supersedes the custom Masarifi PIN requirement: remove custom PIN setup/verification/reset/change/KDF/UI, use optional Android OS authentication (biometrics with OS device credential fallback) in release, and disable optional App Lock prompts only in the explicitly identified DEV build. This is specific local security-product authority; it does not authorize protected Staging/Production/schema/worker/financial changes. Ordinary implementation/testing decisions proceed autonomously; no model delegation or routine approval pause.

Current design and executable task requirements: [native App Lock design](../specs/2026-10-29-native-app-lock-design.md) and [implementation/acceptance overlay](2026-10-29-native-app-lock.md). Keep the original plan and62/69/88/29 IDs/denominators unchanged; its custom-PIN criteria are historical and superseded only by this stated decision.

- T02: preserve completed PIN acceleration/lifecycle evidence as historical. New acceptance requires native-only release lock, OS fallback/cancellation/owner fences, identified-DEV prompt suppression and release anti-bypass proof. Do not rerun accepted30/60-minute exceptions merely because the product changed.
- T04: accepted deployment/sync/key/financial evidence stays valid in its historical scope; refresh directly affected owner/logout/session safety regressions for the new client, never replay accepted financial/reauthentication operations.
- T05: accepted current-candidate database qualification and explicit platform limits stay; no migration or fixture reset is implied by App Lock.
- T06: verify current native-only settings/DEV routes on Xiaomi and retain all original remaining coverage. Security Events remains fixture-gated by the separate KEEP_GATE decision; this App Lock decision does not authorize that feature or waive full T06/T07 dependencies.
- T20–T22: qualify a matching native artifact without the obsolete PIN module, OS fingerprint/device-credential behavior and production anti-bypass. A DEV JavaScript result cannot close the release/native gate. Actual native verification remains user-mediated; no credential entry, Android-security bypass or simulated success is allowed.

Preserve encrypted databases/drafts, accounts, current sessions, financial authorization, owner isolation and legacy secret bytes. Native preferences use a separate owner-scoped key; compatibility must not validate/delete/reset old PIN secrets or rewrite encryption keys. Existing explicit account-erasure cleanup keeps its complete owner-data semantics. Existing Clerk OTP/sign-in code is shared authentication and remains.

Current acceptance must separately state implementation, automation, DEV Xiaomi and release/native/human outcomes. Actual logout or destructive owner cleanup must not erase the preserved test account/draft merely to manufacture device evidence. If unavailable, keep the case NOT_RUN with a precise prerequisite. Continue independent authorized work while protected/native-human boundaries are pending.


## T07 batched continuation decision — 29 October2026

Current accepted checkpoint: T01–T05 retain their recorded accepted scopes; T06 navigation/refund fixes and native App Lock source/DEV results stay preserved. Native release authentication remains pending. The user explicitly reaffirmed Security Events as intentionally hidden and deferred. Its live criterion is DEFERRED_BY_USER, never PASS; the existing gate and source remain unchanged, and full T06 remains unaccepted.

The user requested practical2–4task batches and a narrow acceptance/dependency proposal, while explicitly reserving material dependency changes for separate approval. The [concrete execution-only exception and batch roadmap](2026-10-29-t07-batched-execution-dependency-proposal.md), SHA256c6ee887bae0db1702e202cab4c4ee28b50751cbff269ec82f0b89ea4b356487b, is PROPOSED/PENDING; do not treat it as approved. It separates source/qualification permission from per-task physical/hosted acceptance and preserves final T20–T22 gates. Until approval arrives, retain original execution dependencies; read-only inspection and proposal preparation continue. No T07 product implementation or acceptance is recorded by this note.

No completed T06 test/build/deployment/financial operation is repeated. Preserve original plan and62/69/88/29 denominators, current original draft/12applied operation identities, owner/security guards, hidden features, Production isolation and billing deferral. Single-task batches isolate communications/export/deletion/recording where combining them would weaken safety.


### Execution exception activated — 29 October2026

The user explicitly approved the exact packet c6ee887bae0db1702e202cab4c4ee28b50751cbff269ec82f0b89ea4b356487b: “Approve this exact execution-only exception”. Independent T07–T19a source/local qualification and already-authorized active Xiaomi journeys may now proceed under its exact batching/interface rules. Original task-level acceptance and predecessor acceptance still apply; T06 remains unaccepted, Events hidden/deferred, native release authentication pending and T20–T22/protected actions unchanged. Activation evidence: .superpowers/sdd/2026-10-29-t07-batched-remediation/APPROVED-EXECUTION-EXCEPTION.json.
