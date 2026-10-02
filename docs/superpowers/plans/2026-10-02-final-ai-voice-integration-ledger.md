# SDD ledger — plan: docs/superpowers/plans/2026-10-02-final-ai-voice-integration-plan.md

Authority: the user's complete Phase A–H request, preserved verbatim in the plan. Existing handoffs are evidence, not acceptance. No financial confirmation is authorized.

## Current checkpoint

| Item | Verified state |
| --- | --- |
| AI | Isolated `codex/ai-voice-continuation`: `41170e8` → `cee9421` gateway hardening → final canonical sign instruction; contains `8434640` and `8da9cfb` |
| Onboarding | `5113fb7046372183fea4f8a8b1e23a9ec947dcd2`, contains/supersedes `08fda46`; deployed, exact-SHA CI green, matching Samsung APK installed |
| Integrated SHA | None; no merge performed |
| CI | Final AI exact-SHA run pending; superseded `cee9421` run cancelled |
| Staging | API onboarding `5113fb7`, immutable image `3ed2ad83dbbf…`; Worker stopped |
| Provider acceptance | Pending; the cancelled Samsung attempt had zero Worker/provider attempts |
| Samsung acceptance | Onboarding first-signup pending availability of genuinely unused identity; Voice pending |
| Finance | No Confirm authorization; no Voice transaction |

Phase A: locally complete, exact-SHA CI pending. Other recovery chat inspected as idle. The AI change since `8434640` is gateway completion-identity/accounting/terminal-classification guards and tests/documentation; no recorder, media, migration or routing change.

Pre-flight interfaces: AI gateway receipt → Worker durable usage recording; API admission → Worker processing operation; canonical proposal → financial sign/date/reference resolution; onboarding `/me` bootstrap → Mobile sequential reads. Review each before release. Preserve onboarding lineage and do not deploy an AI-only API over `5113fb7`.

Ruling: retain a phase-based ledger for the user's Phase A–H plan; it has no numbered implementation briefs for the skill's task parser. Use focused RED→GREEN evidence and commands directly. Keep existing evidence; do not delete scratch that holds required receipts.

## Phase A completed findings

- RED: valid bounded wrong-model receipt discarded accounting; malformed outer/content JSON, null envelope, non-string content and canonical rejection were retryable or caused two intercepted dispatches. Six new regressions failed for those exact reasons (45 existing passed).
- GREEN: require real nonblank identity before receipts; record known bounded usage before rejecting a mismatching model. Voice malformed envelopes/content/canonical output are terminal. Assistant retry behavior is unchanged. Final gateway: 51 passed.
- Missing/invalid identity or usage preserves the existing conservative reservation path. Cost/token violations remain terminal and conservatively held; no fabricated zero charge or identity.
- Canonical expense is positive and income negative (`AiService` and Mobile both map negative to income). Existing gateway fixture uses string `1500` and `transaction.create`. Copied operations canary in this worktree's ignored phase workspace corrects the stale negative/numeric amount and `expense` type assertions; the onboarding branch's historical harness remains untouched.
- Requested-route identity is not actual provider evidence: gateway receipt provider and durable attempt/usage model/provider describe authorized dispatch metadata. Live acceptance must independently retain returned model/generation and upstream endpoint evidence. A new migration solely to relabel these existing columns is unwarranted.

Verification: 248 API unit/contract/security suites / 1,413 tests passed (1 suite / 8 tests skipped); typecheck, changed-file lint, API/Worker/migration build, migration checksums and diff whitespace passed. Fresh loopback PostgreSQL 18.6 database `voice_final_ai_targeted` applied all 78 migrations; 24 AI/ledger suites / 103 tests passed (1 suite / 4 skipped). Actual Mobile parser, Worker orchestration, durable accounting and ledger integration use fake inference only. Compiled one-shot interception of 400/503/missing usage: one dispatch each, zero inference. Operational contract self-test: 7 checks passed.

Fresh independent whole-candidate review: no Critical/Important findings; independently 51 gateway checks and 12 intercepted malformed cases passed. Evidence limitation above retained.

Non-green receipts retained: npm exec flags were initially consumed by PowerShell/npm, producing a wrong test invocation; direct Node binaries corrected it. An overly broad path regex matched the AI worktree name and ran unrelated database suites: 97 passed, identity role expectation and admin teardown failed because this disposable fixture uses a separate principal and lacks the CI baseline administrator. This is not a green full-database gate. Corrected exact-file AI/ledger selection on a separate freshly migrated database passed; final integrated full database gates still pending. Initial lint caught an inaccurate JSON type assumption; using an unknown parsed envelope fixed it without changing runtime intent.

## Phase B preflight / maintenance

Fresh SSH 2026-10-02 15:40Z: `/opt/masarifi/current` is onboarding `5113fb7`; API healthy, Worker Created/stopped, immutable image `sha256:3ed2ad83dbbfbb572a70593ea24828907f265ba3a7229e24c015fd6e7af257f4`. Do not overwrite this API with an AI-only candidate.

