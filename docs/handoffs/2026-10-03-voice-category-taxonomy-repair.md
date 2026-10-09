# Voice category taxonomy repair — implementation record

Date: 2026-10-03. Base: 4ea85c6. Isolated branch: codex/voice-category-taxonomy. Final branch integration and paid testing remain paused.

## Corrected diagnosis

The old checker rejected the seeded Food / الطعام identity and accepted Shopping / التسوق because its label expression matched تسوق. This is a confirmed operational test defect. Historical receipts establish a known supplied expense category but do not establish which category Gemini selected. Food is plausible, not proven.

The earlier RCA's “one groceries-pattern match” meant Shopping; it did not prove a literal Groceries category existed. Preserve that historical receipt and its original text. See the dated correction in 2026-10-03-voice-category-resolution-rca.md.

## Approved execution scope

Implement only checker, operational harness, tests and evidence documentation. Keep model, provider, schemas, normalizer, prompt, M4A, database privileges/configuration, production application behavior, quotas, holds and budgets unchanged. Base the category candidate on 4ea85c6; unrelated owner-quota commits remain separate. Preserve all pre-existing uncommitted handoffs and integration ledger changes without staging them.

1. Reproduce Food rejection and Shopping false acceptance.
2. Compare selected alias/ID with trusted expected Food ID, never labels.
3. Fail before gateway dispatch when the expected reference is missing/ambiguous or descriptors disagree with the exact outgoing context.
4. Move semantic checks after the original gateway completion, before Worker resolution/save. Observe original canonical parsing without replacing its validation.
5. Prepare reproducible tracked one-shot harness and privacy-safe diagnostics.
6. Verify actual seeded Food through Worker/SQL using fake inference, retaining invalid/foreign/swapped/stale checks and zero financial mutations.
7. Run relevant broad regressions, independent fresh-context review, commit and one exact-SHA CI. Stop before deployment or inference.

## Changes

- scripts/voice-category-acceptance.cjs requires trusted expectedCategoryId and compares reference identity. It emits only booleans.
- scripts/voice-canary-contract.cjs hardcodes the existing shared Food identity for this fictional English fixture. It checks unique reference mapping and exact descriptors before gateway completion and records only booleans, SHA-256 fingerprints and allowlisted identifier forms/classifications.
- scripts/voice-english-canary.cjs preserves the prior one-shot request guards and adds candidate/harness/helper fingerprints, transient category observation, distinct semantic rejection and resolution/persistence outcomes. This is an operational script; it requires --approved-single-english for inference execution. Its existence is not approval to run it.
- The actual gateway parse/normalization, Worker resolver and SQL functions remain unchanged.

## RED/GREEN evidence

Initial seeded-taxonomy regression: three genuine failures (Food alias, Food ID, Shopping false acceptance). Ten checks pass after identity repair; additional ordering/renaming/ambiguity coverage follows. Operational preflight/semantic-stage regressions failed against the previous parse-callback behavior and pass with the new wrapper. Real-gateway fake-response test verifies semantic rejection is outside AI_SCHEMA_INVALID catch. Provider schema suite retains canonical fingerprint/sign/adversarial coverage.

Worker integration now uses immutable seeded Food for success, not synthetic Groceries. A separately owned disposable category tests stale/deleted rejection without mutating the global seed. Initial test fixture descriptors still expected the old synthetic label; corrected fixture matches seeded Food. Seven cases pass, zero transactions. Deactivation alone remains a separate unverified risk; do not conflate it with this repair.

## Verification and evidence limits

Local checks and independent review/CI will be recorded below after completion. Local PostgreSQL is disposable loopback 18.6 with upstream PGMQ SQL installation and minimal Storage scaffold; exact-SHA CI uses real Supabase. No paid inference or Staging writes in this repair. Historical Gemini category remains unknown.

Last retained admission evidence after the approved English canary: owner Voice usage 6/30, four unknown-cost holds $0.52640000, global/key limits $2. This is historical, not a fresh admission guarantee. Rolling 24-hour expiry can remove quota events from the count but does not release unknown-cost holds. No hold release/reset/change is part of this patch.

## Exact next proposed English canary — requires separate approval

After green CI and separately approved immutable Staging execution, recheck current owner mapping, effective 30-attempt owner limit, rolling usage, $2 key/global limits, unresolved holds, absence of other eligible jobs, exact image SHA/digest and harness/helper/checker fingerprints. Preserve the separately accepted onboarding API and existing governed quota migration; do not downgrade their state.

Use only the existing fictional English M4A fixture (50,528 bytes, 3,969 ms; SHA-256 8e7d2b519d8e6683e043593d4940e2b4ce751b3fa4b315067990b700ebe3b5f3), current Riyadh capture date/offset, normal authenticated create/upload/process and one guarded Worker dispatch. Assert Food exists once in exact outgoing references before dispatch. Keep Gemini 3.5 Flash-Lite, google-vertex/global, strict provider schema, unchanged canonical schema, ZDR/data_collection deny, no fallback and omitted temperature.

Retain only candidate/harness/prompt/schema/reference fingerprints, expected-reference/context checks, identifier form and unchanged-normalization boolean, fixture classification food/shopping/other_supplied_expense/unknown/missing/wrong_kind, separate canonical/semantic/resolution/persistence outcomes, generation correlation, durable attempt count, actual cost/reservation reconciliation and no-mutation checks. Never log raw output, arbitrary identifiers/labels, transcripts, prompts, audio, owner IDs, tokens or credentials.

Require HTTP 200, correct transcript/sign/amount/currency/date/cash, selected Food identity, one real persisted reviewable proposal, one dispatch and authoritative accounting. Cancel through normal API, verify no financial mutation or resurrection and normal media cleanup. Stop on any failed gate or unknown cost; do not retry, invoke fallback, run Arabic/Samsung or Confirm automatically. No such canary was run by this implementation task.

## Completed local verification and review fixes

- Seeded acceptance RED: Food alias/ID rejected and Shopping accepted; GREEN identity checks pass.
- Broad unit/contract/security: 251 suites, 1,512 tests passed, eight skipped (before final review additions); affected suites rerun after additions.
- Broad real local database integration: 100 suites / 312 tests passed; one unrelated exchange-rate test initially failed FX_REQUEST_INVALID instead of FX_UNAVAILABLE at a current-clock comparison. Targeted unchanged exchange-rate plus Voice rerun passed 2 suites / 9 tests. Initial failure retained, not hidden; exact-SHA real Supabase CI is authoritative.
- Actual seeded Food Worker/SQL integration: all seven cases pass; shared seed never modified. Separate owned stale fixture only.
- Typecheck, full lint and three-process build pass; changed tests rerun after review.
- One-shot offline self-test: 16 checks, zero inference, second dispatch blocked and strict privacy/media/request guards retained.
- Fresh reviewer found unrestricted receipt strings, an unset success failureCode causing a false-negative final gate, and a leftover shared Food fixture reset. All were repaired. Receipt/model/finish-reason output is allowlisted; final gate is exercised after successful save without completeWork; SQL-save failure cannot mark success; shared seed reset removed. Focused final-gate and adversarial diagnostic regressions added.

No production source/migration/Mobile/provider/schema/prompt diff against 4ea85c6. No Staging change, paid inference, recording, quota or hold mutation. Fresh exact-SHA CI result will be written to a separate receipt so candidate identity remains stable.
