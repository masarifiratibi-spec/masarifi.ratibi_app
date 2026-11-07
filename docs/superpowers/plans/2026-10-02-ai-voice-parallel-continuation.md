# AI/Voice parallel continuation — 2026-10-02

Status: **offline AI candidate verified; integration, exact-SHA CI and live acceptance pending.** No release, paid inference, route change, APK installation or financial mutation was performed by this chat.

## Recovered checkpoint

| Item | Independently checked state |
| --- | --- |
| AI base | `8434640dbefecb188bbf1def0fac0a7b92655dac` |
| Dedicated branch | `codex/ai-voice-continuation`; no tracking upstream configured |
| Dedicated worktree | `C:/Users/DELL/.codex/worktrees/ai-voice-continuation/MASREFY _Final` |
| New AI code commit | `8da9cfbfe6063a75df34c1d00cd7e47ffcc93c14` |
| Relevant remote | `ratibi`, `https://github.com/masarifiratibi-spec/masarifi.ratibi_app.git`; no push performed |
| AI history since native M4A repair | `facd77c` master repairs → `288f5c4` CI corrections → `8434640` primary-model transport adaptation → new AI code commit above |
| Other chat | **Audit Masarifi Voice end to end**, `01a0f91f-b641-7b80-b1f3-1a2d77020837`; latest user instruction is generic new-user onboarding repair, with Voice paused |
| Onboarding worktree | `C:/Users/DELL/.codex/worktrees/master-voice-repair/MASREFY _Final` |
| Onboarding branch / current commit | `codex/new-owner-onboarding-bootstrap` / `08fda461c653605b3f921001b7bc588fe90dd50a`; physical acceptance/release remain pending |
| Current Staging API | Public `/health/live` freshly reports `8434640`, start `2026-10-02T12:58:21.347Z` |
| Current Staging containers | Read-only SSH: API healthy; API/Worker image ID `8089c50e369d`; Worker exited successfully and remains stopped |
| Retained immutable release digest | `sha256:8089c50e369d81d332a9d89e5fdacd5742797b4eb69cabd9abe0ca898ce5b7fb` from deployment/image evidence; shortened live image ID matches |

`8434640` changes exactly two tracked files: `apps/api/src/ai/ai.gateway.ts` and its unit suite. Only the combination Voice + `google/gemini-3.5-flash-lite` + canonical governed provider `google-vertex` omits temperature and emits `provider.only: [google-vertex/global]`. It preserves the canonical schema, original M4A, privacy, parameter requirements, price ceilings and output limits. It does not register/select the model in database configuration.

Later evidence supersedes the earlier SSH-blocked/prepared-only wording inside the same validation report. SSH was restored through the previously approved source-rule replacement; the exact image was deployed, and temporary audited Voice route version 5 selected 3.5 Lite with no application fallback. **This chat made no firewall/configuration change.** The effective route values are retained evidence from that report, not a fresh privileged database snapshot by this chat.

CI was independently re-read through GitHub:

- [37005228835](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/37005228835): completed/success, exact `8434640`.
- [36990569876](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/36990569876): completed/success, exact `288f5c4`.
- [36989207178](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/36989207178): final run conclusion **cancelled**, exact `facd77c`; the historical report describes failed jobs within that run. It is not a successful CI receipt.
- Neither this new AI commit nor onboarding `08fda46` has successful exact-SHA CI established here. No new CI was dispatched.

## Evidence levels

| Level | Established / outstanding |
| --- | --- |
| CODE IMPLEMENTED | Master recorder/transport/Worker/confirmation repairs; 3.5 transport adaptation; new Voice completion-envelope checks |
| AUTOMATED TEST PASSED | Local logic, real disposable SQL/ledger journeys with fake inference, request serialization and compiled one-shot checks listed below |
| CI PASSED | Existing `288f5c4` and `8434640` only; new candidate needs integrated exact-SHA CI |
| DEPLOYED TO STAGING | `8434640` API and matching stopped Worker; new AI and onboarding changes are local only |
| PROVIDER VERIFIED | Historical 2.5 dispatches reached Vertex and failed 400. Public 3.5 capability/ZDR eligibility verified; no successful 3.5 transcript/extraction established |
| PHYSICALLY VERIFIED ON SAMSUNG | Retained native M4A repair and bounded lifecycle observations on `288f5c4`; full provider/review/confirmation acceptance remains absent |
| UNRESOLVED | Historical rejected Vertex field; exact schema translation; bilingual real extraction; actual endpoint evidence; current unattributed quota event; onboarding physical acceptance; combined release |

