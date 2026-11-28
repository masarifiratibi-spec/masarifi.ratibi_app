# Single Main Consolidation Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task-by-task in the current session. Steps use checkbox syntax. This document authorizes no execution: the current user request is planning only.

**Goal:** Maintain one permanent source branch, `main`, capable of building Android, iOS, API and Admin, with temporary feature branches and independently selected releases.

**Architecture:** Keep platform differences in platform files, capability checks and build profiles inside one repository tree. Main is the shared source reference, not a pointer that production automatically follows. Record each deployed service and store artifact against an immutable source commit and artifact identity.

**Tech Stack:** Expo 55 / React Native, TypeScript, NestJS, Next.js, PostgreSQL, Docker, GitHub Actions, EAS and Xcode.

**Spec:** User requirements recorded below under Global Constraints; current implementation evidence in `docs/project/ai-handoff-ar.md` and the pinned source comparisons below. Existing three-branch instructions describe the old policy and must only be replaced when consolidation qualifies.

## Global Constraints

- Plan first. No application edits, merge, commit, push, branch deletion, signing, store submission or server changes during this planning turn.
- Use only main and the three explicitly approved source lines. Do not import content from other historical branches.
- Preserve current Android behavior; retain additional assistant text consent on Apple only. Preserve the existing comment saying the Apple prompt may be reconsidered in a later release; do not remove it now.
- No automatic production activation on push or merge. No production database tests or migrations during consolidation.
- Preserve unrelated local changes and all existing worktrees. Do not reset, clean, stash or delete other people's work as a shortcut.
- Do not weaken ownership, validation, consent, signing or secret-scanning checks to make consolidation pass.
- Distinguish source qualification from device acceptance, signed artifacts and actual customer availability.

## Verified baseline — 2026-11-28, Asia/Riyadh

Remote refs were read from `ratibi` (`masarifiratibi-spec/masarifi.ratibi_app`), not the unrelated historical `origin` repository.

| Ref | Full commit | Local worktree |
|---|---|---|
| main | 81736959a41833e235701182729383b1987ad66a | D:/Masarifi-main-20261128 |
| codex/voice-promoted-operating-2026-10-13 | 81736959a41833e235701182729383b1987ad66a | D:/Masarifi-integration-2026-10-10 |
| codex/google-play-release-2026-11-24 | f00e5de695ad0c83dec6845b0f7ed4681153f758 | D:/Masarifi-play-release-20261124 |
| iOS | 837ec4358c8531e8acd062b8a260a60baa3aac93 | E:/Masarifi-iOS |

- Main and operating are identical. Main versus Play: 22 paths. Main versus iOS: 321 paths, including evidence and documents; these are not counts of missing features.
- Main includes recent API lint, migration-inventory and container security fixes absent from the two platform heads. Never restore their older backend or Docker tree over main.
- Main mobile depends on Zod `^3.23.0`; iOS pins `4.6.7` and includes schema/call-site changes. This is a real shared validation decision, not an Apple-only configuration change.
- Play adds the production Firebase sender and tracking layout adjustments. iOS adds Apple authentication, Shortcuts modules, store profiles, native qualification and other shared UI/service changes.
- `iosTextConsent` on iOS already checks `Platform.OS === 'ios'` and contains the requested future-review comment.
- Existing project guides still direct agents to the operating branch. They are not yet accurate instructions for a single-main workflow.
- Last production observation from the preceding audit: API version `97e66588b2b516ae8c67e285f8439be591439dd6`; this planning task did not query or change production. That API version alone does not establish the source of every other service.
- Exact candidate qualification passed before main promotion. Main's repeat Backend Foundation run `46138362070` was still in progress when inspected for this plan; do not describe it as passed without checking its result.

## Review Focus

1. Android accidentally receives Apple consent or native modules: exercise both OS selections and build both native targets (tasks 3–5).
2. Zod changes reject existing stored records or API payloads: preserve baseline validation behavior and replay representative valid/invalid fixtures (task 3).
3. An old release branch rolls back current API/Docker fixes: require byte-identical protected shared directories against the baseline (tasks 2 and 5).
4. Signing or deployment starts on push, PR or archive tag: audit event conditions and enforce explicit manual release paths (tasks 1 and 4).
5. A branch or dirty worktree contains unique unrecorded work: capture pinned backups and per-path disposition before retirement (tasks 1, 2 and 6).

## Task 1: Capture recoverable inputs and isolate integration

**Files:** Create `docs/project/single-main-inputs.md` and a Git bundle outside the working tree, with checksum and `git bundle verify` evidence. Read local status without dumping environment files or secrets.

**Inputs/outputs:** Consumes the four pinned refs above; produces a verified source manifest, backup receipt and isolated temporary integration branch.

