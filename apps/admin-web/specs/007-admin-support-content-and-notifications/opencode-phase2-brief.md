<task>
Work in D:\MY Work\0Part_Time\MASREFY _Final\apps\admin-web.

Complete only Phase 2: Frontend Foundations for Spec 007 Support, Feedback, Content, and Notifications.

Selected tasks to complete and mark [X] in specs/007-admin-support-content-and-notifications/tasks.md after their own verification succeeds:
- T006 Add real failing strict-schema tests in src/features/communications/contracts.test.ts for shared IDs, masked references, pagination, safe errors, Unicode NFC, code-point limits, UTF-8 KiB limits, bidi/control rejection, attachment metadata, action context, and unknown-field rejection. Tests must import production schemas from src/features/communications/contracts.ts, not redeclare local schemas.
- T008 Add the 22 Phase 6 navigation entries and route permission requirements without changing existing entries in src/components/admin/AdminShell.tsx and related existing navigation/route permission files only if that is where the current app stores those rules.
- T009 Implement shared strict Zod schemas and exported TypeScript inference for T006 in src/features/communications/contracts.ts. Reuse src/features/shared/admin-schemas.ts only where compatible.
- T010 Add real failing state tests in src/mocks/phase6-communications-state.test.ts for fixed/injected 2026-07-29T12:00:00+03:00 clock, immutable initial snapshots, revision increments, audit references, pending-action keys, and full reset behavior. Tests must import production state helpers.
- T011 Implement only the shared clock, snapshot cloning, revision/audit helpers, pending-action lock, and reset boundary required by T010 in src/mocks/phase6-communications-state.ts. Do not use Date.now() or Math.random().
- T012 Add real failing repository tests in src/features/communications/repository.test.ts for query-key structure, URL encoding, strict response parsing, safe error parsing, targeted invalidation, and no direct fixture access.
- T013 Implement the shared /api/v1/admin request helper, query serialization, response validation, and safe error mapping in src/features/communications/repository.ts. Reuse the existing Admin API client/error style where practical.
- T014 Add real failing hook tests in src/features/communications/hooks.test.ts for deterministic query keys, enabled guards, useLockedMutation, resource/action lock keys, focused invalidation, and retained form data after rejection.
- T015 Implement the shared Phase 6 query-key factory and mutation wrapper in src/features/communications/hooks.ts. Reuse src/features/foundation/useLockedMutation.ts.
- T016 Add real component tests in src/features/communications/shared/CommunicationShared.test.tsx for plain-text rendering, loading/empty/partial/unavailable regions, permission denial, labelled filters, confirmation focus restoration, pending state, live success/error feedback, RTL/LTR direction, and reduced motion.
- T017 Implement OperationalFilters, SafeText, and CommunicationActionDialog with existing Admin primitives only in src/features/communications/shared/OperationalFilters.tsx, src/features/communications/shared/SafeText.tsx, and src/features/communications/shared/CommunicationActionDialog.tsx.

Do not implement Phase 3+ user stories, support/feedback/content/notification route pages, MSW operations, backend code, provider calls, storage, dependencies, or visual redesigns.
</task>

<existing_context>
Read these first:
- .specify/memory/constitution.md
- specs/007-admin-support-content-and-notifications/spec.md
- specs/007-admin-support-content-and-notifications/plan.md
- specs/007-admin-support-content-and-notifications/data-model.md
- specs/007-admin-support-content-and-notifications/research.md
- specs/007-admin-support-content-and-notifications/quickstart.md
- specs/007-admin-support-content-and-notifications/contracts/admin-support-content-notifications.openapi.yaml
- specs/007-admin-support-content-and-notifications/tasks.md

Important current-state findings:
- T005 and T007 are already marked [X]. Do not redo them unless a Phase 2 dependency requires a small adjustment.
- src/features/communications/contracts.test.ts currently redeclares local test schemas instead of importing production schemas. Replace that with real tests against contracts.ts.
- src/features/communications/repository.ts currently has any types and placeholder validateResponse behavior. Replace only the Phase 2 shared boundary.
- src/features/communications/hooks.ts currently has any types and some mutations not using the locked mutation wrapper. Keep the smallest shared Phase 2 surface that tests require.
- src/features/communications/shared/* currently imports @/components/ui/*, but this repo primarily has src/components/admin/ui.tsx. Use existing Admin primitives and imports that actually exist.
- Keep Arabic-first RTL, English LTR readiness, keyboard/focus behavior, and responsive-safe layout.
</existing_context>

<constraints>
- Preserve the approved Admin Web structure and design system.
- No new package install or dependency/version changes.
- No backend, database, Supabase, Stripe, provider integration, real auth, browser storage, raw attachment bytes, real upload/download, or real notification delivery.
- No direct fixture imports from presentation files.
- No dangerouslySetInnerHTML, unsafe URL rendering, debug console logging, secrets, browser storage, Date.now(), Math.random(), or application any in touched Phase 2 files.
- Keep changes scoped to Phase 2 foundation files and the task checklist.
- Do NOT run git add, git commit, git checkout, git reset, or git clean.
</constraints>

<verification_loop>
Use test-first order for each behavior: write/import real tests, run the focused command and confirm it fails for the expected missing/incorrect implementation, implement the smallest code, then re-run the same command until it passes.

Focused commands:
  npm run test -- src/features/communications/contracts.test.ts
  npm run typecheck
  npm run test -- src/mocks/phase6-communications-state.test.ts
  npm run test -- src/features/communications/repository.test.ts
  npm run test -- src/features/communications/hooks.test.ts
  npm run test -- src/features/communications/shared/CommunicationShared.test.tsx

After all Phase 2 tasks pass, run:
  npm run typecheck
  npm run lint
  npm run test -- src/features/communications src/mocks/phase6-communications-state.test.ts src/core/permissions/role-map.test.ts

Only mark a task [X] after its verification command succeeds.
</verification_loop>

<structured_output_contract>
End with a report in this exact shape:
1. Tasks completed and marked [X]
2. Files touched
3. Red/green evidence for each task-level focused command
4. Final gate outcomes with exit codes and useful counts
5. Any deviations, blocked items, or decisions needing orchestrator review
</structured_output_contract>
