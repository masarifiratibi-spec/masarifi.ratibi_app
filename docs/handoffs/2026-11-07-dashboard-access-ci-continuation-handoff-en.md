# Dashboard continuation: access integration, CI and release review

Prepared 7 November 2026, Asia/Riyadh. The user explicitly requested this handoff and a new chat to finish the dashboard. Communicate in Arabic; evidence and technical reports are English. This is a continuation, not a new implementation from scratch.

## Start here

- Work in **`D:/Masarifi-integration-2026-10-10`**, even if the saved Codex project starts in `D:/MY Work/0Part_Time/MASREFY _Final`.
- SAME branch: **`codex/voice-promoted-operating-2026-10-13`**.
- Correct remote: **`ratibi`**, `https://github.com/masarifiratibi-spec/masarifi.ratibi_app.git`. Do not use `origin`, force-push, reset inherited work, or create another branch/worktree for this continuation.
- Implementation source checkpoint: **`0247ed5ea73e9b3b287f4d50daf7b28e0beeb5e7`**. This handoff/packet is committed afterward. Obtain the final published checkpoint with `git log`/`git ls-remote`; do not confuse a documentation descendant with an unqualified application change.
- Latest request before handoff: complete real temporary support access, fix failed CI, test the actual service, publish qualified source, prepare/review the concrete deployment package before any hosted change.
- **No new API/schema/sidecar/proxy activation is approved.** Earlier logo/dashboard approval belonged to another release. Do not reuse it. Finish the exact reviewable packet, then ask once for the still-unapproved execution.

Read this complete file, the release packet README/manifest, and the access evidence report before acting. The original `docs/handoffs/2026-11-07-dashboard-ui-integration-production-handoff-en.md` remains the broad assignment. Its old typography, service/device and iOS-activity snapshots are superseded by subsequent human choices and actual current evidence. Keep the existing Tajawal/DM Sans dashboard identity and published new logo.

## What is complete

Earlier dashboard work is recorded in `docs/evidence/2026-11-07-dashboard-production/`: `findings.md`, `capability-matrix.md`, `routes.json`, `verification.json`, screenshots and CI review. It includes the 106-page inventory and earlier chart/contrast/locale/shell repairs. Reuse that evidence where inputs are unchanged; it is not proof that every hosted action is production accepted. Reconcile outstanding items in that ledger after the current access/CI blockers.

The current access work is recorded in **`docs/evidence/2026-11-07-access-ci-integration/report.md`**. Published implementation commits, in order:

| Commit | Scope |
| --- | --- |
| `ccc7e401dd73d1aa1827af98a4064a8469a17a29` | Real canonical support-access adapter/API metadata and authorization repairs; initial CI repairs |
| `73b790d04d705d349107da1e34cc65a06b195107` | Mobile reflow/locale repair, historical CI fixture qualification, scanned API artifact packaging gate |
| `0ffccbd6918b3e6c4878a96e431ef94a376935f0` | Remaining stale contract/planning/identity assertions and exact synthetic secret classification |
| `26d49117231a683b276fa7bb3334e3776792b989` | Reviewed iOS lineage compatibility and exact actual compiled Android badging validator; no app configuration changes |
| `0247ed5ea73e9b3b287f4d50daf7b28e0beeb5e7` | Checker-only database lint repair and 21 controls; no SQL/function/migration changes |

### Access behavior

- Live mode uses `/api/v1/admin/support-access/requests`, with actual UUIDs, Clerk IDs, canonical ticket grammar, cursor pagination, exact resource/action pairs and displayed expected versions. Unknown totals/history remain unknown. Mock endpoints remain isolated.
- Create/decision/revoke/end use real immutable operation receipts and existing idempotency. A lost response does not trigger a blind fresh operation. Conflicting review never silently substitutes a newer version.
- Additive server request metadata supplies actual creation/purpose/review/grant context. Existing fields and old stored receipts remain compatible.
- Workspace requires only its actual use permission, not broader request-read permission. The API checks the existing authorized RPC and exact selected grant under locks, then rechecks access. Strict browser schemas reject raw/unapproved projections. Assignee, consent, owner state, window and revocation remain enforced.
- Expiry/session/authorization/contract loss clear protected query data and local inputs; foreground revalidation detects external revoke. `/me` explicitly isolates the authenticated owner, including dual-role customers. `/end` checks the locked request's actual assignee; global revoke retains its separate permission.
- New migration `supabase/migrations/20261107140100_support_access_denial_without_consent.sql` permits genuine denial before consent while retaining consent for approval. SHA256 `4a826dda49786f3469f96b6c29dddebc8c652fcae0482e995869193d8fe5051c`. **Not applied to hosted DB.** Retain its forward-compatible CHECK on code rollback; do not fabricate consent or restore an incompatible old constraint.