- [ ] Refresh only approved refs from ratibi and compare their SHAs with this plan. If any moved, regenerate the affected comparison before selecting changes.
- [ ] Check tracked and untracked status in the approved worktrees, including the independent D:/Masarifi-iOS clone if present. Record unique uncommitted work as pending; do not silently omit it or copy secrets into the backup.
- [ ] Create and verify a bundle containing the four approved committed refs; record its file checksum and demonstrate the commits can be resolved from a temporary restored repository.
- [ ] Create `codex/unify-platforms-on-main` from the verified main SHA in a new isolated worktree, using the git-worktrees skill. Do not switch any existing dirty worktree.
- [ ] Read the final result of main's repeat CI. Review any failure before using the baseline as qualified.
- [ ] Recheck push/PR/tag workflow effects before any later remote action. Keep archival markers local until tag-trigger behavior is reviewed; do not use release tag patterns for backups.

## Task 2: Account for every platform difference

**Files:** Create `docs/project/single-main-decisions.csv`; read `docs/project/branch-differences.csv` as historical evidence, not the current inventory.

**Inputs/outputs:** Consumes the pinned heads; produces one disposition per changed path: keep-main, import-platform, reconcile-shared, or preserve-as-historical-evidence, with source SHA and verification owner.

- [ ] Generate fresh `git diff --name-status` inventories for main versus each platform head and inspect file contents and relevant history. A timestamp alone is not evidence that one implementation is correct.
- [ ] Mark `apps/api`, `apps/admin-web`, `packages`, `supabase`, `ops` and `docker` as protected baseline areas. Any requested functional deviation becomes a separate reviewed change, not an incidental branch merge.
- [ ] Identify shared UI/date/auth/storage behavior mixed into iOS changes and test it independently from platform additions. Preserve historical release receipts with their original dates and source pins.
- [ ] Record differences and explicit decisions for app.config.js, eas.json, dependency manifests, assistant consent, Shortcuts, RTL/layout and secret-scan metadata. Do not bulk-import a gitleaks allowlist.
- [ ] Verify every current diff path has a disposition; unexplained unique work blocks retirement.

## Task 3: Build one mobile source with explicit platform behavior

**Files to reconcile:** `apps/mobile/app.config.js`, `apps/mobile/eas.json`, `apps/mobile/package.json`, `apps/mobile/package-lock.json`, `apps/mobile/src/design-system/direction.ts`, `apps/mobile/src/design-system/components/overlays/AppSheet.tsx`, and the reviewed paths listed in the decision manifest.

**Platform sources to import/reconcile:** `apps/mobile/google-services.production.json`, `apps/mobile/modules/masarifi-bank-sms/**`, `apps/mobile/plugins/with-bank-sms-intent.cjs`, `apps/mobile/src/services/platform/*ios*`, `apps/mobile/src/storage/ios-text-consent.ts`, Apple authentication/capture routes and their tests.

**Tests:** Existing Firebase, iOS profile/store, bank SMS, consent, storage and financial contract tests; add focused regression cases to the owning test files when missing. No blanket snapshots that merely encode the new implementation.

**Inputs/outputs:** Consumes task 2 decisions; produces one lockfile and source tree with separately selectable Android and Apple build profiles.

