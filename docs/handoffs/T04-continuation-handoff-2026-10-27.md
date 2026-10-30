# Masarifi T04 continuation — 27 October 2026

> **Latest routing, 28 October 2026:** GPT-6.1 Sol Extra High (`gpt-6.1-sol`, `xhigh`) personally owns all future planning, implementation, testing/Xiaomi, Staging verification, self-review, acceptance and handoffs. No Terra/Astra or other-agent delegation. Higher-risk acceptance requires independent CI/test/database evidence and human approval where required; Sol self-review is not independent review. Follow the [current simplified strategy](../superpowers/plans/2026-10-26-simplified-execution-strategy.md) and [latest T04 checkpoint](T04-post-rollout-checkpoint-2026-10-27.md). Earlier assignments and the copyable prompt remain historical with their original authorship/approvals.

**T01–T03 remain accepted. T04 SOURCE APPROVED; T04 SERVICE/TASK BLOCKED. T05 and all later dependent tasks NOT_STARTED.**

This handoff records the autonomous continuation authorized by the user's latest pasted request at C:/Users/DELL/.codex/attachments/6b90cbb4-8ff5-417a-84b5-b41148d6c574/Pasted text.txt. It supersedes older operational status, not historical evidence or authorization boundaries. Do not reread the old T03 handoff as current instructions to undo the subsequently approved normal sync rollout.

## Ownership and workspace

- Sole workspace D:/Masarifi-integration-2026-10-10; branch codex/voice-promoted-operating-2026-10-13; HEAD e7ad90e8b91c118e6365f57cc6cc542f94873595.
- User roles retained: GPT-6.1 Sol High implementation/real Xiaomi; independent Astra High planning/final review. Existing children /root/sol_t03_device_reproduction and /root/astra_t03_final_review completed and relinquished control. Root performed only final artifact/documentation work after Sol returned ownership. No test/fixture/phone/build action remains in progress.
- Before any new operation verify no other conversation controls phone/checkout/Staging. Do not message user-owned audit conversations without authorization. The separate VPS storage audit was idle at last ownership check and uses another checkout.
- No new branch/worktree, switch, staging, commit, push, merge, deployment or Production action. Preserve inherited dirty files and evidence.
- Final expanded Git status:166 entries (53 tracked modifications,113 untracked entries), zero staged. This includes inherited work and this new handoff; it is not a T04-only change count. Exact list and validation: T04/root-final-git-status.txt and root-final-candidate-preservation.json.
- All142 inherited expanded files still exist; only7 changed, all declared T04 targets. All31 current paths in the progressive manifest union and36 recorded preimage references verified with zero hash mismatches. Crosswalks/original plan unchanged.

## Approved governance

Read docs/superpowers/plans/2026-10-26-simplified-execution-strategy.md and original 2026-10-25-astra-readiness-remediation.md T04/global constraints. Preserve62 client requirements,69 references,88 units and all dependencies. One writer and one final independent task review; additional narrow review is justified only by concrete financial/auth/schema risk.

User permits ordinary current testing-account operations and a reversible DEV-only online privacy App Lock configuration for testing. It does not permit bypassing cached-owner PIN, Clerk, encryption, Android security, actual owner deletion/purge/key loss, queue resets or irreversible financial operations. Standalone App Lock qualification remains required later. Billing/payments/Production remain deferred/untouched.

Normal Staging worker remains approved ONLY for sync-mutations.retry. This session did not expand, stop, restart, rebuild or activate it. Frozen V7 is not a resume mechanism; preserve its consumed claims/journal/reservation/deadline. No temporary consumer, V8, recovery framework or new environment was created.

## Work actually completed

Evidence base: D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-astra-readiness-remediation/T04/