The latest read of the other chat reports the new owner's welcome step complete and one Voice quota event, with no canary submitted by that agent. It requested attribution from the user. A quota event alone does not establish a provider dispatch, success, language or financial outcome. Do not repeat inference or resume polling to investigate it. Correlate existing session/attempt receipts read-only through the owning workflow first.

## Offline repair and review

The shared gateway previously accepted a successful Voice envelope with missing/non-string model, missing/blank generation ID or absent `finish_reason`. It could replace absent upstream identity with configured/local identifiers and treat unknown completion status as success. Six new RED cases reproduced this; the already-covered wrong-model case remained rejected.

The minimal repair adds Voice-only checks to the existing gateway:

- Require the returned model to equal the dispatched candidate and a nonblank generation ID before creating a trusted receipt. Incomplete identity uses the existing terminal schema error and conservative attempt-hold path; no automatic fallback.
- Require explicit completion status `stop`. Existing truncation/refusal classifications remain; known usage is recorded before rejecting a missing completion status.

Assistant response behavior and all request serialization remain unchanged. No additional logger, dependency, adapter registry, schema translation, retry policy or migration was introduced. `AiWorker.voice()` and `AiWorker.assistant()` are the production gateway callers; the actual Worker authorization/receipt/failure callbacks and restricted SQL attempt functions were inspected before editing.

The existing primary-envelope regression now covers fabricated English and Arabic canonical outputs. Its expense fixture was corrected from `-1500` to **`1500`**: Masarifi's canonical sign is positive expense / negative income, as implemented in confirmation normalization and SQL. The historical synthetic-canary report/harness must reconcile that expectation before claiming financial correctness. Those other-chat files were preserved, not overwritten. Offline language fixtures prove transport/parser behavior, not model accuracy.

The canonical `VOICE_OUTPUT_SCHEMA` remains unchanged: closed objects, numeric/string constants, root `oneOf`, enums, nullable optional values, money/alias patterns and required branch properties. The retained official Google reference-converter rejection is evidence about that converter; it does not identify OpenRouter's native translation or the historical 2.5 rejected field. No speculative schema rewrite is justified.

Actual endpoint identity still needs an independent upstream receipt. The completion's `provider` remains the canonical dispatch candidate, so neither that field nor a successful pinning unit test independently proves the selected upstream endpoint.

