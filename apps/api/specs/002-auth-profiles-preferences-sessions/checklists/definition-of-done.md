# Definition of Done — SPEC-BE-002

- [x] Backend implementation exists on the existing `codex/backend-spec-be-002` delivery branch without a new worktree.
- [x] Mobile/Admin source remains unchanged.
- [x] Local schema/RLS/contract/unit/integration/security/E2E coverage exists for owned behavior.
- [x] No Supabase Auth user/session table, legacy Clerk JWT Template code, Admin route/role, or client secret wiring was introduced.
- [ ] Clerk SMS restriction for exactly Egypt/Saudi Arabia/UAE is provider-verified.
- [x] Android Development SHA-256 and the sole `masarifi://oauth-callback` redirect are configured.
- [ ] Apple Team ID is still required to complete iOS Native Applications.
- [x] Clerk native Supabase integration is enabled and the legacy JWT Template list is empty.
- [ ] Hosted Supabase still needs the exact Clerk domain plus a real asymmetric owner/non-owner test.
- [ ] Two Phone and one Google protected aliases pass the full matrix.
- [x] Container, dependency, SAST, and secret/history/image gates pass locally.
- [ ] Authenticated/provider-backed release validation passes; remaining k6/stress is explicitly skipped by the user and is not counted as a pass.
- [x] Delivery commit `056640f` is pushed to `origin/codex/backend-spec-be-002` without force or merge.
- [ ] Remote CI/SBOM/vulnerability/signature/provenance results pass.

Current status: the local implementation, clean database/migration recovery,
security/container, local outage recovery, and runbook tabletop gates pass. Release
remains blocked by hosted Supabase Dashboard configuration, iOS/SMS/provider
inputs, real identities/tokens, a deployed webhook URL/secret store, and remote CI.
Remaining k6 was skipped by explicit user instruction and is not reported as pass.

Latest local verification (2026-08-28): live `npm run verify` passed (171 unit, 83 contract, 48 integration, 18 E2E, 50 security); pgTAP passed 308 assertions; the rebuilt release image passed 9 container assertions.

Final local scope review (2026-08-28): current branch is
`codex/backend-spec-be-002`; `git diff --check`, client-diff,
migration-checksum, ownership-path, worktree-secret, and full-history-secret checks
pass. The ignored local `apps/api/.env` contains only the approved non-secret domain
and localhost origin; secret fields remain empty. The unrelated untracked
`.agents/plugins/` entry remains untouched. Only SPEC-BE-002-owned API/Supabase
paths are staged (114 files, with zero staged client paths or secret values); no
worktree or merge is used.

Delivery evidence (2026-08-28): implementation commit `056640f` was pushed to
`origin/codex/backend-spec-be-002`. The remote workflow does not run for a plain
push to this branch, so remote release evidence remains open; no PR or merge was
created.
