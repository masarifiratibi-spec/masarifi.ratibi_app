# T19a live feedback route — native Admin amendment

The actual feedback list link reaches a Next page that validates only fixture-style IDs such as FDB-1001. The API returns UUIDs. The page therefore displays an error before making a feedback detail request. The previously qualified component tests did not traverse that page guard; the actual async page regression reproduced one failure and seven existing/safe-input passes.

The shared route validator now accepts a valid UUID or the existing narrow fixture format. It still rejects traversal, extra path/query content and unsupported IDs. The actual page, list, moderation and communications-contract suites pass29 cases; full Admin TypeScript and exact two-file lint pass. The deployed API already returns the correct detail fields, so no API image change is included.

## Exact prepared replacement

- Source overlay commit: 97662218cedd9202f15d70ee9ebe5236fd5deff9.
- Five named production overlays on the unchanged deployed01ae baseline: the previously approved four files plus communications/contracts.ts. The current immutable four-file release is retained.
- Build ID: rwReCYw14sWyGKZKt603e.
- Artifact manifest SHA256: 2e1526c56c1b72ea8008668bc4ed4d90036c9743788d8e4f62b095f0fda7e759.
- Final unit SHA256: edb4cc7826fcc19478ab43ed5fb972d692623ece42790a527e0d95d5b804d58f.
- Runtime proposal SHA256: c4682986e00c4bb6d5f8b9f1378b50b322e1aaf9403e069cc7254aa39b8dd33e.
- [Exact JSON request](2026-10-30-T19a-admin-route-id-addendum.json), SHA256 64ddaf536ae2101fbab143e16830d7ec26c99aab2a36e179f54cf6c1d37d5849.

The actual replacement passed16 cases across four suites, strict native production TypeScript and generation of85 static pages. Its original monorepo test dependency paths are present. Installed dependencies were copied independently without package installation. Both existing native Admin services and all36 Docker services remained unchanged; the candidate has not been started and Nginx has not changed. Unit syntax and current Nginx syntax passed.

## Requested action

Start only the exact candidate on loopback3038 with the existing application user, authentication environment and security protections. Retain current3037 and original3036. After exact artifact/build/runtime checks, replace only the Nginx upstream3037 with3038, validate and reload. The before/after source hashes, resolved target and metadata are pinned in the JSON.

Use the same120-second deadline and begin rollback by70seconds on uncertainty. The public probe may briefly observe only the known current build during reload; it must settle to the exact new build within its bounded check and reject any unknown version. Rollback restores the exact5055 configuration and current3037 marker; stop only3038 gracefully, without SIGKILL. Require fresh host and original client draft/financial/native/APK/Metro preservation gates.

After health passes, continue the separately approved existing single feedback record through Review, Plan, Resolve and Close with its approved audit reason and fresh versions, then verify the same owner sees the final state. There is no new message or record. Existing recent-authentication requirements remain enforced. The absent ordinary-role assignments still prevent claiming a complete hosted role matrix.

The previous native approval pins a different build and3037. This amendment is required for the additional route source file and exact new artifact/3038 handover. No financial mutation, ZIP, PDF/download/window, provider question, database/role change, API or Production deployment, APK/Metro restart orT20–T22 work is included.
