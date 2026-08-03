---
description: "Task list template for Masarifi Admin Web features"
---

# Tasks: [FEATURE NAME]

**Input**: `specs/[###-feature-name]/spec.md` and `plan.md`  
**Scope**: Existing `apps/admin-web` frontend only  
**Tests**: Required for changed behavior

Every task MUST use:

```text
- [ ] T001 [P?] [US?] Imperative description with exact file path
```

- `[P]` is allowed only when tasks touch different files and have no incomplete dependency.
- `[US1]` labels are required for user-story phases.
- No task may initialize a project or implement backend, database, provider, or real-authentication code.

## Phase 1: Existing Project and Contract Review

- [ ] T001 Inspect and record the existing routes, components, tokens, assets, and configuration reused by this feature in `specs/[###-feature-name]/plan.md`
- [ ] T002 Map the feature to its approved phase, planned backend modules, and entities in `specs/[###-feature-name]/plan.md`
- [ ] T003 Record baseline typecheck, lint, test, and build commands in `specs/[###-feature-name]/quickstart.md`

---

## Phase 2: Frontend Foundations

- [ ] T004 Define strict frontend contract types in `[exact src path]`
- [ ] T005 Define the typed service or repository boundary in `[exact src path]`
- [ ] T006 Add Mock Service Worker handlers for specified scenarios in `[exact src path]`
- [ ] T007 Add shared loading, empty, error, success, warning, and permission behavior in `[exact src path]`
- [ ] T008 Define Zod validation and normalization for all untrusted feature inputs in `[exact src path]`
- [ ] T009 Record frontend UX controls and deferred production authorization in `specs/[###-feature-name]/plan.md`

**Gate**: Pages MUST NOT import raw mock arrays, no backend runtime may be
introduced, and mock permissions MUST NOT be represented as production security.

---

## Phase 3: User Story 1 — [Title] (P1)

**Goal**: [operator value]

**Independent test**: [observable outcome]

### Tests

- [ ] T010 [P] [US1] Add Vitest coverage for the typed service, validation, safe input handling, state handling, masking, RTL/LTR, and permissions in `[exact test path]`
- [ ] T011 [P] [US1] Add Playwright coverage for approved viewports, keyboard flow, access denial, and sensitive-action confirmation in `[exact test path]`

### Implementation

- [ ] T012 [US1] Connect the existing approved page/component to the typed hook and service in `[exact src path]`
- [ ] T013 [US1] Implement all relevant UI states without redesigning the approved interface in `[exact src path]`
- [ ] T014 [US1] Apply masking, pending-mutation locking, and accessible confirmation behavior where required in `[exact src path]`
- [ ] T015 [US1] Implement specified safe rendering, storage, link, redirect, upload, error, and logging controls in `[exact src path]`

**Checkpoint**: User Story 1 is independently testable and constitution-compliant.

---

[Repeat one phase per additional necessary user story. Tests remain mandatory.]

## Final Phase: Hardening and Verification

- [ ] TXXX Verify Arabic RTL and English LTR behavior at 1440px, 1280px, 1024px, 768px, and 390px
- [ ] TXXX Verify keyboard navigation, visible focus, semantic HTML, accessible names, contrast, and reduced motion
- [ ] TXXX Confirm application code contains no `any`, no direct page-level mock arrays, and no avoidable raw colors
- [ ] TXXX Review sensitive-data exposure, rendering, validation, permissions, storage, public environment values, errors, logs, dependencies, and privacy masking
- [ ] TXXX Document security limitations and deferred NestJS, Supabase, infrastructure, and provider protections
- [ ] TXXX Run and record the actual typecheck command and result
- [ ] TXXX Run and record the actual lint command and result
- [ ] TXXX Run and record the actual Vitest command and result
- [ ] TXXX Run and record the actual Playwright command and result
- [ ] TXXX Run and record the actual production build command and result

## Dependencies

- Phase 1 precedes all other work.
- Phase 2 blocks user-story implementation.
- User stories follow the approved 10-phase Admin frontend sequence and their documented dependencies.
- Final verification runs only after all in-scope stories are complete.

## Completion Rule

Do not mark a verification task complete or claim success unless its command or
procedure was actually executed successfully.