### UI and local evidence

- Corrected desktop flex bases becoming large column heights at mobile width. Title area420→89.4px and duration input~83→44px. Static access/scope/fixture labels follow Arabic/English; real customer content is not translated.
- Playwright list coverage: Arabic/English × light/dark ×1440/1280/1024/768/390. Detail/workspace also inspected at1440/390 in both locales/themes. Synthetic before/after examples are published; authenticated screenshots remain private.
- Admin1045 tests/110 files passed locally; affected access44 tests/7 files refreshed after follow-up. Admin typecheck at1024MB and scoped/full CI lint passed. API47 focused unit and26 real local SQL cases passed, including consent, owner, assignee, separate review, end/revoke and replay.
- Do not repeat full builds/matrices merely because this is a new chat. Re-run affected checks for new changes and observe the fresh final CI.

## Real hosted evidence and its limit

The candidate adapter was bundled from real source with mocks disabled and executed in memory in the existing authenticated browser against `https://api.staging.masarifiratibi.com`. Hosted code was not replaced.

One five-minute self-owned request used only `account-status/read-status`, with customer consent required. Creation201 and independent detail/list reads proved persisted pending/version1. The record was retained; no manual delete or uncertain retry. Pending workspace returned403; requester self-review was blocked. Direct consent and review probes returned403 `RECENT_AUTH_REQUIRED`. No consent/grant, financial data read, financial write or permission change occurred. Notification enqueue does not prove provider delivery.

**Successful hosted fresh-consent → distinct legitimate reviewer → exact workspace → end/revoke remains unproved.** Preserve recent-auth and separation-of-duty. The user permits any ordinary account for testing; that does not authorize forged actors, bypassing consent, widening roles, destructive tests or unrelated customer financial operations. Prefer the existing self-owned status-only scope and a genuine distinct reviewer after compatible approved rollout.

The old hosted API omits new metadata; the new UI fails closed rather than inventing it. Public `/health/live` returns version `a488f4adbf8f291ea49b09940baf5cdb4fe5f0e7`. Public readiness404 is an explicit existing Nginx block, not private readiness proof.

## Exact CI status at handoff

Last completed full run: **Foundation42382098669**, head0ffccbd6, PR merge `df5f0f1b2c4db0815ace3cdb93cedbb4acfe3070`. Both commits have tree `23465a227f49abd3c2b219949706e9ed39a50992`; merge is a direct child of reviewed head. Artifacts use the merge SHA, not run headSha.

- GREEN: API application (type/lint/unit/contracts/OpenAPI/logic/build/audit), Mobile, Admin, secrets, sentinel redaction, all5 Admin browser viewports. Upgraded real SQL integration151 suites/1066 tests passed. All187 canonical migrations and historical Tracking/local-main upgrades passed in previous/current qualification stages.
- GREEN: Staging Client42382098635 and42382094089. Private Journal42382098637, including synthetic, Linux SQLCipher/JNI and disposable Android.
- RED1: fresh `db:lint` reported42601 near `{` at dynamic reset line105, after real reset integration succeeded. The new wrapper preserves the pinned Supabase2.116 mass-check/error policy and only rechecks this exact source/OID/signature with documented constant tracing disabled; it also requires all59 concrete nonexecuting EXPLAIN variants. Other diagnostics/body/overload/plan failures remain blocking; session rolls back.21 Node controls, syntax/format/diff checks passed. **Actual plpgsql_check GREEN still requires fresh CI.** No production function or historical migration was edited.
- RED2: full Android Gradle/minification succeeded, then workflow expected old English label. The new validator passed actual downloaded badging and31 tests plus11 independent real-badging probes. It compares immutable reviewed package/name, with negative controls. The old run did not reach later binary ABI/hash/source receipts; the unchanged steps must pass fresh CI. No device/APK install, EAS/iOS config or IPA build occurred here.
- Image/container/Trivy/archive jobs correctly SKIPPED after these two failures. **No qualified API runtime archive from0ff exists.** The workflow now preserves a Docker-save archive only after all needs, container checks and Trivy pass: artifact `backend-<GITHUB_SHA>-candidate-runtime`, with tar.gz/image ID/manifest,14-day retention.

Fresh CI will start when the final handoff/source batch is pushed. Discover exact new head runs via `gh run list --repo masarifiratibi-spec/masarifi.ratibi_app`; record and follow them to completion, not just their dispatch. Fix actual failures without skipping gates. Do not claim all CI green from the local bounded controls.

