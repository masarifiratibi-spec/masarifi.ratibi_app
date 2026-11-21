# Vertex Voice schema: offline repair and acceptance boundary

Date: 2026-10-03, Asia/Riyadh. Base: `34484cad65bfb1f2798493e6df86ce24627a3893`. Branch: `codex/ai-voice-continuation`.

**Status: offline implementation reviewed and locally verified; exact-SHA CI is the next gate. No deployment or new inference. Provider acceptance remains unverified.**

## Diagnosis and evidence limits

The approved differential used identical fictional English M4A, model, pinned endpoint, prompt/context, privacy, limits and other request dimensions. No structured output returned HTTP 200. A minimal strict required-boolean object also returned HTTP 200 with valid JSON. The full canonical Voice schema previously returned HTTP 400 / INVALID_ARGUMENT. The successful diagnostic responses were deliberately rejected by canonical business validation; neither produced a proposal or transaction.

This strongly isolates the complex schema or its translation/interaction. It does **not** isolate a particular keyword or prove which Google schema API OpenRouter used. No new paid experiment was used to choose this repair. The repair removes the entire avoidable union/constraint translation dependency while retaining structured output and the full canonical validation boundary.

Canonical schema SHA256 remains `c716fc1a49dc2aa0689963a12a53f53f68857a4c3b3e407ae54800a03e50501a`. The canonical schema, parser, Worker, Mobile, database migrations, policy/configuration, published prompt and deployment files are unchanged by this candidate.

Historical probe receipts are preserved in `2026-10-02-flash-lite-structured-output-differential.md`: A generation `gen-1790966589-DdLi6apTBMXkiA3UY8X5`, cost $0.00050800; B generation `gen-1790966769-zDTOkb6pZVLTAsZMZ17u`, cost $0.00030650. Earlier full-schema rejection: `gen-1790963549-T3b89n7AklVnd7g59TLP`, cost unknown, hold retained.

## Offline construct audit

Google's current structured-output guide explicitly includes Gemini 3.5 Flash-Lite. It describes a restricted schema surface and possible complexity-related 400s. Its typed schema interface and its JSON-schema interface must be distinguished. The separate Gemini JSON-schema documentation accepts constructs that the typed interface does not expose. OpenRouter documents the strict wrapper, but not its exact downstream Vertex translation. [Google structured output](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output), [Google typed schema](https://cloud.google.com/vertex-ai/generative-ai/docs/reference/rest/v1/Schema), [Gemini JSON schema](https://ai.google.dev/gemini-api/docs/structured-output), [OpenRouter strict output](https://openrouter.ai/docs/guides/features/structured-outputs).

| Current canonical construct | Classification and decision for this transport |
| --- | --- |
| Root `oneOf` with branch-specific requirements | Not a typed Vertex Schema field. Gemini's JSON-schema dialect documents it with anyOf semantics. Actual OpenRouter dialect is unknown. Replace with one flat outcome and explicit server branch checks. It is a suspect, not a proven individually rejected field. |
| `const` for versions, transaction type and branch outcome | Not a typed Vertex Schema field. Do not depend on conversion of const-only untyped nodes. Remove constant metadata from model output and construct the fixed supported canonical version/type in trusted code. Validate outcome separately. |
| Nullable `type: ['string','null']` | Does not fit typed Vertex's scalar type; nullable conversion is needed there. JSON-schema dialect supports null unions. Replace optional text with explicit empty-string sentinels. No claim that null itself caused the observed 400. |
| Category nested `anyOf` | AnyOf is documented on the restricted surface. The nested string-pattern/null combination still adds translation complexity. Replace with one string, converting only exact empty string to null. |
| Untyped string enums | The values are legitimate string enums, but the canonical nodes omit explicit types. Transport supplies explicit string types for outcome and language only. Unsupported reason remains a described string and is restricted by canonical validation. |
| Amount, currency and reference `pattern` | Avoid relying on provider regex enforcement; it is outside the guide's listed restricted fields. All unchanged canonical regex, safe-integer and reference checks remain authoritative. |
| `minimum`/`maximum` for confidence | Documented; not inherently incompatible. Remove from transport to reduce constraints; unchanged canonical checks enforce finite values in [0,1]. |
| Transcript/text `maxLength` | Not in the guide's restricted-field list. Keep every canonical byte/text/control-character limit on the server. |
| Date `format: date` | Documented; not inherently incompatible. Transport describes YYYY-MM-DD and capture context; canonical calendar validation remains unchanged. |
| `additionalProperties: false` at root and proposal | The minimal strict probe already accepted it through this exact route. Retain it at the single transport root, and independently reject extra fields in normalization and canonical validation. Do not infer native enforcement from acceptance. |
| Common required fields plus optional proposal/reason with conditional required fields | Replace conditional structure with all 13 fields required. Explicit branch invariants are checked locally. |
| Supported/unsupported discriminated branches | Preserve both outcomes and all four unsupported reasons. An unsupported result must have no financial content; it cannot become a transaction. |
| Nested proposal object and nested nullable union | Flatten only the transport. Reconstruct the original canonical nested proposal after type and branch checks. |

