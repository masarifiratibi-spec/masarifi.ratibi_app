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

## Access restored and current preparation

- Verified the connected USB iPhone (iPhone18,3, iOS27.2.1). Existing Store provisioning profile expires6November2027, matches38MAL5945T.com.masarifi.mobile, has no device list, disables debugging and uses production APNs. Final archive/profile/certificate binding remains T09.
- Browser access recovered on the owner's explicit retry. Hostinger console proved SSH active/listening and UFW default incoming deny; current client77.232.122.51 was absent. Two independent public-IP checks matched. Owner explicitly approved exactly77.232.122.51/32 to187.77.81.97:22/tcp; one rule added and strict existing-key/known-host SSH then succeeded. No other rule, key or service changed.
- Fresh runtime inventory: E:/Masarifi-ios-artifacts/production-release-20261122/runtime-inventory-restored.private.json. Core healthy; deletion worker running; worker DB login21idle/25maximum. No application deployment performed.
- Current live readiness modules match the pinned pre-change source after line-ending normalization; health module/service match exact bytes. The optimized readiness dependency module is absent. Local emitted candidates are preparation only; runtime/DI/fleet qualification and Gate C remain.
- Both isolated QA report containers inherit an inappropriate API healthcheck on3000/health/live. Storage actually answers8080/health/ready with200 ready; worker has no HTTP server, is running with zero restarts, and no known failure markers appeared in the last100log lines. These facts do not prove worker progress. Implementer notified to qualify correct checks/heartbeat in T05.
- Fresh production AI roster: assistant GPT-6 Luna via Azure with Gemini3.1FlashLite via Google Vertex fallback; voice Gemini3.5FlashLite via Google Vertex. Both enabled with ZDR required; four other AI workloads disabled. Private roster supplied to implementer for final privacy copy.
- Owner completed a fresh ASC sign-in. Live app6834811274/com.masarifi.mobile/version1.0 remains Prepare for Submission with manual release selected and no build selected. Arabic primary, Finance/Productivity, AR draft metadata present, reviewer credentials empty. Availability16countries: Algeria, Bahrain, Egypt, Iraq, Jordan, Kuwait, Lebanon, Libya, Mauritania, Morocco, Oman, Qatar, Saudi Arabia, Tunisia, UAE,Yemen. France/China not selected. Mac/Vision Pro availability toggles currently checked; native release qualification still required.
- New age questionnaire Shared Location answer is missing; source review supports No, as for Dating. No age/privacy declarations changed yet. GPT-6 Astra T08 audit saved outside Git at E:/Masarifi-ios-artifacts/production-release-20261122/store-privacy-audit.md. SQLCipher is non-OS encryption; final archive export determination pending.
- Owner proposed the Apple project account for reviewer access. Explained that publishing administration credentials must not be put in ordinary app reviewer fields; dedicated ordinary reviewer access remains unresolved. No credential copied or shared.
- Production API inherits global Nginx combined access logs; logging is disabled only for storage capability URLs. Core logs use journald with7day retention/1GB cap. Runtime diagnostics/privacy reconciliation remains in progress.
- Domain preparation completed at01:35Riyadh: added only A/admin187.77.81.97/TTL300 after reading the complete10-record zone; existing Clerk/DKIM/service records preserved. Public resolver1.1.1.1 and the VPS resolve the new address. Previous zone recorded privately in dns-before.json; UI export attempt did not yield a verified artifact.
- Reused the existing Let's Encrypt account to issue admin.masarifiratibi.com certificate, expiring19February2027. New isolated Nginx vhost /etc/nginx/sites-available/masarifi-admin-release-20261122.conf serves HTTP301 to HTTPS and an intentional uncached503 preparation response; it does not route to the dashboard yet. nginx-t passed, public TLS validation passed, API readiness remained200. Config SHA25638b5cb2f18289a80bb472015e88c08f16996b32f3f7ac2a31fbb8a7fbefd9890. Scripts/private evidence retained outside Git; existing vhosts unchanged.
- Independent runtime preparation review warns that primary pool totals omit secondary API/worker pools and dedicated listeners. These must be included before Gate C. No connection limits, pool settings or idle sessions changed. Offline compiled readiness DI harness preparation is ongoing.
