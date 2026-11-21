# Release ledger — plan: docs/superpowers/plans/2026-11-22-dashboard-production-ios-submission.md

Owner approval: implement the updated plan; backups deferred and not a release gate.
Orchestrator chat: 01a2000f-fc99-7cf2-a000-4c020717c863.
Execution model: GPT-6.2 Astra High; milestone reviewers GPT-6 Astra.

## Initial baseline

- iOS branch iOS at 4716a1d59d88aa4022d096ac39ec90a3d6c85324 in E:/Masarifi-iOS. No tracked changes; five inherited untracked QA screenshots preserved.
- Dashboard/shared branch codex/voice-promoted-operating-2026-10-13 at 77cab1c98edac4cd321d6ca16ad2a6aedc2d5fda in D:/Masarifi-integration-2026-10-10. Inherited dirty tracked/untracked files preserved; not part of candidate without explicit reconciliation.
- T01 in progress: requested handoffs from iOS readiness and database chats. Further code/build/deploy ownership moves to release team.
- Prior live audit: core API/deletion worker operating, readiness patch source-only, admin DNS absent; QA report worker/storage unhealthy. Revalidate during execution.
- Ruling: no new worktrees/branches; persistent implementation chat and major-milestone reviews per owner.
- Ruling: backup/recovery implementation postponed until after dashboard deployment and Apple submission. One-hour target remains unverified.

## Gates

Gate A accepted for implementation by independent GPT-6 Astra review; artifact/deployment acceptance is not implied. Gate B pending. Gate C pending. Final release review pending.

## T01 execution and T06/T08 preparation

- Approved plan committed as 4f3573ec and pushed to ratibi/iOS.
- Implementation chat created: 01a20020-2b45-7073-91e5-77468ce4001f, GPT-6.2 Astra High. Product-code writer for both approved checkouts; orchestrator owns this ledger and external preparation.
- Prior iOS and database owners acknowledged handoff. Old signed build24 is waiting on older source c359e547 and is not the release candidate; no approval/dispatch requested for it.
- Fresh read-only SSH inventory retained privately at E:/Masarifi-ios-artifacts/production-release-20261122/runtime-inventory.private.json. Core API is healthy; Apple deletion worker running. Core recreation requires all11 existing Compose overlays including latest Apple secrets/code overlays. API role cap20; worker role cap25 with21 idle sessions at observation; PostgreSQL max_connections280. Isolated QA report worker/storage unhealthy.
- Production API /health/ready returned200 with database/queue up. Existing public English privacy returned200 but contains neither Apple sign-in nor Shortcuts disclosure; final legal candidate still required.
- Existing ASC record located in prior handoff: app6834811274, bundle com.masarifi.mobile. Do not create a duplicate. Metadata still requires live read-back and reviewer credential verification.
- Expo CLI authentication succeeded; recent EAS builds are historical internal artifacts, latest listed build18 from31d10370. Free-build quota verification pending.
- Browser access ended after Chrome control could not reliably verify current URL. No further browser input attempted. DNS/Clerk/ASC browser changes pending; code and SSH preparation can continue. This is an access limitation, not an approval requirement.
- Fresh EAS usage: owner masarifiratibi, Free plan, iOS15/15 used for1Nov-1Dec. No paid build dispatched. Existing public repository has protected ios-ad-hoc-signing environment with certificate/password/profile secrets and required reviewer + branch policy. T09 needs a reviewed Store export path, not reuse of the Ad Hoc profile.
- Device USB inventory returned an empty list; physical acceptance awaits connection. Owner asked asynchronously to connect/unlock the iPhone and sign into ASC without sharing credentials.
- Subsequent SSH probes timed out twice after the successful inventory. No firewall change attempted. Current operational access must be restored through the existing approved access procedure before host changes; no deployment occurred.
- T02 worker Gate A report and private manifest are at .superpowers/sdd/2026-11-22-dashboard-production-ios-submission/worker-gate-a/. GPT-6 Astra independent review dispatched. Migration trees already match (205 files); preserve five combined API files, per-platform mobile lockfiles, dashboard monitoring/QA fences, and mounted runtime overrides. Relevant CI failures require repair, not bypass.
- Gate A review accepted the scoped reconciliation. Carry into B/C: production QA flag absent, QA JWT acceptance isolated, correct-store cleanup, fresh live override parity, CI qualification and production artifact config. Never execute the retired cross-store lifecycle installer.
- Owner confirmed iPhone connected/unlocked and App Store Connect signed in; verify before use. No credentials were requested in chat.
