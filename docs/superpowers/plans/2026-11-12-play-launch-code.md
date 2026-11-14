# Play Launch Code Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for the integrated implementation. Independent public-page and disclosure tasks may use superpowers:dispatching-parallel-agents. Track verification and ownership in this file.

**Goal:** Close code-side Play readiness gaps and implement optional in-app plus external Android update notices, without building or publishing an application.

**Architecture:** Shared legal content feeds public pages. Versioned publication policy drives the mobile update notice and an eligible audience in the existing notification campaign pipeline. No database migration is required. Native build metadata reuses the existing locked `expo-application` module, now declared directly without installation or upgrade.

**Tech Stack:** Expo/React Native, Next App Router, NestJS, existing PostgreSQL notification delivery/provider infrastructure.

**Spec:** D:/Masarifi-integration-2026-10-10/docs/superpowers/specs/2026-11-12-play-launch-code-design.md

## Global Constraints

- No new build, deployment, customer notification, account deletion or production mutation.
- Preserve unrelated dirty files, owner isolation, current signing/Clerk identities, and automatic voice posting after valid consent.
- New policy is additive at a separate endpoint; old metadata contract remains unchanged.
- Announcements are opt-in via published configuration and existing campaign approval; no feature activation from this commit alone.

## Review Focus

- Same version name with a newer build must be detected; up-to-date or malformed versions must not prompt.
- Stale/cancelled publications and queued pushes must not announce unavailable releases.
- An iOS token belonging to an Android customer and a revoked/newer device must not receive the update push.
- A locked, offline, signed-out or owner-switched client must preserve data and allow ordinary recovery.
- Legal pages must render publicly even when authenticated Admin providers are unavailable; consent refusal must never begin capture or upload.

## Tasks and evidence ledger

### Task 1 — Public legal pages

- [x] Public SSR privacy/terms share current bilingual documents, correct public-provider routing and deletion/contact links.
- [x] Preserve verified deletion workflow and add truthful email request fallback.
- [x] Red/green public page and existing deletion tests; scoped typecheck/lint without build.

### Task 2 — Prominent disclosures

- [x] AI and tracking copy describes actual data/recipients/background use.
- [x] Owner/version-scoped voice consent before recording and withdrawal; assistant sends obey existing consent.
- [x] Red/green refusal, acceptance, owner-change and recovery tests; no changes to authorized posting behavior.

### Task 3 — Publication policy and update audience

- [x] Add disabled-by-default validated Android release configuration and dedicated `GET /api/v1/meta/mobile-update`.
- [x] Validate update campaign audience against the active published version/code and bind dispatch to the same policy.
- [x] Select only unrevoked eligible Android push tokens; test same-version build metadata and revoked/updated/publication-withdrawal cases.

### Task 4 — Mobile update UI and push route

- [x] Pure policy/version parser and pinned Play URL opener; timed fetch and safe unavailable behavior.
- [x] Themed optional Update now/Later prompt after usable startup, with per-release snooze and foreground recheck.
- [x] Public `/app-update` destination and strict update push mapping/tap handling.
- [x] Register installed build metadata within existing device contract; test version comparisons, fetch failure, snooze, navigation and store-open failure.

### Task 5 — Operator and Console handoff

- [x] Exact Console checklist and draft truthful Data safety/financial/SMS/App access answers; mark unknown publisher/test/certificate facts.
- [x] Release announcement runbook with publication prerequisites, approval, cancellation and no-send rehearsal.
- [x] Focused checks plus appropriate full tests/typechecks and fresh whole-change review. Keep build/device/hosting/Console acceptance pending explicitly.

## Final source verification

- Mobile: 627 suites / 5,169 tests passed; API full unit: 208 suites / 2,300 tests passed; Admin: 112 files / 1,070 tests passed.
- API focused aggregate: 158 passed, six actual-PostgreSQL cases skipped locally because the disposable target was stopped. Those runtime checks remain required before activating announcements.
- Typechecks, scoped client/web lint, API lint and mobile frontend-quality boundaries passed. Fresh independent review found no remaining actionable source findings after seven fixes and final integration corrections.
- See `docs/evidence/2026-11-12-play-launch-code/report.md`, `verification.json` and `source-manifest.json` for evidence and remaining operational acceptance. A completed code task is not a completed Play release: hosting, final binary/device tests, actual SQL acceptance, Console facts/declarations and Google review remain open. No new build/deployment/customer send occurred.