## Qualified Admin Linux artifact — reuse it

- Source73b790d; complete Admin tree `9f60670e19f2369e7e12d2260c131f9b75391a42`, unchanged through0247ed5e, as are both reports source imports.
- Workflow42380284312, artifact13576619088, name `admin-canonical-73b790d04d705d349107da1e34cc65a06b195107`.
- ZIP263728589 bytes, SHA256 `408046198198bf166613f20fa31ac437e416fe44fbf989f37caa2aeb7b6c3858`.
- Runtime263726798 bytes, SHA256 `8fe6f57f5bcee817639f0ae3a3102c21aa8b2f25bdadbab587986cf74ab32e88`.
- Manifest SHA256 `d6b4e163f3460a1b72532b86f21120ee2c6946bec1902f60e451f624a55497b7`; build `mT4teHZyRNxcKzft789xW`; Node24.16.0/npm11.17.0.
- Full streaming admission checked576 source files,52750 members,44 internal symlinks and73 static assets against independent pins. No extraction/execution/rebuild or next-env rewrite. Private artifact: `.superpowers/sdd/2026-11-07-access-ci-integration/final-admin-73b790d0/`. Public sanitized pins/receipt/verifier are in the release packet.
- Existing public API/auth configuration digests match the previously admitted dashboard. Do not print/copy raw key values. Do not rebuild unchanged Admin for CI-only fixes. The earlierccc artifact is superseded by the reflow fix and must not be deployed.

## Actual serving baseline and release packet

**`ops/releases/2026-11-07-temporary-support-access/README.md` and `manifest.json` are an explicitly BLOCKED review packet, not an executable deployment.** They include exact host/service identities, Admin artifact pins, read-only archive/routing/context tools and28 passing offline tests. Missing API image/archive and actual routing context/candidate hashes are null. No executor/watchdog is admitted. Do not ask deployment approval until those are concrete.

Actual read-only Hostinger snapshot:

- Admin: `masarifi-admin-reflow-97ad2551-20261107`, ID `8f000b29231bdcf163c7e93a9fb134133a9086e21724c5875beb7de966d943d6`, loopback3041→3040, source97ad2551, runtime image53a7a453…; preserve it for rollback.
- Public staging API default is **3001**, container `masarifi-assistant-reports-api-ledger-scope-20261023-t04-r18-8937ba09`, ID75c25ce4…, image4b70927f…, started1November. It is not the legacy `masarifi-staging-api-1` on3000.
- Separate primary API134: `masarifi-production-core-api-20261105-97e66588`, IDfd3d7a21…, image6b37edcc…, started7November12:50:38UTC. Preserve it and every worker/provider/other instance.
- Staging available/enabled pair: `/etc/nginx/sites-available/masarifi-staging` and `/etc/nginx/sites-enabled/masarifi-staging`, preimage SHA256 `81c6ca948a8264214b1c64fa1d72c06079403814064bda62311143691466c9b9`. Separate primary file/link basename `masarifi-production-core-20261105.conf`, SHA256840cd5e7… . Full exact pins/algorithms are in `host-baseline.json`.
- Proposed candidate ports3042(API) and3043(Admin) were free at snapshot. Keep APIdefault3001 and25 specialized locations; route only the four exact/slash-prefix admin/me support-access locations. Admin changes only its default3041→3043. No DNS or main API promotion.
- Actual API DSN was positively matched, without disclosing it, to Supabase project **qcffvfbpzvpwcwxwjyro**, Masarifi Staging. Read-only catalog:177 ledger rows, latest20261107140000, old pending-only CHECK, zero denied-without-consent. Do not replay all187 migrations, fabricate ledger gaps or use an unrelated generated migration version. Only the verified new CHECK is in scope after approval, with canonical transactional ledger recording.
- The human Chrome Hostinger console at `https://fra.hostingervps.com/2708/` was inspected read-only, then expired. CUA subsequently stopped because it could not confidently determine the browser URL. The user was told to open a new Web console. Do not assume an old root or Playwright handle remains usable. Freshly inspect actual UI. Private credentials/recent-auth/CAPTCHA are completed by the user, never pasted into chat. Saved SSH22 previously timed out; no rule was opened. Do not reopen network access casually.

The read-only routing driver computes the candidate in RAM and emits sanitized hashes/diff. It rejects inherited upstream header policies that would be lost, unresolved context, alternate primary symlink names and drift. Actual candidate hash is still pending host access. Trusted transfer commands are prepared privately in `console-context-readonly-commands.private.json`, but were NOT executed. Bind source hashes from the published packet before any first-party RAM execution. The driver is not an installer; the artifact verifier is not a host extractor.

