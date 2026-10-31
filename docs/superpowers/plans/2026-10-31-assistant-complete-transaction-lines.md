# Assistant complete transaction lines implementation plan

**Goal:** Close the remaining latest-N record presentation gap and repair the obsolete CI assertion, preserving the completed direct response work.
**Architecture:** Add atomic display facts at the existing authenticated model-data boundary; retain exact fields, grounding, schema and read limits. Execute inline on the same branch.
**Spec:** [approved behavior and implementation choice](../specs/2026-10-31-assistant-complete-transaction-lines-design.md).

## Constraints and review focus

Preserve the account, five data projections, draft2026-13, APK and Metro33696. No replay of scopes01–07, no real financial writes or broader deployment. Focus on exact signs/precision, distinct currencies, owner-local date rollover, digit-containing customer names, incomplete records, unchanged field-specific reads and bounded page coverage.

## Task1: Fix the obsolete CI privacy assertion

- [x] Read the failing GitHub job and reproduce the exact failing journey locally.
- [x] Replace the old card expectation with real direct-answer masking, explicit reveal and unchanged global privacy checks.
- [x] Run the full mobile suite once, plus typecheck/lint for the touched test.

## Task2: Complete selected transaction lines

- [x] Write and observe failing provider-boundary regressions for three complete lines in AR/EN, exact currencies/dates/customer names and unavailable required fields.
- [x] Add one atomic server display fact per complete confirmed movement; guide full-record answers to select it and keep field-specific queries compatible.
- [x] Run AI unit/contract/security suites, typecheck/lint/build and review the final diff.
- [x] Qualify/deploy only the actual assistant worker using preserved configuration and fresh zero-job gates, if available; prepare a fresh paid acceptance packet without sending it.
- [x] Diagnose the newly observedQA08 SQL23514 at the finish boundary, reproduce serialization/adapter failures, preserve the existing constraint using Unicode line separators, and validate expanded byte bounds/controls.
- [x] Verify879AI and4395mobile tests, typecheck/lint/build and independent review; qualify/deploy the narrow repository patch, refreshJavaScript through the existing Metro after empty-composer checks, preserve all data.
- [x] With the user's separateQA09 approval, verify one completed saved response with all three records natively and against owner data, close09, restore the originalADB reverse state.
- [ ] Update evidence/handoff, commit/push the same branch, inspect actual new HEAD checks and record remaining acceptance limits.