1. Real cursor recovery: actual SyncHttpService throws SyncServiceError while coordinator recognized only HttpError. Exact INVALID/EXPIRED typed errors now recover without losing pending SQLite operations; non-cursor/auth/network errors remain distinct.
2. Durable logout: owner-bound protected prepared/cleanup-ready disposition survives restart, fences cache/hydrate/runtime admission, pauses/drains admitted writes before the decision, preserves data on uncertain provider failure, and retries existing cleanup only after confirmed termination. Replacements and ambiguous all-session retries do not gain cleanup authority.
3. Supported automation logout retained: existing device registration/reminder withdrawal/authenticated installation-sign-out and pinned SDK termination are shared narrowly; no generic financial-token bypass.
4. Owner races: legitimate latest SDK owner restoration works; late old-owner failures/profile results cannot erase the current owner. Final review caught a delayed marker-read race that reselected A's database after B admission. A meaningful RED reproduced it;3 production guard lines and a regression preserve B's database/session/cache and both owners' data.
5. Worker recent-auth: RECENT_AUTH_REQUIRED now remains a direct rejected outcome instead of retrying into SYNC_RETRY_EXHAUSTED. Worker does not renew authentication or change operation identity/body. Actual HTTP/coordinator/SQLite tests qualify verified/cancelled/failed same-operation replay.
6. DEV online App Lock opt-out now requires native com.masarifi.mobile.dev, __DEV__, development/live/exact Staging variant and explicit lowercase false; cached-owner PIN remains mandatory. Original public config restored.
7. Small prerequisite navigation fix: Security Settings Back falls back to existing More route when no back stack. Real Back→More→Home observed. This is not T06 acceptance.

Source/report anchors:

- task-T04-cursor-candidate.json SHA256 4d5761039f432bf687f07ee25c85030c381c5827b790233cf36fc94445ea9f6a
- task-T04-logout-candidate.json SHA256 8d468972e33962b89bb6a1cbcc27a4e85200ce8514f072a3ef538370c3ac3331
- FINAL task-T04-reauth-candidate-v3.json SHA256 e029b836d0c82f5266aa69f276bb77e9ccb7ed872f1330954fd41bffb9d2753a
- task-T04-reauth-report.md SHA256 583508036db477345b106ea0a5600aa0f6e307f2f630eb7f5b693df56321c46e
- task-T04-owner-marker-race-addendum.md SHA256 862bdcadcdde7b75aeee5b2adf6317d3463992a7f6adcb3539cfe617408d751f
- astra-T04-final-review.md SHA256 bb03917df20019b6d5282ee62b18f990e84d44ff9c1a6bce10857aa494fee221
- root-final-candidate-preservation.json consolidates current source hashes. Earlier manifests/reports/RED/FAILED logs remain immutable.

## Tests and actual Xiaomi evidence

Counts overlap and must not be summed. Completed focused cursor138PASS; later mobile5 suites268PASS; latest owner/auth2 suites107PASS after final race fix; corrected API2 suites14PASS. Mobile/API typechecks exit0. Scoped lint before the3-line final guard passed with3 inherited mobile require warnings; no new lint run for that final guard is claimed. Boundaries passed. Prior282/153/19/63/12 checkpoints are historical overlapping scoped evidence, not an aggregate total.

Independent Astra: lifecycle+sync-first logout2 suites34PASS before final delta; after delta only the new race regression1PASS/30skipped. No unresolved P1/P2 source findings. Source APPROVED; full task BLOCKED.

Actual Xiaomi f66a40694eca, model23076RN8DY/Android15, DEV com.masarifi.mobile.dev0.0.1/code1:

- Device-first offline Home/More/read observed.
- Normal UI reads showed accepted T03 QA expense/income once each.
- Own incomplete amount0/no-Save draft survived force-stop/cold reopen.
- More Sign out displayed unsynced-work dialog; Stay retained session/draft.
- Own draft removed through ordinary Discard, then cold empty reopen verified. No financial Save, real provider termination, current-owner purge, owner switch or key-loss test was performed.
- Immediate hot reopen after an earlier Discard showed the draft again. This is OBSERVED/UNLOCALIZED; no before-candidate reproduction proves its origin. Earlier “pre-existing” attribution is explicitly corrected by the final addendum. Preserve for focused T14 investigation; it was not fixed or accepted away.
- Phase2 normal More→Home→Transactions read smoke passed; no new draft/Save/Sign out.
- Old ADB call stalled about14,461s and phone disconnected. This was not established as an application ANR. Fresh reconnection was used; later ADB calls had hard<=15s subprocess deadlines.
- Final phase2 cleanup at05:57:25Z: airplane0/WiFi0/data0, no default network/reverse0. APP_LOCK=true original public config byte-identical SHA256 4b16185f65cc3c1b00a61ae55c0efb3b984710409bcf1eaff04d03372dd7b350; Metro27004/parent17032 at that snapshot. Fresh final-phase PIN visibility was false/UNVERIFIED; earlier normal PIN was observed. Do not manufacture a later PIN result.
- Cleanup receipts: task-T04-device-cleanup.json and reauth-compatibility-2026-10-27/device-phase2-cleanup.json. Native APK was unchanged; DEV/Metro evidence is not standalone release qualification.

Destructive logout, replacement-owner/key-loss phone scenarios remain NOT_RUN under current-account restrictions. Do not demand a destructive real-account test; qualify remaining isolated scenarios through the allowed existing fixture and retain honest device boundaries.

## SQL qualification and exact hosted blockers

Fresh raw read-only receipt T04/root-final-readonly-evidence.json contains06:12:11Z Staging qcffvfbpzvpwcwxwjyro:166 registered migrations/latest20261023200000, authenticated_at ABSENT, pending0, direct/wrapped recent-auth rejected0. Failed wrong-schema read-only probe is preserved separately in that packet. No migration, financial repair or fake application was performed.

Existing positively owned PG17 fixture ONLY: systemID7700634956601963652, loopback55473. No new cluster/runtime/reset/drop. First source run FAILED23514 due missing planning constraints in the selected fixture baseline; it rolled back and owned stop0 at01:29:47Z. Exactly4 unchanged existing phase07 constraint statements were added only to this T04 fixture setup after root confirmed they match Staging. One justified delta run GREEN1/rollback/owned stop0 at06:04:23Z. Existing databases/old receipts/generic helpers/source migrations unchanged; synthetic DBs retained. No fixture process restart is pending.

The two functional source bodies together preserve original auth instant, stale rejection, fresh same-row/operation replay, payload/device/owner protection, applied-not-reclaimable, child dependency and all10 planning receipts. Memberships including OIDs and function ownership/ACL/search_path unchanged. Transactions0/postings0: this is QUEUE/RECEIPT qualification; financial exactly-once NOT_PROVEN by it.

Exact group receipt: reauth-compatibility-2026-10-27/source-sql-fixture-delta/source-sql-selected-group.json.

- Original20261023232159 SHA5379846ef9d29177a1f964cd536476c15e9d59dcb0eb3dcca6890038bedeaaed;10-body SHA c8f795a453b477bbe7f96d31c575de40ca00514e392ad968983126cc0256c8b3.
- Original20261024110500 SHA83a843a6252ed9ae503e9e326bdbabcd0efe154b1e925c7d533d535bc3c1db1b;1-body SHA7dae9102792c24b9901fceb1b97f4a7bf4c021fa6215bb23793c6dd5fc518d1c.
- Do not run the first alone: it narrows domains and breaks planning. Do not blindly run role wrappers: they would revoke an existing self-grant. Do not edit original migrations/history or adopt a general bypass.

HELD task-T04-reauth-held-proposal.md SHA220c14adb9abd08c569763f45026681c8d6cb4cda086a5ccc71f3ad36197d8c7 describes a narrowly reviewed atomic2-body transaction under existing migration role/lock/history infrastructure, omitting only4outer wrappers per source and recording actual executed SQL truthfully. It is conceptual/UNEXECUTED, not an execution-ready approved packet. Do not run the whole pending chain or rewrite166 prior history rows.

A NEW normal worker image is required. Existing validated418-file allowlist was reused to package current bytes; exactly one backend input changed: apps/api/src/sync/claimed-mutation.executor.ts. Archive contents419 verified:

