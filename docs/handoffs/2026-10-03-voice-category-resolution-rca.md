# Voice category resolution — offline RCA and narrow repair

Date: 2026-10-03, Asia/Riyadh. Base: `5912c388583a0c032f919d809bb4fca2542ee9c6`. Branch integration remains paused. No inference, recording, quota mutation, financial mutation, deployment or APK work in this investigation.

## Diagnosis and evidence limits

The first observed failure of the English canary was the operational `semanticChecks/categoryCorrect` assertion, after normalization and canonical parsing, **before production alias resolution and proposal persistence**. See [the original canary receipt](2026-10-03-vertex-schema-english-canary-evidence.md). HTTP200, transcript, amount, currency, date and cash account passed; the exact selected category was not retained. It is impossible to reconstruct that selection from the boolean receipt. Do not report that Gemini selected a UUID, invalid alias, wrong category or null as an observed fact.

Two independently proven defects were found:

1. **Restricted-role reference-cache hashing:** `ReferenceRepository.sharedHash` invoked unqualified pgcrypto `digest`. Staging's API role has no `extensions` schema USAGE and its search path is `"$user", public`. A read-only API-role probe at 2026-10-03T06:53:22Z established unqualified call failure `42883`; qualified `extensions.digest` failed `42501`. This affects shared categories/currencies/countries reads and can block Mobile reference bootstrap/review. It does not explain this particular canary predicate: the Worker never calls this repository/cache to build model references.
2. **Canary acceptance grammar mismatch:** the old checker matched category aliases only; production `AiWorker.resolveId` matches an alias **or an ID**, with a mandatory matching kind. A correct supplied category UUID deterministically failed the checker. The focused regression reproduced that discrepancy. This is a possible explanation of the historical category failure, not proof of its discarded selection.

The receipt does not support a production category-resolver defect. Offline fixtures establish that actual production context, normalization, canonical parsing, owner-scoped resolution and SQL persistence work with valid category aliases and UUIDs. If the next approved receipt shows a wrong/missing model category, that is a separate semantic failure requiring its own evidence; this repair does not force or infer a category.

## Exact path and first boundaries

| Boundary | Actual source/evidence | Conclusion |
| --- | --- | --- |
| Available references | `private.get_ai_work_input`, including the Master Voice forward migration; owner-filtered active account/category aliases with IDs/version/data | Independent of ReferenceService/sharedHash. Foreign owner references are not supplied. |
| Prompt/context | `AiWorker.voice` uses work-input aliases, supplies descriptors `{alias,kind,version,data}`, with category `{kind,labelAr,labelEn}` | Category labels and kind are supplied. IDs are kept for server resolution; no new IDs are added to the model context. |
| Historical target availability | Read-only canary audit found 16 active expense categories, one matching existing groceries predicate | Target was available in the reference set. The discarded exact request/output selection cannot be reconstructed. |
| Provider-facing category | Existing flat Vertex transport `categoryId` string, normalized by `normalizeVertexVoiceOutput` | Historical selected string is unknown; no transport/schema change justified. |
| Canonical validation | Original `parseVoiceOutput` passed in canary | The historical error was not canonical validation rejection. Nullable category remains permitted for an editable proposal; financial confirmation still requires an expense category. |
| Operational acceptance | Extra harness category predicate checks exact supplied expense/groceries reference | **Observed stop here**, before production continuation. Old alias-only predicate was stricter than production ID grammar. |
| Production resolution | `resolveVoiceProposal` → `resolveId(value,'category',references,true)` | Alias or UUID allowed only in category kind and supplied scope. Unknown/foreign/swapped references fail closed. |
| SQL persistence | `saveVoiceResult` → existing owner/active reference checks in `private.save_voice_result` | Correct alias/UUID persists offline; archive after context causes rejection; no transaction mutation. Not reached by historical canary. |
| Mobile reference review | `ReferenceService` → `ReferenceRepository.sharedHash` under active-profile API context | Confirmed separate digest privilege/search-path defect repaired below. |

## Minimal changes

Production change is **one SQL expression** in `apps/api/src/reference/reference.repository.ts`:

```sql
encode(pg_catalog.sha256(pg_catalog.convert_to(
  coalesce(string_agg(row_to_json(x)::text,'' order by x.key),''),'UTF8')),'hex')
```