Fresh unauthenticated metadata still reports exact endpoint `google-vertex/global`, status 0, structured-output parameters and no temperature parameter; the exact model/tag pair remains in the ZDR catalog. [Endpoint metadata](https://openrouter.ai/api/v1/models/google/gemini-3.5-flash-lite/endpoints), [ZDR catalog](https://openrouter.ai/api/v1/endpoints/zdr). Google documents M4A audio and structured output, with custom temperature values unsupported/ignored. Full endpoint slugs constrain the selected variant, while base slugs span variants. [Google model contract](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash-lite), [OpenRouter routing](https://openrouter.ai/docs/guides/routing/provider-selection). These are eligibility facts, not inference evidence.

## Verification

| Gate | Result / limits |
| --- | --- |
| New focused RED | Six malformed Voice responses incorrectly resolved; wrong-model variant already rejected |
| Final gateway suite | 45 tests passed, including EN/AR canonical fixtures, identity/completion rejection, accounting ordering, sibling serialization and privacy diagnostics |
| Broad API unit/contract/security | 248 suites / 1,406 tests passed, 1 suite / 8 tests skipped; before the subsequent test-only Arabic fixture addition |
| Fresh AI/ledger database gate | 24 suites / 103 tests passed, 1 suite / 4 tests skipped |
| Compiled Worker/gateway one-shot | Real fictional English M4A, fake dependencies/upstream: 400 terminal, 503 retry-pending, missing usage terminal; each one intercepted dispatch and no polling; zero inference |
| API typecheck / changed-file lint / format | Passed |
| API/Worker/migration build | Passed on retry |
| Migration checksums / diff whitespace | Passed; AI branch changes no migrations |
| Clean-code/test review | Scoped trust-boundary guards; terminal failures; no new abstractions or content logging; fake HTTP boundary and existing canonical parser retained |

Database fixtures: separate loopback PostgreSQL 18.6 databases `voice_parallel_check` and `voice_parallel_final`, with a separate local disposable test principal. The final database applied all 78 existing migrations, latest `20261001211129`. No other chat's fixture database was reset or edited. Storage HTTP/upstream are fake in these local journeys; no hosted Supabase test write occurred.

Retained non-green receipts:

- Initial AI/ledger run: five failures in unchanged `ledger-read.integration.spec.ts` and `revision.integration.spec.ts`; the two suites subsequently passed independently (9 tests), then the complete fresh gate passed. The first result remains failed; its specific transient cause was not proven.
- Initial build: native Node allocation failure. Retry with bounded process heap and reduced concurrent load passed; no source/configuration guard was weakened.
- A second-database test run was started despite a bootstrap failure caused by an incorrect fixture URL replacement. Its 21 failing suites are invalid application verification. The setup mistake was corrected, all 78 migrations independently confirmed, and the real final gate then passed.

Logs and reusable offline checks are retained only in this worktree's ignored `.superpowers/sdd/2026-10-02-ai-voice-continuation/`. No raw customer audio, transcripts, credentials or financial identifiers were copied into this report. The copied English audio is the pre-existing fictional local SAPI fixture.

Reproduce focused checks from `apps/api`:

```powershell
node node_modules/jest/bin/jest.js --selectProjects unit --runInBand --runTestsByPath test/unit/ai/ai-gateway.spec.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/ai/ai.gateway.ts test/unit/ai/ai-gateway.spec.ts
```

## Parallel safety and next gates

Onboarding `08fda46` touches identity repository/service, a new identity integration suite, Mobile auth service/tests, its report, migration checksums and `20261002134352_authenticated_profile_bootstrap.sql`. The new AI commit touches only the gateway and its unit suite. **No file overlap.** Read-only `git merge-tree --write-tree` between both commits exited 0, producing preview tree `3527d55ed5a452a0a910027fc78230be836ad0f2`; neither branch nor checkout was integrated. This proves merge compatibility, not combined runtime correctness.

Safe offline work completed: independent checkpoint recovery, scoped completion repair, serialization/canonical/security regressions, separate real-database verification, compiled one-dispatch failure checks and conflict preview. Remaining offline work depends on the finalized onboarding source: integrate that exact commit once in this dedicated branch, apply its migration to a fresh disposable fixture, run combined identity/auth/AI/ledger gates, review the final candidate and run required exact-SHA CI. No need to reopen the physically proven recorder/M4A repair.

Before shared Staging work:

1. Resolve attribution of the existing new quota event and confirm current eligible jobs/polling state without creating work.
2. Confirm onboarding's final accepted commit; reconcile safely, review any later conflicts and produce one combined SHA. Never deploy over a newer onboarding release or install an older APK.
3. Run combined regression gates and exact-SHA CI, retain its immutable image digest, then obtain the required shared release authorization. Historical `8434640` CI cannot qualify the combined SHA.
4. Freshly verify route/prompt/flags, exact endpoint/ZDR availability, existing $2 limits, actual allowance/unknown holds and owner references. Preserve unknown reservations; no fallback, credential or privacy change.
5. Only after onboarding integration/physical gate and release authorization, run one English fictional M4A through normal authenticated admission/upload, real Worker and exact primary endpoint. Require transcript, correct language/amount/sign/currency/date/references, canonical result, reviewable proposal, one dispatch, known bounded usage/cost and zero financial mutation. Cancel/reconcile before restoring polling.
6. Arabic gets one equivalent dispatch only after every English gate passes. No financial confirmation. Stop on opaque 400, routing/privacy/accounting/output failures or multiple dispatches; do not automatically try 3.1.
7. If 3.5 repeats opaque Vertex 400, return to the retained content-free provider/schema translation investigation. Qualified fallback requires a separate explicit decision and endpoint mapping review; its activation is not part of this candidate.
8. Samsung lifecycle and bilingual Voice acceptance follow both synthetic successes and onboarding integration. Explicit exactly-once financial confirmation remains a separate approval checkpoint.

Historical source reports remain preserved in the other worktree: `2026-10-02-master-voice-repair-implementation.md`, `2026-10-02-voice-t08-continuation.md`, `2026-10-02-voice-staging-acceptance.md`, `2026-10-02-voice-vertex-focused-rca.md`, `2026-10-02-voice-model-provider-research.md`, `2026-10-02-voice-35-lite-staging-validation.md`, plus the original Master Plan, handoffs and ignored progress/receipts. Their status sentences must be interpreted in evidence order, not copied as current release claims.