The earlier retained offline Google discovery/SDK conversion audit independently found root oneOf and const nodes surviving a conversion that otherwise adapted nullable types. That demonstrates a typed-wire incompatibility **if that conversion is the downstream path**. It does not establish OpenRouter's actual conversion or the exact upstream rejected field. No regression is mislabeled as a reproduction of Google's opaque 400.

## Provider-facing design and canonical mapping

Two production files change: new `apps/api/src/ai/voice-provider-schema.ts` and a small integration in `apps/api/src/ai/ai.gateway.ts`. Reuse the existing exact workload/model/provider predicate; apply this transport only to Voice + `google/gemini-3.5-flash-lite` + `google-vertex`. Other dispatch candidates and unrelated workloads retain their original schema and parser behavior.

`VERTEX_VOICE_OUTPUT_SCHEMA` is one closed object with **13 required primitive fields**. Its only field-level keywords are type, short string enums and descriptions. There are no unions, const nodes, null types, nesting, patterns, formats, range or length constraints. Simplicity is structural, not minimum byte count: descriptions make the current schema 1,386 UTF-8 bytes. SHA256: `1b256ea35d6373934fd2dd340a2dc2b6b62a2fc136fa931dc5fa0e9d17cf85c4`.

| Transport field/type | Unchanged canonical destination / rule |
| --- | --- |
| outcome, string enum | root outcome, supported or unsupported |
| transcript, string | root transcript, without trimming or rewriting |
| language, string enum | root ar/en independently of UI locale |
| confidence, number | root transcript confidence |
| unsupportedReason, string | unsupported root reason; exact empty string required for supported |
| amountMinor, string | proposal amountMinor unchanged; expense positive, income negative |
| currency, string | proposal currency unchanged |
| accountId, string | proposal account alias unchanged; never default or infer an account |
| categoryId, string | proposal category; exact empty string maps to null |
| date, string | proposal calendar date unchanged |
| merchant, string | proposal merchant; exact empty string maps to null |
| note, string | proposal note; exact empty string maps to null |
| proposalConfidence, number | proposal confidence; exactly zero required when unsupported |

Normalization requires an object with exactly those own fields, primitive strings and finite primitive numbers. Supported output requires an empty unsupportedReason. It constructs schemaVersion=1 and proposal schemaVersion=1/type=transaction.create, then calls the existing `parseVoiceWorkerOutput`. Unsupported output requires all seven financial strings to be exactly empty and proposalConfidence=0, constructs no proposal, then calls the same parser. Extra keys are rejected rather than silently stripped.

