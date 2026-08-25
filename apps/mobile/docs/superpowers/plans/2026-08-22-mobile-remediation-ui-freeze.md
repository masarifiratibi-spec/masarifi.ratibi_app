# Masarifi Mobile Remediation — UI-Frozen Implementation

## Global constraints

- Work only in this worktree and only under `apps/mobile` unless execution-ledger tooling writes ignored scratch data.
- The current UI is frozen. Preserve colors, typography, component appearance, hierarchy, screen structure, navigation presentation, and general geometry.
- Visible changes are allowed only for demonstrated RTL/LTR, alignment, clipping, overflow, responsiveness, safe-area, keyboard, wrapping, 200% text-scaling, or touch-target defects. Every visible correction requires before/after evidence.
- Prefer deletion and existing helpers/contracts over new abstractions. Do not add state-management, routing, component, theme, or caching frameworks.
- Use TDD for every behavior change. Keep mocks at system boundaries and use real SQLite when persistence is under test.
- Do not weaken TypeScript, lint, design-system, accessibility, or boundary checks.

## Task 1: Production fixture isolation and cleanup

- Add regression tests proving that production core-finance construction does not seed accounts or transactions, while approved default categories remain available.
- Separate empty production construction from seeded test/dev factories.
- Add an idempotent cleanup path for exact, unmodified legacy fixture accounts and transactions; preserve ambiguous or modified records.

## Task 2: Currency precision

- Add currency-owned `minorUnitScale` and route parsing/formatting through shared helpers without changing amount presentation.

## Task 3: Shared financial truth and period rules

- Make planning, reports, assistant context, voice, and tracking consume the same persisted core ledger rather than test fixtures.
- Centralize transaction effects and financial period calculation according to the approved plan defaults.

## Task 4: Compilation and contract repair

- Resolve TypeScript, lint, boundary, and whitespace failures without changing the approved UI.
- Fix icon size/label callers with exact-value token equivalents.
- Remove unused code and obsolete demo routes while preserving real route names and navigation presentation.
- Fix destructive preference hydration without adding or changing themes.
- Update stale navigation/theme documentation and tests to match the UI freeze.

## Task 5: Android tracking

- Separate production ingestion from mock simulation.
- Add the minimum Android receiver/native bridge needed to normalize financial SMS events and feed existing tracking review/deduplication/persistence/undo logic.
- Keep iOS explicitly unavailable and retain simulation only in dev/tests.
- Preserve all tracking UI and permission presentations.

## Task 6: Assistant and PIN privacy

- Persist assistant consent independently from conversations and block analysis before consent.
- Keep canned assistant behavior in dev/tests; production must report unavailable until a real provider exists.
- Replace reversible PIN storage with a versioned salted KDF verifier and constant-time comparison, including legacy upgrade after successful unlock.
- Preserve current assistant and security UI.

## Task 7: Minimal accessibility and responsive corrections

- Audit only confirmed RTL/LTR, clipping, overflow, safe-area, keyboard, wrapping, 200% text, touch-target, and accidental alignment issues.
- Make the smallest correction for each confirmed issue and retain paired before/after evidence.
- Stop a correction if it needs visual restructuring.

## Task 8: Verification and release evidence

- Eliminate unexpected Jest warnings in changed paths and review changed tests with Test Guard.
- Review changed production code with Clean Code Guard and its AI failure-mode checklist.
- Run typecheck, lint, all boundary checks, Jest, SQLite integration tests, Android critical journeys where available, and `git diff --check`.
- Measure representative 5,000-record ledger paths and optimize only confirmed bottlenecks.
- Capture valid route/state metadata for fresh visual evidence and verify no unexplained UI delta.