- T04/normal-backend-context-t04.tar.gz SHAde15ee3bc8372432266ce5b188794f1b5cef9b8ef5f7c087accacf949c76487d,1,016,655bytes.
- T04/backend-source-t04-manifest.json SHA035e95a31fe6fe0f9ddc08bb2fe7091df7933f05d939760d9e137769da6d0f35.
- T04/root-backend-context-receipt.json:LOCAL_ARCHIVE_CONTENTS_VERIFIED_ONLY. NOT built/scanned/uploaded/activated. Old normal image qualification cannot qualify this candidate.

Supported access blocker: final bounded SSH to masarifi@187.77.81.97 timed out at port22; existing key/strict known-host verification retained. Fresh official authenticated hPanel Web console remained blank/no usable shell. No credential/firewall/access change or reboot was attempted. Do not bypass security or reuse another conversation's console.

Last successful host runtime inspection01:14:23Z, not a fresh post-timeout guarantee:

- Normal worker container43592d5ca20d11fe56faa79c9de03ce809efaef44d0d0d724d55ed4c997b0421/image51b6b177c0631ea3047d685ff1bd9fe27af6f7cd66cc085da99c43792bc212d0; scopeONLYsync-mutations.retry.
- API98cb120092a0685a003b42f3854523d775905451696ad0b93241706c1cb15fd7/imagea4f6c1ad71621b645d09880e943b5c15d27a8d8a4bd038ef4913fd3aebf3d383.
- Frozen V7e4d369becec7e34e5dc2d588383233cc272d9348bc6bc2d9f77c5a6acacc0bab remains historically stopped14:56:11.869653206Z26October/phase3/claims2/noinflight. Never restart/rebind/reset/replay/extend it. Journal SHAffec183e5eab6bfed4e8107728e315b671b8854689eeba167819e37e7f926563.
- Protected env metadata/hashes retained in raw runtime evidence. Do not print secret contents.
- Last authoritative financial snapshot01:03:30Z: T03 eight operations all applied/attempt1, QA notesNULL with versions4/5, financial/posting/owner state unchanged. This session created no financial operation. Later schema snapshot establishes pending0, not a newly queried financial-row proof.

## Exact next safe action

1. Re-establish exclusive ownership and existing supported SSH/Web console access without expanding security permissions. Refresh runtime/env/history/membership/queue preimages read-only.
2. Build and scan ONLY the exact packaged normal worker candidate through existing infrastructure and pinned Dockerfile/security gates. No new consumer/general worker/framework.
3. Resolve the fixed atomic2-body invocation and actual-history receipt with exact image/body/preimage pins. Obtain the genuinely required SPECIFIC Staging schema/image rollout approval before holding/replacing the worker or applying DDL. Existing approved normal sync scope does not itself approve this new schema/image pair. Do not seek a vague or premature rollout approval for an unbuilt image.
4. After approved rollout, verify normal supported same-operation reauthentication/end-to-end receipts and financial exactly-once effects on safe testing data, plus all remaining T04 acceptance within permitted destructive-fixture boundaries. Preserve original operation identities/instants/financial data/settings.
5. Astra must accept the new actual hosted/device evidence before full T04PASS or advancingT05. No approval is inferred from this source-only verdict. T05's whole-chain/history drift and all later tasks remain unstarted.

No physical unlock request or other user question is pending. Root will issue no operational inputs after handing off. Final report should say BLOCKED with the access/image/approval/hosted-evidence dependencies, while retaining the completed source work and acceptedT01–T03.

## Documentation-only transfer check and resumption instructions

At 2026-10-27T06:55:11Z, this conversation began the user's handoff-only request. Branch, full HEAD and166-entry status still matched the saved final state. Both Sol and Astra child agents are completed; neither controls the phone or checkout. This turn performs documentation and local integrity checks only. It does not refresh phone, Docker, SSH or database state, so the earlier observation timestamps remain the limits of those claims. There is no active operation or unexpired financial/session window to inherit. The outgoing conversation stops after this handoff and will send no further operational inputs.