- [ ] Add regression cases asserting Android production selects its existing Firebase sender, retains SMS/notification tracking, and does not show the additional Apple assistant prompt.
- [ ] Add/retain Apple cases for Sign-In, Shortcuts receipt deduplication, explicit text consent/refusal/withdrawal, and account switching. Keep the existing future-review comment in ios-text-consent.ts.
- [ ] Preserve Android's baseline Zod dependency for this consolidation. Adapt imported Apple schema syntax against that dependency and run stored-data/API fixture compatibility tests. If Apple functionality requires incompatible semantics, stop that dependency change and present the concrete failing cases; do not silently upgrade Android to Zod 4.
- [ ] Combine config profiles without changing bundle/package identity, Firebase project, API destinations, signing requirements or store build-number policy. Verify Apple-only hooks do not invoke Swift tooling on Android/Linux installs.
- [ ] Reconcile shared layout/service fixes individually; exercise Arabic RTL, English LTR, large text, account isolation, monetary values and dates on both OS modes.
- [ ] Run from apps/mobile: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run check:frontend-quality`, `npm run test:dependency-security`, and `npm test -- --runInBand`. Run imported configuration/native script tests through their inspected existing commands. Commit coherent reviewed units on the temporary branch only.

## Task 4: Qualify main without coupling it to deployment

**Files:** `.github/workflows/backend-foundation.yml`; import/reconcile `.github/workflows/ios-native-qualification.yml`; associated `apps/mobile/scripts/ios-release-policy.cjs`, `ios-store-config.test.mjs`, `ios-ad-hoc-config.test.mjs` and release scripts; add `scripts/integration/single-main-workflow-policy.test.cjs` for the event boundary.

**Inputs/outputs:** Consumes the unified tree; produces CI supporting PR/main qualification and manual release workflows with exact source pinning.

- [ ] Replace old active branch restrictions deliberately: PRs and main run qualification; signed exports remain manual with their protected environment and expected full source SHA. Update existing branch assertions in scripts and tests together.
- [ ] Make ordinary PR/main qualification include Android build and unsigned iOS compilation on a macOS runner. Windows-only checks cannot establish iOS native build success.
- [ ] Test push, PR and archive-tag event cases: none may deploy services, migrate production, submit to stores or sign/export an IPA. Manual image publication/export remains a distinct action with explicit inputs.
- [ ] Inspect repository default branch, rulesets and environment protections. Propose exact main protections using existing available permissions: PR review, required checks, no force push/deletion. Do not invent an admin capability or bypass a protection when permissions are missing.
- [ ] Verify external integrations still do not deploy on push before uploading the integration PR. Keep environment credentials out of fork/PR jobs.

## Task 5: Prove the combined candidate and promote it

**Files:** Update `docs/project/verification.md`; create `docs/project/single-main-acceptance.md` with source SHA, commands, results, artifacts and unmet gates.

**Inputs/outputs:** Consumes tasks 1–4; produces a qualified combined candidate and promotion receipt.

- [ ] Run `git diff --exit-code 81736959a41833e235701182729383b1987ad66a HEAD -- apps/api apps/admin-web packages supabase ops docker`; expect no output and exit 0, unless a separately approved change is documented.
- [ ] Obtain green Backend Foundation and iOS native checks on the exact candidate. Database jobs use disposable local/CI PostgreSQL only. If schema/source does not change, do not run tests against the production database merely to repeat proof.
- [ ] Build Android and unsigned iOS from the same candidate; inspect application IDs and release profiles. Exercise device smoke cases for login, transaction save/sync, Android tracking, Apple Shortcuts, consent and RTL. Missing device/macOS access remains an explicit acceptance gap.
- [ ] Review the actual PR diff and compare the tested merge tree to the tree intended for main. Follow main protections; do not force-push or merge stale old main contents.
- [ ] After the authorized merge, record the resulting main SHA/tree and verify its tree matches the accepted candidate. Unlike the earlier operating-to-main promotion, main versus the OLD platform heads is expected to differ: required proof is preserved platform behavior and accounted-for changes, not zero diff with old releases.
- [ ] Perform a read-only production health/version check before and after remote promotion. A source merge must not activate new server code.

## Task 6: Update AI instructions and retire redundant branch roles

**Files:** `AGENTS.md`, `apps/mobile/AGENTS.md`, `docs/project/README.md`, `docs/project/ai-handoff-ar.md`, `docs/project/status-ar.md`, `docs/project/features.md`, `docs/project/audit.md`, `docs/project/verification.md`, `docs/project/branch-differences.csv`; create `docs/project/release-workflow.md` and `docs/project/deployed-versions.md`.

**Inputs/outputs:** Consumes successful combined qualification; produces current instructions, independently versioned release records and a branch-retirement receipt.

- [ ] Update active instructions to main as canonical shared/platform source and temporary `codex/<task>` branches. Mark old three-branch guidance as superseded without rewriting dated historical evidence.
- [ ] Record API, worker, Admin, Android and iOS separately: observed source SHA, immutable artifact digest/build number, environment/channel, verification date and rollback target. Use unknown where live evidence is missing; do not copy the API SHA into every service row.
- [ ] Document routine flow: branch from main → implementation → review/checks → merge → isolated staging qualification → separately approved release of the exact tested artifact. Staging is an environment, not a permanent source branch; runtime feature flags default off for unfinished behavior.
- [ ] Verify backups, path decisions, dirty-work preservation, branch references and signing workflow migration before proposing deletion of the operating, Play and iOS branches. Preserve local worktrees until their owners' changes are accounted for. Branch deletion is the final separately reviewed action; no branch deletion is part of the planning turn.
- [ ] Document rollback: before promotion, abandon only the isolated candidate; after promotion, use a reviewed revert PR. Production remains on its old artifact until separately deployed. After a future deployment, rollback requires artifact and database compatibility checks, not a blind Git reset.

## Exit criteria and boundaries

- One permanent active source branch, main; short-lived task branches are expected and deleted after successful delivery.
- Both mobile targets are qualified from one tree with Android behavior preserved and Apple consent retained.
- Current backend fixes remain present; API/data tests and image/security checks are green on the combined candidate.
- Deployment remains separate from source integration. This plan does not include production deployment, production data migration or store submission.
- No promise of zero risk: backups, regression tests, exact artifact records and reversible promotion provide the safety evidence.
- This file is a draft plan only, saved locally and not committed or pushed. Execution requires the user's subsequent instruction.