Only category/merchant/note empty sentinels become null. There is no amount conversion, sign inference, rounding, currency correction, alias guessing, date recalculation, numeric coercion, confidence clamp or branch guessing. Blank merchant/note collapse to null; this intentionally does not preserve the canonical distinction between an empty optional string and null. Nonblank optional values and every financial value are preserved exactly.

The gateway then invokes its original caller-supplied parser; the Worker still supplies the canonical parser. Model output remains untrusted. Successful JSON/schema conformance alone cannot create a proposal. Existing alias resolution, owner/currency/category checks, SQL validation, review and explicit confirmation remain in their original paths. Canonical validation is not replaced by the weaker provider schema.

Existing `strict:true`, pinned `google-vertex/global`, no fallback, ZDR, data_collection=deny, max-price/token/deadline controls, omitted temperature, refusal/truncation checks, safe diagnostics and accounting-before-business-parse are untouched. M4A/AAC recording and Worker byte/container/hash checks are untouched. No new dependency, framework, configuration, native change or migration.

The active published prompt was inspected read-only using content-free structural checks: one approved prompt, no explicit canonical field-key instructions or JSON example. It was not edited/exported. This reduces a known shape-conflict risk; model adherence to the new fields/sentinels remains a canary acceptance question.

## RED/GREEN, regressions and independent review

RED: existing English and Arabic Gemini 3.5 gateway contract tests were changed to return the intended flat provider response. The old gateway rejected both with AI_SCHEMA_INVALID. This establishes the missing transport/normalization behavior, not the exact historical upstream 400 keyword. Setup/import errors were not counted as RED evidence.

GREEN and fresh verification:

- Focused provider-schema/normalization and gateway: **2 suites, 109 tests passed**. Additional existing canonical/Worker tests were exercised in the broad run.
- API unit/contract/security: **249 suites, 1,491 tests passed**, eight existing skipped tests recorded separately.
- All AI/ledger database integration paths on a newly created loopback-only disposable database with all **78 repository migrations**: **24 suites, 103 tests passed**; four API-only role checks initially skipped for lack of their dedicated connection.
- Those four restricted-role checks subsequently ran with a local API-only login: **4/4 passed**, including inability to SET Worker role. No required AI/ledger case remains unexecuted locally.
- Real offline journey uses API serialization, Worker orchestration, flat fake provider output, canonical parsing, Mobile contracts and ledger mutation/replay. Arabic expense uses positive minor units; English income uses negative minor units; balances change in the correct direction. Cancellation creates no transaction; repeated confirmation resolves to the same local transaction.
- Typecheck, full API lint, changed-file formatting, all API/Worker/migration builds, migration checksums and git diff whitespace passed.

Malformed/adversarial coverage includes missing/inherited/prototype/extra fields, nonobjects, wrong primitive types, unsafe positive/negative integers, zero/decimal/leading-zero/plus/whitespace amounts, wrong currency/reference types, impossible dates, invalid language/outcome, NaN/Infinity/out-of-range confidence, null text, control characters, text/UTF-8 size limits, conflicting supported reason, every unsupported reason, financial data smuggled into unsupported output and extra action/tool/authorization fields. Existing refusal/truncation/accounting tests still pass.

Independent read-only review found no production blocker. It found a local test catalogue isolation issue: fixture pricing could survive cleanup. Corrected by INSERT ON CONFLICT DO NOTHING, tracking only a newly inserted model, restoring route fields first, then deleting only that fixture. Existing catalogue prices are never overwritten. Reviewer rechecked and approved the offline scope. Fresh migrations removed stale earlier fixtures that caused two unrelated Admin AI regression failures; the unchanged tests then passed. No production workaround was added for those fixture failures.

Local PostgreSQL lacks a full running Supabase stack. The repository's exact-SHA CI supplies its broader real Supabase/migration/container/application gates. Independent review and local tests do not establish upstream provider acceptance.

## Read-only Staging/accounting snapshot

Snapshot: 2026-10-03 00:44:12 Riyadh / 2026-10-02T21:44:12Z.