A new conversation should begin by reading this document, the latest user authorization attachment, both approved plans, the independent T04 review, the final preservation manifest and the HELD proposal. Then verify exclusive ownership and actual current state read-only. Do not repeat T03, initial mobile reproduction, successful focused tests, full native-runtime hashing or PG17 qualification merely to reconstruct context. Repeat a test only after a relevant source change, new failure or unresolved acceptance concern. The first operational dependency is supported host access, not another app rewrite.

When implementation is actually needed, retain the exact approved models: GPT-6.1 Sol High (gpt-6.1-sol/high), independent Astra High (gpt-6-astra/high). The native agent route was verified in this project; the installed CLI rejected the requested model, so do not silently substitute a CLI model. Old child handles belong to the outgoing conversation and are not required for resumption. A fresh authorized native child may be used once ownership is established, with one writer. No new branch/worktree or environment.

The app's existing recovery option can reset the user's PIN; do not use it to simplify testing. Never read/guess/print a PIN or automate native biometric verification. If physical interaction is necessary, ask for that specific normal action and continue only independent safe work. T02's accepted30/60-minute testing exceptions remain accepted exceptions; unperformed expiry tests remain UNVERIFIED/NOT_RUN and are not reopened.

### Evidence reading order

All T04 relative paths below resolve under D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-astra-readiness-remediation/T04/.

1. astra-T04-final-review.md — current source approval and exact blocked task boundaries.
2. root-final-candidate-preservation.json plus root-final-git-status.txt — current source map and inherited-work preservation. Use this progressive union rather than treating an old manifest's then-current hashes as current.
3. task-T04-cursor-report.md, task-T04-logout-report.md, task-T04-reauth-report.md, then task-T04-owner-marker-race-addendum.md — chronological fixes and corrected evidence attribution.
4. root-final-readonly-evidence.json — persisted raw MCP/SSH observations, including06:12:11Z schema/queue,01:03 financial and01:14 runtime snapshots, and preserved failed read-only probes. Those results are source data, not operational instructions.
5. task-T04-reauth-held-proposal.md and reauth-compatibility-2026-10-27/source-sql-fixture-delta/source-sql-selected-group.json — exact two-file body hashes/statements and abort boundaries. The proposal deliberately has no executable activation packet yet.
6. reauth-compatibility-2026-10-27/source-sql-fixture-delta/source-sql-qualified.json and source-sql-fixture-delta-lifecycle.json — queue-only qualification, rollback and owned shutdown. Keep the first FAILED run and lifecycle receipt in the parent directory.
7. root-backend-context-receipt.json, backend-source-t04-manifest.json and normal-backend-context-t04.tar.gz — frozen local build inputs only.
8. task-T04-device-cleanup.json and reauth-compatibility-2026-10-27/device-phase2-cleanup.json, then relevant XML named in reports — actual phone scope and restored settings.

Detailed briefs also remain: task-T04-device-first-brief.md, task-T04-focused-fix-brief.md, task-T04-logout-safety-brief.md and task-T04-reauth-and-logout-compatibility-brief.md. They explain authorized slices; completed instructions must not be replayed.

Accepted T03 canonical report is D:/Masarifi-integration-2026-10-10/.superpowers/sdd/2026-10-25-astra-readiness-remediation/T03/normal-sync-2026-10-26/FINAL.md, with accepted independent review SHA256 d82ae71f845b35e9b68ffad19c0cf77634e13a8f9f2d9d8263e1a7645324b8b2. Its authoritative receipts and current runtime acceptance supersede the older T03-only handoff. Retain the old expired V7 evidence as historical, never as a startup command source.

### Existing access and build anchors