Original cancelled Samsung session `431394a9-832b-4dcc-b2d6-843c8809aabf` freshly read 15:41Z: failed `VOICE_CANCELLED`, 0 attempts, no proposals/transactions, one media object and $0.1316 hold. Normal `AiWorker.runJob('voice-media.purge')` and `runJob('ai.usage_rollup')` executed once using the deployed image and Worker credentials; inference claiming/completion mechanically forbidden, polling never started. 15:44:41Z: 22 eligible objects purged; 0 reservations released (original two-hour boundary is 15:50:20.585Z). Unknown attempt reservations remain protected. Re-read and complete eligible release through the same normal mechanism before paid work.

15:46Z owner preflight: active, welcome completed, one active SAR cash account, zero transactions, zero eligible jobs. A second cancelled capture `04a0c49f-02d5-4dad-94ae-396702c66d40` at 15:25:40Z / 4.932 seconds has zero claims/provider attempts; attribution requested without another recording. Quota events now 2. Route version 5 remains enabled 3.5 Lite, Vertex, no fallbacks, ZDR, original limits/prices; global budget 2. Prompt/provider/unrelated-route fingerprints unchanged from deployed onboarding evidence.

Fresh public OpenRouter metadata: exact model `google/gemini-3.5-flash-lite`, endpoint `google-vertex/global`, status 0; response_format/structured_outputs/max_tokens supported, temperature absent. Same model/endpoint appears in ZDR catalog. Prices prompt/audio $0.0000003 per token and completion $0.0000025, within governed ceilings. Eligibility is not provider acceptance. Sources: https://openrouter.ai/api/v1/models/google/gemini-3.5-flash-lite/endpoints and https://openrouter.ai/api/v1/endpoints/zdr.

Browser Clerk owner fingerprint matches the existing Samsung owner safely. `/me` and accounts return 200. Category listing still returns 503 `REFERENCE_UNAVAILABLE`; this separate reference boundary must be diagnosed before final review acceptance. No reference/account was created or modified by this phase.

## Remaining phases

### Additional Phase A canonical-contract check

After `cee9421`, request review established an ambiguity: the schema allows signed money but has only `transaction.create`, and the actual Worker context never states which sign means expense/income. Three existing real Worker request tests (AR/EN/noisy) reproduced the missing contract instruction RED, then passed when the existing instruction gained one sentence: `Expenses use positive amountMinor; income uses negative amountMinor.` This is application execution context, not a model/provider/schema or published-prompt change. Fresh review found no issues and independently passed 15 Worker checks. Gateway + Worker targeted gate: 66 passed; typecheck/lint/build and compiled one-shot failure checks passed again. The earlier `cee9421` CI run `37029548003` was cancelled to prevent publication of a superseded candidate; it must never count as release acceptance. Fresh exact-SHA CI follows this final Phase A commit.

Cancelled-session reconciliation confirmed 15:52Z: original audio count 0, storage reference cleared, reservation `released`, attempts 0, proposals 0, transactions 0. Normal maintenance at 15:51:31Z purged 2 remaining eligible references and released exactly 1 eligible hold. Historical unresolved provider-attempt holds remain protected; the second new cancelled capture's hold is not old enough to release yet.

15:50:47Z authenticated OpenRouter key read: limit 2, remaining 1.99932675, usage 0.00067325; no inference. Effective Voice provider approved/ZDR-capable/no_training, model approved/audio_input/structured_output, prompt version 1 approved/evaluation-passed; route and all unrelated fingerprints unchanged.

Reference issue isolated read-only under the **actual API role and API connection** at 15:53Z: search_path `"$user", public`; extensions schema USAGE false; unqualified digest call fails SQLSTATE `42883`, qualified call fails `42501`. `ReferenceRepository.sharedHash` currently calls unqualified `digest`, explaining cached category/reference 503. Migration-role probes can resolve it and therefore do not represent the API boundary. No grant/config/source change made here. Treat as a unique release-critical shared reference defect for the later integration phase; avoid broadening database privileges. Worker reference construction uses its existing restricted definer path and remains independently verifiable before paid canary.

B: cancelled-session read-only correlation and governed non-inference maintenance; fresh route/prompt/ZDR/budget/quota checks; exact tested Worker image; one English synthetic, Arabic only after full pass.

C: provider/canonical evidence remains distinct from physical product acceptance.

D–E: only after AI safe integration boundary, inventory unique branches and preview merges; integrate final accepted onboarding and AI lineages once.

F–G: combined regressions, fresh migrations, fresh exact-SHA CI/image and one guarded integrated Staging release/APK as required.

H: existing-owner/new-owner onboarding evidence, synthetic Voice, Samsung Voice; financial confirmation requires separate explicit approval. Stop on opaque 400 or any routing/privacy/schema/accounting/dispatch/mutation violation.