Required future executor: pin both sidecars/configs/env/mounts/resources, retain existing secrets only in memory, private canaries, exact original-file backup, independent acknowledged two-candidate rollback watchdog, atomic one-file Nginx install/validate/reload, guarded restore/reload even if disk already original, and proof of old public endpoints and unrelated service continuity. No old helper can be replayed with stale IDs/roots/ports/approval flags.

## Next actions, in order

1. Verify same branch, local/remote head and owned/inherited status. Read final new CI run IDs and finish their actual qualification. The21 checker controls do not replace extension execution; require fresh DB lint/integrations and Android ABI/hash/source evidence, then image/container/Trivy/archive.
2. Download the qualified API Docker-save artifact, verify immutable run/head/merge/tree relationship, exact ZIP/tar/image/manifest SHA/bytes and nonroot/API-only command. Keep tokens/signed URLs in RAM and artifacts private. No new hosted staging yet.
3. Reuse the verified Admin artifact while full Admin tree/reports/public pins stay equal. Renew the actual console only as necessary for read-only context; calculate and record real candidate/context hashes, master config identity, current protected services and resource headroom.
4. Finish and independently review the guarded one-file migration/extraction/two-sidecar/watchdog/rollback executor. Replace all blocked/null packet inputs with exact pins and successful qualification. Publish qualified packet/evidence on ratibi SAME branch; verify remote exact.
5. Present the complete concrete packet in Arabic for the user's **new** execution approval. No hosted mutation before this. After approval only: execute reviewed artifact/schema/routing scope, verify genuine multi-actor access and unchanged default/specialized/primary services, record actual served versions and limits. Do not label whole production ready merely from local/CI tests.
6. Reconcile remaining106-route/capability ledger and actual administration integrations; billing remains explicitly unavailable unless a real supported contract exists. Preserve content during refresh, real error/unknown states, ownership, pagination and session behavior. Expand screenshot coverage only where new shared changes justify it.

## Coordination, private evidence and resource boundaries

iOS chat **01a1abcc-d7b9-7f32-8ce2-eec8e19e82b8** is authorized for coordination. User still has IPA/build paused. It prepared exact two-file45fcaac5 identity guard; these are now integrated verbatim into26d49117. Reviewed5482885f iOS marker applies only on that ancestry, absent here. Do not merge iOS configuration/history into Android automatically.

Peer proposed8 exact historical secret-catalog fingerprints from its published merge ancestry. Independent read-only review accepted all8 for iOS ONLY: original blobs/line/value/source/bounds and parent/ancestor proof match; unchanged classifier admits20 supplied findings,32 mutations remain blocked. Android catalog/history remain unchanged. Peer must commit exactly its entries and rerun complete history. Proposal/proof in `E:/Masarifi-ios-artifacts/sync-ci-20261107-0ffccbd6/`; no broad exclusions or source execution. Send the final remote source checkpoint to the peer; a qualified recommendation is not an automatic merge.

The original mobile chat01a1b55a-9542-7922-9766-be15c1da7c23 reported no reserved paths. Concurrent mobile/APK134–136 commits are preserved; this dashboard task did not install/rebuild a physical app or change its data/session. Reconcile any newer peer work before shared changes.

Private ledger/evidence root: **`.superpowers/sdd/2026-11-07-access-ci-integration/`** (`progress.md`, exact CI logs/status/merge-binding proofs, agent reviews, artifacts, scan receipts). Private browser evidence: **`apps/admin-web/output/playwright/2026-11-07-access-ci/`**, explicitly locally excluded from Git. Hosted screenshots/customer receipts are never published; synthetic/redacted copies only.

Preserve inherited modified performance files under `docs/performance/2026-11-02/` (bottlenecks, coverage, task ledger) and every inherited untracked handoff/performance/release file. `apps/admin-web/next-env.d.ts` currently shows modified but has no substantive diff (generated/line-ending artifact); do not stage it. Stage explicit task-owned paths, check the shared index, and never use blanket add/reset/clean.

Windows free RAM was only~2.2GB. All parent-owned Next dev and Docker Supabase services are stopped, with volumes retained. No owned process remains to kill. Existing native PostgreSQL55442 was discovered read-only and lacks plpgsql_check; it was left untouched. Do not restart Docker (~2.8GB cost), kill human Chrome/Java/WSL, clear sessions or build Android/iOS locally to reproduce CI. Use the owned CI disposable environment. Admin typecheck needed1024MB; failed low-memory attempts are not passing receipts.

The new chat owns continuation after this handoff. This chat stops product/host work after publishing and transferring the checkpoint, preventing concurrent edits.
