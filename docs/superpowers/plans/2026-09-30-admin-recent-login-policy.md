# Admin recent Clerk login policy implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline; one fresh final review, not per-task delegation.

**Goal:** Govern privileged Admin mutations with valid recent Clerk authentication and existing RBAC, without requiring MFA.

**Architecture:** Keep the existing Clerk authentication guard and canonical permission evaluator. Rename the shared Admin metadata from `recentMfa` to `recentAuth` and check signed first-factor age, including service/database boundaries. Preserve the existing 600-second window, audit, reason/confirmation, idempotency, ownership and last-Super-Admin protections. No new configuration switch or credential.

**Tech Stack:** NestJS/TypeScript, Clerk, PostgreSQL, Next.js, Jest/Vitest, existing exact-SHA Staging release pipeline.

**Spec:** Owner request in this chat, 2026-09-30: signed-out/unprivileged callers denied; stale authentication denied; recent valid Clerk login allowed without an MFA claim; RBAC and protected mutations unchanged. After verified Staging release, resume the already approved Voice activation/canaries.

## Global constraints

- Production and all credentials untouched; no Clerk MFA purchase/enrollment/configuration.
- Existing OpenRouter key, USD 2 key/global limits, exact Gemini Voice models, approved Vertex association/routing, ZDR and guardrail policy unchanged except already approved pending governed association.
- No uninstall/clear-data, private phone extraction, automatic transaction confirmation or blocked diagnostic repeats.
- Existing current codex branch is authorized by the continuation handoff; preserve five untracked handoffs and use isolated local database fixtures only.

## Review focus

- Fresh token with stale signed authentication age must fail; missing/negative/nonfinite age must fail closed.
- Missing MFA or fresh MFA must neither deny a recent login nor rescue a stale login.
- Every existing privileged route keeps its exact permission and recent-authentication requirement.
- Security/invitation and engagement service/database checks use the same first factor, preserving audit and owner protections.
- UI confirmation/idempotency/RBAC eligibility stays intact and stale authentication still requests reauthentication.

## Task 1: Atomic security policy change

- [x] Add regression cases to existing Admin guard/security-service tests, a real-guard HTTP test for governed Voice mutation, and UI invitation copy/eligible-action coverage. Run RED against current source.
- [x] Rename shared Admin metadata and all route consumers/contracts to `recentAuth`; use first-factor age with the existing time window. Update service/invitation and engagement handoff checks; keep MFA status optional and truthful.
- [x] Update UI copy/default mock policy and current operational documentation; preserve reasons, permissions and action contracts.
- [x] Run scoped RED-to-GREEN checks, full API unit/contract/security/e2e as appropriate, real isolated database governance/ownership/audit regressions, Admin tests/static/build checks and API/Worker/migration builds.
- [x] One fresh whole-change review; one fix pass for any important findings, each RED-to-GREEN. Commit intentional files only.

## Task 2: Exact-SHA Staging release and pending Voice acceptance

- [ ] Push exact verified SHA to `ratibi/codex/masarifi-staging-environment`, dispatch existing `run_k6=false` workflow, wait all applicable gates, read immutable artifact digest.
- [ ] Deploy only changed Staging services and built Admin artifact from exact source; preserve environment files and verify live/ready/database/queue/Worker health and versions.
- [ ] Reauthenticate normally if first-factor age exceeds 600 seconds. Apply approved governed Voice associations/allowlist, pass existing corpus evaluation and publish; enable only authorized Staging runtime flags and compliant Voice route after preflight report.
- [ ] Resolve the measured account-create blocker through normal code/API flow; preserve its approved zero-balance fixture and idempotency key.
- [ ] Bounded Arabic/English Voice canaries, review/cancel and transaction-count comparison, then matching APK/Samsung recording/upload/analysis/review acceptance. Human speech/security inputs remain genuine checkpoints; exact-schema/provider failure requires a measured stop before unapproved changes.
