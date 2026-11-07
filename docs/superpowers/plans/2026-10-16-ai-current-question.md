# AI current question and financial coverage implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct topic switching and evaluate financial/application coverage against real Staging data before continuing the other reliability repairs.

**Architecture:** Keep the existing owner-fenced agent, query tools, durable jobs and numeric references. Give the model a final dedicated current-user message after bounded untrusted context, instead of making it infer the active question from a JSON document containing historical requests. Reconcile evidenced financial-tool gaps with the application's established calculations.

**Tech Stack:** NestJS/TypeScript, existing AiGateway/OpenRouter transport, PostgreSQL, React Native DEV, Jest.

**Spec:** `docs/superpowers/specs/2026-10-16-dev-reliability-design.md`, together with the existing assistant-agent design.

## Global constraints

- Existing worktree and branch only; no ordinary-app or Production operations.
- Voice stays ON Posting; existing epoch, runtime and automatic transport preserved.
- No successful financial templates; exact server facts, authenticated owner reads and action confirmation remain authoritative.
- No real-owner deletion, session switch, historical audio/message replay or unrestricted model tools.
- Model quality requires live tests; unit mocks do not prove semantics.

## Review focus

- Current financial request after an unrelated history turn must not be refused because of history.
- Current unrelated request after a financial turn must not receive the earlier financial answer.
- A short financial follow-up after a greeting must retain its financial anchor.
- Fees, refunds, multiple currencies, empty periods and capped collections must agree with the application and disclose coverage.
- Changes to shared gateway transport must leave ordinary/Voice request bodies unchanged when the new agent input is absent.

### Task 1: Isolate the active user question

**Files:** `apps/api/src/ai/assistant-agent.ts`, `apps/api/src/ai/ai.gateway.ts`, `apps/api/test/unit/ai/assistant-agent.spec.ts`, `apps/api/test/unit/ai/ai-gateway.spec.ts`.

**Interfaces:** Add optional internal `currentQuestion?: string` to `CompletionInput<T>`. The agent supplies redacted current content; the gateway appends a final user message only when supplied. Existing callers remain unchanged.

- [x] Add a transport regression using the real agent/gateway and a fake external HTTP response. Capture outbound messages and assert the final message is the current question even when context contains a different historical request; verify exact grounded result/redirect through the real parser.
- [x] Run `npm test -- --selectProjects unit --runInBand assistant-agent.spec.ts ai-gateway.spec.ts`; observe the wrong final message before implementation.
- [x] Implement the optional final message and explicit context-vs-current-request prompt guidance. Preserve context bounds and redaction.
- [x] Run the same tests, AI unit/contract suites, API typecheck/lint. Review the diff for shared Voice changes.
- [ ] Commit only this task's files and record the evidence.

### Task 2: Financial coverage/parity repairs

**Files:** Agent data/query and comparison files and their existing unit/integration/SQL tests; new migration only if a proven SQL defect requires it.

**Interfaces:** Preserve owner-fenced fixed `AssistantDataQuery` and exact-minor facts; use established reporting semantics instead of inventing independent totals.

- [x] Finish the domain audit and record concrete missing data or parity defects, then specify the exact fixtures/fix in a focused sub-plan before editing.
- [x] Reproduce each accepted defect with actual data/query tests, implement the smallest fix and run the domain suites.
- [ ] Verify safe owner isolation, pagination, confirmed/pending distinctions and numeric/date grounding with fresh read-only data.
- [ ] Commit reviewed changes and keep installed migration checksum history intact.

### Task 3: DEV runtime and semantic qualification

**Files:** Private preservation/runtime/evaluation artifacts; repository evidence document with no raw personal data or credentials.

**Interfaces:** Existing exact DEV-header routing and owner admission, private agent queue, preserved original126 runtime pins and Voice epoch.

- [ ] Package a clean committed source with an owned DEV-only runtime upgrade; preserve ordinary3001 and Voice3004 routing and every unrelated container.
- [ ] Run fresh conversational questions: financial after programming, unrelated after financial, latest transaction, largest expense/categories, current-day and previous-day totals, comparable periods, follow-up across greeting, app financial help and domain availability. Judge factual answers against current SQL/app sources, not expected prose.
- [ ] Measure end-to-end/provider times and check usage/accounting, failures, pending jobs, financial hashes and Voice heartbeat.
- [ ] Fix any observed failures with a new regression, repeat affected cases and report actual acceptance coverage.
- [ ] Record final source/runtime/evidence pins and remaining limits. Continue account deletion, offline UX and performance repairs under the reliability spec without awaiting approval.

## Source qualification (2026-10-16)

API unit/contract: 249 suites / 1830 tests passed. Mobile complete bounded suite: 487 suites / 3217 tests passed, no skips. Both typechecks passed. Dedicated PostgreSQL data parity: 53 tests passed; account-deletion local database: 5 tests passed. Independent scoped AI and cross-slice code reviews found no remaining product-code findings after the period-reference and planning-scope repairs. Hosted model semantics, privacy provider deletion and native UI/performance qualification remain separate runtime acceptance gates; local tests do not establish those outcomes.