This replaces `encode(digest(...,'sha256'),'hex')` using PostgreSQL-native SHA-256. The ordered aggregate, selected fields, filters, returned hex and cache key behavior remain identical. Arabic UTF-8 parity is asserted against Node SHA-256 over the actual aggregated bytes. No migration, grant, role/search-path change or extension access was added. PostgreSQL documents [native sha256 and conversion functions](https://www.postgresql.org/docs/current/functions-binarystring.html).

`scripts/voice-category-acceptance.cjs` is an **operational checker**, not application financial logic. It uses actual transient backend references, accepts alias-or-ID only in category kind and retains the existing expense/groceries acceptance rule. Returns only `categorySelected`, `categoryReferenceKnown`, `categoryExpense`, `categoryExpected`, `categoryCorrect` booleans. It neither repairs nor guesses a value. Missing/unknown/foreign/swapped/wrong category remains a stopped canary.

The prepared ignored one-shot harness now captures the real `repo.workInput` references in memory and uses the tested helper. At any future approved execution, mount the candidate's helper at `/app/canary-category.cjs`, verify its hash and the harness hash, and preserve the existing request/dispatch guard. No revised harness was uploaded or executed against Staging in this phase. Local `--self-test` passed 16 checks with zero inference requests.

One existing unit test's session expiry was moved from the now-expired 2026-10-03 date to 2099: its intended public-projection assertion had started invoking an unmocked expiry recovery branch today. No production recovery behavior changed.

## RED/GREEN and verification

| Check | Evidence |
| --- | --- |
| Restricted-role cache regression | RED: six cases fail with actual `function digest(text, unknown) does not exist`; GREEN: six pass using native expression, with `extensions` USAGE still false. Covers all three resource hashes, Arabic hash parity, shared cache invalidation/owner isolation and inactive-profile rejection on warm cache. |
| Canary alias/ID regression | RED: valid UUID rejected; nine other checks passed. GREEN: all ten pass, including unknown, foreign, swapped, missing/stale, wrong category and booleans-only diagnostics. |
| Actual Worker/reference integration | Seven cases pass through actual work-input context, transport normalizer, unchanged canonical parser, resolver and SQL save; only inference fake. Valid alias/UUID and nullable editable category persist; unknown/swapped/foreign/stale do not persist transcript/proposal; zero transactions throughout. |
| Broad API unit/contract/security | 250 active suites, 1,501 tests passed; eight skipped tests explicitly excluded from executed evidence. |
| Fresh database integration | 101 active suites, 313 tests passed; four dedicated-connection cases and one suite skipped by existing gates. All repository migrations applied. |
| Static/build checks | API typecheck, full lint, three-process builds and changed-file formatting pass. Whole-tree Prettier reported four pre-existing files outside this patch; left unchanged. |
| Independent review | No blocking correctness/security issues; source scope, owner isolation, alias/ID handling, real SQL stale-reference rejection and content-free diagnostics reviewed independently. |

Local database limitation: Docker Desktop was unavailable. Used fresh disposable loopback PostgreSQL18.6 with official PGMQ1.5.1 SQL-only installation and minimal Storage scaffold; no Staging writes. Initial broad run had two setup/order failures (test expects connection role postgres; last-super-admin cleanup without a prior fixture). A repeated subset reused route/quota mutations and failed five cases. Those are preserved in ignored logs, not suppressed. Fresh database under expected local role and full suite order passed all 313 executed tests. Real Supabase exact-SHA CI remains the release authority; its separate post-run receipt will identify candidate SHA/run/image and outcome.

Preserved logs under ignored `.superpowers/sdd/2026-10-03-category-rca/`: `reference-red.log`, `reference-green.log`, `checker-red.log`, `checker-green.log`, `category-boundary.log`, `api-broad.log`, `api-broad-green.log`, `database-broad.log`, `database-targeted.log`, `database-verified.log`.

Comparison against `5912c38` confirms no changes to `apps/api/src/ai`, canonical/provider schemas, gateway/Worker, Mobile, migrations, Docker or workflow. Model/provider/M4A/privacy/routing/prompt/budgets and unrelated AI routes unchanged. No final branch integration or replacement of accepted onboarding API.

## Quota and unknown holds: governed availability

Fresh read-only Staging receipt: **2026-10-03T07:19:30.555Z** (10:19:30 Riyadh), zero inference requests. Owner quota **5/5**, rolling window24hours, global monthly budget **$2**. Four pre-existing unknown-cost holds remain reserved **$0.52640000**; four unresolved terminal attempts have null billed cost and no generation hash.

| Current counted event (UTC) | Status / retained amount | Leaves rolling window (Riyadh) |
| --- | --- | --- |
| Oct2 16:52:40.007Z | reserved / $0.13160000 | **Oct3 19:52:40.007** |
| Oct2 17:51:58.524Z | reserved / $0.13160000 | Oct3 20:51:58.524 |
| Oct2 18:42:16.846Z | completed / $0.00050800 | Oct3 21:42:16.846 |
| Oct2 18:45:11.716Z | completed / $0.00030650 | Oct3 21:45:11.716 |
| Oct3 06:36:25.292Z | completed / $0.00078270 | Oct4 09:36:25.292 |

`private.reserve_ai_quota` counts non-released events with created_at within rolling24hours; therefore the first normal user slot is **Oct3 19:52:40 Riyadh**, assuming no new events/policy changes. Recheck read-only immediately before any approved canary; elapsed time is neither an approval nor a guaranteed admission receipt.

Unknown-hold expiry is **different from rolling quota expiry**. `private.rollup_ai_usage` releases older-than-two-hour reservations only if no unresolved provider attempt exists. These four do not satisfy that predicate; session cancellation/expiry/media purge does not free unknown cost. `record_voice_attempt` updates dispatched attempts, not these terminal failed/unknown records. There is no current automatic verified reconciliation feed for these historical records; no honest release time can be promised. Safe reconciliation requires an authoritative upstream outcome/billing receipt and an approved audited path. Do not mark unknown cost zero or release by hand. Two older holds already left the user quota window and remain budget holds. Monthly-budget period selection does not delete hold evidence.

Known monthly completed cost $0.00159720 plus retained holds $0.52640000 and another unchanged worst-case estimate $0.13160000 is below $2; owner quota currently prevents admission. This calculation is not a reservation or provider request. Last verified key limit remains $2; this offline repair does not modify it.

## Exact proposed next English canary — not authorized/executed

Only after this candidate's exact-SHA CI passes, explicit approval, and fresh legitimate admission:

1. Verify immutable candidate digest and helper/harness hashes; preserve accepted onboarding API separately until approved integration. Read-only checks must establish exact route `google/gemini-3.5-flash-lite` → only `google-vertex/global`, no fallback, temperature omitted, ZDR/data_collection deny, published prompt and schema fingerprint unchanged, $2 key/global limits, no other eligible jobs, known owner and existing SAR cash/category references.
2. Use the same fictional English `lite-fictional-en.m4a`: 50,528bytes, 3,969ms, SHA256 `8e7d2b519d8e6683e043593d4940e2b4ce751b3fa4b315067990b700ebe3b5f3`; phrase “I spent fifteen Saudi riyals on groceries today using cash.” Supply current capture context and Riyadh offset; no new recording/reference/account.
3. Ordinary authenticated create/upload/process, target-only one-shot Worker; existing guarded fetch permits **one dispatch maximum**. No Retry/fallback/Arabic/Samsung/financial confirmation.
4. Require HTTP200 through approved Google/global path, audio and strict structured output accepted, unchanged canonical validation, exact transcript/amount1500/SAR/date/cash checks, all five content-free category checks true, owner-valid active category resolution, **real proposal persisted and reviewable**. Fetch proposal with the authenticated client; no financial mutation.
5. Require exactly one durable attempt and authoritative usage/generation/reservation cost agreement. Stop on unknown accounting, wrong routing/privacy, malformed/truncated output, any failed category/canonical/persistence predicate or unexpected mutation; do not repeat.
6. Ordinary Cancel/discard and normal target media cleanup, verify no proposal resurrection/transaction/balance change. Cancellation does not erase legitimately billed quota. Report receipt before any further testing.

This proposal is not permission to execute. Arabic/Samsung acceptance and final integration remain paused. T08/Master Voice acceptance is incomplete until the real proposal and later explicitly approved physical/financial checkpoints succeed.
