# Grounded assistant response layout implementation plan

> **For agentic workers:** Execute inline with superpowers:executing-plans; one final independent review. Keep the user's existing checkout and branch.

**Goal:** Display authentic expense answers with a prominent amount, comparison and concise grounded explanation/saving suggestion.

**Architecture:** Derive an optional versioned spending presentation from successful owner summary reads after existing answer grounding. Add it to existing metadata, validate/map it in the mobile adapter and render it using existing semantic theme and financial privacy controls. Other answers retain their original content.

**Tech Stack:** TypeScript, NestJS, React Native/Expo, Zod, Jest.

**Spec:** [Approved design](../specs/2026-10-31-assistant-response-layout-design.md).

## Global constraints

- Same branch/check-out/Redmi/account/APK/Metro33696; preserve2026-13 and existing records.
- No invented totals, savings targets, category attribution or cross-currency arithmetic.
- Keep Saudi prose and intentional English; no financial mutation or broader provider policy.
- No consumed-window replay, migration, capture, PDF/ZIP/Feedback, merge or Production.

## Review focus

- Huge exact signed amounts and non-two-decimal currencies must retain every digit.
- Empty, failed and capped/missing category data are distinct; missing category is never zero.
- Mixed income/largest-transaction/other account questions must not lose their requested answer.
- Privacy masking, dark theme, RTL/LTR and 200% text remain functional.
- Legacy metadata/plain text and unknown presentation versions remain readable.

### Task 1: Grounded server presentation

Files: create `apps/api/src/ai/assistant-spending-presentation.ts` and its unit spec; modify `assistant-agent.ts` and agent unit tests.

- [x] Write and run failing tests for exact multi-currency summary/comparison/category targets, failed/capped data, mixed questions and calendar interval matching.
- [x] Implement `selectSpendingSummaryRead`, `previousSpendingPeriod` and `buildSpendingPresentation`, retaining the canonical grounded answer unchanged. Reuse `assistantPeriodTotals`/`assistantComparisons`; only successful matched records establish an explanation or numeric target.
- [x] Attach optional metadata after grounding; optionally perform one fixed prior-interval read, recording its evidence without changing provider dispatch bounds. Verify focused API suites and typecheck/build.

### Task 2: Validated mobile presentation

Files: domain `assistant-presentation.ts`, `assistant.ts`, live `assistant-api-service.ts`, bubble and new `AssistantSpendingSummary.tsx`, localization keys and targeted tests.

- [x] Write and run failing adapter/UI tests for the approved hierarchy, exact values, privacy reveal, incomplete baselines, legacy and unknown versions, and both languages/themes.
- [x] Validate optional presentation metadata and map it to responses. Render prominent amounts, comparison and short sections using semantic tokens, preserving existing actions and fallback prose.
- [x] Run focused mobile suites, typecheck/lint and one device inspection with the preserved app state.

### Task 3: Runtime and evidence

- [x] Review final changes independently and fix material findings.
- [x] Verify before/after phone preservation, then deploy only the qualified assistant worker overlay and use the existing Metro. Preserve the annual key and all other consumers/configuration.
- [x] Prepare any necessary new bounded live acceptance separately from closed scopes; do not claim provider quality from mocks.
- [x] Record evidence and remaining limits, update handoff and push the same branch; inspect current HEAD checks.


Completed31 October2026: source tests/review, qualified worker deployment, actual Arabic card and canonical details on the same Redmi, exact preservation gate, and same-branch publication. Scope04/05/06 are closed; see docs/evidence/2026-10-31-assistant-grounded-response-layout.md for actual acceptance and the separate English/CI limits.
