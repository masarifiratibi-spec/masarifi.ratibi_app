# Foreign Tracking isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore access for the verified Google account without reading, adopting, clearing or running another owner's retained Tracking work.

**Architecture:** A small independent Tracking admission store records confirmed foreign-state isolation. The Tracking reset participant alone accepts its typed, confirmed-isolation outcome; other authentication failures propagate. Central storage/native/service boundaries deny all Tracking operations and destructive cleanup during isolation, while authoritative financial account bootstrap proceeds normally.

**Tech Stack:** Existing TypeScript, Zustand, Expo native module and Jest; no new dependencies or hosted changes.

**Spec:** `docs/superpowers/specs/2026-11-04-auth-foreign-tracking-isolation-design.md`

## Global Constraints

- Preserve all active-session, authoritative profile, database-owner, App Lock, logout and deletion checks.
- Preserve retained context bytes, generations, encrypted queues, keys, sessions, pending work and unrelated source/docs.
- Same repository and `codex/voice-promoted-operating-2026-10-13`; user requires this workspace/branch, no worktree switch.
- No app clear/uninstall/sign-out, hosted mutation, production activation, performance work or protected Metro restart.
- Build/install only through reconciled guarded scripts; actual Redmi behavior is mandatory.

## Review Focus

- Native B metadata mismatches JS B: reject, never infer continuity from suspension alone.
- Owner/logout changes during async assessment: reject stale isolation publication.
- Direct queue, source preferences and native acknowledgement calls: fail before reads/mutations.
- Local reset/default identity reset/logout: preserve B and reject before destructive operations.
- Returning to verified B: normal continuity may recover Tracking; no sticky or arbitrary admission.

### Task 1: Isolation contract and guarded application boundaries

**Files:** Create `apps/mobile/src/state/tracking-admission.ts`; modify `services/tracking-background-runtime.ts`, `automatic-tracking-coordinator.ts`, `live/automatic-tracking-service.ts`, `tracking-source-preferences.ts`, native-facing bank notification adapter, `storage/sms-import-queue.ts`, `storage/local-data-reset.ts`, `storage/runtime-user-data-reset.ts`, `services/owner-lifecycle.ts`, `features/tracking/TrackingStatusScreen.tsx`, and locale dictionaries. Extend existing Tracking/native/storage/UI tests at their real seams.

**Interfaces:** Admission store exposes `isolatedForOwnerId: string | null`, `isolateTrackingForOwner(ownerId)`, `clearTrackingIsolation()`, `assertTrackingAvailable()`. Restoration exposes a typed confirmed-foreign isolation failure handled only by its registered reset callback. Existing callers keep their signatures.

- [ ] Add a real AppShell restoration regression: verified A + valid retained B + native PRESERVED admits A/profile complete, preserves B bytes/notifications and keeps intake blocked. Run it and record expected RED.
- [ ] Implement the typed outcome after native B owner/generation PRESERVED, unchanged raw and current generation/owner; handle only that outcome in Tracking's callback. Keep malformed/ambiguous/capability/suspension errors fatal.
- [ ] Add boundary regressions for queue/source/native operations, coordinator/service admission, reset/logout and races. Watch each missing behavior fail before adding the corresponding guard.
- [ ] Add a clear Arabic/English unavailable Tracking screen before any Tracking content hooks mount. Verify it exposes no tracking controls or destructive recovery.
- [ ] Run targeted Jest regressions, TypeScript, lint and frontend boundaries. Independently review production/test diffs with clean-code-guard/test-guard and a fresh reviewer.
- [ ] Commit only scoped code/tests and relevant English design/evidence, with no private logs/identities or unrelated historical docs.

### Task 2: Required validation and actual Redmi delivery

**Files:** Private evidence under `.superpowers/sdd/2026-11-04-auth-foreign-tracking-isolation/`; update the English release/investigation report and delivery identity only with observed results.

**Interfaces:** Task 1's committed canonical source is overlaid by the existing guarded ordinary Staging builder. Installed and delivered APKs must match its exact source/bundle/certificate identity.

- [ ] Run full mobile tests and required source checks once for the final implementation; capture exit receipts and report pre-existing warnings honestly.
- [ ] Build one clean ordinary ARM64 Release with current source, original certificate, diagnostics off and App Lock on; confirm cached source/native restoration and qualification.
- [ ] Install in place, preserve package metadata and observe real account entry on Redmi. Test safe navigation and the visibly isolated Tracking state without financial/provider mutations, logout, recording or old work replay.
- [ ] Verify actual installed/delivery hashes, bundle/source provenance, absence of temporary observers/Benchmark bindings and protected Metro/reverses.
- [ ] Replace delivery only after device acceptance, update truthful English limitations, secret-scan scoped changes, push the same branch without force and verify the remote SHA.