- ADB executable C:/platform-tools/platform-tools/adb.exe; serial f66a40694eca. Any future ADB subprocess must have a hard bounded timeout; the prior long stall is preserved.
- SSH executable C:/Windows/System32/OpenSSH/ssh.exe, user masarifi, host187.77.81.97. Existing key C:/Users/DELL/.ssh/masarifi_staging_ed25519 and known-hosts C:/Users/DELL/.ssh/known_hosts_masarifi_staging. Use existing strict verification, IdentitiesOnly, BatchMode, ConnectTimeout8 and one connection attempt. Do not print key contents, replace credentials, widen firewall rules or bypass a warning.
- Official panel https://hpanel.hostinger.com/vps/2006836/usage; server srv2006836.hstgr.cloud. Old console session URLs/tabs are not durable credentials. Open a fresh official console through an authenticated panel if appropriate; the last one remained blank. Do not claim/control the other audit conversation's tabs.
- The old approved normal context is T03/normal-sync-2026-10-26/backend-source-v2-manifest.json SHA4a6b7ea323b9ed63f8fb365389e31dfd20f129ce0bb9e3023bcac9e37d5a75dd; its archive f00163437d5b60a7649ebabfd6d3cc90c2a64ba972e65ae0d3d72ae2a7bf0203 remains untouched. Do not upload/rebuild that old source as the T04 fix.
- Existing server build tree /opt/masarifi/qa-t03/packages/f00163437d5b60a7649ebabfd6d3cc90c2a64ba972e65ae0d3d72ae2a7bf0203 and upload counterpart /opt/masarifi/qa-t03/uploads/f00163437d5b60a7649ebabfd6d3cc90c2a64ba972e65ae0d3d72ae2a7bf0203 identify historical artifacts only. A new artifact uses its own digest; preserve the old archive/chunks.
- Reuse docker/backend.Dockerfile and existing normal hardened build/scan route. Dependency/runtime overlays and official vulnerability checks are recorded in T03 normal-sync evidence; no source/dependency/native change warrants an unrelated redesign. No image/provenance/security scan has yet qualified T04.
- Original consumed V7 journal: /run/masarifi-t03/journal/t03-qa-bc2c323a66641b97/00003.json. Authorization expired2026-10-26T14:56:11Z. Do not remove the reservation, alter journal/claims/deadlines, run archived bind/preflight/session/rehearsal commands or replay applied operations.
- Existing fixture directory T03/runner-prep/pg17; qualified helpers scripts/qa/t03-exact-sync/fixture-common.ps1. fixture-start.ps1 is a new-cluster initializer and is NOT a resume command. Do not modify frozen manifests or shadow native ownership guards. The completed fixture is stopped, so no fixture startup is part of the immediate continuation.
- Correct Staging mutation table is public.client_mutations. The wrong-schema read-only probe failed42P01 and did not change anything. Never infer a queue/schema transition from that failed probe.
- Protected metadata last verified: worker.env SHA3420c2018e9454bbf4cef4d42aa7f46f613e3f04075834bca85a63d575c42847; api.env SHAabdb3bec68ec0489a06e3f5eaac682bf76679f6c1730210a7c7b49cde7085bef; migration.env SHA75b5d7fe85405c7b0d1bc257f1c5cc3b884c6f3ec3a8f736223a24ac0669acf1. All were mode0600/uid1000/gid1000. These are historical pins to recheck, not permission to edit them.
- Minified build manifests may be a single huge line: parse JSON and print selected fields; do not dump the whole manifest. Phone XML/logs and account-bearing evidence stay private.

### Copyable initial prompt for the new conversation

> Continue Masarifi from D:/Masarifi-integration-2026-10-10/docs/handoffs/T04-continuation-handoff-2026-10-27.md. Read its referenced current evidence and latest authorization. T01–T03 accepted; T04 source approved but service/task BLOCKED. Use only D:/Masarifi-integration-2026-10-10 on codex/voice-promoted-operating-2026-10-13, HEAD e7ad90e8b91c118e6365f57cc6cc542f94873595; preserve all dirty work. First establish exclusive ownership and inspect current state read-only. Resume at the supported Staging-access blocker; then exact worker build/scan and a concrete separately approved atomic schema/image rollout, followed by actual hosted/device acceptance. Do not replay completed tests/operations, start V7/another consumer, alter credentials or reset data. GPT-6.1 Sol High implements/tests; Astra High plans/reviews; one writer. No T05 advancement until T04 accepted, no Production/billing, no inferred rollout approval.

This handoff is documentation, not a new authorization window. The outgoing conversation has stopped; all further operational decisions belong to the new conversation after its own ownership and current-state checks.