- Owner Voice quota: **4/5** in the rolling window; zero eligible jobs.
- Four failed unknown-cost provider attempts: **$0.52640000** reserved holds; billed cost unknown. Unchanged; no manual release.
- Two completed diagnostic attempts: total actual **$0.00081450**; normal reservation reconciliation completed.
- Global budget: **$2**. Staging key limit: **$2**, usage **$0.00148775**, remaining **$1.99851225**; key metadata HTTP200; zero inference requests in this inspection.
- Voice route5 remains enabled: Gemini 3.5 Flash-Lite / Google Vertex, empty fallbacks, ZDR required, approved no-training provider, approved audio/structured-output model, published approved prompt1. Price ceilings prompt1/completion3 per million, output1200, timeout120s unchanged.
- Provider, safety, unrelated-route and prompt fingerprints match the prior differential preflight.
- Test owner transactions **0**, confirmed balance **0**. No financial/reference/profile mutation in Staging.
- Accepted onboarding API remains healthy at SHA5113fb7046372183fea4f8a8b1e23a9ec947dcd2. Ordinary Worker remains Created/stopped. No Production action.

## Exact proposed next English canary — NOT AUTHORIZED OR EXECUTED

After explicit approval, and only after this repair's exact-SHA CI is green:

1. Recheck current rolling quota, $2 key/global admission, held amounts, route/prompt/provider/privacy fingerprints, accepted API provenance and absence of eligible unrelated jobs. Existing unknown holds stay reserved. If admission fails, stop; do not free holds or increase limits.
2. Use the **existing fictional English M4A**, 50,528 bytes / 3,969ms, SHA256 `8e7d2b519d8e6683e043593d4940e2b4ce751b3fa4b315067990b700ebe3b5f3`. No microphone, Samsung or newly generated media. Use the verified existing owner and SAR cash reference; create no financial reference.
3. Run one exact-target, one-shot Worker from the new immutable tested image against that normally authenticated create/upload/process session. Preserve the accepted onboarding API; do not replace it with an AI-only image or start a polling Worker. Do not modify the outgoing envelope in a diagnostic fetcher: this test must exercise the production provider schema and normalizer.
4. Mechanically guard a **maximum of one forwarded provider dispatch** and the exact M4A hash, strict schema hash above, model/global pin, privacy, no fallback and existing limits. All normal media/lease/admission/accounting paths must execute. The prior A/B harness rewrites response_format and is unsuitable for this acceptance.
5. Require complete non-refused HTTP200, verified actual approved dated model/global path, untruncated flat JSON, successful normalization and unchanged canonical validation, correct fictional transcript/extraction/references/date/sign, and a persisted reviewable proposal. An HTTP200 alone fails acceptance.
6. Correlate generation ID, one attempt, actual token/cost receipt, one owner quota event and normal PROCESS reservation reconciliation. If quota is still4, this uses the fifth event. Existing per-attempt estimate is $0.1316; combined unknown holds plus the new reservation would be $0.6580 before normal reconciliation, not an actual bill. Unknown accounting is a stop condition; never release a hold manually.
7. Stop on any opaque400, wrong routing/model/privacy, malformed/refused/truncated response, canonical/semantic validation failure, second dispatch attempt or unknown cost. No retry, fallback, Arabic, Samsung, schema experiment or model switch follows automatically.
8. **No Confirm.** Assert zero financial mutation, preserve metadata-only receipt, then use ordinary explicit Cancel/discard after capturing review evidence and verify cancellation/media cleanup. Stop and report.

No paid canary has been run for this repair. T08/provider release acceptance and the Master Plan remain incomplete until authorized provider and later physical acceptance succeed.

## Exact-SHA CI receipt

Candidate commit, CI URL/result and immutable image digest will be recorded in a separate post-run evidence receipt so that the tested code SHA cannot drift while documenting its own verification.
